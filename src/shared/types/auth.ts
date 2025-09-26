/**
 * Shared Authentication Types & Contracts
 * 
 * These types are shared between frontend and backend to ensure type safety
 * across the entire application. They define the core data structures for
 * user authentication and authorization.
 */

// ============================================================================
// Core User Types
// ============================================================================

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  dateOfBirth?: Date;
  parentEmail?: string; // For parental controls
  role: UserRole;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export enum UserRole {
  CHILD = 'child',
  PARENT = 'parent',
  ADMIN = 'admin'
}

export interface UserProfile {
  id: string;
  userId: string;
  bio?: string;
  favoriteRockets: string[];
  achievements: Achievement[];
  preferences: UserPreferences;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  unlockedAt: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    achievements: boolean;
    missions: boolean;
  };
  privacy: {
    showProfile: boolean;
    shareDesigns: boolean;
  };
}

// ============================================================================
// Authentication Request/Response Types
// ============================================================================

export interface RegisterRequest {
  email: string;
  username: string;
  displayName: string;
  password: string;
  dateOfBirth?: string; // ISO date string
  parentEmail?: string;
  acceptsTerms: boolean;
}

export interface RegisterResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

// ============================================================================
// JWT Token Types
// ============================================================================

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  iat: number;
  exp: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  field?: string; // For validation errors
}

// ============================================================================
// Validation Error Types
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// Session & Security Types
// ============================================================================

export interface UserSession {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
  isActive: boolean;
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet';
  os: string;
  browser: string;
  fingerprint: string;
}

// ============================================================================
// Parental Control Types
// ============================================================================

export interface ParentalControlSettings {
  childUserId: string;
  parentUserId: string;
  maxDailyPlayTime: number; // minutes
  allowedFeatures: {
    rocketDesign: boolean;
    simulation: boolean;
    sharing: boolean;
    challenges: boolean;
    shop: boolean;
  };
  contentFilters: {
    hideComplexPhysics: boolean;
    simplifiedUI: boolean;
  };
  notifications: {
    dailyReport: boolean;
    achievements: boolean;
    timeWarnings: boolean;
  };
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

// ============================================================================
// Audit & Logging Types
// ============================================================================

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

export enum UserActivityAction {
  LOGIN = 'login',
  LOGOUT = 'logout',
  REGISTER = 'register',
  PASSWORD_CHANGE = 'password_change',
  PROFILE_UPDATE = 'profile_update',
  EMAIL_VERIFY = 'email_verify',
  ROCKET_CREATE = 'rocket_create',
  ROCKET_LAUNCH = 'rocket_launch',
  MISSION_COMPLETE = 'mission_complete',
  SHOP_PURCHASE = 'shop_purchase'
}
