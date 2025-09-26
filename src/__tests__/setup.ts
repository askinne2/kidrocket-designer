/**
 * Jest Test Setup
 * 
 * Global test configuration and setup for the KidRocket Designer test suite.
 * Sets up environment variables, mocks, and global test utilities.
 */

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';

// Database configuration for tests
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'kidrocket_designer_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'password';

// Redis configuration for tests
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_DB = '1'; // Use different DB for tests

// Email configuration for tests
process.env.EMAIL_SERVICE = 'test';
process.env.EMAIL_FROM = 'test@kidrocket.com';

// Global test timeout
jest.setTimeout(30000);

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidEmail(): R;
      toBeValidJWT(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },

  toBeValidEmail(received: string) {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false,
      };
    }
  },

  toBeValidJWT(received: string) {
    // Basic JWT format check (header.payload.signature)
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    const pass = jwtRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false,
      };
    }
  }
});

// Mock console methods in test environment to reduce noise
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  // Only show console.error in tests if it's not a known test warning
  const message = args[0];
  if (typeof message === 'string' && (
    message.includes('Warning: ReactDOM.render is no longer supported') ||
    message.includes('Warning: React.createFactory() is deprecated') ||
    message.includes('Warning: componentWillMount has been renamed')
  )) {
    return;
  }
  originalConsoleError(...args);
};

console.warn = (...args: any[]) => {
  // Only show console.warn in tests if it's not a known test warning
  const message = args[0];
  if (typeof message === 'string' && (
    message.includes('Warning: React.createFactory() is deprecated') ||
    message.includes('Warning: componentWillMount has been renamed')
  )) {
    return;
  }
  originalConsoleWarn(...args);
};

// Global test helpers
export const createMockUser = (overrides: any = {}) => ({
  id: 'test-user-123',
  email: 'test@example.com',
  username: 'testuser',
  displayName: 'Test User',
  password: 'hashedPassword123',
  role: 'child',
  isEmailVerified: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides
});

export const createMockSession = (overrides: any = {}) => ({
  id: 'test-session-123',
  userId: 'test-user-123',
  deviceInfo: {
    type: 'desktop',
    os: 'Unknown',
    browser: 'Unknown',
    fingerprint: 'test-fingerprint'
  },
  ipAddress: '127.0.0.1',
  userAgent: 'Test User Agent',
  createdAt: new Date(),
  lastAccessedAt: new Date(),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  isActive: true,
  ...overrides
});

export const createMockRequest = (overrides: any = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  ip: '127.0.0.1',
  get: jest.fn(),
  cookies: {},
  user: undefined,
  ...overrides
});

export const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.render = jest.fn().mockReturnValue(res);
  return res;
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Database test utilities
export const truncateAllTables = async (db: any): Promise<void> => {
  const tables = [
    'session_activities',
    'user_sessions', 
    'user_profiles',
    'users'
  ];
  
  for (const table of tables) {
    await db.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
  }
};

export const seedTestUser = async (db: any, userData: any = {}): Promise<any> => {
  const user = createMockUser(userData);
  const query = `
    INSERT INTO users (
      id, email, username, display_name, password, role, 
      is_email_verified, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  
  const values = [
    user.id,
    user.email,
    user.username,
    user.displayName,
    user.password,
    user.role,
    user.isEmailVerified,
    user.createdAt,
    user.updatedAt
  ];
  
  const result = await db.query(query, values);
  return result.rows[0];
};

// Cleanup after each test
afterEach(async () => {
  // Clean up any global state
  jest.clearAllTimers();
});

// Global error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit process in tests, just log the error
});

// Export test environment check
export const isTestEnvironment = (): boolean => {
  return process.env.NODE_ENV === 'test';
};

// Mock external services that shouldn't run in tests
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    sAdd: jest.fn(),
    sMembers: jest.fn(),
    sRem: jest.fn(),
    exists: jest.fn(),
    info: jest.fn(),
    multi: jest.fn(() => ({
      sAdd: jest.fn(),
      sRem: jest.fn(),
      exec: jest.fn().mockResolvedValue([])
    })),
    on: jest.fn()
  }))
}));
