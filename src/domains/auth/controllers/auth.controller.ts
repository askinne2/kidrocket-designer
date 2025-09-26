/**
 * Authentication Controller
 * 
 * Handles HTTP requests for user authentication operations.
 * Implements clean architecture patterns with proper separation of concerns.
 */

import { Request, Response, NextFunction } from 'express';
import { inject, injectable } from 'inversify';
import { 
  RegisterRequest, 
  LoginRequest, 
  RefreshTokenRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  ApiResponse 
} from '@/shared/types/auth';
import { AuthService } from '../services/auth.service';
import { ValidationService } from '../services/validation.service';
import { Logger } from '@/infrastructure/logging/logger';
import { RateLimiterService } from '@/infrastructure/security/rate-limiter.service';

@injectable()
export class AuthController {
  constructor(
    @inject('AuthService') private authService: AuthService,
    @inject('ValidationService') private validationService: ValidationService,
    @inject('Logger') private logger: Logger,
    @inject('RateLimiterService') private rateLimiter: RateLimiterService
  ) {}

  /**
   * Register a new user account
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestData: RegisterRequest = req.body;
      
      // Validate input
      const validation = await this.validationService.validateRegistration(requestData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid registration data',
            details: validation.errors
          }
        } as ApiResponse);
        return;
      }

      // Check rate limit
      await this.rateLimiter.checkLimit('register', req.ip, 5, 3600); // 5 attempts per hour

      // Register user
      const result = await this.authService.register(requestData, {
        ipAddress: req.ip || '',
        userAgent: req.get('User-Agent') || ''
      });

      this.logger.info('User registered successfully', {
        userId: result.user.id,
        email: result.user.email,
        ipAddress: req.ip
      });

      res.status(201).json({
        success: true,
        data: result
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestData: LoginRequest = req.body;
      
      // Validate input
      const validation = await this.validationService.validateLogin(requestData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid login data',
            details: validation.errors
          }
        } as ApiResponse);
        return;
      }

      // Check rate limit
      await this.rateLimiter.checkLimit('login', req.ip, 10, 900); // 10 attempts per 15 minutes

      // Authenticate user
      const result = await this.authService.login(requestData, {
        ipAddress: req.ip || '',
        userAgent: req.get('User-Agent') || ''
      });

      // Set secure HTTP-only cookies for tokens
      if (requestData.rememberMe) {
        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }

      this.logger.info('User logged in successfully', {
        userId: result.user.id,
        email: result.user.email,
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        data: result
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestData: RefreshTokenRequest = {
        refreshToken: req.body.refreshToken || req.cookies.refreshToken
      };

      if (!requestData.refreshToken) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'Refresh token is required'
          }
        } as ApiResponse);
        return;
      }

      const result = await this.authService.refreshToken(requestData.refreshToken);

      res.status(200).json({
        success: true,
        data: result
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
      const userId = req.user?.id; // Set by auth middleware

      if (refreshToken) {
        await this.authService.logout(refreshToken);
      }

      // Clear cookies
      res.clearCookie('refreshToken');

      this.logger.info('User logged out', {
        userId,
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully' }
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Change user password
   * POST /api/v1/auth/change-password
   */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestData: ChangePasswordRequest = req.body;
      const userId = req.user?.id; // Set by auth middleware

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        } as ApiResponse);
        return;
      }

      // Validate input
      const validation = await this.validationService.validatePasswordChange(requestData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid password change data',
            details: validation.errors
          }
        } as ApiResponse);
        return;
      }

      await this.authService.changePassword(userId, requestData);

      this.logger.info('Password changed successfully', {
        userId,
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        data: { message: 'Password changed successfully' }
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestData: ForgotPasswordRequest = req.body;

      // Check rate limit
      await this.rateLimiter.checkLimit('forgot-password', req.ip, 3, 3600); // 3 attempts per hour

      await this.authService.forgotPassword(requestData.email);

      // Always return success to prevent email enumeration
      res.status(200).json({
        success: true,
        data: { message: 'If the email exists, a reset link has been sent' }
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password with token
   * POST /api/v1/auth/reset-password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestData: ResetPasswordRequest = req.body;

      // Validate input
      const validation = await this.validationService.validatePasswordReset(requestData);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid password reset data',
            details: validation.errors
          }
        } as ApiResponse);
        return;
      }

      await this.authService.resetPassword(requestData.token, requestData.newPassword);

      this.logger.info('Password reset successfully', {
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        data: { message: 'Password reset successfully' }
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify email address
   * POST /api/v1/auth/verify-email
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestData: VerifyEmailRequest = req.body;

      if (!requestData.token) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'Verification token is required'
          }
        } as ApiResponse);
        return;
      }

      const result = await this.authService.verifyEmail(requestData.token);

      this.logger.info('Email verified successfully', {
        userId: result.userId,
        ipAddress: req.ip
      });

      res.status(200).json({
        success: true,
        data: { message: 'Email verified successfully' }
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   * GET /api/v1/auth/me
   */
  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        } as ApiResponse);
        return;
      }

      const user = await this.authService.getCurrentUser(userId);

      res.status(200).json({
        success: true,
        data: user
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }
}

// TODO: Add OpenAPI documentation decorators
// TODO: Add request/response logging middleware
// TODO: Add input sanitization middleware
// TODO: Consider adding CSRF protection for state-changing operations
// TODO: Add metrics collection for authentication events
