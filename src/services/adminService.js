const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireText(value, label, maxLength = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw createError(`${label} is required`, 400);
  }
  return value.trim();
}

function validateId(id, label) {
  if (!mongoose.isValidObjectId(id)) {
    throw createError(`Invalid ${label} ID`, 400);
  }
}

async function getStats() {
  const [doctors, patients, pending, approved, rejected] = await Promise.all([
    User.countDocuments({ role: 'doctor', active: true }),
    User.countDocuments({ role: 'patient', active: true }),
    Appointment.countDocuments({ status: 'pending' }),
    Appointment.countDocuments({ status: { $in: ['approved', 'confirmed'] } }),
    Appointment.countDocuments({ status: 'rejected' }),
  ]);
  return { doctors, patients, pending, approved, rejected };
}

async function listDoctors({ search } = {}) {
  const searchPattern = search
    ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    : null;
  const doctorFilter = searchPattern
    ? { $or: [{ name: searchPattern }, { specialty: searchPattern }] }
    : {};
  const doctors = await Doctor.find(doctorFilter)
    .populate('user', 'name email role active createdAt')
    .select('name specialty phone available user availableSlots')
    .sort({ name: 1 })
    .lean();
  return doctors
    .filter((doctor) => !searchPattern || !doctor.user || searchPattern.test(doctor.user.name) || searchPattern.test(doctor.user.email))
    .map((doctor) => ({
      ...doctor,
      account: doctor.user || null,
      user: undefined,
    }));
}

async function listPatients({ search } = {}) {
  const filter = { role: 'patient' };
  if (search) {
    filter.$or = [
      { name: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { email: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    ];
  }
  return User.find(filter).select('name email role active createdAt').sort({ name: 1 }).lean();
}

async function createDoctorAccount({ name, email, password, specialty, phone }) {
  const cleanName = requireText(name, 'Doctor name');
  const cleanEmail = requireText(email, 'Doctor email', 254).toLowerCase();
  const cleanSpecialty = requireText(specialty, 'Specialty');
  if (typeof password !== 'string' || password.length < 8) {
    throw createError('Doctor password must be at least 8 characters', 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw createError('A valid doctor email is required', 400);
  }
  if (await User.exists({ email: cleanEmail })) {
    throw createError('An account with this email already exists', 409);
  }

  const user = await User.create({
    name: cleanName,
    email: cleanEmail,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'doctor',
  });
  try {
    const doctor = await Doctor.create({
      name: cleanName,
      specialty: cleanSpecialty,
      phone: typeof phone === 'string' ? phone.trim() : undefined,
      user: user._id,
    });
    return {
      user: { id: user._id, name: user.name, email: user.email, role: user.role, active: user.active },
      doctor,
    };
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
}

async function updateDoctor({ doctorId, name, specialty, phone }) {
  validateId(doctorId, 'doctor');
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw createError('Doctor not found', 404);
  if (name !== undefined) doctor.name = requireText(name, 'Doctor name');
  if (specialty !== undefined) doctor.specialty = requireText(specialty, 'Specialty');
  if (phone !== undefined) doctor.phone = typeof phone === 'string' ? phone.trim() : '';
  await doctor.save();
  if (doctor.user) {
    await User.updateOne({ _id: doctor.user }, { $set: { name: doctor.name } });
  }
  return doctor;
}

async function setAccountStatus({ userId, active }) {
  validateId(userId, 'user');
  if (typeof active !== 'boolean') throw createError('active must be true or false', 400);
  const user = await User.findOneAndUpdate(
    { _id: userId, role: { $in: ['doctor', 'patient'] } },
    { $set: { active } },
    { new: true },
  ).select('name email role active');
  if (!user) throw createError('Account not found', 404);
  if (user.role === 'doctor') {
    await Doctor.updateOne({ user: user._id }, { $set: { available: active } });
  }
  return user;
}

async function listAppointments(filters = {}) {
  const filter = {};
  if (filters.status && ['pending', 'approved', 'confirmed', 'rejected', 'cancelled', 'completed'].includes(filters.status)) {
    filter.status = filters.status;
  }
  if (filters.doctorId) {
    validateId(filters.doctorId, 'doctor');
    filter.doctor = filters.doctorId;
  }
  if (filters.patientId) {
    validateId(filters.patientId, 'patient');
    filter.patient = filters.patientId;
  }
  if (filters.from || filters.to) {
    filter.appointmentTime = {};
    if (filters.from) filter.appointmentTime.$gte = new Date(filters.from);
    if (filters.to) filter.appointmentTime.$lte = new Date(filters.to);
    if (Object.values(filter.appointmentTime).some((date) => !Number.isFinite(date.getTime()))) {
      throw createError('from and to must be valid dates', 400);
    }
  }
  return Appointment.find(filter)
    .populate('patient', 'name email active')
    .populate('doctor', 'name specialty phone')
    .sort({ appointmentTime: 1 })
    .lean();
}

module.exports = {
  getStats,
  listDoctors,
  listPatients,
  createDoctorAccount,
  updateDoctor,
  setAccountStatus,
  listAppointments,
};
