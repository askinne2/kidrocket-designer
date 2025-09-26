/**
 * Auth Service Tests
 * 
 * Unit tests for the authentication service.
 * Tests core business logic including registration, login, password management.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/auth.service';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { EmailService } from '@/infrastructure/email/email.service';
import { CacheService } from '@/infrastructure/cache/cache.service';
import { Logger } from '@/infrastructure/logging/logger';
import { 
  RegisterRequest, 
  LoginRequest,
  UserRole,
  User 
} from '@/shared/types/auth';
import { AppError, ErrorCode } from '@/shared/types/common';

// Mock external dependencies
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

// Mock service dependencies
const mockUserRepository = {
  create: jest.fn(),
  findByEmail: jest.fn(),
  findByUsername: jest.fn(),
  findById: jest.fn(),
  updateLastLogin: jest.fn(),
  updatePassword: jest.fn(),
  setPasswordResetToken: jest.fn(),
  findByPasswordResetToken: jest.fn(),
  resetPassword: jest.fn(),
  setEmailVerificationToken: jest.fn(),
  findByEmailVerificationToken: jest.fn(),
  verifyEmail: jest.fn()
} as jest.Mocked<UserRepository>;

const mockSessionRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  updateLastAccessed: jest.fn(),
  deactivate: jest.fn(),
  deactivateAllForUser: jest.fn()
} as jest.Mocked<SessionRepository>;

const mockEmailService = {
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn()
} as jest.Mocked<EmailService>;

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn()
} as jest.Mocked<CacheService>;

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
} as jest.Mocked<Logger>;

describe('AuthService', () => {
  let authService: AuthService;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    displayName: 'Test User',
    password: 'hashedPassword123',
    role: UserRole.CHILD,
    isEmailVerified: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  };

  const mockContext = {
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 (Test Browser)'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create service instance with mocked dependencies
    authService = new (AuthService as any)(
      mockUserRepository,
      mockSessionRepository,
      mockEmailService,
      mockCacheService,
      mockLogger
    );

    // Set up JWT environment variables
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  describe('register', () => {
    const validRegisterRequest: RegisterRequest = {
      email: 'newuser@example.com',
      username: 'newuser',
      displayName: 'New User',
      password: 'StrongPassword123!',
      acceptsTerms: true
    };

    it('should register a new user successfully', async () => {
      // Mock no existing user
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);

      // Mock password hashing
      mockedBcrypt.hash.mockResolvedValue('hashedPassword123' as never);

      // Mock user creation
      const createdUser = {
        ...mockUser,
        id: 'new-user-123',
        email: validRegisterRequest.email,
        username: validRegisterRequest.username,
        displayName: validRegisterRequest.displayName,
        password: 'hashedPassword123'
      };
      mockUserRepository.create.mockResolvedValue(createdUser);

      // Mock session creation
      const mockSession = {
        id: 'session-123',
        userId: createdUser.id,
        deviceInfo: {
          type: 'desktop' as const,
          os: 'Unknown',
          browser: 'Unknown',
          fingerprint: 'test-fingerprint'
        },
        ipAddress: mockContext.ipAddress,
        userAgent: mockContext.userAgent,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isActive: true
      };
      mockSessionRepository.create.mockResolvedValue(mockSession);

      // Mock JWT token generation
      mockedJwt.sign
        .mockReturnValueOnce('mock-access-token' as never)
        .mockReturnValueOnce('mock-refresh-token' as never);

      // Mock email service
      mockEmailService.sendEmailVerification.mockResolvedValue(undefined);
      mockUserRepository.setEmailVerificationToken.mockResolvedValue(undefined);

      const result = await authService.register(validRegisterRequest, mockContext);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validRegisterRequest.email);
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith(validRegisterRequest.username);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(validRegisterRequest.password, 12);
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: validRegisterRequest.email,
          username: validRegisterRequest.username,
          displayName: validRegisterRequest.displayName,
          password: 'hashedPassword123',
          role: UserRole.CHILD,
          isEmailVerified: false
        })
      );
      expect(mockSessionRepository.create).toHaveBeenCalled();
      expect(mockedJwt.sign).toHaveBeenCalledTimes(2);
      expect(mockEmailService.sendEmailVerification).toHaveBeenCalled();

      expect(result).toEqual({
        user: expect.objectContaining({
          id: createdUser.id,
          email: createdUser.email,
          username: createdUser.username
        }),
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 15 * 60
      });

      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw error if email already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(authService.register(validRegisterRequest, mockContext))
        .rejects
        .toThrow(AppError);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if username already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);

      await expect(authService.register(validRegisterRequest, mockContext))
        .rejects
        .toThrow(AppError);

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should determine parent role for users 18+', async () => {
      const adultRegisterRequest = {
        ...validRegisterRequest,
        dateOfBirth: '1990-01-01' // 34 years old
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashedPassword123' as never);

      const createdUser = { ...mockUser, role: UserRole.PARENT };
      mockUserRepository.create.mockResolvedValue(createdUser);

      const mockSession = {
        id: 'session-123',
        userId: createdUser.id,
        deviceInfo: {
          type: 'desktop' as const,
          os: 'Unknown',
          browser: 'Unknown',
          fingerprint: 'test-fingerprint'
        },
        ipAddress: mockContext.ipAddress,
        userAgent: mockContext.userAgent,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isActive: true
      };
      mockSessionRepository.create.mockResolvedValue(mockSession);

      mockedJwt.sign
        .mockReturnValueOnce('mock-access-token' as never)
        .mockReturnValueOnce('mock-refresh-token' as never);

      mockEmailService.sendEmailVerification.mockResolvedValue(undefined);
      mockUserRepository.setEmailVerificationToken.mockResolvedValue(undefined);

      await authService.register(adultRegisterRequest, mockContext);

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.PARENT
        })
      );
    });
  });

  describe('login', () => {
    const validLoginRequest: LoginRequest = {
      email: 'test@example.com',
      password: 'StrongPassword123!'
    };

    it('should login user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockCacheService.get.mockResolvedValue(null); // No account lock

      const mockSession = {
        id: 'session-123',
        userId: mockUser.id,
        deviceInfo: {
          type: 'desktop' as const,
          os: 'Unknown',
          browser: 'Unknown',
          fingerprint: 'test-fingerprint'
        },
        ipAddress: mockContext.ipAddress,
        userAgent: mockContext.userAgent,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isActive: true
      };
      mockSessionRepository.create.mockResolvedValue(mockSession);

      mockedJwt.sign
        .mockReturnValueOnce('mock-access-token' as never)
        .mockReturnValueOnce('mock-refresh-token' as never);

      mockUserRepository.updateLastLogin.mockResolvedValue(undefined);

      const result = await authService.login(validLoginRequest, mockContext);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(validLoginRequest.email);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(validLoginRequest.password, mockUser.password);
      expect(mockCacheService.get).toHaveBeenCalledWith(`auth:locked:${mockUser.id}`);
      expect(mockSessionRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);

      expect(result).toEqual({
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username
        }),
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 15 * 60
      });

      expect(result.user).not.toHaveProperty('password');
    });

    it('should throw error for non-existent user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(validLoginRequest, mockContext))
        .rejects
        .toThrow(new AppError('Invalid credentials', ErrorCode.INVALID_CREDENTIALS, 401));

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw error for invalid password', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(authService.login(validLoginRequest, mockContext))
        .rejects
        .toThrow(new AppError('Invalid credentials', ErrorCode.INVALID_CREDENTIALS, 401));

      expect(mockSessionRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for locked account', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockCacheService.get.mockResolvedValue('locked'); // Account is locked

      await expect(authService.login(validLoginRequest, mockContext))
        .rejects
        .toThrow(new AppError('Account temporarily locked due to security reasons', ErrorCode.FORBIDDEN, 403));

      expect(mockSessionRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockPayload = {
        userId: mockUser.id,
        tokenId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
      };

      mockedJwt.verify.mockReturnValue(mockPayload as never);

      const mockSession = {
        id: 'session-123',
        userId: mockUser.id,
        deviceInfo: {
          type: 'desktop' as const,
          os: 'Unknown',
          browser: 'Unknown',
          fingerprint: 'test-fingerprint'
        },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isActive: true
      };

      mockSessionRepository.findById.mockResolvedValue(mockSession);
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockedJwt.sign.mockReturnValue('new-access-token' as never);
      mockSessionRepository.updateLastAccessed.mockResolvedValue(undefined);

      const result = await authService.refreshToken(refreshToken);

      expect(mockedJwt.verify).toHaveBeenCalledWith(refreshToken, 'test-refresh-secret');
      expect(mockSessionRepository.findById).toHaveBeenCalledWith('session-123');
      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(mockedJwt.sign).toHaveBeenCalled();
      expect(mockSessionRepository.updateLastAccessed).toHaveBeenCalledWith('session-123');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        expiresIn: 15 * 60
      });
    });

    it('should throw error for invalid token', async () => {
      const refreshToken = 'invalid-refresh-token';
      
      mockedJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      await expect(authService.refreshToken(refreshToken))
        .rejects
        .toThrow(new AppError('Invalid refresh token', ErrorCode.TOKEN_INVALID, 401));
    });

    it('should throw error for inactive session', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockPayload = {
        userId: mockUser.id,
        tokenId: 'session-123',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
      };

      mockedJwt.verify.mockReturnValue(mockPayload as never);

      const inactiveSession = {
        id: 'session-123',
        userId: mockUser.id,
        deviceInfo: {
          type: 'desktop' as const,
          os: 'Unknown',
          browser: 'Unknown',
          fingerprint: 'test-fingerprint'
        },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000), // Expired
        isActive: false
      };

      mockSessionRepository.findById.mockResolvedValue(inactiveSession);

      await expect(authService.refreshToken(refreshToken))
        .rejects
        .toThrow(new AppError('Invalid refresh token', ErrorCode.TOKEN_INVALID, 401));
    });
  });

  describe('changePassword', () => {
    const changePasswordRequest = {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword456!'
    };

    it('should change password successfully', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('newHashedPassword' as never);
      mockUserRepository.updatePassword.mockResolvedValue(undefined);
      mockSessionRepository.deactivateAllForUser.mockResolvedValue(undefined);

      await authService.changePassword(mockUser.id, changePasswordRequest);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(changePasswordRequest.currentPassword, mockUser.password);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(changePasswordRequest.newPassword, 12);
      expect(mockUserRepository.updatePassword).toHaveBeenCalledWith(mockUser.id, 'newHashedPassword');
      expect(mockSessionRepository.deactivateAllForUser).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw error for incorrect current password', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(authService.changePassword(mockUser.id, changePasswordRequest))
        .rejects
        .toThrow(new AppError('Current password is incorrect', ErrorCode.INVALID_CREDENTIALS, 400));

      expect(mockUserRepository.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const token = 'valid-jwt-token';
      const mockPayload = {
        userId: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 15 * 60
      };

      mockedJwt.verify.mockReturnValue(mockPayload as never);
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.verifyToken(token);

      expect(mockedJwt.verify).toHaveBeenCalledWith(token, 'test-jwt-secret');
      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockUser);
    });

    it('should throw error for invalid token', async () => {
      const token = 'invalid-jwt-token';
      
      mockedJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      await expect(authService.verifyToken(token))
        .rejects
        .toThrow(new AppError('Invalid token', ErrorCode.TOKEN_INVALID, 401));
    });

    it('should throw error if user not found', async () => {
      const token = 'valid-jwt-token';
      const mockPayload = {
        userId: 'non-existent-user',
        email: 'test@example.com',
        role: UserRole.CHILD,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 15 * 60
      };

      mockedJwt.verify.mockReturnValue(mockPayload as never);
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.verifyToken(token))
        .rejects
        .toThrow(new AppError('User not found', ErrorCode.NOT_FOUND, 404));
    });
  });
});

// TODO: Add tests for forgotPassword method
// TODO: Add tests for resetPassword method
// TODO: Add tests for verifyEmail method
// TODO: Add tests for logout method
// TODO: Add tests for getCurrentUser method
// TODO: Add tests for device fingerprinting
// TODO: Add tests for session security features
// TODO: Add performance tests for token operations
