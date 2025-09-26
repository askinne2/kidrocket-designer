/**
 * Rocket Domain Types
 * 
 * Core type definitions for the Rocket/Simulation module following
 * the clean architecture pattern established in the Auth module.
 */

export interface RocketDesign {
  id: string;
  userId: string;
  name: string;
  description?: string;
  version: number;
  config: RocketConfig;
  metadata: RocketMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface RocketConfig {
  // Body Configuration
  body: {
    length: number; // meters
    diameter: number; // meters
    mass: number; // kg (dry mass)
    material: RocketMaterial;
    fineness: number; // length/diameter ratio for aerodynamics
  };
  
  // Nose Cone Configuration
  noseCone: {
    type: NoseConeType;
    length: number; // meters
    mass: number; // kg
    material: RocketMaterial;
  };
  
  // Fins Configuration
  fins: {
    count: number;
    span: number; // meters
    rootChord: number; // meters
    tipChord: number; // meters
    sweepAngle: number; // degrees
    thickness: number; // meters
    material: RocketMaterial;
    mass: number; // kg
  };
  
  // Engine Configuration
  engine: {
    type: EngineType;
    thrust: number; // Newtons
    burnTime: number; // seconds
    specificImpulse: number; // seconds (Isp)
    propellantMass: number; // kg
    totalMass: number; // kg (including casing)
  };
  
  // Recovery System
  recovery: {
    type: RecoveryType;
    deploymentAltitude: number; // meters AGL
    parachuteDiameter?: number; // meters (if parachute)
    chuteCount?: number;
    mass: number; // kg
  };
  
  // Launch Configuration
  launch: {
    launchAngle: number; // degrees from vertical
    launchRodLength: number; // meters
    windSpeed?: number; // m/s
    windDirection?: number; // degrees
  };
}

export interface RocketMetadata {
  thumbnail?: string; // base64 or URL to image
  tags: string[];
  isPublic: boolean;
  likes: number;
  downloads: number;
  complexity: ComplexityLevel;
  estimatedCost: number; // USD
  buildTime: number; // hours
}

export interface SimulationResult {
  id: string;
  rocketId: string;
  userId: string;
  config: RocketConfig; // Snapshot of config used
  results: FlightResults;
  telemetry: TrajectoryPoint[];
  weather: WeatherConditions;
  createdAt: Date;
}

export interface FlightResults {
  // Performance Metrics
  maxAltitude: number; // meters AGL
  maxVelocity: number; // m/s
  maxAcceleration: number; // m/s²
  flightTime: number; // seconds
  burnoutAltitude: number; // meters AGL
  burnoutVelocity: number; // m/s
  apogeeTime: number; // seconds
  recoveryTime: number; // seconds
  landingDistance: number; // meters from launch pad
  
  // Safety & Performance
  maxMachNumber: number;
  maxDynamicPressure: number; // Pa
  stabilityMargin: number; // calibers
  
