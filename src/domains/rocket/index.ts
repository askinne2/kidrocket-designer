/**
 * Rocket Module Index
 * 
 * Main entry point for the rocket domain module.
 * Exports all public interfaces and factory functions for integration.
 */

// Types
export * from '../../shared/types/rocket';

// Services
export { RocketService } from './services/rocket.service';
export { SimulationEngine } from './services/simulation.engine';
export { ValidationService as RocketValidationService } from './services/validation.service';

// Repositories
export { RocketRepository } from './repositories/rocket.repository';
export { SimulationRepository } from './repositories/simulation.repository';

// Controllers
export { RocketController } from './controllers/rocket.controller';

// Routes
export { 
  createRocketRoutes, 
  createAuthenticatedRocketRoutes,
  rocketRateLimits,
  rocketValidationMiddleware
} from './routes/rocket.routes';

// Factory functions for dependency injection
export function createRocketModule(dependencies: {
  databaseService: any;
  cacheService: any;
}) {
  const { databaseService, cacheService } = dependencies;
  
  // Create repositories
  const rocketRepository = new RocketRepository(databaseService);
  const simulationRepository = new SimulationRepository(databaseService);
  
  // Create services
  const validationService = new ValidationService();
  const rocketService = new RocketService(
    rocketRepository,
    simulationRepository,
    validationService,
    cacheService
  );
  
  // Create controller
  const rocketController = new RocketController(rocketService);
  
  return {
    // Repositories
    rocketRepository,
    simulationRepository,
    
    // Services
    rocketService,
    validationService,
    
    // Controller
    rocketController,
    
    // Utility functions
    createRoutes: (authMiddleware: any) => 
      createRocketRoutes(databaseService, cacheService, authMiddleware)
  };
}
