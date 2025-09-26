/**
 * Auth Controller Tests
 * 
 * Unit tests for the authentication controller.
 * Tests all endpoints with various scenarios including success and error cases.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { ValidationService } from '../services/validation.service';
import { Logger } from '@/infrastructure/logging/logger';
import { RateLimiterService } from '@/infrastructure/security/rate-limiter.service';
import { 
  RegisterRequest, 
  LoginRequest, 
  UserRole,
  ApiResponse 
} from '@/shared/types/auth';

// Mock dependencies
const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
  changePassword: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  verifyEmail: jest.fn(),
  getCurrentUser: jest.fn()
} as jest.Mocked<AuthService>;

const mockValidationService = {
  validateRegistration: jest.fn(),
  validateLogin: jest.fn(),
  validatePasswordChange: jest.fn(),
  validatePasswordReset: jest.fn()
} as jest.Mocked<ValidationService>;

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
} as jest.Mocked<Logger>;

const mockRateLimiter = {
  checkLimit: jest.fn()
} as jest.Mocked<RateLimiterService>;

// Mock Express objects
const mockRequest = (body: any = {}, headers: any = {}, ip: string = '127.0.0.1') => ({
  body,
  ip,
  get: jest.fn((header: string) => headers[header]),
  user: undefined,
  cookies: {}
} as unknown as Request);

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn() as NextFunction;

describe('AuthController', () => {
  let authController: AuthController;
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create controller instance with mocked dependencies
    authController = new (AuthController as any)(
      mockAuthService,
      mockValidationService,
      mockLogger,
      mockRateLimiter
    );

    res = mockResponse();
    next = mockNext;
  });

  describe('register', () => {
    const validRegisterRequest: RegisterRequest = {
      email: 'test@example.com',
      username: 'testuser',
      displayName: 'Test User',
      password: 'StrongPassword123!',
      acceptsTerms: true
    };

    it('should register a new user successfully', async () => {
      req = mockRequest(validRegisterRequest);
      
      // Mock successful validation
      mockValidationService.validateRegistration.mockResolvedValue({
        isValid: true,
        errors: []
      });

      // Mock successful rate limiting
      mockRateLimiter.checkLimit.mockResolvedValue(undefined);

      // Mock successful registration
      const mockUser = {
        id: 'user-123',
        email: validRegisterRequest.email,
        username: validRegisterRequest.username,
        displayName: validRegisterRequest.displayName,
        role: UserRole.CHILD,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockRegistrationResult = {
        user: mockUser,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 900
      };

      mockAuthService.register.mockResolvedValue(mockRegistrationResult);

      await authController.register(req, res, next);

      expect(mockValidationService.validateRegistration).toHaveBeenCalledWith(validRegisterRequest);
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('register', '127.0.0.1', 5, 3600);
      expect(mockAuthService.register).toHaveBeenCalledWith(
        validRegisterRequest,
        expect.objectContaining({
          ipAddress: '127.0.0.1',
          userAgent: undefined
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockRegistrationResult
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User registered successfully',
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
          ipAddress: '127.0.0.1'
        })
      );
    });

    it('should return validation error for invalid data', async () => {
      req = mockRequest({ ...validRegisterRequest, email: 'invalid-email' });
      
      mockValidationService.validateRegistration.mockResolvedValue({
        isValid: false,
        errors: [{
          field: 'email',
          message: 'Please enter a valid email address',
          code: 'INVALID_EMAIL'
        }]
      });

      await authController.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid registration data',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: 'Please enter a valid email address'
            })
          ])
        }
      });
      expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('should handle rate limiting', async () => {
      req = mockRequest(validRegisterRequest);
      
      mockValidationService.validateRegistration.mockResolvedValue({
        isValid: true,
        errors: []
      });

      const rateLimitError = new Error('Rate limit exceeded');
      mockRateLimiter.checkLimit.mockRejectedValue(rateLimitError);

      await authController.register(req, res, next);

      expect(next).toHaveBeenCalledWith(rateLimitError);
      expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      req = mockRequest(validRegisterRequest);
      
      mockValidationService.validateRegistration.mockResolvedValue({
        isValid: true,
        errors: []
      });
      mockRateLimiter.checkLimit.mockResolvedValue(undefined);

      const serviceError = new Error('Database connection failed');
      mockAuthService.register.mockRejectedValue(serviceError);

      await authController.register(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('login', () => {
    const validLoginRequest: LoginRequest = {
      email: 'test@example.com',
      password: 'StrongPassword123!'
    };

    it('should login user successfully', async () => {
      req = mockRequest(validLoginRequest);
      
      mockValidationService.validateLogin.mockResolvedValue({
        isValid: true,
        errors: []
      });
      mockRateLimiter.checkLimit.mockResolvedValue(undefined);

      const mockLoginResult = {
        user: {
          id: 'user-123',
          email: validLoginRequest.email,
          username: 'testuser',
          displayName: 'Test User',
          role: UserRole.CHILD,
          isEmailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 900
      };

      mockAuthService.login.mockResolvedValue(mockLoginResult);

      await authController.login(req, res, next);

      expect(mockValidationService.validateLogin).toHaveBeenCalledWith(validLoginRequest);
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('login', '127.0.0.1', 10, 900);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        validLoginRequest,
        expect.objectContaining({
          ipAddress: '127.0.0.1',
          userAgent: undefined
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockLoginResult
      });
    });

    it('should set refresh token cookie when rememberMe is true', async () => {
      req = mockRequest({ ...validLoginRequest, rememberMe: true });
      
      mockValidationService.validateLogin.mockResolvedValue({
        isValid: true,
        errors: []
      });
      mockRateLimiter.checkLimit.mockResolvedValue(undefined);

      const mockLoginResult = {
        user: {
          id: 'user-123',
          email: validLoginRequest.email,
          username: 'testuser',
          displayName: 'Test User',
          role: UserRole.CHILD,
          isEmailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 900
      };

      mockAuthService.login.mockResolvedValue(mockLoginResult);

      await authController.login(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'mock-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000
        })
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      req = mockRequest({ refreshToken: 'valid-refresh-token' });
      
      const mockRefreshResult = {
        accessToken: 'new-access-token',
        expiresIn: 900
      };

      mockAuthService.refreshToken.mockResolvedValue(mockRefreshResult);

      await authController.refreshToken(req, res, next);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockRefreshResult
      });
    });

    it('should handle missing refresh token', async () => {
      req = mockRequest({});

      await authController.refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELD',
          message: 'Refresh token is required'
        }
      });
      expect(mockAuthService.refreshToken).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      req = mockRequest({ refreshToken: 'valid-refresh-token' });
      req.user = { id: 'user-123' };

      mockAuthService.logout.mockResolvedValue(undefined);

      await authController.logout(req, res, next);

      expect(mockAuthService.logout).toHaveBeenCalledWith('valid-refresh-token');
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Logged out successfully' }
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      req = mockRequest();
      req.user = { id: 'user-123' };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User',
        role: UserRole.CHILD,
        isEmailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      await authController.getCurrentUser(req, res, next);

      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith('user-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUser
      });
    });

    it('should handle unauthorized request', async () => {
      req = mockRequest();
      req.user = undefined;

      await authController.getCurrentUser(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      expect(mockAuthService.getCurrentUser).not.toHaveBeenCalled();
    });
  });
});

// TODO: Add tests for changePassword endpoint
// TODO: Add tests for forgotPassword endpoint
// TODO: Add tests for resetPassword endpoint
// TODO: Add tests for verifyEmail endpoint
// TODO: Add integration tests with real database
// TODO: Add performance tests for high-load scenarios
// TODO: Add security tests for various attack vectors
