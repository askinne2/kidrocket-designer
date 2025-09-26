/**
 * Environment Configuration
 * Handles different API URLs for development vs production
 */

const config = {
  development: {
    API_BASE_URL: 'http://localhost:3001',
  },
  production: {
    // Update this with your Render.com backend URL after deployment
    API_BASE_URL: 'https://your-app-name.onrender.com',
  }
};

const environment = process.env.NODE_ENV || 'development';

export const API_BASE_URL = config[environment as keyof typeof config].API_BASE_URL;

const environmentConfig = {
  API_BASE_URL,
  isDevelopment: environment === 'development',
  isProduction: environment === 'production',
};

export default environmentConfig;
