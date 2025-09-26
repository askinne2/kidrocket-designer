/**
 * Rocket Service Tests
 * 
 * Unit tests for the RocketService following the testing patterns
 * established in the auth module.
 */

import { RocketService } from '../services/rocket.service';
import { RocketRepository } from '../repositories/rocket.repository';
import { SimulationRepository } from '../repositories/simulation.repository';
import { ValidationService } from '../services/validation.service';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { 
  RocketDesign, 
  CreateRocketRequest, 
  RocketConfig,
  RocketMaterial,
  NoseConeType,
  EngineType,
  RecoveryType,
  ComplexityLevel
} from '../../../shared/types/rocket';

// Mock dependencies
jest.mock('../repositories/rocket.repository');
jest.mock('../repositories/simulation.repository');
jest.mock('../services/validation.service');
jest.mock('../../../infrastructure/cache/cache.service');

describe('RocketService', () => {
  let rocketService: RocketService;
  let mockRocketRepository: jest.Mocked<RocketRepository>;
  let mockSimulationRepository: jest.Mocked<SimulationRepository>;
  let mockValidationService: jest.Mocked<ValidationService>;
  let mockCacheService: jest.Mocked<CacheService>;

  // Test data
  const mockUserId = 'user-123';
  const mockRocketId = 'rocket-456';

  const mockRocketConfig: RocketConfig = {
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
  };

  const mockCreateRocketRequest: CreateRocketRequest = {
    name: 'Test Rocket',
    description: 'A test rocket design',
    config: mockRocketConfig,
    metadata: {
      tags: ['test', 'beginner'],
      isPublic: false,
      complexity: ComplexityLevel.BEGINNER,
      estimatedCost: 25.50,
      buildTime: 2
    }
  };

  const mockRocketDesign: RocketDesign = {
    id: mockRocketId,
    userId: mockUserId,
    name: 'Test Rocket',
    description: 'A test rocket design',
    version: 1,
    config: mockRocketConfig,
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
    // Create mock instances
    mockRocketRepository = new RocketRepository({} as any) as jest.Mocked<RocketRepository>;
    mockSimulationRepository = new SimulationRepository({} as any) as jest.Mocked<SimulationRepository>;
    mockValidationService = new ValidationService() as jest.Mocked<ValidationService>;
    mockCacheService = new CacheService() as jest.Mocked<CacheService>;

    // Create service instance
    rocketService = new RocketService(
      mockRocketRepository,
      mockSimulationRepository,
      mockValidationService,
      mockCacheService
    );

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createRocket', () => {
    it('should create a rocket successfully', async () => {
      // Arrange
      mockValidationService.validateCreateRocket.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedData: mockCreateRocketRequest
      });

      mockValidationService.validateRocketConfig.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      mockRocketRepository.create.mockResolvedValue(mockRocketDesign);
      mockCacheService.set.mockResolvedValue(undefined);
      mockCacheService.del.mockResolvedValue(undefined);

      // Act
      const result = await rocketService.createRocket(mockUserId, mockCreateRocketRequest);

      // Assert
      expect(result).toEqual(mockRocketDesign);
      expect(mockValidationService.validateCreateRocket).toHaveBeenCalledWith(mockCreateRocketRequest);
      expect(mockValidationService.validateRocketConfig).toHaveBeenCalledWith(mockCreateRocketRequest.config);
      expect(mockRocketRepository.create).toHaveBeenCalledWith(mockUserId, mockCreateRocketRequest);
      expect(mockCacheService.set).toHaveBeenCalledWith(`rocket:${mockRocketId}`, mockRocketDesign, 3600);
      expect(mockCacheService.del).toHaveBeenCalledWith(`user_rockets:${mockUserId}`);
    });

    it('should throw error for invalid rocket data', async () => {
      // Arrange
      mockValidationService.validateCreateRocket.mockResolvedValue({
        isValid: false,
        errors: ['Name is required']
      });

      // Act & Assert
      await expect(
        rocketService.createRocket(mockUserId, mockCreateRocketRequest)
      ).rejects.toThrow('Validation failed: Name is required');

      expect(mockRocketRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error for invalid rocket configuration', async () => {
      // Arrange
      mockValidationService.validateCreateRocket.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedData: mockCreateRocketRequest
      });

      mockValidationService.validateRocketConfig.mockResolvedValue({
        isValid: false,
        errors: ['Thrust-to-weight ratio too low'],
        warnings: []
      });

      // Act & Assert
      await expect(
        rocketService.createRocket(mockUserId, mockCreateRocketRequest)
      ).rejects.toThrow('Configuration validation failed: Thrust-to-weight ratio too low');

      expect(mockRocketRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('getRocket', () => {
    it('should return cached rocket if available', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(mockRocketDesign);

      // Act
      const result = await rocketService.getRocket(mockRocketId, mockUserId);

      // Assert
      expect(result).toEqual(mockRocketDesign);
      expect(mockCacheService.get).toHaveBeenCalledWith(`rocket:${mockRocketId}`);
      expect(mockRocketRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch from repository if not cached', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockRocketRepository.findById.mockResolvedValue(mockRocketDesign);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      const result = await rocketService.getRocket(mockRocketId, mockUserId);

      // Assert
      expect(result).toEqual(mockRocketDesign);
      expect(mockRocketRepository.findById).toHaveBeenCalledWith(mockRocketId, mockUserId);
      expect(mockCacheService.set).toHaveBeenCalledWith(`rocket:${mockRocketId}`, mockRocketDesign, 3600);
    });

    it('should return null if rocket not found', async () => {
      // Arrange
      mockCacheService.get.mockResolvedValue(null);
      mockRocketRepository.findById.mockResolvedValue(null);

      // Act
      const result = await rocketService.getRocket(mockRocketId, mockUserId);

      // Assert
      expect(result).toBeNull();
    });

    it('should deny access to cached private rocket from different user', async () => {
      // Arrange
      const privateRocket = { ...mockRocketDesign, metadata: { ...mockRocketDesign.metadata, isPublic: false } };
      mockCacheService.get.mockResolvedValue(privateRocket);

      // Act
      const result = await rocketService.getRocket(mockRocketId, 'different-user');

      // Assert
      expect(result).toBeNull();
      expect(mockRocketRepository.findById).toHaveBeenCalledWith(mockRocketId, 'different-user');
    });
  });

  describe('updateRocket', () => {
    const updateData = {
      name: 'Updated Rocket',
      description: 'Updated description'
    };

    const updatedRocket = {
      ...mockRocketDesign,
      name: 'Updated Rocket',
      description: 'Updated description',
      version: 2
    };

    it('should update rocket successfully', async () => {
      // Arrange
      mockValidationService.validateUpdateRocket.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedData: updateData
      });

      mockRocketRepository.update.mockResolvedValue(updatedRocket);
      mockCacheService.set.mockResolvedValue(undefined);
      mockCacheService.del.mockResolvedValue(undefined);

      // Act
      const result = await rocketService.updateRocket(mockRocketId, mockUserId, updateData);

      // Assert
      expect(result).toEqual(updatedRocket);
      expect(mockValidationService.validateUpdateRocket).toHaveBeenCalledWith(updateData);
      expect(mockRocketRepository.update).toHaveBeenCalledWith(mockRocketId, mockUserId, updateData);
      expect(mockCacheService.set).toHaveBeenCalledWith(`rocket:${mockRocketId}`, updatedRocket, 3600);
      expect(mockCacheService.del).toHaveBeenCalledWith(`user_rockets:${mockUserId}`);
    });

    it('should validate config if provided in update', async () => {
      // Arrange
      const updateWithConfig = { ...updateData, config: mockRocketConfig };

      mockValidationService.validateUpdateRocket.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedData: updateWithConfig
      });

      mockValidationService.validateRocketConfig.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      mockRocketRepository.update.mockResolvedValue(updatedRocket);

      // Act
      await rocketService.updateRocket(mockRocketId, mockUserId, updateWithConfig);

      // Assert
      expect(mockValidationService.validateRocketConfig).toHaveBeenCalledWith(mockRocketConfig);
    });
  });

  describe('deleteRocket', () => {
    it('should delete rocket successfully', async () => {
      // Arrange
      mockRocketRepository.delete.mockResolvedValue(true);
      mockCacheService.del.mockResolvedValue(undefined);

      // Act
      const result = await rocketService.deleteRocket(mockRocketId, mockUserId);

      // Assert
      expect(result).toBe(true);
      expect(mockRocketRepository.delete).toHaveBeenCalledWith(mockRocketId, mockUserId);
      expect(mockCacheService.del).toHaveBeenCalledTimes(3);
      expect(mockCacheService.del).toHaveBeenCalledWith(`rocket:${mockRocketId}`);
      expect(mockCacheService.del).toHaveBeenCalledWith(`user_rockets:${mockUserId}`);
      expect(mockCacheService.del).toHaveBeenCalledWith(`rocket_simulations:${mockRocketId}`);
    });

    it('should return false if rocket not found', async () => {
      // Arrange
      mockRocketRepository.delete.mockResolvedValue(false);

      // Act
      const result = await rocketService.deleteRocket(mockRocketId, mockUserId);

      // Assert
      expect(result).toBe(false);
      expect(mockCacheService.del).not.toHaveBeenCalled();
    });
  });

  describe('listRockets', () => {
    const mockListResponse = {
      rockets: [mockRocketDesign],
      total: 1,
      page: 1,
      limit: 20
    };

    it('should list rockets with default options', async () => {
      // Arrange
      mockRocketRepository.findMany.mockResolvedValue(mockListResponse);

      // Act
      const result = await rocketService.listRockets({});

      // Assert
      expect(result).toEqual(mockListResponse);
      expect(mockRocketRepository.findMany).toHaveBeenCalledWith({});
    });

    it('should cache public rocket lists', async () => {
      // Arrange
      const options = { isPublic: true };
      mockCacheService.get.mockResolvedValue(null);
      mockRocketRepository.findMany.mockResolvedValue(mockListResponse);
      mockCacheService.set.mockResolvedValue(undefined);

      // Act
      const result = await rocketService.listRockets(options);

      // Assert
      expect(result).toEqual(mockListResponse);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        `rocket_list:${JSON.stringify(options)}`,
        mockListResponse,
        600
      );
    });

    it('should return cached results for public lists', async () => {
      // Arrange
      const options = { isPublic: true };
      mockCacheService.get.mockResolvedValue(mockListResponse);

      // Act
      const result = await rocketService.listRockets(options);

      // Assert
      expect(result).toEqual(mockListResponse);
      expect(mockRocketRepository.findMany).not.toHaveBeenCalled();
    });
  });

  describe('launchRocket', () => {
    const mockSimulationResult = {
      id: 'sim-123',
      rocketId: mockRocketId,
      userId: mockUserId,
      config: mockRocketConfig,
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
      mockRocketRepository.findById.mockResolvedValue(mockRocketDesign);
      mockSimulationRepository.create.mockResolvedValue(mockSimulationResult);
      mockCacheService.del.mockResolvedValue(undefined);

      // Act
      const result = await rocketService.launchRocket(mockRocketId, mockUserId, {});

      // Assert
      expect(result).toEqual(mockSimulationResult);
      expect(mockRocketRepository.findById).toHaveBeenCalledWith(mockRocketId, mockUserId);
      expect(mockSimulationRepository.create).toHaveBeenCalled();
      expect(mockCacheService.del).toHaveBeenCalledWith(`rocket_simulations:${mockRocketId}`);
    });

    it('should throw error if rocket not found', async () => {
      // Arrange
      mockRocketRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        rocketService.launchRocket(mockRocketId, mockUserId, {})
      ).rejects.toThrow('Rocket not found or access denied');
    });

    it('should throw error if user does not own rocket', async () => {
      // Arrange
      const otherUserRocket = { ...mockRocketDesign, userId: 'other-user' };
      mockRocketRepository.findById.mockResolvedValue(otherUserRocket);

      // Act & Assert
      await expect(
        rocketService.launchRocket(mockRocketId, mockUserId, {})
      ).rejects.toThrow('Cannot launch rocket you do not own');
    });
  });

  describe('estimatePerformance', () => {
    it('should return performance estimate for valid config', async () => {
      // Arrange
      mockValidationService.validateRocketConfig.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      // Act
      const result = await rocketService.estimatePerformance(mockRocketConfig);

      // Assert
      expect(result).toHaveProperty('estimatedAltitude');
      expect(result).toHaveProperty('estimatedVelocity');
      expect(result).toHaveProperty('thrustToWeight');
      expect(result).toHaveProperty('stabilityMargin');
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should throw error for invalid config', async () => {
      // Arrange
      mockValidationService.validateRocketConfig.mockResolvedValue({
        isValid: false,
        errors: ['Invalid configuration'],
        warnings: []
      });

      // Act & Assert
      await expect(
        rocketService.estimatePerformance(mockRocketConfig)
      ).rejects.toThrow('Configuration validation failed: Invalid configuration');
    });
  });

  describe('likeRocket', () => {
    it('should like public rocket successfully', async () => {
      // Arrange
      const publicRocket = { ...mockRocketDesign, userId: 'other-user', metadata: { ...mockRocketDesign.metadata, isPublic: true } };
      mockRocketRepository.findById.mockResolvedValue(publicRocket);
      mockRocketRepository.incrementLikes.mockResolvedValue(undefined);
      mockCacheService.del.mockResolvedValue(undefined);

      // Act
      await rocketService.likeRocket(mockRocketId, mockUserId);

      // Assert
      expect(mockRocketRepository.incrementLikes).toHaveBeenCalledWith(mockRocketId);
      expect(mockCacheService.del).toHaveBeenCalledWith(`rocket:${mockRocketId}`);
    });

    it('should throw error for private rocket', async () => {
      // Arrange
      const privateRocket = { ...mockRocketDesign, userId: 'other-user', metadata: { ...mockRocketDesign.metadata, isPublic: false } };
      mockRocketRepository.findById.mockResolvedValue(privateRocket);

      // Act & Assert
      await expect(
        rocketService.likeRocket(mockRocketId, mockUserId)
      ).rejects.toThrow('Cannot like private rocket');
    });

    it('should throw error for own rocket', async () => {
      // Arrange
      const ownPublicRocket = { ...mockRocketDesign, metadata: { ...mockRocketDesign.metadata, isPublic: true } };
      mockRocketRepository.findById.mockResolvedValue(ownPublicRocket);

      // Act & Assert
      await expect(
        rocketService.likeRocket(mockRocketId, mockUserId)
      ).rejects.toThrow('Cannot like your own rocket');
    });
  });

  describe('downloadRocket', () => {
    it('should download public rocket successfully', async () => {
      // Arrange
      const publicRocket = { ...mockRocketDesign, userId: 'other-user', metadata: { ...mockRocketDesign.metadata, isPublic: true } };
      const copiedRocket = { ...mockRocketDesign, id: 'copied-rocket', name: 'Test Rocket (Copy)' };

      mockRocketRepository.findById.mockResolvedValue(publicRocket);
      mockRocketRepository.incrementDownloads.mockResolvedValue(undefined);
      
      // Mock the createRocket call
      mockValidationService.validateCreateRocket.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedData: expect.any(Object)
      });
      mockValidationService.validateRocketConfig.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });
      mockRocketRepository.create.mockResolvedValue(copiedRocket);

      // Act
      const result = await rocketService.downloadRocket(mockRocketId, mockUserId);

      // Assert
      expect(result.name).toBe('Test Rocket (Copy)');
      expect(mockRocketRepository.incrementDownloads).toHaveBeenCalledWith(mockRocketId);
    });

    it('should not increment downloads for own rocket', async () => {
      // Arrange
      const ownRocket = { ...mockRocketDesign, metadata: { ...mockRocketDesign.metadata, isPublic: true } };
      const copiedRocket = { ...mockRocketDesign, id: 'copied-rocket', name: 'Test Rocket (Copy)' };

      mockRocketRepository.findById.mockResolvedValue(ownRocket);
      
      // Mock the createRocket call
      mockValidationService.validateCreateRocket.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedData: expect.any(Object)
      });
      mockValidationService.validateRocketConfig.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });
      mockRocketRepository.create.mockResolvedValue(copiedRocket);

      // Act
      await rocketService.downloadRocket(mockRocketId, mockUserId);

      // Assert
      expect(mockRocketRepository.incrementDownloads).not.toHaveBeenCalled();
    });
  });
});
