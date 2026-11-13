require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Doctor = require('../src/models/Doctor');

async function seed() {
  const uri = process.env.MONGODB_URI || '';

  if (!/^mongodb:\/\/(127\.0\.0\.1|localhost):27018\//.test(uri)) {
    throw new Error(
      'Safety check failed: MONGODB_URI must target local MongoDB on port 27018.',
    );
  }

  const patientPassword = process.env.SEED_PATIENT_PASSWORD;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const doctorPassword = process.env.SEED_DOCTOR_PASSWORD;

  if (!patientPassword || !adminPassword ||
      patientPassword.length < 12 || adminPassword.length < 12 ||
      (doctorPassword && doctorPassword.length < 12)) {
    throw new Error(
      'Set SEED_PATIENT_PASSWORD and SEED_ADMIN_PASSWORD to values of at least 12 characters.',
    );
  }

  await mongoose.connect(uri);

  const users = [
    {
      name: 'Demo Patient One',
      email: 'patient1@example.test',
      password: patientPassword,
      role: 'patient',
    },
    {
      name: 'Demo Patient Two',
      email: 'patient2@example.test',
      password: patientPassword,
      role: 'patient',
    },
    {
      name: 'Local Demo Admin',
      email: 'admin@example.test',
      password: adminPassword,
      role: 'admin',
    },
    ...(doctorPassword ? [{
      name: 'Dr. Alex Morgan',
      email: 'doctor@example.test',
      password: doctorPassword,
      role: 'doctor',
    }] : []),
  ];

  for (const entry of users) {
    const passwordHash = await bcrypt.hash(entry.password, 12);

    await User.findOneAndUpdate(
      { email: entry.email },
      {
        $set: {
          name: entry.name,
          passwordHash,
          role: entry.role,
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  const doctors = [
    { name: 'Dr. Alex Morgan', specialty: 'Cardiology', available: true },
    { name: 'Dr. Jamie Taylor', specialty: 'Dermatology', available: true },
  ];

  for (const doctor of doctors) {
    const linkedUser = doctorPassword && doctor.name === 'Dr. Alex Morgan'
      ? await User.findOne({ email: 'doctor@example.test' }).select('_id')
      : null;
    await Doctor.findOneAndUpdate(
      { name: doctor.name, specialty: doctor.specialty },
      { $set: { available: doctor.available, ...(linkedUser ? { user: linkedUser._id } : {}) } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  console.log('Synthetic local seed data created or updated.');
  console.log('Users: patient1@example.test, patient2@example.test, admin@example.test');
  console.log('Doctors: 2 synthetic doctors');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
