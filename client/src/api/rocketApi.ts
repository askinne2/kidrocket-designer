/**
 * Rocket API Client
 * 
 * API client for communicating with the rocket backend services.
 */

import axios from 'axios';

// Types (shared with backend)
export interface RocketConfig {
  body: {
    length: number;
    diameter: number;
    mass: number;
    material: string;
    fineness: number;
  };
  noseCone: {
    type: string;
    length: number;
    mass: number;
    material: string;
  };
  fins: {
    count: number;
    span: number;
    rootChord: number;
    tipChord: number;
    sweepAngle: number;
    thickness: number;
    material: string;
    mass: number;
  };
  engine: {
    type: string;
    thrust: number;
    burnTime: number;
    specificImpulse: number;
    propellantMass: number;
    totalMass: number;
  };
  recovery: {
    type: string;
    deploymentAltitude: number;
    parachuteDiameter?: number;
    chuteCount?: number;
    mass: number;
  };
  launch: {
    launchAngle: number;
    launchRodLength: number;
    windSpeed?: number;
    windDirection?: number;
  };
}

export interface CreateRocketRequest {
  name: string;
  description?: string;
  config: RocketConfig;
  metadata?: {
    tags?: string[];
    isPublic?: boolean;
    complexity?: string;
    estimatedCost?: number;
    buildTime?: number;
  };
}

export interface RocketDesign {
  id: string;
  userId: string;
  name: string;
  description?: string;
  version: number;
  config: RocketConfig;
  metadata: {
    thumbnail?: string;
    tags: string[];
    isPublic: boolean;
    likes: number;
    downloads: number;
    complexity: string;
    estimatedCost: number;
    buildTime: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FlightResults {
  maxAltitude: number;
  maxVelocity: number;
  maxAcceleration: number;
  flightTime: number;
  burnoutAltitude: number;
  burnoutVelocity: number;
  apogeeTime: number;
  recoveryTime: number;
  landingDistance: number;
  maxMachNumber: number;
  maxDynamicPressure: number;
  stabilityMargin: number;
  successful: boolean;
  issues: Array<{
    type: string;
    code: string;
    message: string;
    time?: number;
    severity: number;
  }>;
  score: number;
}

export interface TrajectoryPoint {
  time: number;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  acceleration: { x: number; y: number; z: number };
  mass: number;
  thrust: number;
  drag: number;
  machNumber: number;
  altitude: number;
  phase: string;
}

export interface SimulationResult {
  id: string;
  rocketId: string;
  userId: string;
  config: RocketConfig;
  results: FlightResults;
  telemetry: TrajectoryPoint[];
  weather: {
    temperature: number;
    pressure: number;
    humidity: number;
    windSpeed: number;
    windDirection: number;
  };
  createdAt: string;
}

export interface LaunchOptions {
  weather?: {
    temperature?: number;
    pressure?: number;
    humidity?: number;
    windSpeed?: number;
    windDirection?: number;
  };
  timeStep?: number;
  maxFlightTime?: number;
  detailedTelemetry?: boolean;
}

export interface PerformanceEstimate {
  estimatedAltitude: number;
  estimatedVelocity: number;
  thrustToWeight: number;
  stabilityMargin: number;
  recommendations: string[];
}

// API Client
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const rocketApi = {
  // Create a new rocket
  async createRocket(data: CreateRocketRequest): Promise<RocketDesign> {
    const response = await apiClient.post('/rockets', data);
    return response.data.data;
  },

  // Get rocket by ID
  async getRocket(id: string): Promise<RocketDesign> {
    const response = await apiClient.get(`/rockets/${id}`);
    return response.data.data;
  },

  // Update rocket
  async updateRocket(id: string, data: Partial<CreateRocketRequest>): Promise<RocketDesign> {
    const response = await apiClient.put(`/rockets/${id}`, data);
    return response.data.data;
  },

  // Delete rocket
  async deleteRocket(id: string): Promise<void> {
    await apiClient.delete(`/rockets/${id}`);
  },

  // Launch rocket simulation
  async launchRocket(id: string, options?: LaunchOptions): Promise<SimulationResult> {
    const response = await apiClient.post(`/rockets/${id}/launch`, { options });
    return response.data.data;
  },

  // Get performance estimate
  async estimatePerformance(config: RocketConfig): Promise<PerformanceEstimate> {
    const response = await apiClient.post('/rockets/estimate', config);
    return response.data.data;
  },

  // List user's rockets
  async getUserRockets(): Promise<RocketDesign[]> {
    const response = await apiClient.get('/users/me/rockets');
    return response.data.data;
  },

  // Get rocket simulations
  async getRocketSimulations(id: string, includeTelemetry = false): Promise<SimulationResult[]> {
    const response = await apiClient.get(`/rockets/${id}/simulations?telemetry=${includeTelemetry}`);
    return response.data.data.simulations;
  },

  // Get popular rockets
  async getPopularRockets(limit = 10): Promise<RocketDesign[]> {
    const response = await apiClient.get(`/rockets/popular?limit=${limit}`);
    return response.data.data;
  }
};

// Default rocket configuration for new rockets
export const defaultRocketConfig: RocketConfig = {
  body: {
    length: 0.6,
    diameter: 0.024,
    mass: 0.1,
    material: 'cardboard',
    fineness: 25
  },
  noseCone: {
    type: 'ogive',
    length: 0.1,
    mass: 0.02,
    material: 'balsa'
  },
  fins: {
    count: 4,
    span: 0.08,
    rootChord: 0.06,
    tipChord: 0.03,
    sweepAngle: 30,
    thickness: 0.003,
    material: 'balsa',
    mass: 0.01
  },
  engine: {
    type: 'C',
    thrust: 12,
    burnTime: 2.5,
    specificImpulse: 180,
    propellantMass: 0.024,
    totalMass: 0.038
  },
  recovery: {
    type: 'parachute',
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

// Material options
export const materialOptions = [
  { value: 'cardboard', label: 'Cardboard' },
  { value: 'balsa', label: 'Balsa Wood' },
  { value: 'plywood', label: 'Plywood' },
  { value: 'fiberglass', label: 'Fiberglass' },
  { value: 'carbon_fiber', label: 'Carbon Fiber' },
  { value: 'aluminum', label: 'Aluminum' },
  { value: 'plastic', label: 'Plastic' }
];

export const noseConeTypes = [
  { value: 'conical', label: 'Conical' },
  { value: 'ogive', label: 'Ogive' },
  { value: 'parabolic', label: 'Parabolic' },
  { value: 'elliptical', label: 'Elliptical' },
  { value: 'blunt', label: 'Blunt' }
];

export const engineTypes = [
  { value: 'A', label: 'A Class' },
  { value: 'B', label: 'B Class' },
  { value: 'C', label: 'C Class' },
  { value: 'D', label: 'D Class' },
  { value: 'E', label: 'E Class' },
  { value: 'F', label: 'F Class' },
  { value: 'G', label: 'G Class' }
];

export const recoveryTypes = [
  { value: 'tumble', label: 'Tumble Recovery' },
  { value: 'streamer', label: 'Streamer' },
  { value: 'parachute', label: 'Parachute' },
  { value: 'dual_deploy', label: 'Dual Deploy' }
];
