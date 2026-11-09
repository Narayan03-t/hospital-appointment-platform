const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/server');

const TEST_SECRET = 'isolated-test-secret-with-at-least-32-characters';

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

function createToken(role) {
  return jwt.sign(
    { sub: '507f1f77bcf86cd799439011', role },
    TEST_SECRET,
    { algorithm: 'HS256', expiresIn: '5m' },
  );
}

describe('API authentication and authorization', () => {
  test('appointments endpoint rejects a missing token', async () => {
    const response = await request(app).get('/api/appointments/my');

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toBe('Authentication token required');
  });

  test('appointments endpoint rejects an invalid token', async () => {
    const response = await request(app)
      .get('/api/appointments/my')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toBe(
      'Invalid or expired authentication token',
    );
  });

  test('appointments endpoint rejects a non-patient role', async () => {
    const response = await request(app)
      .get('/api/appointments/my')
      .set('Authorization', `Bearer ${createToken('admin')}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.error).toBe('Insufficient permissions');
  });

  test('doctor creation rejects a missing token', async () => {
    const response = await request(app)
      .post('/api/doctors')
      .send({ name: 'Synthetic Test Doctor', specialty: 'Testing' });

    expect(response.statusCode).toBe(401);
  });

  test('doctor creation rejects a patient role', async () => {
    const response = await request(app)
      .post('/api/doctors')
      .set('Authorization', `Bearer ${createToken('patient')}`)
      .send({ name: 'Synthetic Test Doctor', specialty: 'Testing' });

    expect(response.statusCode).toBe(403);
    expect(response.body.error).toBe('Insufficient permissions');
  });

  test('doctor listing rejects an invalid availability filter', async () => {
    const response = await request(app)
      .get('/api/doctors')
      .query({ available: 'yes' });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('available must be true or false');
  });
});
