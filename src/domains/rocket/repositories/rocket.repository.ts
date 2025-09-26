/**
 * Rocket Repository
 * 
 * Data access layer for rocket designs following the repository pattern
 * established in the auth module.
 */

import { DatabaseService } from '../../../infrastructure/database/database.service';
import { 
  RocketDesign, 
  CreateRocketRequest, 
  UpdateRocketRequest,
  RocketListResponse,
  ROCKET_CONSTRAINTS 
} from '../../../shared/types/rocket';

export class RocketRepository {
  constructor(private db: DatabaseService) {}

  /**
   * Create a new rocket design
   */
  async create(userId: string, data: CreateRocketRequest): Promise<RocketDesign> {
    const query = `
      INSERT INTO rockets (
        user_id, name, description, config, 
        tags, is_public, complexity, estimated_cost, build_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
        id, user_id, name, description, version, config,
        thumbnail, tags, is_public, likes, downloads, complexity,
        estimated_cost, build_time, created_at, updated_at
    `;

    const values = [
      userId,
      data.name,
      data.description || null,
      JSON.stringify(data.config),
      data.metadata?.tags || [],
      data.metadata?.isPublic || false,
      data.metadata?.complexity || 'beginner',
      data.metadata?.estimatedCost || 0,
      data.metadata?.buildTime || 0
    ];

    try {
      const result = await this.db.query(query, values);
      return this.mapRowToRocket(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create rocket: ${error.message}`);
    }
  }

  /**
   * Find rocket by ID
   */
  async findById(id: string, userId?: string): Promise<RocketDesign | null> {
    let query = `
      SELECT 
        id, user_id, name, description, version, config,
        thumbnail, tags, is_public, likes, downloads, complexity,
        estimated_cost, build_time, created_at, updated_at
      FROM rockets 
      WHERE id = $1
    `;
    
    const values = [id];

    // If userId provided, ensure user owns rocket or it's public
    if (userId) {
      query += ` AND (user_id = $2 OR is_public = true)`;
      values.push(userId);
    } else {
      // If no user context, only show public rockets
      query += ` AND is_public = true`;
    }

    try {
      const result = await this.db.query(query, values);
      return result.rows.length > 0 ? this.mapRowToRocket(result.rows[0]) : null;
    } catch (error) {
      throw new Error(`Failed to find rocket: ${error.message}`);
    }
  }

  /**
   * Update rocket design (creates new version)
   */
  async update(id: string, userId: string, data: UpdateRocketRequest): Promise<RocketDesign> {
    // First verify ownership
    const existing = await this.findById(id, userId);
    if (!existing || existing.userId !== userId) {
      throw new Error('Rocket not found or access denied');
    }

    const query = `
      UPDATE rockets 
      SET 
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        config = COALESCE($5, config),
        version = version + 1,
        tags = COALESCE($6, tags),
        is_public = COALESCE($7, is_public),
        complexity = COALESCE($8, complexity),
        estimated_cost = COALESCE($9, estimated_cost),
        build_time = COALESCE($10, build_time),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING 
        id, user_id, name, description, version, config,
        thumbnail, tags, is_public, likes, downloads, complexity,
        estimated_cost, build_time, created_at, updated_at
    `;

    const values = [
      id,
      userId,
      data.name,
      data.description,
      data.config ? JSON.stringify(data.config) : null,
      data.metadata?.tags,
      data.metadata?.isPublic,
      data.metadata?.complexity,
      data.metadata?.estimatedCost,
      data.metadata?.buildTime
    ];

    try {
      const result = await this.db.query(query, values);
      return this.mapRowToRocket(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to update rocket: ${error.message}`);
    }
  }

