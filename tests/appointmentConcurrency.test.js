const os = require('os');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const app = require('../src/server');
const User = require('../src/models/User');
const Doctor = require('../src/models/Doctor');
const Appointment = require('../src/models/Appointment');

const TEST_DATABASE = 'hospital_appointments_concurrency_test';
const TEST_URI = `mongodb://127.0.0.1:27018/${TEST_DATABASE}`;

let patient;
let doctor;
let patientToken;

describe('Concurrent appointment booking API integration test', () => {
  beforeAll(async () => {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must contain at least 32 characters');
    }

    const parsedUri = new URL(TEST_URI);

    if (
      parsedUri.hostname !== '127.0.0.1' ||
      parsedUri.port !== '27018' ||
      parsedUri.pathname !== `/${TEST_DATABASE}`
    ) {
      throw new Error('Unsafe test database URI; refusing to connect');
    }

    if (mongoose.connection.readyState !== 0) {
      throw new Error('Mongoose must be disconnected before this test');
    }

    await mongoose.connect(TEST_URI, {
      serverSelectionTimeoutMS: 5000,
      runtimeAdapters: { os },
    });

    if (mongoose.connection.name !== TEST_DATABASE) {
      throw new Error('Connected to an unexpected database; aborting');
    }

    await Promise.all([
      User.init(),
      Doctor.init(),
      Appointment.init(),
    ]);

    patient = await User.create({
      name: 'Concurrency Test Patient',
      email: `concurrency-test-${Date.now()}@example.test`,
      passwordHash: await bcrypt.hash('SyntheticTestPassword123!', 4),
      role: 'patient',
    });

    doctor = await Doctor.create({
      name: 'Concurrency Test Doctor',
      specialty: 'General Medicine',
      available: true,
    });

    patientToken = jwt.sign(
      { sub: String(patient._id), role: 'patient' },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '5m' },
    );
  }, 20000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      if (mongoose.connection.name !== TEST_DATABASE) {
        throw new Error('Unexpected database during cleanup; refusing deletion');
      }

      if (patient?._id) {
        await Appointment.deleteMany({ patient: patient._id });
        await User.deleteOne({ _id: patient._id });
      }

      if (doctor?._id) {
        await Doctor.deleteOne({ _id: doctor._id });
      }

      await mongoose.disconnect();
    }
  });

  test('only one simultaneous booking for the same doctor and time succeeds', async () => {
    const appointmentTime = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const payload = {
      doctorId: String(doctor._id),
      appointmentTime,
      reason: 'Concurrent booking integration test',
    };

    const responses = await Promise.all([
      request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(payload),
      request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(payload),
    ]);

    const statuses = responses
      .map((response) => response.statusCode)
      .sort((a, b) => a - b);

    expect(statuses).toEqual([201, 409]);

    const confirmedCount = await Appointment.countDocuments({
      doctor: doctor._id,
      appointmentTime: new Date(appointmentTime),
      status: 'confirmed',
    });

    expect(confirmedCount).toBe(1);
  }, 20000);
});
