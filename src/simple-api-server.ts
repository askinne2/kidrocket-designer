/**
 * Simple Standalone API Server
 * Basic Express server with mock rocket endpoints for frontend testing
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Basic health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'KidRocket Designer API'
  });
});

// API info
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'KidRocket Designer API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      rockets: {
        estimate: 'POST /api/v1/rockets/estimate',
        create: 'POST /api/v1/rockets',
        launch: 'POST /api/v1/rockets/:id/launch',
        list: 'GET /api/v1/rockets',
        popular: 'GET /api/v1/rockets/popular'
      }
    }
  });
});

// Performance estimation endpoint
app.post('/api/v1/rockets/estimate', (req, res) => {
  try {
    console.log('Estimating performance for rocket config:', req.body);
    
    const config = req.body;
    
    // Mock realistic performance estimation
    const bodyMass = config?.body?.mass || 0.1;
    const engineThrust = config?.engine?.thrust || 12;
    const bodyLength = config?.body?.length || 0.6;
    const bodyDiameter = config?.body?.diameter || 0.024;
    
    const thrustToWeight = engineThrust / (bodyMass * 9.81);
    const stabilityMargin = (bodyLength / bodyDiameter) * 0.1; // Simplified
    const estimatedAltitude = Math.min(500, thrustToWeight * 30 + Math.random() * 50);
    const estimatedVelocity = Math.sqrt(estimatedAltitude * 2 * 9.81) * 0.7;
    
    const recommendations = [];
    if (thrustToWeight < 5) {
      recommendations.push('Consider a more powerful engine for better performance');
    }
    if (stabilityMargin < 1) {
      recommendations.push('Increase fin size or move center of gravity forward');
    }
    if (estimatedAltitude < 50) {
      recommendations.push('Reduce weight or increase engine power for higher altitude');
    }
    if (recommendations.length === 0) {
      recommendations.push('Rocket configuration looks good!');
    }

    const estimate = {
      estimatedAltitude: Math.round(estimatedAltitude * 10) / 10,
      estimatedVelocity: Math.round(estimatedVelocity * 10) / 10,
      thrustToWeight: Math.round(thrustToWeight * 10) / 10,
      stabilityMargin: Math.round(stabilityMargin * 10) / 10,
      recommendations
    };

    console.log('Performance estimate:', estimate);

    res.json({
      success: true,
      data: estimate
    });
  } catch (error: any) {
    console.error('Error estimating performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to estimate performance',
      error: error.message
    });
  }
});

// Create rocket endpoint
app.post('/api/v1/rockets', (req, res) => {
  try {
    console.log('Creating rocket:', req.body);
    
    const rocket = {
      id: 'rocket-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      userId: 'user-123',
      name: req.body.name || 'New Rocket',
      description: req.body.description || '',
      version: 1,
      config: req.body.config || {},
      metadata: {
        thumbnail: undefined,
        tags: req.body.metadata?.tags || [],
        isPublic: req.body.metadata?.isPublic || false,
        likes: 0,
        downloads: 0,
        complexity: req.body.metadata?.complexity || 'beginner',
        estimatedCost: req.body.metadata?.estimatedCost || 25.50,
        buildTime: req.body.metadata?.buildTime || 2
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('Created rocket:', rocket.id);

    res.status(201).json({
      success: true,
      message: 'Rocket created successfully',
      data: rocket
    });
  } catch (error: any) {
    console.error('Error creating rocket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create rocket',
      error: error.message
    });
  }
});

// Launch rocket simulation
app.post('/api/v1/rockets/:id/launch', (req, res) => {
  try {
    const rocketId = req.params.id;
    const launchOptions = req.body.options || {};
    
    console.log(`Launching rocket ${rocketId} with options:`, launchOptions);
    
    // Generate realistic simulation data
    const weather = {
      temperature: launchOptions.weather?.temperature || 20,
      pressure: launchOptions.weather?.pressure || 101325,
      humidity: launchOptions.weather?.humidity || 50,
      windSpeed: launchOptions.weather?.windSpeed || 5,
      windDirection: launchOptions.weather?.windDirection || 0
    };
    
    const baseAltitude = 200 + Math.random() * 100;
    const flightTime = 15 + Math.random() * 10;
    const maxVelocity = 60 + Math.random() * 30;
    
    const results = {
      maxAltitude: Math.round(baseAltitude * 10) / 10,
      maxVelocity: Math.round(maxVelocity * 10) / 10,
      maxAcceleration: Math.round((100 + Math.random() * 100) * 10) / 10,
      flightTime: Math.round(flightTime * 10) / 10,
      burnoutAltitude: Math.round((baseAltitude * 0.3) * 10) / 10,
      burnoutVelocity: Math.round((maxVelocity * 0.8) * 10) / 10,
      apogeeTime: Math.round((flightTime * 0.4) * 10) / 10,
      recoveryTime: Math.round((flightTime * 0.5) * 10) / 10,
      landingDistance: Math.round((50 + Math.random() * 100) * 10) / 10,
      maxMachNumber: Math.round((maxVelocity / 343) * 1000) / 1000,
      maxDynamicPressure: Math.round((1000 + Math.random() * 500) * 10) / 10,
      stabilityMargin: Math.round((2 + Math.random()) * 10) / 10,
      successful: true,
      issues: [],
      score: Math.round(70 + Math.random() * 30)
    };
    
    // Generate telemetry data
    const telemetry = generateTelemetryData(results, flightTime);
    
    const simulationResult = {
      id: 'sim-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      rocketId: rocketId,
      userId: 'user-123',
      config: req.body.config || {},
      results,
      telemetry,
      weather,
      createdAt: new Date().toISOString()
    };

    console.log(`Simulation complete for rocket ${rocketId}: ${results.maxAltitude}m altitude`);

    res.status(201).json({
      success: true,
      message: 'Rocket launched successfully',
      data: simulationResult
    });
  } catch (error: any) {
    console.error('Error launching rocket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to launch rocket',
      error: error.message
    });
  }
});

// Generate realistic telemetry data
function generateTelemetryData(results: any, flightTime: number) {
  const telemetry = [];
  const timeStep = 0.1;
  const burnTime = 2.5;
  const apogeeTime = results.apogeeTime;
  
  for (let t = 0; t <= flightTime; t += timeStep) {
    // Calculate altitude using realistic trajectory
    let altitude = 0;
    if (t <= apogeeTime) {
      // Ascending phase
      altitude = results.maxAltitude * Math.sin((Math.PI / 2) * (t / apogeeTime));
    } else {
      // Descending phase
      const descendTime = t - apogeeTime;
      const totalDescendTime = flightTime - apogeeTime;
      altitude = results.maxAltitude * Math.cos((Math.PI / 2) * (descendTime / totalDescendTime));
    }
    
    // Calculate velocity
    let velocity = 0;
    if (t <= burnTime) {
      velocity = results.maxVelocity * (t / burnTime);
    } else if (t <= apogeeTime) {
      velocity = results.maxVelocity * (1 - ((t - burnTime) / (apogeeTime - burnTime)));
    } else {
      velocity = -20; // Descent velocity
    }
    
    // Calculate acceleration
    let acceleration = 0;
    if (t <= burnTime) {
      acceleration = results.maxAcceleration;
    } else {
      acceleration = -9.81; // Gravity
    }
    
    // Determine flight phase
    let phase = 'prelaunch';
    if (t > 0 && t <= burnTime) phase = 'boost';
    else if (t > burnTime && t <= apogeeTime) phase = 'coast';
    else if (t > apogeeTime && t <= results.recoveryTime) phase = 'apogee';
    else if (t > results.recoveryTime) phase = 'recovery';
    
    telemetry.push({
      time: Math.round(t * 10) / 10,
      position: { 
        x: Math.round(t * 3 * 10) / 10, 
        y: Math.round(Math.max(0, altitude) * 10) / 10, 
        z: 0 
      },
      velocity: { 
        x: Math.round(3 * 10) / 10, 
        y: Math.round(velocity * 10) / 10, 
        z: 0 
      },
      acceleration: { 
        x: 0, 
        y: Math.round(acceleration * 10) / 10, 
        z: 0 
      },
      mass: Math.round((0.162 - (t < burnTime ? t * 0.01 : 0.025)) * 1000) / 1000,
      thrust: t <= burnTime ? 12 : 0,
      drag: Math.round(Math.abs(velocity) * 0.1 * 10) / 10,
      machNumber: Math.round((Math.abs(velocity) / 343) * 1000) / 1000,
      altitude: Math.round(Math.max(0, altitude) * 10) / 10,
      phase
    });
  }
  
  return telemetry;
}

// List rockets (mock)
app.get('/api/v1/rockets', (req, res) => {
  res.json({
    success: true,
    data: {
      rockets: [],
      total: 0,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    }
  });
});

// Popular rockets (mock)
app.get('/api/v1/rockets/popular', (req, res) => {
  res.json({
    success: true,
    data: []
  });
});

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
    path: req.originalUrl,
    availableEndpoints: [
      'GET /health',
      'GET /api/v1',
      'POST /api/v1/rockets/estimate',
      'POST /api/v1/rockets',
      'POST /api/v1/rockets/:id/launch'
    ]
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('🚀 KidRocket Designer API Server Started!');
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API info: http://localhost:${PORT}/api/v1`);
  console.log(`🎯 Ready to receive rocket designs and simulations!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
  });
});

export default app;
