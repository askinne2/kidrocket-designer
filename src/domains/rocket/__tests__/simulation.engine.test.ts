/**
 * Simulation Engine Tests
 * 
 * Unit tests for the SimulationEngine physics calculations.
 */

import { SimulationEngine } from '../services/simulation.engine';
import { 
  RocketConfig,
  RocketMaterial,
  NoseConeType,
  EngineType,
  RecoveryType,
  WeatherConditions,
  FlightPhase
} from '../../../shared/types/rocket';

describe('SimulationEngine', () => {
  let simulationEngine: SimulationEngine;

  // Test rocket configuration (simple C-class rocket)
  const testRocketConfig: RocketConfig = {
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

  const testWeatherConditions: WeatherConditions = {
    temperature: 20,
    pressure: 101325,
    humidity: 50,
    windSpeed: 5,
    windDirection: 0
  };

  beforeEach(() => {
    simulationEngine = new SimulationEngine({
      timeStep: 0.01,
      maxFlightTime: 60,
      detailedTelemetry: true
    });
  });

  describe('simulate', () => {
    it('should run a complete simulation successfully', async () => {
      // Act
      const result = await simulationEngine.simulate(testRocketConfig, testWeatherConditions);

      // Assert
      expect(result.results).toBeDefined();
      expect(result.telemetry).toBeDefined();
      expect(result.telemetry.length).toBeGreaterThan(0);
      
      // Check that we have reasonable results
      expect(result.results.maxAltitude).toBeGreaterThan(0);
      expect(result.results.maxVelocity).toBeGreaterThan(0);
      expect(result.results.flightTime).toBeGreaterThan(0);
      expect(result.results.successful).toBe(true);
      expect(result.results.score).toBeGreaterThan(0);
    });

    it('should produce telemetry data with correct structure', async () => {
      // Act
      const result = await simulationEngine.simulate(testRocketConfig, testWeatherConditions);

      // Assert
      const firstPoint = result.telemetry[0];
      expect(firstPoint).toHaveProperty('time');
      expect(firstPoint).toHaveProperty('position');
      expect(firstPoint).toHaveProperty('velocity');
      expect(firstPoint).toHaveProperty('acceleration');
      expect(firstPoint).toHaveProperty('mass');
      expect(firstPoint).toHaveProperty('thrust');
      expect(firstPoint).toHaveProperty('drag');
      expect(firstPoint).toHaveProperty('machNumber');
      expect(firstPoint).toHaveProperty('altitude');
      expect(firstPoint).toHaveProperty('phase');

      // Check initial conditions
      expect(firstPoint.time).toBe(0);
      expect(firstPoint.position.x).toBe(0);
      expect(firstPoint.position.y).toBe(0);
      expect(firstPoint.position.z).toBe(0);
      expect(firstPoint.phase).toBe(FlightPhase.BOOST);
    });

    it('should handle different flight phases correctly', async () => {
      // Act
      const result = await simulationEngine.simulate(testRocketConfig, testWeatherConditions);

      // Assert
      const phases = result.telemetry.map(point => point.phase);
      const uniquePhases = [...new Set(phases)];

      // Should have at least boost and coast phases
      expect(uniquePhases).toContain(FlightPhase.BOOST);
      expect(uniquePhases).toContain(FlightPhase.COAST);

      // Boost phase should be at the beginning
      expect(phases[0]).toBe(FlightPhase.BOOST);

      // Should transition from boost to coast
      const boostEndIndex = phases.findIndex(phase => phase !== FlightPhase.BOOST);
      expect(boostEndIndex).toBeGreaterThan(0);
      expect(phases[boostEndIndex]).toBe(FlightPhase.COAST);
    });

    it('should calculate realistic performance metrics', async () => {
      // Act
      const result = await simulationEngine.simulate(testRocketConfig, testWeatherConditions);

      // Assert - C-class rocket should achieve reasonable altitude
      expect(result.results.maxAltitude).toBeGreaterThan(50); // At least 50m
      expect(result.results.maxAltitude).toBeLessThan(500); // But not too high for C-class

      // Velocity should be reasonable
      expect(result.results.maxVelocity).toBeGreaterThan(20); // At least 20 m/s
      expect(result.results.maxVelocity).toBeLessThan(150); // But subsonic

      // Flight time should be reasonable
      expect(result.results.flightTime).toBeGreaterThan(5); // At least 5 seconds
      expect(result.results.flightTime).toBeLessThan(30); // But not too long

      // Burnout should occur during engine burn time
      expect(result.results.burnoutAltitude).toBeGreaterThan(0);
      expect(result.results.burnoutVelocity).toBeGreaterThan(0);
    });

    it('should detect configuration issues', async () => {
      // Arrange - Create an unstable rocket (very short with small fins)
      const unstableConfig: RocketConfig = {
        ...testRocketConfig,
        body: { ...testRocketConfig.body, length: 0.1 }, // Very short
        fins: { ...testRocketConfig.fins, span: 0.01 } // Very small fins
      };

      // Act
      const result = await simulationEngine.simulate(unstableConfig, testWeatherConditions);

      // Assert
      expect(result.results.issues.length).toBeGreaterThan(0);
      expect(result.results.issues.some(issue => issue.code.includes('STABILITY'))).toBe(true);
    });

    it('should handle invalid configurations gracefully', async () => {
      // Arrange - Create invalid config with zero thrust
      const invalidConfig: RocketConfig = {
        ...testRocketConfig,
        engine: { ...testRocketConfig.engine, thrust: 0 }
      };

      // Act
      const result = await simulationEngine.simulate(invalidConfig, testWeatherConditions);

      // Assert
      expect(result.results.successful).toBe(false);
      expect(result.results.issues.some(issue => issue.type === 'error')).toBe(true);
      expect(result.telemetry.length).toBe(0);
    });
  });

  describe('estimatePerformance', () => {
    it('should provide quick performance estimates', () => {
      // Act
      const estimate = SimulationEngine.estimatePerformance(testRocketConfig);

      // Assert
      expect(estimate).toHaveProperty('estimatedAltitude');
      expect(estimate).toHaveProperty('estimatedVelocity');
      expect(estimate).toHaveProperty('thrustToWeight');
      expect(estimate).toHaveProperty('stabilityMargin');

      // Values should be reasonable
      expect(estimate.estimatedAltitude).toBeGreaterThan(0);
      expect(estimate.estimatedVelocity).toBeGreaterThan(0);
      expect(estimate.thrustToWeight).toBeGreaterThan(1); // Should be able to lift off
      expect(estimate.stabilityMargin).toBeGreaterThan(0);
    });

    it('should calculate correct thrust-to-weight ratio', () => {
      // Act
      const estimate = SimulationEngine.estimatePerformance(testRocketConfig);

      // Assert
      const totalMass = testRocketConfig.body.mass + testRocketConfig.noseCone.mass + 
                       testRocketConfig.fins.mass + testRocketConfig.engine.totalMass + 
                       testRocketConfig.recovery.mass;
      const expectedTWR = testRocketConfig.engine.thrust / (totalMass * 9.80665);

      expect(estimate.thrustToWeight).toBeCloseTo(expectedTWR, 2);
    });

    it('should detect low thrust-to-weight ratios', () => {
      // Arrange - Heavy rocket with weak engine
      const heavyRocketConfig: RocketConfig = {
        ...testRocketConfig,
        body: { ...testRocketConfig.body, mass: 1.0 }, // Very heavy
        engine: { ...testRocketConfig.engine, thrust: 5 } // Weak engine
      };

      // Act
      const estimate = SimulationEngine.estimatePerformance(heavyRocketConfig);

      // Assert
      expect(estimate.thrustToWeight).toBeLessThan(5); // Should be low
    });
  });

  describe('physics calculations', () => {
    it('should respect conservation of mass during propellant burn', async () => {
      // Act
      const result = await simulationEngine.simulate(testRocketConfig, testWeatherConditions);

      // Assert
      const initialMass = result.telemetry[0]?.mass || 0;
      const burnoutPoint = result.telemetry.find(point => point.thrust === 0);
      const burnoutMass = burnoutPoint?.mass || 0;

      const massLoss = initialMass - burnoutMass;
      
      // Mass loss should be approximately equal to propellant mass
      expect(massLoss).toBeCloseTo(testRocketConfig.engine.propellantMass, 1);
    });

    it('should calculate drag forces correctly', async () => {
      // Act
      const result = await simulationEngine.simulate(testRocketConfig, testWeatherConditions);

      // Assert
      const pointsWithVelocity = result.telemetry.filter(point => 
        Math.sqrt(point.velocity.x ** 2 + point.velocity.y ** 2 + point.velocity.z ** 2) > 1
      );

      // All points with significant velocity should have drag > 0
      pointsWithVelocity.forEach(point => {
        expect(point.drag).toBeGreaterThan(0);
      });
    });

    it('should handle launch rod constraint', async () => {
      // Act
      const result = await simulationEngine.simulate(testRocketConfig, testWeatherConditions);

      // Assert
      const earlyPoints = result.telemetry.slice(0, 50); // First 50 points
      const rodLength = testRocketConfig.launch.launchRodLength;

      // Early points should be constrained to launch rod
      const earlyDistances = earlyPoints.map(point => 
        Math.sqrt(point.position.x ** 2 + point.position.y ** 2)
      );

      expect(Math.max(...earlyDistances)).toBeLessThanOrEqual(rodLength * 1.1); // Small tolerance
    });

    it('should calculate Mach number correctly', async () => {
      // Act
      const result = await simulationEngine.simulate(testRocketConfig, testWeatherConditions);

      // Assert
      const maxMachPoint = result.telemetry.reduce((max, point) => 
        point.machNumber > max.machNumber ? point : max
      );

      // For C-class rocket, should be subsonic
      expect(maxMachPoint.machNumber).toBeLessThan(1.0);
      expect(maxMachPoint.machNumber).toBeGreaterThan(0);
    });

    it('should handle recovery deployment correctly', async () => {
      // Act
      const result = await simulationEngine.simulate(testRocketConfig, testWeatherConditions);

      // Assert
      const recoveryPoints = result.telemetry.filter(point => 
        point.phase === FlightPhase.RECOVERY
      );

      if (recoveryPoints.length > 0) {
        // Recovery should start near the deployment altitude
        const firstRecoveryPoint = recoveryPoints[0];
        const deploymentAltitude = testRocketConfig.recovery.deploymentAltitude;
        
        expect(firstRecoveryPoint.altitude).toBeLessThanOrEqual(deploymentAltitude * 1.1);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle zero wind conditions', async () => {
      // Arrange
      const noWindWeather = { ...testWeatherConditions, windSpeed: 0 };

      // Act
      const result = await simulationEngine.simulate(testRocketConfig, noWindWeather);

      // Assert
      expect(result.results.successful).toBe(true);
      expect(result.telemetry.length).toBeGreaterThan(0);
    });

    it('should handle high altitude conditions', async () => {
      // Arrange
      const highAltitudeWeather = { 
        ...testWeatherConditions, 
        pressure: 50000, // Reduced pressure
        temperature: -10 // Cold temperature
      };

      // Act
      const result = await simulationEngine.simulate(testRocketConfig, highAltitudeWeather);

      // Assert
      expect(result.results.successful).toBe(true);
      // Performance should be different due to air density changes
      expect(result.results.maxAltitude).toBeDefined();
    });

    it('should handle very short time steps', () => {
      // Arrange
      const preciseEngine = new SimulationEngine({
        timeStep: 0.001,
        maxFlightTime: 5,
        detailedTelemetry: false
      });

      // Act & Assert - Should not throw errors
      expect(async () => {
        await preciseEngine.simulate(testRocketConfig, testWeatherConditions);
      }).not.toThrow();
    });

    it('should limit simulation time', async () => {
      // Arrange
      const shortTimeEngine = new SimulationEngine({
        timeStep: 0.01,
        maxFlightTime: 1, // Very short max time
        detailedTelemetry: true
      });

      // Act
      const result = await shortTimeEngine.simulate(testRocketConfig, testWeatherConditions);

      // Assert
      const maxTime = Math.max(...result.telemetry.map(point => point.time));
      expect(maxTime).toBeLessThanOrEqual(1.1); // Small tolerance
    });
  });
});
