/**
 * Simple Server Implementation
 * Basic Express server without complex dependency injection
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { DatabaseService } from './infrastructure/database/database.service';
import { CacheService } from './infrastructure/cache/cache.service';
import { createRocketModule } from './domains/rocket';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Basic API info
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'KidRocket Designer API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      rockets: '/api/v1/rockets',
      estimate: '/api/v1/rockets/estimate'
    }
  });
});

// Simple rocket estimation endpoint (no database required)
app.post('/api/v1/rockets/estimate', (req, res) => {
  try {
    // Mock performance estimation
    const config = req.body;
    
    const estimate = {
      estimatedAltitude: 200 + Math.random() * 100,
      estimatedVelocity: 80 + Math.random() * 20,
      thrustToWeight: 5 + Math.random() * 3,
      stabilityMargin: 2 + Math.random(),
      recommendations: [
        'Rocket configuration looks good!',
        'Consider testing in calm weather conditions'
      ]
    };

    res.json({
      success: true,
      data: estimate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to estimate performance',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Basic rocket endpoints (mock data for now)
app.get('/api/v1/rockets', (req, res) => {
  res.json({
    success: true,
    data: {
      rockets: [],
      total: 0,
      page: 1,
      limit: 20
    }
  });
});

// Mock rocket creation
app.post('/api/v1/rockets', (req, res) => {
  const rocket = {
    id: 'rocket-' + Date.now(),
    userId: 'user-123',
    name: req.body.name || 'New Rocket',
    description: req.body.description || '',
    version: 1,
    config: req.body.config,
    metadata: {
      tags: req.body.metadata?.tags || [],
      isPublic: false,
      likes: 0,
      downloads: 0,
      complexity: 'beginner',
      estimatedCost: 25.50,
      buildTime: 2
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  res.status(201).json({
    success: true,
    message: 'Rocket created successfully',
    data: rocket
  });
});

// Mock rocket launch
app.post('/api/v1/rockets/:id/launch', (req, res) => {
  const rocketId = req.params.id;
  
  // Mock simulation result
  const simulationResult = {
    id: 'sim-' + Date.now(),
    rocketId: rocketId,
    userId: 'user-123',
    config: req.body.config || {},
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
    telemetry: generateMockTelemetry(),
    weather: {
      temperature: 20,
      pressure: 101325,
      humidity: 50,
      windSpeed: 5,
      windDirection: 0
    },
    createdAt: new Date().toISOString()
  };

  res.status(201).json({
    success: true,
    message: 'Rocket launched successfully',
    data: simulationResult
  });
});

// Generate mock telemetry data
function generateMockTelemetry() {
  const telemetry = [];
  const flightTime = 18.4;
  const timeStep = 0.1;
  
  for (let t = 0; t <= flightTime; t += timeStep) {
    const altitude = Math.max(0, 245.7 * Math.sin(Math.PI * t / flightTime));
    const velocity = t < 3 ? t * 30 : Math.max(0, 89.3 - (t - 3) * 5);
    
    telemetry.push({
      time: t,
      position: { x: t * 2, y: altitude, z: 0 },
      velocity: { x: 2, y: t < 6.8 ? velocity : -velocity, z: 0 },
      acceleration: { x: 0, y: t < 2.5 ? 156.2 : -9.81, z: 0 },
      mass: 0.162 - (t < 2.5 ? t * 0.01 : 0.025),
      thrust: t < 2.5 ? 12 : 0,
      drag: velocity * 0.1,
      machNumber: velocity / 343,
      altitude: altitude,
      phase: t < 2.5 ? 'boost' : t < 6.8 ? 'coast' : t < 8.2 ? 'apogee' : 'recovery'
    });
  }
  
  return telemetry;
}

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 KidRocket Designer API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API info: http://localhost:${PORT}/api/v1`);
});

export default app;
