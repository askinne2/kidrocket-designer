/**
 * Cache Service
 * 
 * Redis-based caching service with fallback to in-memory cache.
 * Provides high-performance caching with TTL, tagging, and pattern matching.
 */

import { createClient, RedisClientType } from 'redis';
import { injectable, inject } from 'inversify';
import { Logger } from '@/infrastructure/logging/logger';
import { CacheEntry, CacheOptions } from '@/shared/types/common';

interface CacheConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    maxRetries: number;
    retryDelayOnFailover: number;
  };
  fallback: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };
}

@injectable()
export class CacheService {
  private redis: RedisClientType;
  private fallbackCache: Map<string, CacheEntry> = new Map();
  private isRedisConnected: boolean = false;
  private config: CacheConfig;

  constructor(
    @inject('Logger') private logger: Logger
  ) {
    this.config = this.getConfig();
    this.initializeRedis();
    this.startFallbackCacheCleanup();
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    this.redis = createClient({
      socket: {
        host: this.config.redis.host,
        port: this.config.redis.port,
        reconnectStrategy: (retries) => {
          if (retries > this.config.redis.maxRetries) {
            this.logger.error('Max Redis reconnection attempts reached');
            return false;
          }
          return Math.min(retries * 50, 500);
        }
      },
      password: this.config.redis.password,
      database: this.config.redis.db,
      name: 'KidRocket-Cache'
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis client connecting');
    });

    this.redis.on('ready', () => {
      this.isRedisConnected = true;
      this.logger.info('Redis client connected and ready', {
        host: this.config.redis.host,
        port: this.config.redis.port,
        database: this.config.redis.db
      });
    });

    this.redis.on('error', (error) => {
      this.isRedisConnected = false;
      this.logger.error('Redis client error', { error: error.message });
    });

    this.redis.on('end', () => {
      this.isRedisConnected = false;
      this.logger.warn('Redis client connection ended');
    });

    this.redis.on('reconnecting', () => {
      this.logger.info('Redis client reconnecting');
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await this.redis.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis', { error: error.message });
      if (!this.config.fallback.enabled) {
        throw error;
      }
      this.logger.info('Using fallback in-memory cache');
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      this.isRedisConnected = false;
      this.logger.info('Redis client disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting Redis client', { error: error.message });
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);

    try {
      if (this.isRedisConnected) {
        const value = await this.redis.get(fullKey);
        if (value !== null) {
          this.logger.debug('Cache hit (Redis)', { key });
          return JSON.parse(value);
        }
      }

      // Fallback to in-memory cache
      if (this.config.fallback.enabled) {
        const entry = this.fallbackCache.get(fullKey);
        if (entry && entry.expiresAt > new Date()) {
          this.logger.debug('Cache hit (fallback)', { key });
          return entry.value;
        } else if (entry) {
          this.fallbackCache.delete(fullKey);
        }
      }

      this.logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      this.logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(
    key: string, 
    value: T, 
    ttlSeconds?: number, 
    options: CacheOptions = {}
  ): Promise<void> {
    const fullKey = this.getFullKey(key);
    const ttl = ttlSeconds || options.ttl || 300; // Default 5 minutes
    const serializedValue = JSON.stringify(value);

    try {
      if (this.isRedisConnected) {
        await this.redis.setEx(fullKey, ttl, serializedValue);
        
        // Set tags if provided
        if (options.tags && options.tags.length > 0) {
          await this.setTags(fullKey, options.tags);
        }
        
        this.logger.debug('Cache set (Redis)', { key, ttl });
      } else if (this.config.fallback.enabled) {
        // Use fallback cache
        this.setFallbackCache(fullKey, value, ttl);
        this.logger.debug('Cache set (fallback)', { key, ttl });
      }
    } catch (error) {
      this.logger.error('Cache set error', { key, error: error.message });
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);

    try {
      if (this.isRedisConnected) {
        await this.redis.del(fullKey);
        await this.deleteTags(fullKey);
        this.logger.debug('Cache delete (Redis)', { key });
      }

      if (this.config.fallback.enabled) {
        this.fallbackCache.delete(fullKey);
        this.logger.debug('Cache delete (fallback)', { key });
      }
    } catch (error) {
      this.logger.error('Cache delete error', { key, error: error.message });
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const fullPattern = this.getFullKey(pattern);
    let deletedCount = 0;

    try {
      if (this.isRedisConnected) {
        const keys = await this.redis.keys(fullPattern);
        if (keys.length > 0) {
          deletedCount = await this.redis.del(keys);
          
          // Clean up tags for deleted keys
          await Promise.all(keys.map(key => this.deleteTags(key)));
          
          this.logger.debug('Cache pattern delete (Redis)', { 
            pattern, 
            deletedCount 
          });
        }
      }

      // Clean fallback cache
      if (this.config.fallback.enabled) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        for (const [key] of this.fallbackCache) {
          if (regex.test(key)) {
            this.fallbackCache.delete(key);
            deletedCount++;
          }
        }
      }

      return deletedCount;
    } catch (error) {
      this.logger.error('Cache pattern delete error', { 
        pattern, 
        error: error.message 
      });
      return 0;
    }
  }

  /**
   * Delete all keys with specific tags
   */
  async deleteByTag(tag: string): Promise<number> {
    if (!this.isRedisConnected) {
      this.logger.warn('Tag-based deletion requires Redis');
      return 0;
    }

    try {
      const tagKey = this.getTagKey(tag);
      const keys = await this.redis.sMembers(tagKey);
      
      if (keys.length === 0) {
        return 0;
      }

      // Delete all keys with this tag
      const deletedCount = await this.redis.del(keys);
      
      // Clean up the tag set
      await this.redis.del(tagKey);
      
      // Clean up other tag references
      await Promise.all(keys.map(key => this.deleteTags(key)));

      this.logger.debug('Cache tag delete', { tag, deletedCount });
      return deletedCount;
    } catch (error) {
      this.logger.error('Cache tag delete error', { tag, error: error.message });
      return 0;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);

    try {
      if (this.isRedisConnected) {
        const exists = await this.redis.exists(fullKey);
        return exists === 1;
      }

      if (this.config.fallback.enabled) {
        const entry = this.fallbackCache.get(fullKey);
        return entry !== undefined && entry.expiresAt > new Date();
      }

      return false;
    } catch (error) {
      this.logger.error('Cache exists error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    redis: {
      connected: boolean;
      keyCount?: number;
      memoryUsed?: string;
      hits?: number;
      misses?: number;
    };
    fallback: {
      enabled: boolean;
      keyCount: number;
      maxSize: number;
    };
  }> {
    const stats = {
      redis: {
        connected: this.isRedisConnected
      } as any,
      fallback: {
        enabled: this.config.fallback.enabled,
        keyCount: this.fallbackCache.size,
        maxSize: this.config.fallback.maxSize
      }
    };

    if (this.isRedisConnected) {
      try {
        const info = await this.redis.info('stats');
        const keyspace = await this.redis.info('keyspace');
        
        // Parse Redis info
        const statsMatch = info.match(/keyspace_hits:(\d+)/);
        const missesMatch = info.match(/keyspace_misses:(\d+)/);
        const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
        
        stats.redis.hits = statsMatch ? parseInt(statsMatch[1]) : 0;
        stats.redis.misses = missesMatch ? parseInt(missesMatch[1]) : 0;
        stats.redis.memoryUsed = memoryMatch ? memoryMatch[1].trim() : 'unknown';
        
        // Count keys in current database
        const dbMatch = keyspace.match(new RegExp(`db${this.config.redis.db}:keys=(\\d+)`));
        stats.redis.keyCount = dbMatch ? parseInt(dbMatch[1]) : 0;
      } catch (error) {
        this.logger.error('Failed to get Redis stats', { error: error.message });
      }
    }

    return stats;
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    redis: boolean;
    fallback: boolean;
    responseTime?: number;
  }> {
    const startTime = Date.now();
    const testKey = 'health-check';
    const testValue = 'test';

    try {
      // Test Redis if connected
      let redisWorking = false;
      if (this.isRedisConnected) {
        await this.set(testKey, testValue, 5);
        const retrieved = await this.get(testKey);
        await this.delete(testKey);
        redisWorking = retrieved === testValue;
      }

      const responseTime = Date.now() - startTime;
      const fallbackWorking = this.config.fallback.enabled;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';
      if (redisWorking) {
        status = 'healthy';
      } else if (fallbackWorking) {
        status = 'degraded';
      }

      return {
        status,
        redis: redisWorking,
        fallback: fallbackWorking,
        responseTime
      };
    } catch (error) {
      this.logger.error('Cache health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        redis: false,
        fallback: this.config.fallback.enabled
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private getConfig(): CacheConfig {
    return {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'kidrocket:',
        maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
        retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100')
      },
      fallback: {
        enabled: process.env.CACHE_FALLBACK_ENABLED !== 'false',
        maxSize: parseInt(process.env.CACHE_FALLBACK_MAX_SIZE || '1000'),
        ttl: parseInt(process.env.CACHE_FALLBACK_TTL || '300')
      }
    };
  }

  private getFullKey(key: string): string {
    return `${this.config.redis.keyPrefix}${key}`;
  }

  private getTagKey(tag: string): string {
    return `${this.config.redis.keyPrefix}tags:${tag}`;
  }

  private async setTags(key: string, tags: string[]): Promise<void> {
    if (!this.isRedisConnected) return;

    try {
      const pipeline = this.redis.multi();
      
      // Add key to each tag set
      tags.forEach(tag => {
        pipeline.sAdd(this.getTagKey(tag), key);
      });
      
      await pipeline.exec();
    } catch (error) {
      this.logger.error('Failed to set cache tags', { 
        key, 
        tags, 
        error: error.message 
      });
    }
  }

  private async deleteTags(key: string): Promise<void> {
    if (!this.isRedisConnected) return;

    try {
      // Find all tag sets that contain this key
      const tagPattern = this.getTagKey('*');
      const tagKeys = await this.redis.keys(tagPattern);
      
      if (tagKeys.length > 0) {
        const pipeline = this.redis.multi();
        tagKeys.forEach(tagKey => {
          pipeline.sRem(tagKey, key);
        });
        await pipeline.exec();
      }
    } catch (error) {
      this.logger.error('Failed to delete cache tags', { 
        key, 
        error: error.message 
      });
    }
  }

  private setFallbackCache<T>(key: string, value: T, ttlSeconds: number): void {
    // Check if cache is full
    if (this.fallbackCache.size >= this.config.fallback.maxSize) {
      this.evictOldestFallbackEntries();
    }

    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    this.fallbackCache.set(key, {
      key,
      value,
      ttl: ttlSeconds,
      createdAt: new Date(),
      expiresAt
    });
  }

  private evictOldestFallbackEntries(): void {
    const entries = Array.from(this.fallbackCache.entries());
    entries.sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
    
    // Remove oldest 25% of entries
    const toRemove = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      this.fallbackCache.delete(entries[i][0]);
    }
  }

  private startFallbackCacheCleanup(): void {
    if (!this.config.fallback.enabled) return;

    // Clean up expired entries every 5 minutes
    setInterval(() => {
      const now = new Date();
      const expiredKeys: string[] = [];

      for (const [key, entry] of this.fallbackCache) {
        if (entry.expiresAt <= now) {
          expiredKeys.push(key);
        }
      }

      expiredKeys.forEach(key => this.fallbackCache.delete(key));

      if (expiredKeys.length > 0) {
        this.logger.debug('Cleaned up expired fallback cache entries', {
          expiredCount: expiredKeys.length,
          remainingCount: this.fallbackCache.size
        });
      }
    }, 5 * 60 * 1000); // 5 minutes
  }
}

// TODO: Add cache warming strategies
// TODO: Implement cache compression for large values
// TODO: Add cache analytics and monitoring
// TODO: Implement distributed cache invalidation
// TODO: Add cache serialization options (MessagePack, etc.)
// TODO: Implement cache partitioning/sharding
// TODO: Add cache backup and restore functionality
