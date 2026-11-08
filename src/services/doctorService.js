const Doctor = require('../models/Doctor');

async function listDoctors({ specialty, available } = {}) {
  const filter = {};

  if (specialty) {
    filter.specialty = new RegExp(
      specialty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i',
    );
  }

  if (available !== undefined) {
    filter.available = available;
  }

  return Doctor.find(filter)
    .select('name specialty available')
    .sort({ name: 1 })
    .lean();
}

async function createDoctor({ name, specialty }) {
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof specialty !== 'string' ||
    !specialty.trim()
  ) {
    const error = new Error('Doctor name and specialty are required');
    error.statusCode = 400;
    throw error;
  }

  return Doctor.create({
    name: name.trim(),
    specialty: specialty.trim(),
  });
}

module.exports = { listDoctors, createDoctor };
