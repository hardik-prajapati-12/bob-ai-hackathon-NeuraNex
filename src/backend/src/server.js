'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config/env');
const { connectDB } = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const vesselRoutes = require('./routes/vessels');
const berthRoutes = require('./routes/berths');
const terminalRoutes = require('./routes/terminals');
const craneRoutes = require('./routes/cranes');
const scheduleRoutes = require('./routes/schedules');
const congestionRoutes = require('./routes/congestion');
const optimizationRoutes = require('./routes/optimization');
const aiRoutes = require('./routes/ai');
const operationsPlanRoutes = require('./routes/operationsPlan');
const alertRoutes = require('./routes/alerts');
const dashboardRoutes = require('./routes/dashboard');

// ─── App Setup ───────────────────────────────────────────────────────────────

const app = express();

// Security headers
app.use(helmet());

// CORS — allow frontend origin
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting — 200 requests per 15 minutes per IP
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { success: false, message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging (skip in test)
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.isDev ? 'dev' : 'combined'));
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/vessels', vesselRoutes);
app.use('/api/berths', berthRoutes);
app.use('/api/terminals', terminalRoutes);
app.use('/api/cranes', craneRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/congestion', congestionRoutes);
app.use('/api/optimization', optimizationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/operations-plan', operationsPlanRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// Global error handler (must be last)
app.use(errorHandler);

// ─── Server Start ─────────────────────────────────────────────────────────────

async function startServer() {
  try {
    await connectDB();

    const server = app.listen(config.port, () => {
      logger.info(`PortMind AI Backend running on port ${config.port} [${config.nodeEnv}]`);
      logger.info(`Health check: http://localhost:${config.port}/api/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received — shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received — shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    return server;
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

// Export app for testing, start server only when run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
