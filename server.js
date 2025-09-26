/**
 * Production API Server for KidRocket Designer
 * JavaScript version for reliable deployment
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

// CORS configuration for production
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://askinne2.github.io',
    /\.github\.io$/,
    /\.onrender\.com$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'KidRocket Designer API',
    version: '1.0.0'
  });
});

// API info endpoint
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'KidRocket Designer API',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/health',
      rockets: {
        estimate: 'POST /api/v1/rockets/estimate',
        create: 'POST /api/v1/rockets',
        launch: 'POST /api/v1/rockets/:id/launch'
      }
    }
  });
});

// Rocket performance estimation endpoint
app.post('/api/v1/rockets/estimate', (req, res) => {
  try {
    const { body: rocketBody, engine, fins, noseCone } = req.body;
    
    console.log('Estimating performance for rocket config:', { 
      body: rocketBody, 
      engine: engine ? { type: engine.type, thrust: engine.thrust } : 'not provided',
      fins: fins ? { count: fins.count } : 'not provided'
    });

    // Simple physics calculations for demonstration
    const mass = rocketBody?.mass || 0.1;
    const thrust = engine?.thrust || 12;
    const length = rocketBody?.length || 0.6;
    const finCount = fins?.count || 4;
    
    // Basic altitude estimation (simplified)
    const thrustToWeight = thrust / (mass * 9.81);
    const estimatedAltitude = Math.round((thrust * 30 - mass * 100) * (1 + length/2) * (1 + finCount/10));
    const estimatedVelocity = Math.round(Math.sqrt(2 * estimatedAltitude * 0.8));
    const stabilityMargin = Math.round((2 + finCount/2) * 10) / 10;

    const performanceData = {
      estimatedAltitude: Math.max(estimatedAltitude, 50),
      estimatedVelocity: Math.max(estimatedVelocity, 20),
      thrustToWeight: Math.round(thrustToWeight * 10) / 10,
      stabilityMargin,
      recommendations: [
        thrustToWeight > 5 ? "Good thrust-to-weight ratio!" : "Consider a more powerful engine",
        stabilityMargin > 2 ? "Rocket should be stable in flight" : "Add more fins for better stability",
        "Configuration looks good for educational use!"
      ].filter(Boolean)
    };

    console.log('Performance estimate:', performanceData);

    res.json({
      success: true,
      data: performanceData
    });

  } catch (error) {
    console.error('Error estimating performance:', error);
    res.status(400).json({
      success: false,
      error: 'Invalid rocket configuration',
      message: 'Please check your rocket parameters'
    });
  }
});

// Create rocket endpoint
app.post('/api/v1/rockets', (req, res) => {
  try {
    const { name, description, config } = req.body;
    
    // Generate a simple ID
    const rocketId = `rocket-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    console.log('Creating rocket:', {
      name: name || 'Unnamed Rocket',
      description: description || 'No description',
      config: config ? 'provided' : 'missing'
    });

    const rocket = {
      id: rocketId,
      name: name || 'Temporary Rocket',
      description: description || 'Temporary rocket for simulation',
      config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('Created rocket:', rocketId);

    res.status(201).json({
      success: true,
      data: rocket
    });

  } catch (error) {
    console.error('Error creating rocket:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to create rocket',
      message: 'Please check your rocket data'
    });
  }
});

// Launch simulation endpoint
app.post('/api/v1/rockets/:id/launch', (req, res) => {
  try {
    const rocketId = req.params.id;
    const { weather, timeStep, maxFlightTime } = req.body;
    
    console.log(`Launching rocket ${rocketId} with options:`, {
      weather: weather || 'default',
      timeStep: timeStep || 0.01,
      maxFlightTime: maxFlightTime || 300
    });

    // Generate realistic simulation data
    const baseAltitude = 200 + Math.random() * 200; // 200-400m
    const flightTime = 15 + Math.random() * 20; // 15-35 seconds
    const maxVelocity = 40 + Math.random() * 30; // 40-70 m/s

    // Generate telemetry points
    const telemetryPoints = [];
    const numPoints = Math.floor(flightTime / (timeStep || 0.1));
    
    for (let i = 0; i <= numPoints; i++) {
      const t = (i / numPoints) * flightTime;
      const phase = t < flightTime * 0.3 ? 'boost' : t < flightTime * 0.6 ? 'coast' : 'recovery';
      
      // Simplified trajectory calculation
      let altitude = 0;
      let velocity = 0;
      
      if (phase === 'boost') {
        altitude = baseAltitude * (t / (flightTime * 0.3)) * (1 - 0.5 * (t / (flightTime * 0.3)));
        velocity = maxVelocity * (t / (flightTime * 0.3));
      } else if (phase === 'coast') {
        const coastTime = t - flightTime * 0.3;
        const coastDuration = flightTime * 0.3;
        altitude = baseAltitude * (1 - 0.5 * (coastTime / coastDuration));
        velocity = maxVelocity * (1 - coastTime / coastDuration);
      } else {
        const recoveryTime = t - flightTime * 0.6;
        const recoveryDuration = flightTime * 0.4;
        altitude = baseAltitude * 0.5 * (1 - recoveryTime / recoveryDuration);
        velocity = Math.max(5, maxVelocity * 0.2);
      }

      telemetryPoints.push({
        time: Math.round(t * 10) / 10,
        altitude: Math.max(0, Math.round(altitude * 10) / 10),
        velocity: Math.round(velocity * 10) / 10,
        acceleration: phase === 'boost' ? 15 : phase === 'coast' ? -9.8 : -2,
        phase
      });
    }

    const simulationResult = {
      id: `sim-${Date.now()}`,
      rocketId,
      maxAltitude: Math.round(baseAltitude * 10) / 10,
      maxVelocity: Math.round(maxVelocity * 10) / 10,
      flightTime: Math.round(flightTime * 10) / 10,
      telemetry: telemetryPoints,
      events: [
        { time: 0, event: 'Launch', altitude: 0 },
        { time: flightTime * 0.3, event: 'Engine Burnout', altitude: baseAltitude * 0.7 },
        { time: flightTime * 0.6, event: 'Apogee', altitude: baseAltitude },
        { time: flightTime * 0.65, event: 'Recovery Deployment', altitude: baseAltitude * 0.9 },
        { time: flightTime, event: 'Landing', altitude: 0 }
      ],
      weather: weather || { temperature: 20, pressure: 101325, humidity: 50 },
      createdAt: new Date().toISOString()
    };

    console.log(`Simulation complete for rocket ${rocketId}: ${simulationResult.maxAltitude}m altitude`);

    res.json({
      success: true,
      data: simulationResult
    });

  } catch (error) {
    console.error('Error running simulation:', error);
    res.status(400).json({
      success: false,
      error: 'Simulation failed',
      message: 'Please check your launch parameters'
    });
  }
});

// Get popular rockets endpoint
app.get('/api/v1/rockets/popular', (req, res) => {
  const popularRockets = [
    {
      id: 'big-bertha',
      name: 'Big Bertha',
      description: 'Classic beginner rocket with great stability',
      estimatedAltitude: 250,
      difficulty: 'beginner'
    },
    {
      id: 'alpha-iii',
      name: 'Alpha III',
      description: 'Perfect first rocket for new rocketeers',
      estimatedAltitude: 300,
      difficulty: 'beginner'
    },
    {
      id: 'big-dog',
      name: 'Big Dog',
      description: 'Impressive size with reliable performance',
      estimatedAltitude: 400,
      difficulty: 'intermediate'
    }
  ];

  res.json({
    success: true,
    data: popularRockets
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} is not a valid endpoint`,
    availableEndpoints: [
      'GET /health',
      'GET /api/v1',
      'POST /api/v1/rockets/estimate',
      'POST /api/v1/rockets',
      'POST /api/v1/rockets/:id/launch',
      'GET /api/v1/rockets/popular'
    ]
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'Something went wrong on the server'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 KidRocket Designer API Server Started!');
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API info: http://localhost:${PORT}/api/v1`);
  console.log(`🎯 Ready to receive rocket designs and simulations!`);
});

module.exports = app;
