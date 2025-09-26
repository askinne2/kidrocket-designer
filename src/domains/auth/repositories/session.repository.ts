/**
 * Session Repository
 * 
 * Data access layer for user session management.
 * Handles session storage, validation, and cleanup.
 */

import { inject, injectable } from 'inversify';
import { UserSession, DeviceInfo } from '@/shared/types/auth';
import { DatabaseService } from '@/infrastructure/database/database.service';
import { CacheService } from '@/infrastructure/cache/cache.service';
import { Logger } from '@/infrastructure/logging/logger';

interface CreateSessionData {
  userId: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  userAgent: string;
  expiresAt: Date;
  isActive: boolean;
}

@injectable()
export class SessionRepository {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_PREFIX = 'session:';

  constructor(
    @inject('DatabaseService') private db: DatabaseService,
    @inject('CacheService') private cache: CacheService,
    @inject('Logger') private logger: Logger
  ) {}

  /**
   * Create a new session
   */
  async create(sessionData: CreateSessionData): Promise<UserSession> {
    const query = `
      INSERT INTO user_sessions (
        id, user_id, device_type, device_os, device_browser, device_fingerprint,
        ip_address, user_agent, created_at, last_accessed_at, expires_at, is_active
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8, $9
      ) RETURNING *
    `;

    const values = [
      sessionData.userId,
      sessionData.deviceInfo.type,
      sessionData.deviceInfo.os,
      sessionData.deviceInfo.browser,
      sessionData.deviceInfo.fingerprint,
      sessionData.ipAddress,
      sessionData.userAgent,
      sessionData.expiresAt,
      sessionData.isActive
    ];

    try {
      const result = await this.db.query(query, values);
      const session = this.mapRowToSession(result.rows[0]);
      
      // Cache the session
      await this.cacheSession(session);
      
      this.logger.info('Session created', { 
        sessionId: session.id, 
        userId: session.userId,
        deviceType: session.deviceInfo.type 
      });
      
      return session;
    } catch (error) {
      this.logger.error('Failed to create session', { 
        error: error.message, 
        userId: sessionData.userId 
      });
      throw error;
    }
  }

  /**
   * Find session by ID
   */
  async findById(id: string): Promise<UserSession | null> {
    // Try cache first
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cached = await this.cache.get<UserSession>(cacheKey);
    if (cached) {
      return cached;
    }

    const query = 'SELECT * FROM user_sessions WHERE id = $1';
    
    try {
      const result = await this.db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const session = this.mapRowToSession(result.rows[0]);
      await this.cacheSession(session);
      
      return session;
    } catch (error) {
      this.logger.error('Failed to find session by ID', { 
        error: error.message, 
        sessionId: id 
      });
      throw error;
    }
  }