  /**
   * Delete rocket design
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const query = `
      DELETE FROM rockets 
      WHERE id = $1 AND user_id = $2
    `;

    try {
      const result = await this.db.query(query, [id, userId]);
      return result.rowCount > 0;
    } catch (error) {
      throw new Error(`Failed to delete rocket: ${error.message}`);
    }
  }

  /**
   * List rockets with pagination and filtering
   */
  async findMany(options: {
    userId?: string;
    isPublic?: boolean;
    complexity?: string;
    tags?: string[];
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: 'created_at' | 'updated_at' | 'likes' | 'name';
    sortOrder?: 'asc' | 'desc';
  }): Promise<RocketListResponse> {
    const {
      userId,
      isPublic,
      complexity,
      tags,
      search,
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = options;

    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramCount = 0;

    // Build WHERE conditions
    if (userId && isPublic === undefined) {
      // User's own rockets (both public and private)
      whereConditions.push(`user_id = $${++paramCount}`);
      queryParams.push(userId);
    } else if (isPublic !== undefined) {
      whereConditions.push(`is_public = $${++paramCount}`);
      queryParams.push(isPublic);
      
      if (userId && isPublic) {
        // Include user's own rockets OR public rockets
        whereConditions[whereConditions.length - 1] = `(user_id = $${++paramCount} OR is_public = true)`;
        queryParams.push(userId);
      }
    }

    if (complexity) {
      whereConditions.push(`complexity = $${++paramCount}`);
      queryParams.push(complexity);
    }

    if (tags && tags.length > 0) {
      whereConditions.push(`tags && $${++paramCount}`);
      queryParams.push(tags);
    }

    if (search) {
      whereConditions.push(`to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || array_to_string(tags, ' ')) @@ plainto_tsquery('english', $${++paramCount})`);
      queryParams.push(search);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM rockets
      ${whereClause}
    `;

    // Data query
    const dataQuery = `
      SELECT 
        id, user_id, name, description, version, config,
        thumbnail, tags, is_public, likes, downloads, complexity,
        estimated_cost, build_time, created_at, updated_at
      FROM rockets
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder.toUpperCase()}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    queryParams.push(limit, (page - 1) * limit);

    try {
      const [countResult, dataResult] = await Promise.all([
        this.db.query(countQuery, queryParams.slice(0, -2)), // Remove LIMIT/OFFSET params for count
        this.db.query(dataQuery, queryParams)
      ]);

      const total = parseInt(countResult.rows[0].total, 10);
      const rockets = dataResult.rows.map(row => this.mapRowToRocket(row));

      return {
        rockets,
        total,
        page,
        limit
      };
    } catch (error) {
      throw new Error(`Failed to list rockets: ${error.message}`);
    }
  }

  /**
   * Find rockets by user ID
   */
  async findByUserId(userId: string, includePrivate: boolean = true): Promise<RocketDesign[]> {
    const query = `
      SELECT 
        id, user_id, name, description, version, config,
        thumbnail, tags, is_public, likes, downloads, complexity,
        estimated_cost, build_time, created_at, updated_at
      FROM rockets 
      WHERE user_id = $1 ${!includePrivate ? 'AND is_public = true' : ''}
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.db.query(query, [userId]);
      return result.rows.map(row => this.mapRowToRocket(row));
    } catch (error) {
      throw new Error(`Failed to find rockets by user: ${error.message}`);
    }
  }

  /**
   * Increment likes count
   */
  async incrementLikes(id: string): Promise<void> {
    const query = `
      UPDATE rockets 
      SET likes = likes + 1 
      WHERE id = $1 AND is_public = true
    `;

    try {
      await this.db.query(query, [id]);
    } catch (error) {
      throw new Error(`Failed to increment likes: ${error.message}`);
    }
  }

  /**
   * Increment downloads count
   */
  async incrementDownloads(id: string): Promise<void> {
    const query = `
      UPDATE rockets 
      SET downloads = downloads + 1 
      WHERE id = $1 AND is_public = true
    `;

    try {
      await this.db.query(query, [id]);
    } catch (error) {
      throw new Error(`Failed to increment downloads: ${error.message}`);
    }
  }

  /**
   * Get popular rockets (public rockets sorted by likes/downloads)
   */
  async findPopular(limit: number = 10): Promise<RocketDesign[]> {
    const query = `
      SELECT 
        id, user_id, name, description, version, config,
        thumbnail, tags, is_public, likes, downloads, complexity,
        estimated_cost, build_time, created_at, updated_at
      FROM rockets 
      WHERE is_public = true
      ORDER BY (likes * 2 + downloads) DESC, created_at DESC
      LIMIT $1
    `;

    try {
      const result = await this.db.query(query, [limit]);
      return result.rows.map(row => this.mapRowToRocket(row));
    } catch (error) {
      throw new Error(`Failed to find popular rockets: ${error.message}`);
    }
  }

  /**
   * Map database row to RocketDesign object
   */
  private mapRowToRocket(row: any): RocketDesign {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      version: row.version,
      config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      metadata: {
        thumbnail: row.thumbnail,
        tags: row.tags || [],
        isPublic: row.is_public,
        likes: row.likes,
        downloads: row.downloads,
        complexity: row.complexity,
        estimatedCost: parseFloat(row.estimated_cost) || 0,
        buildTime: row.build_time || 0
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
