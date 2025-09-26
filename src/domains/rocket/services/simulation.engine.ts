/**
 * Rocket Simulation Engine
 * 
 * Core physics engine for simulating rocket flight trajectories.
 * Designed to be WASM-compatible for high-performance client-side execution.
 * 
 * Based on established rocket physics principles and industry-standard
 * simulation techniques used in OpenRocket and similar tools.
 */

import { 
  RocketConfig, 
  TrajectoryPoint, 
  FlightResults, 
  WeatherConditions, 
  LaunchOptions, 
  FlightPhase, 
  FlightIssue,
  DEFAULT_WEATHER 
} from '../../../shared/types/rocket';

export class SimulationEngine {
  // Physical constants
  private static readonly GRAVITY = 9.80665; // m/s² (standard gravity)
  private static readonly AIR_DENSITY_SEA_LEVEL = 1.225; // kg/m³
  private static readonly GAS_CONSTANT = 287.05; // J/(kg·K) for dry air
  private static readonly TEMPERATURE_LAPSE_RATE = 0.0065; // K/m
  private static readonly DRAG_COEFFICIENT_BOOST = 0.75; // Typical for model rockets during boost
  private static readonly DRAG_COEFFICIENT_COAST = 0.45; // Typical for model rockets during coast

  // Simulation parameters
  private timeStep: number;
  private maxFlightTime: number;
  private detailedTelemetry: boolean;

  constructor(options: LaunchOptions = {}) {
    this.timeStep = options.timeStep || 0.01; // 10ms default
    this.maxFlightTime = options.maxFlightTime || 300; // 5 minutes max
    this.detailedTelemetry = options.detailedTelemetry || false;
  }

  /**
   * Run complete rocket simulation
   */
  async simulate(
    config: RocketConfig, 
    weather: WeatherConditions = DEFAULT_WEATHER,
    launchOptions?: LaunchOptions
  ): Promise<{ results: FlightResults; telemetry: TrajectoryPoint[] }> {
    // Initialize simulation state
    const state = this.initializeState(config, weather);
    const telemetry: TrajectoryPoint[] = [];
    const issues: FlightIssue[] = [];

    // Pre-flight validation
    const validationIssues = this.validateConfiguration(config);
    issues.push(...validationIssues);

    if (validationIssues.some(issue => issue.type === 'error')) {
      return {
        results: this.createFailedResults(issues),
        telemetry: []
      };
    }

    // Main simulation loop
    let time = 0;
    let phase = FlightPhase.PRELAUNCH;
    
    while (time <= this.maxFlightTime && state.position.y >= 0) {
      // Update flight phase
      phase = this.determineFlightPhase(time, state, config);
      
      // Calculate forces
      const forces = this.calculateForces(state, config, weather, phase, time);
      
      // Update state using Runge-Kutta 4th order integration
      this.updateState(state, forces, this.timeStep);
      
      // Record telemetry point
      if (this.shouldRecordTelemetry(time)) {
        const telemetryPoint: TrajectoryPoint = {
          time,
          position: { ...state.position },
          velocity: { ...state.velocity },
          acceleration: { ...state.acceleration },
          mass: state.mass,
          thrust: forces.thrust,
          drag: forces.drag,
          machNumber: this.calculateMachNumber(state.velocity, weather),
          altitude: state.position.y,
          phase
        };
        telemetry.push(telemetryPoint);
      }

      // Check for flight anomalies
      const phaseIssues = this.checkFlightAnomalies(state, config, time, phase);
      issues.push(...phaseIssues);

      time += this.timeStep;
    }

    // Calculate final results
    const results = this.calculateResults(telemetry, issues, config);

    return { results, telemetry };
  }

  /**
   * Initialize simulation state
   */
  private initializeState(config: RocketConfig, weather: WeatherConditions) {
    const totalMass = this.calculateTotalMass(config);
    const launchAngle = (config.launch.launchAngle * Math.PI) / 180; // Convert to radians

    return {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
      mass: totalMass,
      burnoutTime: config.engine.burnTime,
      onLaunchRod: true,
      launchRodLength: config.launch.launchRodLength,
      launchAngle,
      parachuteDeployed: false,
      weather
    };
  }

