/**
 * Authentication Service
 * 
 * Core business logic for user authentication and authorization.
 * Implements secure authentication patterns with proper error handling.
 */

import { inject, injectable } from 'inversify';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { 
  User, 
  RegisterRequest, 
  RegisterResponse,
  LoginRequest, 
  LoginResponse,
  RefreshTokenResponse,
  ChangePasswordRequest,
  JWTPayload,
  RefreshTokenPayload,
  UserRole,
  UserSession,
  DeviceInfo
} from '@/shared/types/auth';
import { AppError, ErrorCode } from '@/shared/types/common';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { EmailService } from '@/infrastructure/email/email.service';
import { CacheService } from '@/infrastructure/cache/cache.service';
import { Logger } from '@/infrastructure/logging/logger';

interface AuthContext {
  ipAddress: string;
  userAgent: string;
}

@injectable()
export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key';
  private readonly JWT_EXPIRES_IN = '15m'; // Short-lived access tokens
  private readonly JWT_REFRESH_EXPIRES_IN = '7d'; // Longer-lived refresh tokens
  private readonly SALT_ROUNDS = 12;

  constructor(
    @inject('UserRepository') private userRepository: UserRepository,
    @inject('SessionRepository') private sessionRepository: SessionRepository,
    @inject('EmailService') private emailService: EmailService,
    @inject('CacheService') private cacheService: CacheService,
    @inject('Logger') private logger: Logger
  ) {}

  /**
   * Register a new user
   */
  async register(request: RegisterRequest, context: AuthContext): Promise<RegisterResponse> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(request.email);
    if (existingUser) {
      throw new AppError('User already exists with this email', ErrorCode.ALREADY_EXISTS, 409);
    }

    const existingUsername = await this.userRepository.findByUsername(request.username);
    if (existingUsername) {
      throw new AppError('Username is already taken', ErrorCode.ALREADY_EXISTS, 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(request.password, this.SALT_ROUNDS);

    // Determine user role based on age (if provided)
    let role = UserRole.CHILD;
    if (request.dateOfBirth) {
      const birthDate = new Date(request.dateOfBirth);
      const age = this.calculateAge(birthDate);
      if (age >= 18) {
        role = UserRole.PARENT;
      }
    }

    // Create user
    const user = await this.userRepository.create({
      email: request.email,
      username: request.username,
      displayName: request.displayName,
      password: hashedPassword,
      dateOfBirth: request.dateOfBirth ? new Date(request.dateOfBirth) : undefined,
      parentEmail: request.parentEmail,
      role,
      isEmailVerified: false
    });

    // Create session
    const deviceInfo = this.parseDeviceInfo(context.userAgent);
    const session = await this.createSession(user.id, deviceInfo, context);

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user, session.id);

    // Send verification email
    await this.sendVerificationEmail(user);

    this.logger.info('User registered successfully', {
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 // 15 minutes in seconds
    };
  }

  /**
   * Login user
   */
  async login(request: LoginRequest, context: AuthContext): Promise<LoginResponse> {
    // Find user by email
    const user = await this.userRepository.findByEmail(request.email);
    if (!user) {
      throw new AppError('Invalid credentials', ErrorCode.INVALID_CREDENTIALS, 401);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(request.password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', ErrorCode.INVALID_CREDENTIALS, 401);
    }

    // Check if account is locked (optional security feature)
    const lockKey = `auth:locked:${user.id}`;
    const isLocked = await this.cacheService.get(lockKey);
    if (isLocked) {
      throw new AppError('Account temporarily locked due to security reasons', ErrorCode.FORBIDDEN, 403);
    }

    // Create session
    const deviceInfo = this.parseDeviceInfo(context.userAgent);
    const session = await this.createSession(user.id, deviceInfo, context);

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user, session.id);

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    this.logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      sessionId: session.id
    });

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 // 15 minutes in seconds
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as RefreshTokenPayload;
      
      // Check if session exists and is active
      const session = await this.sessionRepository.findById(payload.tokenId);
      if (!session || !session.isActive || session.expiresAt < new Date()) {
        throw new AppError('Invalid refresh token', ErrorCode.TOKEN_INVALID, 401);
      }

      // Get user
      const user = await this.userRepository.findById(payload.userId);
      if (!user) {
        throw new AppError('User not found', ErrorCode.NOT_FOUND, 404);
      }

      // Generate new access token
      const accessToken = this.generateAccessToken(user);

      // Update session last accessed
      await this.sessionRepository.updateLastAccessed(session.id);

      return {
        accessToken,
        expiresIn: 15 * 60 // 15 minutes in seconds
      };

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid refresh token', ErrorCode.TOKEN_INVALID, 401);
      }
      throw error;
    }
  }

  /**
   * Logout user (invalidate refresh token)
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as RefreshTokenPayload;
      await this.sessionRepository.deactivate(payload.tokenId);
      
      this.logger.info('User logged out', {
        userId: payload.userId,
        sessionId: payload.tokenId
      });
    } catch (error) {
      // Silently fail for invalid tokens
      this.logger.warn('Failed to logout with invalid token', { error: error.message });
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, request: ChangePasswordRequest): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', ErrorCode.NOT_FOUND, 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(request.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', ErrorCode.INVALID_CREDENTIALS, 400);
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(request.newPassword, this.SALT_ROUNDS);

    // Update password
    await this.userRepository.updatePassword(userId, hashedNewPassword);

    // Invalidate all sessions except current one
    await this.sessionRepository.deactivateAllForUser(userId);

    this.logger.info('Password changed successfully', { userId });
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Don't reveal that user doesn't exist
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token
    await this.userRepository.setPasswordResetToken(user.id, resetToken, resetTokenExpiry);

    // Send reset email
    await this.emailService.sendPasswordResetEmail(user.email, user.displayName, resetToken);

    this.logger.info('Password reset requested', { userId: user.id, email: user.email });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findByPasswordResetToken(token);
    if (!user) {
      throw new AppError('Invalid or expired reset token', ErrorCode.TOKEN_INVALID, 400);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Update password and clear reset token
    await this.userRepository.resetPassword(user.id, hashedPassword);

    // Invalidate all sessions
    await this.sessionRepository.deactivateAllForUser(user.id);

    this.logger.info('Password reset successfully', { userId: user.id });
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<{ userId: string }> {
    const user = await this.userRepository.findByEmailVerificationToken(token);
    if (!user) {
      throw new AppError('Invalid or expired verification token', ErrorCode.TOKEN_INVALID, 400);
    }

    await this.userRepository.verifyEmail(user.id);

    this.logger.info('Email verified successfully', { userId: user.id });

    return { userId: user.id };
  }

  /**
   * Get current user
   */
  async getCurrentUser(userId: string): Promise<Omit<User, 'password'>> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', ErrorCode.NOT_FOUND, 404);
    }

    return this.sanitizeUser(user);
  }

  /**
   * Verify JWT token and return user info
   */
  async verifyToken(token: string): Promise<User> {
    try {
      const payload = jwt.verify(token, this.JWT_SECRET) as JWTPayload;
      const user = await this.userRepository.findById(payload.userId);
      
      if (!user) {
        throw new AppError('User not found', ErrorCode.NOT_FOUND, 404);
      }

      return user;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid token', ErrorCode.TOKEN_INVALID, 401);
      }
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async generateTokens(user: User, sessionId: string): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user.id, sessionId);
    
    return { accessToken, refreshToken };
  }

  private generateAccessToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
    };

    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN });
  }

  private generateRefreshToken(userId: string, sessionId: string): string {
    const payload: RefreshTokenPayload = {
      userId,
      tokenId: sessionId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    };

    return jwt.sign(payload, this.JWT_REFRESH_SECRET, { expiresIn: this.JWT_REFRESH_EXPIRES_IN });
  }

  private async createSession(userId: string, deviceInfo: DeviceInfo, context: AuthContext): Promise<UserSession> {
    const session: Omit<UserSession, 'id' | 'createdAt' | 'lastAccessedAt'> = {
      userId,
      deviceInfo,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      isActive: true
    };

    return await this.sessionRepository.create(session);
  }

  private parseDeviceInfo(userAgent: string): DeviceInfo {
    // Simple user agent parsing - in production, use a proper library like 'ua-parser-js'
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
    const isTablet = /iPad|Tablet/i.test(userAgent);
    
    let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    if (isTablet) deviceType = 'tablet';
    else if (isMobile) deviceType = 'mobile';

    return {
      type: deviceType,
      os: this.extractOS(userAgent),
      browser: this.extractBrowser(userAgent),
      fingerprint: crypto.createHash('sha256').update(userAgent).digest('hex').substring(0, 16)
    };
  }

  private extractOS(userAgent: string): string {
    if (/Windows/i.test(userAgent)) return 'Windows';
    if (/Mac OS/i.test(userAgent)) return 'macOS';
    if (/Linux/i.test(userAgent)) return 'Linux';
    if (/Android/i.test(userAgent)) return 'Android';
    if (/iOS/i.test(userAgent)) return 'iOS';
    return 'Unknown';
  }

  private extractBrowser(userAgent: string): string {
    if (/Chrome/i.test(userAgent)) return 'Chrome';
    if (/Firefox/i.test(userAgent)) return 'Firefox';
    if (/Safari/i.test(userAgent)) return 'Safari';
    if (/Edge/i.test(userAgent)) return 'Edge';
    return 'Unknown';
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  private sanitizeUser(user: User): Omit<User, 'password'> {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.userRepository.setEmailVerificationToken(user.id, verificationToken, verificationExpiry);
    await this.emailService.sendEmailVerification(user.email, user.displayName, verificationToken);
  }
}

// TODO: Add password strength validation
// TODO: Implement account lockout after failed attempts
// TODO: Add two-factor authentication support
// TODO: Implement session management dashboard
// TODO: Add geolocation-based security alerts
// TODO: Implement OAuth providers (Google, Apple, etc.)
// TODO: Add audit logging for all auth events
// TODO: Implement device trust/remember device feature
