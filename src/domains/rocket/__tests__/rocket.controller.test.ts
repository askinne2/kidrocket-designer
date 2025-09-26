/**
 * Rocket Controller Tests
 * 
 * Unit tests for the RocketController HTTP endpoints.
 */

import { Request, Response } from 'express';
import { RocketController } from '../controllers/rocket.controller';
import { RocketService } from '../services/rocket.service';
import { 
  RocketDesign, 
  CreateRocketRequest, 
  ComplexityLevel,
  RocketMaterial,
  NoseConeType,
  EngineType,
  RecoveryType
} from '../../../shared/types/rocket';

// Mock the RocketService
jest.mock('../services/rocket.service');

describe('RocketController', () => {
  let rocketController: RocketController;
  let mockRocketService: jest.Mocked<RocketService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  const mockUserId = 'user-123';
  const mockRocketId = 'rocket-456';

  const mockRocketDesign: RocketDesign = {
    id: mockRocketId,
    userId: mockUserId,
    name: 'Test Rocket',
    description: 'A test rocket design',
    version: 1,
    config: {
      body: {
        length: 0.6,
        diameter: 0.024,
        mass: 0.1,
        material: RocketMaterial.CARDBOARD,
        fineness: 25
      },
      noseCone: {
        type: NoseConeType.OGIVE,
        length: 0.1,
        mass: 0.02,
        material: RocketMaterial.BALSA
      },
      fins: {
        count: 4,
        span: 0.08,
        rootChord: 0.06,
        tipChord: 0.03,
        sweepAngle: 30,
        thickness: 0.003,
        material: RocketMaterial.BALSA,
        mass: 0.01
      },
      engine: {
        type: EngineType.C,
        thrust: 12,
        burnTime: 2.5,
        specificImpulse: 180,
        propellantMass: 0.024,
        totalMass: 0.038
      },
      recovery: {
        type: RecoveryType.PARACHUTE,
        deploymentAltitude: 150,
        parachuteDiameter: 0.3,
        chuteCount: 1,
        mass: 0.02
      },
      launch: {
        launchAngle: 0,
        launchRodLength: 1.2,
        windSpeed: 5,
        windDirection: 0
      }
    },
    metadata: {
      thumbnail: undefined,
      tags: ['test', 'beginner'],
      isPublic: false,
      likes: 0,
      downloads: 0,
      complexity: ComplexityLevel.BEGINNER,
      estimatedCost: 25.50,
      buildTime: 2
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  };

  beforeEach(() => {
    // Create mock service
    mockRocketService = new RocketService(
      {} as any, {} as any, {} as any, {} as any
    ) as jest.Mocked<RocketService>;

    // Create controller
    rocketController = new RocketController(mockRocketService);

    // Create mock response methods
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    // Create mock request and response
    mockRequest = {
      user: { id: mockUserId },
      params: {},
      query: {},
      body: {}
    };

    mockResponse = {
      json: mockJson,
      status: mockStatus
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createRocket', () => {
    const createRocketRequest: CreateRocketRequest = {
      name: 'Test Rocket',
      description: 'A test rocket',
      config: mockRocketDesign.config,
      metadata: {
        tags: ['test'],
        complexity: ComplexityLevel.BEGINNER
      }
    };

    it('should create rocket successfully', async () => {
      // Arrange
      mockRequest.body = createRocketRequest;
      mockRocketService.createRocket.mockResolvedValue(mockRocketDesign);

      // Act
      await rocketController.createRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockRocketService.createRocket).toHaveBeenCalledWith(mockUserId, createRocketRequest);
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Rocket created successfully',
        data: mockRocketDesign
      });
    });

    it('should return 401 if user not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;
      mockRequest.body = createRocketRequest;

      // Act
      await rocketController.createRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockRocketService.createRocket).not.toHaveBeenCalled();
    });

    it('should return 400 for validation errors', async () => {
      // Arrange
      mockRequest.body = createRocketRequest;
      mockRocketService.createRocket.mockRejectedValue(new Error('Validation failed: Name is required'));

      // Act
      await rocketController.createRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed: Name is required',
        code: 'VALIDATION_ERROR'
      });
    });

    it('should return 500 for server errors', async () => {
      // Arrange
      mockRequest.body = createRocketRequest;
      mockRocketService.createRocket.mockRejectedValue(new Error('Database connection failed'));

      // Act
      await rocketController.createRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to create rocket',
        code: 'CREATION_ERROR'
      });
    });
  });

  describe('getRocket', () => {
    it('should get rocket successfully', async () => {
      // Arrange
      mockRequest.params = { id: mockRocketId };
      mockRocketService.getRocket.mockResolvedValue(mockRocketDesign);

      // Act
      await rocketController.getRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockRocketService.getRocket).toHaveBeenCalledWith(mockRocketId, mockUserId);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockRocketDesign
      });
    });

    it('should return 404 if rocket not found', async () => {
      // Arrange
      mockRequest.params = { id: mockRocketId };
      mockRocketService.getRocket.mockResolvedValue(null);

      // Act
      await rocketController.getRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Rocket not found',
        code: 'ROCKET_NOT_FOUND'
      });
    });
  });

  describe('updateRocket', () => {
    const updateData = {
      name: 'Updated Rocket',
      description: 'Updated description'
    };

    const updatedRocket = { ...mockRocketDesign, ...updateData, version: 2 };

    it('should update rocket successfully', async () => {
      // Arrange
      mockRequest.params = { id: mockRocketId };
      mockRequest.body = updateData;
      mockRocketService.updateRocket.mockResolvedValue(updatedRocket);

      // Act
      await rocketController.updateRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockRocketService.updateRocket).toHaveBeenCalledWith(mockRocketId, mockUserId, updateData);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Rocket updated successfully',
        data: updatedRocket
      });
    });

    it('should return 401 if user not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;
      mockRequest.params = { id: mockRocketId };
      mockRequest.body = updateData;

      // Act
      await rocketController.updateRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockRocketService.updateRocket).not.toHaveBeenCalled();
    });

    it('should return 404 if rocket not found', async () => {
      // Arrange
      mockRequest.params = { id: mockRocketId };
      mockRequest.body = updateData;
      mockRocketService.updateRocket.mockRejectedValue(new Error('Rocket not found'));

      // Act
      await rocketController.updateRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Rocket not found',
        code: 'ROCKET_NOT_FOUND'
      });
    });
  });

  describe('deleteRocket', () => {
    it('should delete rocket successfully', async () => {
      // Arrange
      mockRequest.params = { id: mockRocketId };
      mockRocketService.deleteRocket.mockResolvedValue(true);

      // Act
      await rocketController.deleteRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockRocketService.deleteRocket).toHaveBeenCalledWith(mockRocketId, mockUserId);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Rocket deleted successfully'
      });
    });

    it('should return 404 if rocket not found', async () => {
      // Arrange
      mockRequest.params = { id: mockRocketId };
      mockRocketService.deleteRocket.mockResolvedValue(false);

      // Act
      await rocketController.deleteRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Rocket not found or access denied',
        code: 'ROCKET_NOT_FOUND'
      });
    });
  });

  describe('listRockets', () => {
    const mockListResponse = {
      rockets: [mockRocketDesign],
      total: 1,
      page: 1,
      limit: 20
    };

    it('should list rockets with default parameters', async () => {
      // Arrange
      mockRocketService.listRockets.mockResolvedValue(mockListResponse);

      // Act
      await rocketController.listRockets(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockRocketService.listRockets).toHaveBeenCalledWith({
        userId: undefined,
        isPublic: undefined,
        complexity: undefined,
        tags: undefined,
        search: undefined,
        page: 1,
        limit: 20,
        sortBy: 'created_at',
        sortOrder: 'desc'
      });
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockListResponse
      });
    });

    it('should handle query parameters correctly', async () => {
      // Arrange
      mockRequest.query = {
        public: 'true',
        complexity: 'beginner',
        tags: 'test,rocket',
        search: 'test',
        page: '2',
        limit: '10',
        sortBy: 'likes',
        sortOrder: 'asc',
        my: 'true'
      };
      mockRocketService.listRockets.mockResolvedValue(mockListResponse);

      // Act
      await rocketController.listRockets(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockRocketService.listRockets).toHaveBeenCalledWith({
        userId: mockUserId,
        isPublic: true,
        complexity: 'beginner',
        tags: ['test', 'rocket'],
        search: 'test',
        page: 2,
        limit: 10,
        sortBy: 'likes',
        sortOrder: 'asc'
      });
    });

    it('should limit page size to maximum', async () => {
      // Arrange
      mockRequest.query = { limit: '200' }; // Over the limit
      mockRocketService.listRockets.mockResolvedValue(mockListResponse);

      // Act
      await rocketController.listRockets(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockRocketService.listRockets).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });
  });

  describe('launchRocket', () => {
    const mockSimulationResult = {
      id: 'sim-123',
      rocketId: mockRocketId,
      userId: mockUserId,
      config: mockRocketDesign.config,
      results: {
        maxAltitude: 245.7,
        maxVelocity: 89.3,
        maxAcceleration: 156.2,
        flightTime: 18.4,
        burnoutAltitude: 78.2,
        burnoutVelocity: 67.1,
        apogeeTime: 6.8,
        recoveryTime: 8.2,
        landingDistance: 125.3,
        maxMachNumber: 0.26,
        maxDynamicPressure: 1247.8,
        stabilityMargin: 2.3,
        successful: true,
        issues: [],
        score: 87
      },
      telemetry: [],
      weather: {
        temperature: 20,
        pressure: 101325,
        humidity: 50,
        windSpeed: 5,
        windDirection: 0
      },
      createdAt: new Date()
    };

    it('should launch rocket successfully', async () => {
      // Arrange
      mockRequest.params = { id: mockRocketId };
      mockRequest.body = { options: { weather: { temperature: 25 } } };
      mockRocketService.launchRocket.mockResolvedValue(mockSimulationResult);

      // Act
      await rocketController.launchRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockRocketService.launchRocket).toHaveBeenCalledWith(
        mockRocketId,
        mockUserId,
        { options: { weather: { temperature: 25 } } }
      );
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Rocket launched successfully',
        data: mockSimulationResult
      });
    });

    it('should return 401 if user not authenticated', async () => {
      // Arrange
      mockRequest.user = undefined;
      mockRequest.params = { id: mockRocketId };

      // Act
      await rocketController.launchRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockRocketService.launchRocket).not.toHaveBeenCalled();
    });

    it('should return 404 if rocket not found', async () => {
      // Arrange
      mockRequest.params = { id: mockRocketId };
      mockRequest.body = {};
      mockRocketService.launchRocket.mockRejectedValue(new Error('Rocket not found'));

      // Act
      await rocketController.launchRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Rocket not found',
        code: 'ROCKET_NOT_FOUND'
      });
    });

    it('should return 403 if user cannot launch rocket', async () => {
      // Arrange
      mockRequest.params = { id: mockRocketId };
      mockRequest.body = {};
      mockRocketService.launchRocket.mockRejectedValue(new Error('Cannot launch rocket you do not own'));

      // Act
      await rocketController.launchRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Cannot launch rocket you do not own',
        code: 'LAUNCH_FORBIDDEN'
      });
    });
  });

  describe('getLeaderboard', () => {
    const mockLeaderboard = [
      {
        simulation: mockSimulationResult,
        rocketName: 'Test Rocket',
        userName: 'TestUser'
      }
    ];

    it('should get leaderboard with default parameters', async () => {
      // Arrange
      mockRocketService.getLeaderboard.mockResolvedValue(mockLeaderboard);

      // Act
      await rocketController.getLeaderboard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockRocketService.getLeaderboard).toHaveBeenCalledWith({
        metric: 'max_altitude',
        limit: 10,
        timeframe: 'all'
      });
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockLeaderboard
      });
    });

    it('should handle query parameters', async () => {
      // Arrange
      mockRequest.query = {
        metric: 'max_velocity',
        limit: '20',
        timeframe: 'week'
      };
      mockRocketService.getLeaderboard.mockResolvedValue(mockLeaderboard);

      // Act
      await rocketController.getLeaderboard(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockRocketService.getLeaderboard).toHaveBeenCalledWith({
        metric: 'max_velocity',
        limit: 20,
        timeframe: 'week'
      });
    });
  });

  describe('estimatePerformance', () => {
    const mockEstimate = {
      estimatedAltitude: 200,
      estimatedVelocity: 80,
      thrustToWeight: 7.5,
      stabilityMargin: 2.1,
      recommendations: ['Consider larger fins for better stability']
    };

    it('should estimate performance successfully', async () => {
      // Arrange
      mockRequest.body = mockRocketDesign.config;
      mockRocketService.estimatePerformance.mockResolvedValue(mockEstimate);

      // Act
      await rocketController.estimatePerformance(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockRocketService.estimatePerformance).toHaveBeenCalledWith(mockRocketDesign.config);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockEstimate
      });
    });

    it('should return 400 for invalid configuration', async () => {
      // Arrange
      mockRequest.body = { invalid: 'config' };
      mockRocketService.estimatePerformance.mockRejectedValue(new Error('Configuration validation failed'));

      // Act
      await rocketController.estimatePerformance(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Configuration validation failed',
        code: 'VALIDATION_ERROR'
      });
    });
  });

  describe('error handling', () => {
    it('should log errors to console', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockRequest.body = {};
      mockRocketService.createRocket.mockRejectedValue(new Error('Test error'));

      // Act
      await rocketController.createRocket(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Error creating rocket:', expect.any(Error));

      // Cleanup
      consoleSpy.mockRestore();
    });
  });
});
