const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/server');

describe('Hospital Appointment Platform API', () => {
  test('GET / should return API name and version', async () => {
    const response = await request(app).get('/');

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe(
      'Hospital Appointment Platform API',
    );
    expect(response.body.version).toBe('1.0.0');
  });

  test('GET /health should report database disconnection', async () => {
    const response = await request(app).get('/health');

    expect(response.statusCode).toBe(503);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.service).toBe(
      'hospital-appointment-platform',
    );
    expect(response.body.database).toBe('disconnected');
    expect(response.body.timestamp).toBeDefined();
  });

  test('GET /health should report database connection when connected', async () => {
    const originalReadyState = mongoose.connection.readyState;

    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 1,
    });

    try {
      const response = await request(app).get('/health');

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.database).toBe('connected');
    } finally {
      Object.defineProperty(mongoose.connection, 'readyState', {
        configurable: true,
        value: originalReadyState,
      });
    }
  });
});
