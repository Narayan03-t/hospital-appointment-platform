const request = require('supertest');
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

  test('GET /health should return healthy status', async () => {
    const response = await request(app).get('/health');

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.service).toBe(
      'hospital-appointment-platform',
    );
    expect(response.body.timestamp).toBeDefined();
  });
});
