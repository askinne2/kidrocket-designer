/**
 * User Repository
 * 
 * Data access layer for user entities.
 * Implements repository pattern with clean separation from business logic.
 */

import { inject, injectable } from 'inversify';
import { User, UserRole } from '@/shared/types/auth';
import { DatabaseService } from '@/infrastructure/database/database.service';
import { CacheService } from '@/infrastructure/cache/cache.service';
import { Logger } from '@/infrastructure/logging/logger';

interface CreateUserData {
  email: string;
  username: string;
  displayName: string;
  password: string;
  dateOfBirth?: Date;
  parentEmail?: string;
  role: UserRole;
  isEmailVerified: boolean;
}

interface UpdateUserData {
  displayName?: string;
  avatar?: string;
  dateOfBirth?: Date;
  parentEmail?: string;
}

@injectable()
export class UserRepository {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'user:';

  constructor(
    @inject('DatabaseService') private db: DatabaseService,
    @inject('CacheService') private cache: CacheService,
    @inject('Logger') private logger: Logger
  ) {}

  /**
   * Create a new user
   */
  async create(userData: CreateUserData): Promise<User> {
    const query = `
      INSERT INTO users (
        id, email, username, display_name, password, date_of_birth, 
        parent_email, role, is_email_verified, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
      ) RETURNING *
    `;

    const values = [
      userData.email,
      userData.username,
      userData.displayName,
      userData.password,
      userData.dateOfBirth,
      userData.parentEmail,
      userData.role,
      userData.isEmailVerified
    ];

    try {
      const result = await this.db.query(query, values);
      const user = this.mapRowToUser(result.rows[0]);
      
      // Cache the user
      await this.cacheUser(user);
      
      this.logger.info('User created', { userId: user.id, email: user.email });
      return user;
    } catch (error) {
      this.logger.error('Failed to create user', { error: error.message, email: userData.email });
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    // Try cache first
    const cacheKey = `${this.CACHE_PREFIX}id:${id}`;
    const cached = await this.cache.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    const query = 'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL';
    
    try {
      const result = await this.db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const user = this.mapRowToUser(result.rows[0]);
      await this.cacheUser(user);
      
      return user;
    } catch (error) {
      this.logger.error('Failed to find user by ID', { error: error.message, userId: id });
      throw error;
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    // Try cache first
    const cacheKey = `${this.CACHE_PREFIX}email:${email.toLowerCase()}`;
    const cached = await this.cache.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    const query = 'SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL';
    
    try {
      const result = await this.db.query(query, [email]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const user = this.mapRowToUser(result.rows[0]);
      await this.cacheUser(user);
      
      return user;
    } catch (error) {
      this.logger.error('Failed to find user by email', { error: error.message, email });
      throw error;
    }
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    // Try cache first
    const cacheKey = `${this.CACHE_PREFIX}username:${username.toLowerCase()}`;
    const cached = await this.cache.get<User>(cacheKey);
    if (cached) {
      return cached;
    }

    const query = 'SELECT * FROM users WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL';
    
    try {
      const result = await this.db.query(query, [username]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const user = this.mapRowToUser(result.rows[0]);
      await this.cacheUser(user);
      
      return user;
    } catch (error) {
      this.logger.error('Failed to find user by username', { error: error.message, username });
      throw error;
    }
  }

  /**
   * Update user data
   */
  async update(id: string, userData: UpdateUserData): Promise<User> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (userData.displayName !== undefined) {
      setClauses.push(`display_name = $${paramIndex++}`);
      values.push(userData.displayName);
    }

    if (userData.avatar !== undefined) {
      setClauses.push(`avatar = $${paramIndex++}`);
      values.push(userData.avatar);
    }

    if (userData.dateOfBirth !== undefined) {
      setClauses.push(`date_of_birth = $${paramIndex++}`);
      values.push(userData.dateOfBirth);
    }

    if (userData.parentEmail !== undefined) {
      setClauses.push(`parent_email = $${paramIndex++}`);
      values.push(userData.parentEmail);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users 
      SET ${setClauses.join(', ')} 
      WHERE id = $${paramIndex} AND deleted_at IS NULL 
      RETURNING *
    `;

    try {
      const result = await this.db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = this.mapRowToUser(result.rows[0]);
      await this.invalidateUserCache(id);
      await this.cacheUser(user);
      
      this.logger.info('User updated', { userId: id });
      return user;
    } catch (error) {
      this.logger.error('Failed to update user', { error: error.message, userId: id });
      throw error;
    }
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    const query = `
      UPDATE users 
      SET password = $1, updated_at = NOW() 
      WHERE id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await this.db.query(query, [hashedPassword, id]);
      
      if (result.rowCount === 0) {
        throw new Error('User not found');
      }

      await this.invalidateUserCache(id);
      this.logger.info('User password updated', { userId: id });
    } catch (error) {
      this.logger.error('Failed to update password', { error: error.message, userId: id });
      throw error;
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    const query = `
      UPDATE users 
      SET last_login_at = NOW(), updated_at = NOW() 
      WHERE id = $1 AND deleted_at IS NULL
    `;

    try {
      await this.db.query(query, [id]);
      await this.invalidateUserCache(id);
      this.logger.debug('User last login updated', { userId: id });
    } catch (error) {
      this.logger.error('Failed to update last login', { error: error.message, userId: id });
      throw error;
    }
  }

  /**
   * Set password reset token
   */
  async setPasswordResetToken(id: string, token: string, expiresAt: Date): Promise<void> {
    const query = `
      UPDATE users 
      SET password_reset_token = $1, password_reset_expires = $2, updated_at = NOW() 
      WHERE id = $3 AND deleted_at IS NULL
    `;

    try {
      const result = await this.db.query(query, [token, expiresAt, id]);
      
      if (result.rowCount === 0) {
        throw new Error('User not found');
      }

      await this.invalidateUserCache(id);
      this.logger.info('Password reset token set', { userId: id });
    } catch (error) {
      this.logger.error('Failed to set password reset token', { error: error.message, userId: id });
      throw error;
    }
  }

  /**
   * Find user by password reset token
   */
  async findByPasswordResetToken(token: string): Promise<User | null> {
    const query = `
      SELECT * FROM users 
      WHERE password_reset_token = $1 
      AND password_reset_expires > NOW() 
      AND deleted_at IS NULL
    `;

    try {
      const result = await this.db.query(query, [token]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to find user by reset token', { error: error.message });
      throw error;
    }
  }

  /**
   * Reset password and clear reset token
   */
  async resetPassword(id: string, hashedPassword: string): Promise<void> {
    const query = `
      UPDATE users 
      SET password = $1, password_reset_token = NULL, password_reset_expires = NULL, updated_at = NOW() 
      WHERE id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await this.db.query(query, [hashedPassword, id]);
      
      if (result.rowCount === 0) {
        throw new Error('User not found');
      }

      await this.invalidateUserCache(id);
      this.logger.info('Password reset completed', { userId: id });
    } catch (error) {
      this.logger.error('Failed to reset password', { error: error.message, userId: id });
      throw error;
    }
  }

  /**
   * Set email verification token
   */
  async setEmailVerificationToken(id: string, token: string, expiresAt: Date): Promise<void> {
    const query = `
      UPDATE users 
      SET email_verification_token = $1, email_verification_expires = $2, updated_at = NOW() 
      WHERE id = $3 AND deleted_at IS NULL
    `;

    try {
      const result = await this.db.query(query, [token, expiresAt, id]);
      
      if (result.rowCount === 0) {
        throw new Error('User not found');
      }

      await this.invalidateUserCache(id);
      this.logger.info('Email verification token set', { userId: id });
    } catch (error) {
      this.logger.error('Failed to set email verification token', { error: error.message, userId: id });
      throw error;
    }
  }

  /**
   * Find user by email verification token
   */
  async findByEmailVerificationToken(token: string): Promise<User | null> {
    const query = `
      SELECT * FROM users 
      WHERE email_verification_token = $1 
      AND email_verification_expires > NOW() 
      AND deleted_at IS NULL
    `;

    try {
      const result = await this.db.query(query, [token]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to find user by verification token', { error: error.message });
      throw error;
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(id: string): Promise<void> {
    const query = `
      UPDATE users 
      SET is_email_verified = true, email_verification_token = NULL, email_verification_expires = NULL, updated_at = NOW() 
      WHERE id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await this.db.query(query, [id]);
      
      if (result.rowCount === 0) {
        throw new Error('User not found');
      }

      await this.invalidateUserCache(id);
      this.logger.info('Email verified', { userId: id });
    } catch (error) {
      this.logger.error('Failed to verify email', { error: error.message, userId: id });
      throw error;
    }
  }

  /**
   * Soft delete user
   */
  async delete(id: string): Promise<void> {
    const query = `
      UPDATE users 
      SET deleted_at = NOW(), updated_at = NOW() 
      WHERE id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await this.db.query(query, [id]);
      
      if (result.rowCount === 0) {
        throw new Error('User not found');
      }

      await this.invalidateUserCache(id);
      this.logger.info('User deleted', { userId: id });
    } catch (error) {
      this.logger.error('Failed to delete user', { error: error.message, userId: id });
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      displayName: row.display_name,
      password: row.password,
      avatar: row.avatar,
      dateOfBirth: row.date_of_birth,
      parentEmail: row.parent_email,
      role: row.role as UserRole,
      isEmailVerified: row.is_email_verified,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at
    };
  }

  private async cacheUser(user: User): Promise<void> {
    const cachePromises = [
      this.cache.set(`${this.CACHE_PREFIX}id:${user.id}`, user, this.CACHE_TTL),
      this.cache.set(`${this.CACHE_PREFIX}email:${user.email.toLowerCase()}`, user, this.CACHE_TTL),
      this.cache.set(`${this.CACHE_PREFIX}username:${user.username.toLowerCase()}`, user, this.CACHE_TTL)
    ];

    await Promise.all(cachePromises);
  }

  private async invalidateUserCache(id: string): Promise<void> {
    // Get user first to invalidate all cache keys
    const user = await this.findById(id);
    if (user) {
      const cacheKeys = [
        `${this.CACHE_PREFIX}id:${user.id}`,
        `${this.CACHE_PREFIX}email:${user.email.toLowerCase()}`,
        `${this.CACHE_PREFIX}username:${user.username.toLowerCase()}`
      ];

      await Promise.all(cacheKeys.map(key => this.cache.delete(key)));
    }
  }
}

// TODO: Add user search functionality with pagination
// TODO: Implement user statistics and analytics queries
// TODO: Add bulk operations for user management
// TODO: Implement user activity tracking
// TODO: Add user preferences storage
// TODO: Implement user relationship management (friends, followers)
// TODO: Add user content aggregation queries
