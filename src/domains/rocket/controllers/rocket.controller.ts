/**
 * Rocket Controller
 * 
 * HTTP request handlers for rocket-related endpoints.
 * Follows the controller pattern established in the auth module.
 */

import { Request, Response } from 'express';
import { RocketService } from '../services/rocket.service';
import { 
  CreateRocketRequest, 
  UpdateRocketRequest, 
  LaunchRocketRequest,
  ComplexityLevel
} from '../../../shared/types/rocket';

export class RocketController {
  constructor(private rocketService: RocketService) {}

  /**
   * POST /api/v1/rockets
   * Create a new rocket design
   */
  createRocket = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      const data: CreateRocketRequest = req.body;
      const rocket = await this.rocketService.createRocket(userId, data);

      res.status(201).json({
        success: true,
        message: 'Rocket created successfully',
        data: rocket
      });
    } catch (error) {
      console.error('Error creating rocket:', error);
      
      if (error.message.includes('Validation failed')) {
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to create rocket',
          code: 'CREATION_ERROR'
        });
      }
    }
  };

  /**
   * GET /api/v1/rockets/:id
   * Get rocket by ID
   */
  getRocket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const rocket = await this.rocketService.getRocket(id, userId);

      if (!rocket) {
        res.status(404).json({
          success: false,
          message: 'Rocket not found',
          code: 'ROCKET_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        data: rocket
      });
    } catch (error) {
      console.error('Error getting rocket:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get rocket',
        code: 'RETRIEVAL_ERROR'
      });
    }
  };

  /**
   * PUT /api/v1/rockets/:id
   * Update rocket design
   */
  updateRocket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      const data: UpdateRocketRequest = req.body;
      const rocket = await this.rocketService.updateRocket(id, userId, data);

      res.json({
        success: true,
        message: 'Rocket updated successfully',
        data: rocket
      });
    } catch (error) {
      console.error('Error updating rocket:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        res.status(404).json({
          success: false,
          message: error.message,
          code: 'ROCKET_NOT_FOUND'
        });
      } else if (error.message.includes('Validation failed')) {
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update rocket',
          code: 'UPDATE_ERROR'
        });
      }
    }
  };

  /**
   * DELETE /api/v1/rockets/:id
   * Delete rocket design
   */
  deleteRocket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      const success = await this.rocketService.deleteRocket(id, userId);

      if (!success) {
        res.status(404).json({
          success: false,
          message: 'Rocket not found or access denied',
          code: 'ROCKET_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Rocket deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting rocket:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete rocket',
        code: 'DELETION_ERROR'
      });
    }
  };

  /**
   * GET /api/v1/rockets
   * List rockets with filtering and pagination
   */
  listRockets = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const {
        public: isPublic,
        complexity,
        tags,
        search,
        page = '1',
        limit = '20',
        sortBy = 'created_at',
        sortOrder = 'desc',
        my: myRockets
      } = req.query;

      const options = {
        userId: myRockets === 'true' ? userId : undefined,
        isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
        complexity: complexity as ComplexityLevel,
        tags: typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : undefined,
        search: search as string,
        page: parseInt(page as string, 10),
        limit: Math.min(parseInt(limit as string, 10), 100), // Max 100 per page
        sortBy: sortBy as 'created_at' | 'updated_at' | 'likes' | 'name',
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const result = await this.rocketService.listRockets(options);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error listing rockets:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to list rockets',
        code: 'LIST_ERROR'
      });
    }
  };

  /**
   * POST /api/v1/rockets/:id/launch
   * Launch rocket simulation
   */
  launchRocket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      const launchRequest: LaunchRocketRequest = req.body;
      const simulation = await this.rocketService.launchRocket(id, userId, launchRequest);

      res.status(201).json({
        success: true,
        message: 'Rocket launched successfully',
        data: simulation
      });
    } catch (error) {
      console.error('Error launching rocket:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        res.status(404).json({
          success: false,
          message: error.message,
          code: 'ROCKET_NOT_FOUND'
        });
      } else if (error.message.includes('Cannot launch')) {
        res.status(403).json({
          success: false,
          message: error.message,
          code: 'LAUNCH_FORBIDDEN'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to launch rocket',
          code: 'LAUNCH_ERROR'
        });
      }
    }
  };

  /**
   * GET /api/v1/rockets/:id/simulations
   * Get rocket simulation history
   */
  getRocketSimulations = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const {
        page = '1',
        limit = '20',
        telemetry = 'false'
      } = req.query;

      const options = {
        page: parseInt(page as string, 10),
        limit: Math.min(parseInt(limit as string, 10), 50), // Max 50 per page
        includeTelemetry: telemetry === 'true'
      };

      const result = await this.rocketService.getRocketSimulations(id, userId, options);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error getting rocket simulations:', error);
      
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        res.status(404).json({
          success: false,
          message: error.message,
          code: 'ROCKET_NOT_FOUND'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to get rocket simulations',
          code: 'SIMULATIONS_ERROR'
        });
      }
    }
  };

  /**
   * GET /api/v1/simulations/:id
   * Get simulation by ID
   */
  getSimulation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { telemetry = 'false' } = req.query;

      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      const includeTelemetry = telemetry === 'true';
      const simulation = await this.rocketService.getSimulation(id, userId, includeTelemetry);

      if (!simulation) {
        res.status(404).json({
          success: false,
          message: 'Simulation not found',
          code: 'SIMULATION_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        data: simulation
      });
    } catch (error) {
      console.error('Error getting simulation:', error);
      
      if (error.message.includes('Access denied')) {
        res.status(403).json({
          success: false,
          message: error.message,
          code: 'ACCESS_DENIED'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to get simulation',
          code: 'SIMULATION_ERROR'
        });
      }
    }
  };

  /**
   * GET /api/v1/users/me/rockets
   * Get current user's rockets
   */
  getUserRockets = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      const { private: includePrivate = 'true' } = req.query;
      const rockets = await this.rocketService.getUserRockets(
        userId, 
        includePrivate === 'true'
      );

      res.json({
        success: true,
        data: rockets
      });
    } catch (error) {
      console.error('Error getting user rockets:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user rockets',
        code: 'USER_ROCKETS_ERROR'
      });
    }
  };

  /**
   * GET /api/v1/users/me/simulations
   * Get current user's simulation history
   */
  getUserSimulations = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      const {
        page = '1',
        limit = '20',
        successful
      } = req.query;

      const options = {
        page: parseInt(page as string, 10),
        limit: Math.min(parseInt(limit as string, 10), 50),
        successful: successful === 'true' ? true : successful === 'false' ? false : undefined
      };

      const result = await this.rocketService.getUserSimulations(userId, options);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error getting user simulations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user simulations',
        code: 'USER_SIMULATIONS_ERROR'
      });
    }
  };

  /**
   * GET /api/v1/leaderboard
   * Get performance leaderboard
   */
  getLeaderboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        metric = 'max_altitude',
        limit = '10',
        timeframe = 'all'
      } = req.query;

      const options = {
        metric: metric as 'max_altitude' | 'max_velocity' | 'score',
        limit: Math.min(parseInt(limit as string, 10), 100),
        timeframe: timeframe as 'day' | 'week' | 'month' | 'all'
      };

      const result = await this.rocketService.getLeaderboard(options);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get leaderboard',
        code: 'LEADERBOARD_ERROR'
      });
    }
  };

  /**
   * GET /api/v1/rockets/popular
   * Get popular rockets
   */
  getPopularRockets = async (req: Request, res: Response): Promise<void> => {
    try {
      const { limit = '10' } = req.query;
      const rockets = await this.rocketService.getPopularRockets(
        Math.min(parseInt(limit as string, 10), 50)
      );

      res.json({
        success: true,
        data: rockets
      });
    } catch (error) {
      console.error('Error getting popular rockets:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get popular rockets',
        code: 'POPULAR_ROCKETS_ERROR'
      });
    }
  };

  /**
   * POST /api/v1/rockets/:id/like
   * Like a rocket
   */
  likeRocket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      await this.rocketService.likeRocket(id, userId);

      res.json({
        success: true,
        message: 'Rocket liked successfully'
      });
    } catch (error) {
      console.error('Error liking rocket:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          code: 'ROCKET_NOT_FOUND'
        });
      } else if (error.message.includes('Cannot like')) {
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'LIKE_ERROR'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to like rocket',
          code: 'LIKE_ERROR'
        });
      }
    }
  };

  /**
   * POST /api/v1/rockets/:id/download
   * Download/copy a rocket design
   */
  downloadRocket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      const copiedRocket = await this.rocketService.downloadRocket(id, userId);

      res.status(201).json({
        success: true,
        message: 'Rocket downloaded successfully',
        data: copiedRocket
      });
    } catch (error) {
      console.error('Error downloading rocket:', error);
      
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          code: 'ROCKET_NOT_FOUND'
        });
      } else if (error.message.includes('Cannot download')) {
        res.status(403).json({
          success: false,
          message: error.message,
          code: 'DOWNLOAD_FORBIDDEN'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to download rocket',
          code: 'DOWNLOAD_ERROR'
        });
      }
    }
  };

  /**
   * POST /api/v1/rockets/estimate
   * Get performance estimate for rocket configuration
   */
  estimatePerformance = async (req: Request, res: Response): Promise<void> => {
    try {
      const config = req.body;
      const estimate = await this.rocketService.estimatePerformance(config);

      res.json({
        success: true,
        data: estimate
      });
    } catch (error) {
      console.error('Error estimating performance:', error);
      
      if (error.message.includes('validation failed')) {
        res.status(400).json({
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to estimate performance',
          code: 'ESTIMATION_ERROR'
        });
      }
    }
  };

  /**
   * GET /api/v1/users/me/stats
   * Get current user's statistics
   */
  getUserStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
        return;
      }

      const stats = await this.rocketService.getUserStats(userId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting user stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user stats',
        code: 'STATS_ERROR'
      });
    }
  };
}
