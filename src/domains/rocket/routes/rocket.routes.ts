/**
 * Rocket Routes
 * 
 * HTTP route definitions for the rocket module.
 * Integrates with auth middleware for secure endpoints.
 */

import { Router } from 'express';
import { RocketController } from '../controllers/rocket.controller';
import { RocketService } from '../services/rocket.service';
import { ValidationService } from '../services/validation.service';
import { RocketRepository } from '../repositories/rocket.repository';
import { SimulationRepository } from '../repositories/simulation.repository';
import { DatabaseService } from '../../../infrastructure/database/database.service';
import { CacheService } from '../../../infrastructure/cache/cache.service';

// Import auth middleware (assuming it exists in the auth module)
// These would need to be implemented based on the auth module structure
interface AuthMiddleware {
  authenticate: (req: any, res: any, next: any) => void;
  optionalAuth: (req: any, res: any, next: any) => void;
  requireAuth: (req: any, res: any, next: any) => void;
}

export function createRocketRoutes(
  databaseService: DatabaseService,
  cacheService: CacheService,
  authMiddleware: AuthMiddleware
): Router {
  const router = Router();

  // Initialize dependencies
  const rocketRepository = new RocketRepository(databaseService);
  const simulationRepository = new SimulationRepository(databaseService);
  const validationService = new ValidationService();
  const rocketService = new RocketService(
    rocketRepository,
    simulationRepository,
    validationService,
    cacheService
  );
  const rocketController = new RocketController(rocketService);

  // Public routes (no authentication required)
  
  /**
   * GET /api/v1/rockets/popular
   * Get popular public rockets
   */
  router.get('/popular', rocketController.getPopularRockets);

  /**
   * GET /api/v1/leaderboard
   * Get performance leaderboard
   */
  router.get('/leaderboard', rocketController.getLeaderboard);

  /**
   * POST /api/v1/rockets/estimate
   * Get performance estimate for rocket configuration
   * (Public endpoint for design assistance)
   */
  router.post('/estimate', rocketController.estimatePerformance);

  // Semi-public routes (optional authentication - affects what data is returned)
  
  /**
   * GET /api/v1/rockets
   * List rockets (public rockets for anonymous, includes private for authenticated users)
   */
  router.get('/', authMiddleware.optionalAuth, rocketController.listRockets);

  /**
   * GET /api/v1/rockets/:id
   * Get rocket by ID (public rockets for anonymous, includes private if owned)
   */
  router.get('/:id', authMiddleware.optionalAuth, rocketController.getRocket);

  /**
   * GET /api/v1/rockets/:id/simulations
   * Get rocket simulation history (public rockets for anonymous, includes private if owned)
   */
  router.get('/:id/simulations', authMiddleware.optionalAuth, rocketController.getRocketSimulations);

  // Protected routes (authentication required)

  /**
   * POST /api/v1/rockets
   * Create a new rocket design
   */
  router.post('/', authMiddleware.requireAuth, rocketController.createRocket);

  /**
   * PUT /api/v1/rockets/:id
   * Update rocket design (owner only)
   */
  router.put('/:id', authMiddleware.requireAuth, rocketController.updateRocket);

  /**
   * DELETE /api/v1/rockets/:id
   * Delete rocket design (owner only)
   */
  router.delete('/:id', authMiddleware.requireAuth, rocketController.deleteRocket);

  /**
   * POST /api/v1/rockets/:id/launch
   * Launch rocket simulation (owner only)
   */
  router.post('/:id/launch', authMiddleware.requireAuth, rocketController.launchRocket);

  /**
   * POST /api/v1/rockets/:id/like
   * Like a public rocket
   */
  router.post('/:id/like', authMiddleware.requireAuth, rocketController.likeRocket);

  /**
   * POST /api/v1/rockets/:id/download
   * Download/copy a public rocket design
   */
  router.post('/:id/download', authMiddleware.requireAuth, rocketController.downloadRocket);

  // User-specific routes

  /**
   * GET /api/v1/users/me/rockets
   * Get current user's rockets
   */
  router.get('/users/me/rockets', authMiddleware.requireAuth, rocketController.getUserRockets);

  /**
   * GET /api/v1/users/me/simulations
   * Get current user's simulation history
   */
  router.get('/users/me/simulations', authMiddleware.requireAuth, rocketController.getUserSimulations);

  /**
   * GET /api/v1/users/me/stats
   * Get current user's statistics
   */
  router.get('/users/me/stats', authMiddleware.requireAuth, rocketController.getUserStats);

  // Simulation-specific routes

  /**
   * GET /api/v1/simulations/:id
   * Get simulation by ID (owner only or public rocket)
   */
  router.get('/simulations/:id', authMiddleware.requireAuth, rocketController.getSimulation);

  return router;
}

