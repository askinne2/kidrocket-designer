/**
 * Rocket Service
 * 
 * Business logic layer for rocket operations, following the service pattern
 * established in the auth module.
 */

import { RocketRepository } from '../repositories/rocket.repository';
import { SimulationRepository } from '../repositories/simulation.repository';
import { SimulationEngine } from './simulation.engine';
import { ValidationService } from './validation.service';
import { CacheService } from '../../../infrastructure/cache/cache.service';

import {
  RocketDesign,
  CreateRocketRequest,
  UpdateRocketRequest,
  LaunchRocketRequest,
  RocketListResponse,
  SimulationResult,
  SimulationListResponse,
  LaunchOptions,
  WeatherConditions,
  DEFAULT_WEATHER,
  ROCKET_CONSTRAINTS
} from '../../../shared/types/rocket';

export class RocketService {
  constructor(
    private rocketRepository: RocketRepository,
    private simulationRepository: SimulationRepository,
    private validationService: ValidationService,
    private cacheService: CacheService
  ) {}

  /**
   * Create a new rocket design
   */
  async createRocket(userId: string, data: CreateRocketRequest): Promise<RocketDesign> {
    // Validate input data
    const validation = await this.validationService.validateCreateRocket(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Validate rocket configuration physics
    const configValidation = await this.validationService.validateRocketConfig(data.config);
    if (!configValidation.isValid) {
      throw new Error(`Configuration validation failed: ${configValidation.errors.join(', ')}`);
    }

    try {
      // Create rocket in database
      const rocket = await this.rocketRepository.create(userId, data);

      // Cache the rocket for quick access
      await this.cacheService.set(`rocket:${rocket.id}`, rocket, 3600); // 1 hour TTL

      // Clear user's rocket list cache
      await this.cacheService.del(`user_rockets:${userId}`);

      return rocket;
    } catch (error) {
      throw new Error(`Failed to create rocket: ${error.message}`);
    }
  }

  /**
   * Get rocket by ID
   */
  async getRocket(id: string, userId?: string): Promise<RocketDesign | null> {
    // Check cache first
    const cacheKey = `rocket:${id}`;
    const cached = await this.cacheService.get<RocketDesign>(cacheKey);
    if (cached) {
      // Verify access permissions for cached data
      if (!userId || cached.userId === userId || cached.metadata.isPublic) {
        return cached;
      }
    }

    try {
      const rocket = await this.rocketRepository.findById(id, userId);
      
      if (rocket) {
        // Cache the result
        await this.cacheService.set(cacheKey, rocket, 3600);
      }

      return rocket;
    } catch (error) {
      throw new Error(`Failed to get rocket: ${error.message}`);
    }
  }

  /**
   * Update rocket design
   */
  async updateRocket(id: string, userId: string, data: UpdateRocketRequest): Promise<RocketDesign> {
    // Validate input data
    const validation = await this.validationService.validateUpdateRocket(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // If config is being updated, validate it
    if (data.config) {
      const configValidation = await this.validationService.validateRocketConfig(data.config);
      if (!configValidation.isValid) {
        throw new Error(`Configuration validation failed: ${configValidation.errors.join(', ')}`);
      }
    }

    try {
      const rocket = await this.rocketRepository.update(id, userId, data);

      // Update cache
      await this.cacheService.set(`rocket:${id}`, rocket, 3600);

      // Clear related caches
      await this.cacheService.del(`user_rockets:${userId}`);

      return rocket;
    } catch (error) {
      throw new Error(`Failed to update rocket: ${error.message}`);
    }
  }

  /**
   * Delete rocket design
   */
  async deleteRocket(id: string, userId: string): Promise<boolean> {
    try {
      const success = await this.rocketRepository.delete(id, userId);

      if (success) {
        // Clear caches
        await this.cacheService.del(`rocket:${id}`);
        await this.cacheService.del(`user_rockets:${userId}`);
        await this.cacheService.del(`rocket_simulations:${id}`);
      }

      return success;
    } catch (error) {
      throw new Error(`Failed to delete rocket: ${error.message}`);
    }
  }

  /**
   * List rockets with filtering and pagination
   */
  async listRockets(options: {
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
    // Generate cache key based on options
    const cacheKey = `rocket_list:${JSON.stringify(options)}`;
    
    // Check cache for public lists only (user-specific lists are too dynamic)
    if (!options.userId) {
      const cached = await this.cacheService.get<RocketListResponse>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const result = await this.rocketRepository.findMany(options);

      // Cache public results
      if (!options.userId) {
        await this.cacheService.set(cacheKey, result, 600); // 10 minutes TTL
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to list rockets: ${error.message}`);
    }
  }

  /**
   * Get user's rockets
   */
  async getUserRockets(userId: string, includePrivate: boolean = true): Promise<RocketDesign[]> {
    const cacheKey = `user_rockets:${userId}:${includePrivate}`;
    
    const cached = await this.cacheService.get<RocketDesign[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const rockets = await this.rocketRepository.findByUserId(userId, includePrivate);

      // Cache user's rockets
      await this.cacheService.set(cacheKey, rockets, 1800); // 30 minutes TTL

      return rockets;
    } catch (error) {
      throw new Error(`Failed to get user rockets: ${error.message}`);
    }
  }

  /**
   * Launch rocket simulation
   */
  async launchRocket(
    rocketId: string, 
    userId: string, 
    request: LaunchRocketRequest = {}
  ): Promise<SimulationResult> {
    // Get rocket design
    const rocket = await this.getRocket(rocketId, userId);
    if (!rocket) {
      throw new Error('Rocket not found or access denied');
    }

    if (rocket.userId !== userId) {
      throw new Error('Cannot launch rocket you do not own');
    }

    // Prepare simulation parameters
    const weather = { ...DEFAULT_WEATHER, ...request.options?.weather };
    const launchOptions = request.options || {};

    try {
      // Run simulation
      const simulationEngine = new SimulationEngine(launchOptions);
      const { results, telemetry } = await simulationEngine.simulate(
        rocket.config,
        weather,
        launchOptions
      );

      // Save simulation results
      const simulation = await this.simulationRepository.create({
        rocketId: rocket.id,
        userId,
        config: rocket.config,
        results,
        telemetry,
        weather,
        launchOptions
      });

      // Clear simulation cache for this rocket
      await this.cacheService.del(`rocket_simulations:${rocketId}`);

      // Update rocket metadata if this is a successful flight
      if (results.successful && results.score > 70) {
        // Could increment a "successful launches" counter or similar
      }

      return simulation;
    } catch (error) {
      throw new Error(`Failed to launch rocket: ${error.message}`);
    }
  }

  /**
   * Get rocket simulations
   */
  async getRocketSimulations(
    rocketId: string, 
    userId?: string,
    options: { page?: number; limit?: number; includeTelemetry?: boolean } = {}
  ): Promise<SimulationListResponse> {
    // Verify rocket access
    const rocket = await this.getRocket(rocketId, userId);
    if (!rocket) {
      throw new Error('Rocket not found or access denied');
    }

    const cacheKey = `rocket_simulations:${rocketId}:${JSON.stringify(options)}`;
    
    // Only cache if not including telemetry (telemetry data is large)
    if (!options.includeTelemetry) {
      const cached = await this.cacheService.get<SimulationListResponse>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const result = await this.simulationRepository.findByRocketId(rocketId, options);

      // Cache non-telemetry results
      if (!options.includeTelemetry) {
        await this.cacheService.set(cacheKey, result, 600); // 10 minutes TTL
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to get rocket simulations: ${error.message}`);
    }
  }

  /**
   * Get simulation by ID
   */
  async getSimulation(id: string, userId: string, includeTelemetry: boolean = false): Promise<SimulationResult | null> {
    try {
      const simulation = await this.simulationRepository.findById(id, includeTelemetry);
      
      if (!simulation) {
        return null;
      }

      // Verify user owns the simulation or the associated rocket is public
      if (simulation.userId !== userId) {
        const rocket = await this.getRocket(simulation.rocketId, userId);
        if (!rocket || !rocket.metadata.isPublic) {
          throw new Error('Access denied');
        }
      }

      return simulation;
    } catch (error) {
      throw new Error(`Failed to get simulation: ${error.message}`);
    }
  }

  /**
   * Get user's simulation history
   */
  async getUserSimulations(
    userId: string,
    options: { page?: number; limit?: number; successful?: boolean } = {}
  ): Promise<SimulationListResponse> {
    try {
      return await this.simulationRepository.findByUserId(userId, options);
    } catch (error) {
      throw new Error(`Failed to get user simulations: ${error.message}`);
    }
  }

  /**
   * Get performance leaderboard
   */
  async getLeaderboard(options: {
    metric?: 'max_altitude' | 'max_velocity' | 'score';
    limit?: number;
    timeframe?: 'day' | 'week' | 'month' | 'all';
  } = {}): Promise<Array<{
    simulation: SimulationResult;
    rocketName: string;
    userName: string;
  }>> {
    const cacheKey = `leaderboard:${JSON.stringify(options)}`;
    
    const cached = await this.cacheService.get<Array<{
      simulation: SimulationResult;
      rocketName: string;
      userName: string;
    }>>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const result = await this.simulationRepository.getLeaderboard(options);

      // Cache leaderboard for 5 minutes
      await this.cacheService.set(cacheKey, result, 300);

      return result;
    } catch (error) {
      throw new Error(`Failed to get leaderboard: ${error.message}`);
    }
  }

  /**
   * Get popular rockets
   */
  async getPopularRockets(limit: number = 10): Promise<RocketDesign[]> {
    const cacheKey = `popular_rockets:${limit}`;
    
    const cached = await this.cacheService.get<RocketDesign[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const rockets = await this.rocketRepository.findPopular(limit);

      // Cache popular rockets for 15 minutes
      await this.cacheService.set(cacheKey, rockets, 900);

      return rockets;
    } catch (error) {
      throw new Error(`Failed to get popular rockets: ${error.message}`);
    }
  }

  /**
   * Like a rocket (increment likes count)
   */
  async likeRocket(id: string, userId: string): Promise<void> {
    // Verify rocket exists and is public
    const rocket = await this.getRocket(id, userId);
    if (!rocket) {
      throw new Error('Rocket not found');
    }

    if (!rocket.metadata.isPublic) {
      throw new Error('Cannot like private rocket');
    }

    if (rocket.userId === userId) {
      throw new Error('Cannot like your own rocket');
    }

    try {
      await this.rocketRepository.incrementLikes(id);

      // Clear relevant caches
      await this.cacheService.del(`rocket:${id}`);
      await this.cacheService.del('popular_rockets:*');
    } catch (error) {
      throw new Error(`Failed to like rocket: ${error.message}`);
    }
  }

  /**
   * Download/copy a rocket design
   */
  async downloadRocket(id: string, userId: string): Promise<RocketDesign> {
    // Get the original rocket
    const originalRocket = await this.getRocket(id, userId);
    if (!originalRocket) {
      throw new Error('Rocket not found');
    }

    if (!originalRocket.metadata.isPublic && originalRocket.userId !== userId) {
      throw new Error('Cannot download private rocket');
    }

    try {
      // Increment download count
      if (originalRocket.userId !== userId) {
        await this.rocketRepository.incrementDownloads(id);
      }

      // Create a copy for the user
      const copyData: CreateRocketRequest = {
        name: `${originalRocket.name} (Copy)`,
        description: originalRocket.description,
        config: originalRocket.config,
        metadata: {
          ...originalRocket.metadata,
          isPublic: false, // Copies are private by default
          likes: 0,
          downloads: 0
        }
      };

      const copiedRocket = await this.createRocket(userId, copyData);

      // Clear relevant caches
      await this.cacheService.del(`rocket:${id}`);
      await this.cacheService.del('popular_rockets:*');

      return copiedRocket;
    } catch (error) {
      throw new Error(`Failed to download rocket: ${error.message}`);
    }
  }

  /**
   * Get quick performance estimate without full simulation
   */
  async estimatePerformance(config: any): Promise<{
    estimatedAltitude: number;
    estimatedVelocity: number;
    thrustToWeight: number;
    stabilityMargin: number;
    recommendations: string[];
  }> {
    // Validate configuration first
    const configValidation = await this.validationService.validateRocketConfig(config);
    if (!configValidation.isValid) {
      throw new Error(`Configuration validation failed: ${configValidation.errors.join(', ')}`);
    }

    try {
      const estimate = SimulationEngine.estimatePerformance(config);
      const recommendations: string[] = [];

      // Generate recommendations based on estimates
      if (estimate.thrustToWeight < 5) {
        recommendations.push('Consider a more powerful engine for better performance');
      }

      if (estimate.stabilityMargin < 1.0) {
        recommendations.push('Increase fin size or move center of gravity forward for better stability');
      }

      if (estimate.estimatedAltitude < 50) {
        recommendations.push('Reduce rocket weight or increase engine power for higher altitude');
      }

      return {
        ...estimate,
        recommendations
      };
    } catch (error) {
      throw new Error(`Failed to estimate performance: ${error.message}`);
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<{
    totalRockets: number;
    publicRockets: number;
    totalSimulations: number;
    successfulSimulations: number;
    bestAltitude: number;
    bestVelocity: number;
    averageScore: number;
  }> {
    const cacheKey = `user_stats:${userId}`;
    
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get rocket stats
      const rockets = await this.rocketRepository.findByUserId(userId, true);
      const totalRockets = rockets.length;
      const publicRockets = rockets.filter(r => r.metadata.isPublic).length;

      // Get simulation stats
      const simStats = await this.simulationRepository.getUserStats(userId);

      const stats = {
        totalRockets,
        publicRockets,
        ...simStats
      };

      // Cache stats for 10 minutes
      await this.cacheService.set(cacheKey, stats, 600);

      return stats;
    } catch (error) {
      throw new Error(`Failed to get user stats: ${error.message}`);
    }
  }
}
