'use strict';

const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,

  // MongoDB
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/portmind',

  // Auth
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_in_production',
  demoUsername: process.env.DEMO_USERNAME || 'admin',
  demoPassword: process.env.DEMO_PASSWORD || 'portmind2026',

  // AI Provider
  aiProvider: process.env.AI_PROVIDER || 'watsonx',
  watsonx: {
    apiKey: process.env.WATSONX_API_KEY || '',
    projectId: process.env.WATSONX_PROJECT_ID || '',
    url: process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com',
    modelId: process.env.WATSONX_MODEL_ID || 'ibm/granite-13b-chat-v2',
  },

  // CORS
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Derived
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isProd: process.env.NODE_ENV === 'production',
};

module.exports = config;