  // Success Indicators
  successful: boolean;
  issues: FlightIssue[];
  score: number; // 0-100 performance score
}

export interface TrajectoryPoint {
  time: number; // seconds
  position: {
    x: number; // meters (downrange)
    y: number; // meters (altitude AGL)
    z: number; // meters (crossrange)
  };
  velocity: {
    x: number; // m/s
    y: number; // m/s
    z: number; // m/s
  };
  acceleration: {
    x: number; // m/s²
    y: number; // m/s²
    z: number; // m/s²
  };
  mass: number; // kg
  thrust: number; // N
  drag: number; // N
  machNumber: number;
  altitude: number; // meters AGL
  phase: FlightPhase;
}

export interface WeatherConditions {
  temperature: number; // Celsius
  pressure: number; // Pa
  humidity: number; // %
  windSpeed: number; // m/s
  windDirection: number; // degrees
  windGustSpeed?: number; // m/s
}

export interface LaunchOptions {
  weather?: Partial<WeatherConditions>;
  launchSite?: LaunchSite;
  timeStep?: number; // simulation time step in seconds
  maxFlightTime?: number; // maximum simulation time in seconds
  detailedTelemetry?: boolean; // high-resolution trajectory data
}

export interface LaunchSite {
  name: string;
  latitude: number;
  longitude: number;
  elevation: number; // meters MSL
  timezone: string;
}

// Enums and Constants
export enum RocketMaterial {
  CARDBOARD = 'cardboard',
  BALSA = 'balsa',
  PLYWOOD = 'plywood',
  FIBERGLASS = 'fiberglass',
  CARBON_FIBER = 'carbon_fiber',
  ALUMINUM = 'aluminum',
  PLASTIC = 'plastic'
}

export enum NoseConeType {
  CONICAL = 'conical',
  OGIVE = 'ogive',
  PARABOLIC = 'parabolic',
  ELLIPTICAL = 'elliptical',
  BLUNT = 'blunt'
}

export enum EngineType {
  // Model Rocket Engines
  A = 'A', B = 'B', C = 'C', D = 'D', E = 'E', F = 'F', G = 'G',
  // High Power Engines
  H = 'H', I = 'I', J = 'J', K = 'K', L = 'L', M = 'M', N = 'N',
  // Custom/Electric
  ELECTRIC = 'electric',
  CUSTOM = 'custom'
}

export enum RecoveryType {
  TUMBLE = 'tumble',
  STREAMER = 'streamer',
  PARACHUTE = 'parachute',
  DUAL_DEPLOY = 'dual_deploy',
  HELICOPTER = 'helicopter'
}

export enum ComplexityLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export enum FlightPhase {
  PRELAUNCH = 'prelaunch',
  BOOST = 'boost',
  COAST = 'coast',
  APOGEE = 'apogee',
  RECOVERY = 'recovery',
  LANDING = 'landing',
  ABORT = 'abort'
}

export interface FlightIssue {
  type: 'warning' | 'error' | 'info';
  code: string;
  message: string;
  time?: number; // when during flight this occurred
  severity: number; // 1-10
}

// API Request/Response Types
export interface CreateRocketRequest {
  name: string;
  description?: string;
  config: RocketConfig;
  metadata?: Partial<RocketMetadata>;
}

export interface UpdateRocketRequest extends Partial<CreateRocketRequest> {
  version?: number;
}

export interface LaunchRocketRequest {
  options?: LaunchOptions;
}

export interface RocketListResponse {
  rockets: RocketDesign[];
  total: number;
  page: number;
  limit: number;
}

export interface SimulationListResponse {
  simulations: SimulationResult[];
  total: number;
  page: number;
  limit: number;
}

// Validation Schemas (for use with Joi)
export const ROCKET_CONSTRAINTS = {
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 1000,
  MAX_BODY_LENGTH: 10, // meters
  MIN_BODY_LENGTH: 0.1, // meters
  MAX_BODY_DIAMETER: 1, // meters
  MIN_BODY_DIAMETER: 0.01, // meters
  MAX_MASS: 1000, // kg
  MIN_MASS: 0.001, // kg
  MAX_FINS: 8,
  MIN_FINS: 3,
  MAX_THRUST: 100000, // N
  MIN_THRUST: 0.1, // N
  MAX_BURN_TIME: 300, // seconds
  MIN_BURN_TIME: 0.1, // seconds
} as const;

// Default Values
export const DEFAULT_WEATHER: WeatherConditions = {
  temperature: 20, // 20°C
  pressure: 101325, // 1 atm
  humidity: 50, // 50%
  windSpeed: 5, // 5 m/s
  windDirection: 0 // North
};

export const DEFAULT_LAUNCH_SITE: LaunchSite = {
  name: 'Default Launch Site',
  latitude: 40.0,
  longitude: -74.0,
  elevation: 100,
  timezone: 'America/New_York'
};