/**
 * Middleware factory for creating auth-aware rocket routes
 * This integrates with the existing auth module
 */
export function createAuthenticatedRocketRoutes(
  databaseService: DatabaseService,
  cacheService: CacheService
): Router {
  // Mock auth middleware - replace with actual auth middleware from auth module
  const authMiddleware: AuthMiddleware = {
    authenticate: (req, res, next) => {
      // Extract JWT token from Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // TODO: Verify JWT token and set req.user
        // This should use the AuthService from the auth module
        try {
          // Mock user for now - replace with actual JWT verification
          req.user = { id: 'mock-user-id', email: 'user@example.com' };
          next();
        } catch (error) {
          res.status(401).json({
            success: false,
            message: 'Invalid authentication token',
            code: 'INVALID_TOKEN'
          });
        }
      } else {
        res.status(401).json({
          success: false,
          message: 'Authentication token required',
          code: 'MISSING_TOKEN'
        });
      }
    },

    optionalAuth: (req, res, next) => {
      // Same as authenticate but doesn't fail if no token
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          // TODO: Verify JWT token and set req.user
          req.user = { id: 'mock-user-id', email: 'user@example.com' };
        } catch (error) {
          // Ignore invalid tokens for optional auth
        }
      }
      next();
    },

    requireAuth: (req, res, next) => {
      // Alias for authenticate for clearer intent
      authMiddleware.authenticate(req, res, next);
    }
  };

  return createRocketRoutes(databaseService, cacheService, authMiddleware);
}

/**
 * Rate limiting configuration for rocket endpoints
 */
export const rocketRateLimits = {
  // General rocket operations
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per window
  },
  
  // Rocket creation (more restrictive)
  create: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10 // 10 rockets per hour
  },
  
  // Simulation launches (most restrictive)
  launch: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50 // 50 simulations per hour
  },
  
  // Public endpoints (less restrictive)
  public: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200 // 200 requests per window
  }
};

/**
 * Validation middleware for rocket routes
 */
export const rocketValidationMiddleware = {
  /**
   * Validate rocket ID parameter
   */
  validateRocketId: (req: any, res: any, next: any) => {
    const { id } = req.params;
    
    // UUID validation (basic)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid rocket ID format',
        code: 'INVALID_ROCKET_ID'
      });
    }
    
    next();
  },

  /**
   * Validate simulation ID parameter
   */
  validateSimulationId: (req: any, res: any, next: any) => {
    const { id } = req.params;
    
    // UUID validation (basic)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid simulation ID format',
        code: 'INVALID_SIMULATION_ID'
      });
    }
    
    next();
  },

  /**
   * Validate pagination parameters
   */
  validatePagination: (req: any, res: any, next: any) => {
    const { page, limit } = req.query;
    
    if (page && (isNaN(parseInt(page)) || parseInt(page) < 1)) {
      return res.status(400).json({
        success: false,
        message: 'Page must be a positive integer',
        code: 'INVALID_PAGE'
      });
    }
    
    if (limit && (isNaN(parseInt(limit)) || parseInt(limit) < 1 || parseInt(limit) > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100',
        code: 'INVALID_LIMIT'
      });
    }
    
    next();
  }
};