  /**
   * Find all active sessions for a user
   */
  async findActiveByUserId(userId: string): Promise<UserSession[]> {
    const query = `
      SELECT * FROM user_sessions 
      WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
      ORDER BY last_accessed_at DESC
    `;

    try {
      const result = await this.db.query(query, [userId]);
      return result.rows.map(row => this.mapRowToSession(row));
    } catch (error) {
      this.logger.error('Failed to find active sessions', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  }

  /**
   * Update session last accessed time
   */
  async updateLastAccessed(id: string): Promise<void> {
    const query = `
      UPDATE user_sessions 
      SET last_accessed_at = NOW() 
      WHERE id = $1 AND is_active = true
    `;

    try {
      const result = await this.db.query(query, [id]);
      
      if (result.rowCount > 0) {
        await this.invalidateSessionCache(id);
        this.logger.debug('Session last accessed updated', { sessionId: id });
      }
    } catch (error) {
      this.logger.error('Failed to update session last accessed', { 
        error: error.message, 
        sessionId: id 
      });
      throw error;
    }
  }

  /**
   * Deactivate a session
   */
  async deactivate(id: string): Promise<void> {
    const query = `
      UPDATE user_sessions 
      SET is_active = false 
      WHERE id = $1
    `;

    try {
      const result = await this.db.query(query, [id]);
      
      if (result.rowCount > 0) {
        await this.invalidateSessionCache(id);
        this.logger.info('Session deactivated', { sessionId: id });
      }
    } catch (error) {
      this.logger.error('Failed to deactivate session', { 
        error: error.message, 
        sessionId: id 
      });
      throw error;
    }
  }

  /**
   * Deactivate all sessions for a user
   */
  async deactivateAllForUser(userId: string): Promise<void> {
    const query = `
      UPDATE user_sessions 
      SET is_active = false 
      WHERE user_id = $1 AND is_active = true
    `;

    try {
      const result = await this.db.query(query, [userId]);
      
      if (result.rowCount > 0) {
        // Invalidate cache for all user sessions
        await this.invalidateUserSessionsCache(userId);
        this.logger.info('All sessions deactivated for user', { 
          userId, 
          sessionCount: result.rowCount 
        });
      }
    } catch (error) {
      this.logger.error('Failed to deactivate all sessions', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  }

  /**
   * Deactivate all sessions except current one
   */
  async deactivateAllExcept(userId: string, currentSessionId: string): Promise<void> {
    const query = `
      UPDATE user_sessions 
      SET is_active = false 
      WHERE user_id = $1 AND id != $2 AND is_active = true
    `;

    try {
      const result = await this.db.query(query, [userId, currentSessionId]);
      
      if (result.rowCount > 0) {
        await this.invalidateUserSessionsCache(userId);
        this.logger.info('All other sessions deactivated for user', { 
          userId, 
          currentSessionId,
          sessionCount: result.rowCount 
        });
      }
    } catch (error) {
      this.logger.error('Failed to deactivate other sessions', { 
        error: error.message, 
        userId,
        currentSessionId 
      });
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpired(): Promise<number> {
    const query = `
      DELETE FROM user_sessions 
      WHERE expires_at < NOW() OR (is_active = false AND last_accessed_at < NOW() - INTERVAL '7 days')
    `;

    try {
      const result = await this.db.query(query);
      const deletedCount = result.rowCount || 0;
      
      if (deletedCount > 0) {
        this.logger.info('Expired sessions cleaned up', { deletedCount });
      }
      
      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions', { error: error.message });
      throw error;
    }
  }

  /**
   * Get session statistics for a user
   */
  async getUserSessionStats(userId: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    deviceBreakdown: { [deviceType: string]: number };
    recentActivity: Date | null;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN is_active = true AND expires_at > NOW() THEN 1 END) as active_sessions,
        device_type,
        COUNT(device_type) as device_count,
        MAX(last_accessed_at) as recent_activity
      FROM user_sessions 
      WHERE user_id = $1 
      GROUP BY device_type
    `;

    try {
      const result = await this.db.query(query, [userId]);
      
      let totalSessions = 0;
      let activeSessions = 0;
      const deviceBreakdown: { [deviceType: string]: number } = {};
      let recentActivity: Date | null = null;

      result.rows.forEach(row => {
        totalSessions += parseInt(row.total_sessions);
        activeSessions += parseInt(row.active_sessions);
        deviceBreakdown[row.device_type] = parseInt(row.device_count);
        
        if (!recentActivity || row.recent_activity > recentActivity) {
          recentActivity = row.recent_activity;
        }
      });

      return {
        totalSessions,
        activeSessions,
        deviceBreakdown,
        recentActivity
      };
    } catch (error) {
      this.logger.error('Failed to get session stats', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  }

  /**
   * Find sessions by IP address (for security monitoring)
   */
  async findByIpAddress(ipAddress: string, limit: number = 50): Promise<UserSession[]> {
    const query = `
      SELECT * FROM user_sessions 
      WHERE ip_address = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;

    try {
      const result = await this.db.query(query, [ipAddress, limit]);
      return result.rows.map(row => this.mapRowToSession(row));
    } catch (error) {
      this.logger.error('Failed to find sessions by IP', { 
        error: error.message, 
        ipAddress 
      });
      throw error;
    }
  }

  /**
   * Find suspicious sessions (multiple devices from same IP, etc.)
   */
  async findSuspiciousSessions(): Promise<{
    multipleDevicesFromSameIP: UserSession[];
    unusualLocations: UserSession[];
    concurrentSessions: UserSession[];
  }> {
    // Multiple devices from same IP
    const multipleDevicesQuery = `
      SELECT s1.* FROM user_sessions s1
      INNER JOIN (
        SELECT ip_address, user_id, COUNT(DISTINCT device_fingerprint) as device_count
        FROM user_sessions 
        WHERE is_active = true AND expires_at > NOW()
        GROUP BY ip_address, user_id
        HAVING COUNT(DISTINCT device_fingerprint) > 2
      ) s2 ON s1.ip_address = s2.ip_address AND s1.user_id = s2.user_id
      WHERE s1.is_active = true AND s1.expires_at > NOW()
    `;

    // Concurrent sessions (more than 3 active sessions)
    const concurrentQuery = `
      SELECT s1.* FROM user_sessions s1
      INNER JOIN (
        SELECT user_id, COUNT(*) as session_count
        FROM user_sessions 
        WHERE is_active = true AND expires_at > NOW()
        GROUP BY user_id
        HAVING COUNT(*) > 3
      ) s2 ON s1.user_id = s2.user_id
      WHERE s1.is_active = true AND s1.expires_at > NOW()
    `;

    try {
      const [multipleDevicesResult, concurrentResult] = await Promise.all([
        this.db.query(multipleDevicesQuery),
        this.db.query(concurrentQuery)
      ]);

      return {
        multipleDevicesFromSameIP: multipleDevicesResult.rows.map(row => this.mapRowToSession(row)),
        unusualLocations: [], // TODO: Implement geolocation-based detection
        concurrentSessions: concurrentResult.rows.map(row => this.mapRowToSession(row))
      };
    } catch (error) {
      this.logger.error('Failed to find suspicious sessions', { error: error.message });
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private mapRowToSession(row: any): UserSession {
    return {
      id: row.id,
      userId: row.user_id,
      deviceInfo: {
        type: row.device_type,
        os: row.device_os,
        browser: row.device_browser,
        fingerprint: row.device_fingerprint
      },
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at,
      expiresAt: row.expires_at,
      isActive: row.is_active
    };
  }

  private async cacheSession(session: UserSession): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${session.id}`;
    await this.cache.set(cacheKey, session, this.CACHE_TTL);
  }

  private async invalidateSessionCache(sessionId: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${sessionId}`;
    await this.cache.delete(cacheKey);
  }

  private async invalidateUserSessionsCache(userId: string): Promise<void> {
    // In a real implementation, you might want to use cache tags or patterns
    // For now, we'll just log that user sessions should be invalidated
    this.logger.debug('User sessions cache should be invalidated', { userId });
    
    // TODO: Implement pattern-based cache invalidation
    // await this.cache.deletePattern(`${this.CACHE_PREFIX}user:${userId}:*`);
  }
}

// TODO: Add session analytics and reporting
// TODO: Implement geolocation tracking for sessions
// TODO: Add session security scoring
// TODO: Implement session hijacking detection
// TODO: Add session backup and recovery
// TODO: Implement session sharing/delegation for parental controls
// TODO: Add session performance metrics