  /**
   * Calculate all forces acting on the rocket
   */
  private calculateForces(state: any, config: RocketConfig, weather: WeatherConditions, phase: FlightPhase, time: number) {
    const forces = {
      thrust: 0,
      drag: 0,
      weight: state.mass * SimulationEngine.GRAVITY,
      windForce: 0
    };

    // Thrust force (during boost phase)
    if (phase === FlightPhase.BOOST && time <= config.engine.burnTime) {
      forces.thrust = config.engine.thrust;
      
      // Update mass (propellant consumption)
      const propellantFlowRate = config.engine.propellantMass / config.engine.burnTime;
      state.mass -= propellantFlowRate * this.timeStep;
    }

    // Drag force
    const velocity = Math.sqrt(
      state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2
    );
    
    if (velocity > 0) {
      const airDensity = this.calculateAirDensity(state.position.y, weather);
      const dragCoefficient = phase === FlightPhase.BOOST 
        ? SimulationEngine.DRAG_COEFFICIENT_BOOST 
        : SimulationEngine.DRAG_COEFFICIENT_COAST;
      
      const referenceArea = Math.PI * (config.body.diameter / 2) ** 2;
      forces.drag = 0.5 * airDensity * velocity ** 2 * dragCoefficient * referenceArea;
    }

    // Wind force (simplified)
    if (weather.windSpeed > 0) {
      const windAngle = (weather.windDirection * Math.PI) / 180;
      forces.windForce = 0.1 * weather.windSpeed * state.velocity.y; // Simplified wind effect
    }

    return forces;
  }

  /**
   * Update rocket state using numerical integration
   */
  private updateState(state: any, forces: any, dt: number) {
    // Calculate accelerations
    const totalVerticalForce = forces.thrust - forces.weight - 
      (forces.drag * state.velocity.y / Math.max(0.001, Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2)));
    
