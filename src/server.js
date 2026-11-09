const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDatabase } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));


app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    console.log(JSON.stringify({
      level: 'info',
      event: 'http_request',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    }));
  });

  next();
});

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);

app.get('/health', (req, res) => {
  const databaseConnected = require('mongoose').connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'healthy' : 'unhealthy',
    service: 'hospital-appointment-platform',
    database: databaseConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Hospital Appointment Platform API',
    version: '1.0.0',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    console.error('Request failed:', err.message);
  }

  return res.status(statusCode).json({
    error: statusCode >= 500
      ? 'Internal server error'
      : err.message,
  });
});

const PORT = process.env.PORT || 3000;
let server;

async function startServer() {
  await connectDatabase();

  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hospital Appointment API running on port ${PORT}`);
  });
}

async function shutdown() {
  console.log('Shutting down Hospital Appointment API');

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  await require('mongoose').disconnect();
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Application startup failed:', error.message);
    process.exitCode = 1;
  });

  process.once('SIGTERM', () => {
    shutdown().catch((error) => {
      console.error('Shutdown failed:', error.message);
      process.exitCode = 1;
    });
  });

  process.once('SIGINT', () => {
    shutdown().catch((error) => {
      console.error('Shutdown failed:', error.message);
      process.exitCode = 1;
    });
  });
}

module.exports = app;
