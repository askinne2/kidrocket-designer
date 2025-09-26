/**
 * Database Service
 * 
 * PostgreSQL database connection and query interface.
 * Implements connection pooling, query logging, and error handling.
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { injectable, inject } from 'inversify';
import { Logger } from '@/infrastructure/logging/logger';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

interface QueryOptions {
  logQuery?: boolean;
  timeout?: number;
  retries?: number;
}

@injectable()
export class DatabaseService {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor(
    @inject('Logger') private logger: Logger
  ) {
    const config = this.getConfig();
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    });

    // Setup pool event handlers
    this.setupPoolEventHandlers();
  }

  /**
   * Initialize database connection
   */
  async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      this.logger.info('Database connected successfully', {
        host: this.pool.options.host,
        database: this.pool.options.database,
        maxConnections: this.pool.options.max
      });
    } catch (error) {
      this.logger.error('Failed to connect to database', { 
        error: error.message,
        host: this.pool.options.host,
        database: this.pool.options.database
      });
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      this.logger.info('Database disconnected successfully');
    } catch (error) {
      this.logger.error('Error disconnecting from database', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute a query with parameters
   */
  async query<T = any>(
    text: string, 
    params?: any[], 
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const startTime = Date.now();
    const queryId = this.generateQueryId();

    try {
      if (options.logQuery !== false) {
        this.logger.debug('Executing query', {
          queryId,
          query: this.sanitizeQueryForLogging(text),
          paramCount: params?.length || 0
        });
      }

      const result = await this.executeWithRetry(text, params, options);
      const duration = Date.now() - startTime;

      if (options.logQuery !== false) {
        this.logger.debug('Query completed', {
          queryId,
          duration,
          rowCount: result.rowCount
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Query failed', {
        queryId,
        error: error.message,
        duration,
        query: this.sanitizeQueryForLogging(text),
        paramCount: params?.length || 0
      });
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    const transactionId = this.generateQueryId();

    try {
      this.logger.debug('Starting transaction', { transactionId });
      
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      
      this.logger.debug('Transaction committed', { transactionId });
      return result;
    } catch (error) {
      this.logger.error('Transaction failed, rolling back', {
        transactionId,
        error: error.message
      });
      
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        this.logger.error('Rollback failed', {
          transactionId,
          rollbackError: rollbackError.message
        });
      }
      
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool for manual transaction management
   */
  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Check if database is healthy
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      totalConnections: number;
      idleConnections: number;
      waitingConnections: number;
      responseTime?: number;
    };
  }> {
    const startTime = Date.now();

    try {
      await this.query('SELECT 1', [], { logQuery: false });
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        details: {
          connected: this.isConnected,
          totalConnections: this.pool.totalCount,
          idleConnections: this.pool.idleCount,
          waitingConnections: this.pool.waitingCount,
          responseTime
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          totalConnections: this.pool.totalCount,
          idleConnections: this.pool.idleCount,
          waitingConnections: this.pool.waitingCount
        }
      };
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalConnections: number;
    idleConnections: number;
    waitingConnections: number;
    maxConnections: number;
  }> {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingConnections: this.pool.waitingCount,
      maxConnections: this.pool.options.max || 20
    };
  }

  /**
   * Execute raw SQL (for migrations, etc.)
   */
  async raw(sql: string): Promise<QueryResult> {
    this.logger.info('Executing raw SQL', {
      sqlLength: sql.length,
      preview: sql.substring(0, 100) + (sql.length > 100 ? '...' : '')
    });

    return await this.query(sql, [], { logQuery: true });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private getConfig(): DatabaseConfig {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'kidrocket_designer',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.DB_SSL === 'true',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000')
    };
  }

  private setupPoolEventHandlers(): void {
    this.pool.on('connect', (client) => {
      this.logger.debug('New client connected', {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount
      });
    });

    this.pool.on('acquire', (client) => {
      this.logger.debug('Client acquired from pool', {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount
      });
    });

    this.pool.on('error', (error, client) => {
      this.logger.error('Database pool error', {
        error: error.message,
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount
      });
    });

    this.pool.on('remove', (client) => {
      this.logger.debug('Client removed from pool', {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount
      });
    });
  }

  private async executeWithRetry<T = any>(
    text: string,
    params?: any[],
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    const maxRetries = options.retries || 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const queryOptions: any = {};
        
        if (options.timeout) {
          queryOptions.timeout = options.timeout;
        }

        return await this.pool.query(text, params);
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries || !this.isRetryableError(error)) {
          throw error;
        }

        this.logger.warn('Query failed, retrying', {
          attempt,
          maxRetries,
          error: error.message
        });

        // Exponential backoff
        await this.sleep(Math.pow(2, attempt - 1) * 1000);
      }
    }

    throw lastError!;
  }

  private isRetryableError(error: any): boolean {
    // Retry on connection errors, timeouts, etc.
    const retryableCodes = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH'
    ];

    return retryableCodes.some(code => 
      error.code === code || error.message.includes(code)
    );
  }

  private generateQueryId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private sanitizeQueryForLogging(query: string): string {
    // Remove sensitive data patterns from query for logging
    return query
      .replace(/password\s*=\s*['"'][^'"]*['"]/gi, "password='***'")
      .replace(/token\s*=\s*['"'][^'"]*['"]/gi, "token='***'")
      .replace(/\$\d+/g, '?'); // Replace parameter placeholders
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// TODO: Add query performance monitoring and slow query logging
// TODO: Implement read/write splitting for scalability
// TODO: Add query result caching for frequently accessed data
// TODO: Implement database connection failover
// TODO: Add query builder integration (optional)
// TODO: Implement database migration runner
// TODO: Add connection pooling metrics and alerts