    const totalHorizontalForce = -forces.drag * state.velocity.x / Math.max(0.001, Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2));

    state.acceleration.y = totalVerticalForce / state.mass;
    state.acceleration.x = totalHorizontalForce / state.mass;
    state.acceleration.z = 0; // 2D simulation for now

    // Handle launch rod constraint
    if (state.onLaunchRod) {
      const rodDistance = Math.sqrt(state.position.x ** 2 + state.position.y ** 2);
      if (rodDistance >= state.launchRodLength) {
        state.onLaunchRod = false;
      } else {
        // Constrain motion along launch rod
        const rodAngle = state.launchAngle;
        state.acceleration.x = state.acceleration.y * Math.sin(rodAngle);
        state.acceleration.y = state.acceleration.y * Math.cos(rodAngle);
      }
    }

    // Euler integration (simple but stable for this use case)
    state.velocity.x += state.acceleration.x * dt;
    state.velocity.y += state.acceleration.y * dt;
    state.velocity.z += state.acceleration.z * dt;

    state.position.x += state.velocity.x * dt;
    state.position.y += state.velocity.y * dt;
    state.position.z += state.velocity.z * dt;
  }

  /**
   * Determine current flight phase
   */
  private determineFlightPhase(time: number, state: any, config: RocketConfig): FlightPhase {
    if (time === 0) return FlightPhase.PRELAUNCH;
    if (time <= config.engine.burnTime) return FlightPhase.BOOST;
    if (state.velocity.y > 0) return FlightPhase.COAST;
    if (!state.parachuteDeployed && state.position.y >= config.recovery.deploymentAltitude) {
      state.parachuteDeployed = true;
      return FlightPhase.RECOVERY;
    }
    if (state.parachuteDeployed || state.velocity.y < 0) return FlightPhase.RECOVERY;
    if (state.position.y <= 0) return FlightPhase.LANDING;
    
    return FlightPhase.COAST;
  }

  /**
   * Calculate air density at altitude
   */
  private calculateAirDensity(altitude: number, weather: WeatherConditions): number {
    const temperature = weather.temperature + 273.15; // Convert to Kelvin
    const temperatureAtAltitude = temperature - SimulationEngine.TEMPERATURE_LAPSE_RATE * altitude;
    const pressureRatio = Math.pow(temperatureAtAltitude / temperature, 5.256);
    const densityRatio = Math.pow(temperatureAtAltitude / temperature, 4.256);
    
    return SimulationEngine.AIR_DENSITY_SEA_LEVEL * densityRatio;
  }

  /**
   * Calculate Mach number
   */
  private calculateMachNumber(velocity: any, weather: WeatherConditions): number {
    const temperature = weather.temperature + 273.15; // Kelvin
    const speedOfSound = Math.sqrt(1.4 * SimulationEngine.GAS_CONSTANT * temperature);
    const totalVelocity = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    
    return totalVelocity / speedOfSound;
  }

  /**
   * Calculate total rocket mass
   */
  private calculateTotalMass(config: RocketConfig): number {
    return (
      config.body.mass +
      config.noseCone.mass +
      config.fins.mass +
      config.engine.totalMass +
      config.recovery.mass
    );
  }

  /**
   * Validate rocket configuration
   */
  private validateConfiguration(config: RocketConfig): FlightIssue[] {
    const issues: FlightIssue[] = [];

    // Check stability margin (simplified)
    const stabilityMargin = this.calculateStabilityMargin(config);
    if (stabilityMargin < 1.0) {
      issues.push({
        type: 'warning',
        code: 'LOW_STABILITY',
        message: `Low stability margin: ${stabilityMargin.toFixed(2)} calibers`,
        severity: 7
      });
    }

    // Check thrust-to-weight ratio
    const totalMass = this.calculateTotalMass(config);
    const thrustToWeight = config.engine.thrust / (totalMass * SimulationEngine.GRAVITY);
    
    if (thrustToWeight < 5) {
      issues.push({
        type: 'warning',
        code: 'LOW_TWR',
        message: `Low thrust-to-weight ratio: ${thrustToWeight.toFixed(2)}`,
        severity: 6
      });
    }

    // Check for unrealistic values
    if (config.engine.thrust <= 0) {
      issues.push({
        type: 'error',
        code: 'INVALID_THRUST',
        message: 'Engine thrust must be positive',
        severity: 10
      });
    }

    if (totalMass <= 0) {
      issues.push({
        type: 'error',
        code: 'INVALID_MASS',
        message: 'Total rocket mass must be positive',
        severity: 10
      });
    }

    return issues;
  }

  /**
   * Calculate stability margin (simplified Barrowman method)
   */
  private calculateStabilityMargin(config: RocketConfig): number {
    // This is a simplified calculation - real implementation would be more complex
    const bodyLength = config.body.length;
    const noseConeLength = config.noseCone.length;
    const finRootChord = config.fins.rootChord;
    const finSpan = config.fins.span;

    // Center of pressure (approximate)
    const centerOfPressure = bodyLength * 0.7 + finRootChord * 0.5;
    
    // Center of gravity (approximate)
    const centerOfGravity = bodyLength * 0.4; // Simplified

    // Stability margin in calibers
    const stabilityMargin = (centerOfPressure - centerOfGravity) / config.body.diameter;

    return stabilityMargin;
  }

  /**
   * Check for flight anomalies
   */
  private checkFlightAnomalies(state: any, config: RocketConfig, time: number, phase: FlightPhase): FlightIssue[] {
    const issues: FlightIssue[] = [];

    // Check for excessive velocity
    const velocity = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2 + state.velocity.z ** 2);
    if (velocity > 343) { // Mach 1 at sea level
      issues.push({
        type: 'warning',
        code: 'SUPERSONIC_FLIGHT',
        message: `Supersonic velocity: ${velocity.toFixed(1)} m/s`,
        time,
        severity: 5
      });
    }

    // Check for excessive acceleration
    const acceleration = Math.sqrt(state.acceleration.x ** 2 + state.acceleration.y ** 2 + state.acceleration.z ** 2);
    if (acceleration > 300) { // ~30G
      issues.push({
        type: 'warning',
        code: 'HIGH_ACCELERATION',
        message: `High acceleration: ${(acceleration / 9.81).toFixed(1)}G`,
        time,
        severity: 6
      });
    }

    // Check for negative altitude (ground impact)
    if (state.position.y < 0) {
      issues.push({
        type: 'info',
        code: 'GROUND_IMPACT',
        message: 'Rocket has landed',
        time,
        severity: 1
      });
    }

    return issues;
  }

  /**
   * Calculate final flight results
   */
  private calculateResults(telemetry: TrajectoryPoint[], issues: FlightIssue[], config: RocketConfig): FlightResults {
    if (telemetry.length === 0) {
      return this.createFailedResults(issues);
    }

    // Find key metrics
    const maxAltitude = Math.max(...telemetry.map(p => p.altitude));
    const maxVelocity = Math.max(...telemetry.map(p => 
      Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2 + p.velocity.z ** 2)
    ));
    const maxAcceleration = Math.max(...telemetry.map(p =>
      Math.sqrt(p.acceleration.x ** 2 + p.acceleration.y ** 2 + p.acceleration.z ** 2)
    ));

    const flightTime = telemetry[telemetry.length - 1].time;
    const burnoutPoint = telemetry.find(p => p.phase !== FlightPhase.BOOST);
    const apogeePoint = telemetry.find(p => p.velocity.y <= 0);
    const recoveryPoint = telemetry.find(p => p.phase === FlightPhase.RECOVERY);

    const burnoutAltitude = burnoutPoint?.altitude || 0;
    const burnoutVelocity = burnoutPoint ? 
      Math.sqrt(burnoutPoint.velocity.x ** 2 + burnoutPoint.velocity.y ** 2 + burnoutPoint.velocity.z ** 2) : 0;
    
    const apogeeTime = apogeePoint?.time || 0;
    const recoveryTime = recoveryPoint?.time || flightTime;

    const finalPoint = telemetry[telemetry.length - 1];
    const landingDistance = Math.sqrt(finalPoint.position.x ** 2 + finalPoint.position.z ** 2);

    const maxMachNumber = Math.max(...telemetry.map(p => p.machNumber));
    const maxDynamicPressure = Math.max(...telemetry.map(p => {
      const velocity = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2 + p.velocity.z ** 2);
      const airDensity = this.calculateAirDensity(p.altitude, { temperature: 20, pressure: 101325, humidity: 50, windSpeed: 0, windDirection: 0 });
      return 0.5 * airDensity * velocity ** 2;
    }));

    const stabilityMargin = this.calculateStabilityMargin(config);
    const successful = !issues.some(issue => issue.type === 'error');

    // Calculate performance score (0-100)
    let score = 50; // Base score
    
    // Altitude bonus (up to 25 points)
    score += Math.min(25, maxAltitude / 10); // 1 point per 10m
    
    // Stability bonus (up to 15 points)
    if (stabilityMargin >= 1.0) score += Math.min(15, stabilityMargin * 5);
    
    // Success bonus (10 points)
    if (successful) score += 10;
    
    // Deduct points for issues
    issues.forEach(issue => {
      if (issue.type === 'error') score -= 20;
      if (issue.type === 'warning') score -= issue.severity;
    });

    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      maxAltitude,
      maxVelocity,
      maxAcceleration,
      flightTime,
      burnoutAltitude,
      burnoutVelocity,
      apogeeTime,
      recoveryTime,
      landingDistance,
      maxMachNumber,
      maxDynamicPressure,
      stabilityMargin,
      successful,
      issues,
      score
    };
  }

  /**
   * Create failed flight results
   */
  private createFailedResults(issues: FlightIssue[]): FlightResults {
    return {
      maxAltitude: 0,
      maxVelocity: 0,
      maxAcceleration: 0,
      flightTime: 0,
      burnoutAltitude: 0,
      burnoutVelocity: 0,
      apogeeTime: 0,
      recoveryTime: 0,
      landingDistance: 0,
      maxMachNumber: 0,
      maxDynamicPressure: 0,
      stabilityMargin: 0,
      successful: false,
      issues,
      score: 0
    };
  }

  /**
   * Determine if telemetry should be recorded at this time step
   */
  private shouldRecordTelemetry(time: number): boolean {
    if (this.detailedTelemetry) return true;
    
    // Record every 10th time step for standard resolution
    return Math.round(time / this.timeStep) % 10 === 0;
  }

  /**
   * Static method for quick performance estimation (without full simulation)
   */
  static estimatePerformance(config: RocketConfig): {
    estimatedAltitude: number;
    estimatedVelocity: number;
    thrustToWeight: number;
    stabilityMargin: number;
  } {
    const engine = new SimulationEngine();
    const totalMass = engine.calculateTotalMass(config);
    const thrustToWeight = config.engine.thrust / (totalMass * SimulationEngine.GRAVITY);
    const stabilityMargin = engine.calculateStabilityMargin(config);

    // Simplified altitude estimation using rocket equation
    const deltaV = config.engine.specificImpulse * SimulationEngine.GRAVITY * 
      Math.log(totalMass / (totalMass - config.engine.propellantMass));
    
    const estimatedVelocity = deltaV * 0.7; // Account for drag and gravity losses
    const estimatedAltitude = (estimatedVelocity ** 2) / (2 * SimulationEngine.GRAVITY);

    return {
      estimatedAltitude,
      estimatedVelocity,
      thrustToWeight,
      stabilityMargin
    };
  }
}
