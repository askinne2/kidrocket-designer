/**
 * KidRocket Designer Server
 * Main server entry point
 */

import { config } from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_BASE_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Serve static files
app.use(express.static('public'));

// Root route - serve our demo page
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: './public' });
});

// API routes placeholder
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'KidRocket Designer API v1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth/*'
    }
  });
});

// Auth routes placeholder (will be implemented with dependency injection)
app.post('/api/v1/auth/register', (req, res) => {
  res.status(501).json({
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Auth module not yet wired up - dependency injection setup needed'
    }
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  res.status(501).json({
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED', 
      message: 'Auth module not yet wired up - dependency injection setup needed'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 KidRocket Designer server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 API endpoint: http://localhost:${PORT}/api/v1`);
});

export default app;
