const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const User = require('../models/User');

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
    .select('name specialty available availableSlots')
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

function error(message, statusCode) {
  const result = new Error(message);
  result.statusCode = statusCode;
  return result;
}

async function getDoctorForUser(userId) {
  if (!mongoose.isValidObjectId(userId)) {
    throw error('Invalid doctor ID', 400);
  }
  const user = await User.findOne({ _id: userId, role: 'doctor', active: true }).select('_id');
  const doctor = user ? await Doctor.findOne({ user: userId }) : null;
  if (!doctor) {
    throw error('No doctor profile is linked to this account', 404);
  }
  return doctor;
}

async function listDoctorAppointments(userId, status) {
  const doctor = await getDoctorForUser(userId);
  const filter = { doctor: doctor._id };
  if (status && ['pending', 'approved', 'confirmed', 'rejected', 'cancelled', 'completed'].includes(status)) {
    filter.status = status;
  }
  return Appointment.find(filter)
    .populate('patient', 'name email')
    .populate('doctor', 'name specialty')
    .sort({ appointmentTime: 1 })
    .lean();
}

async function decideAppointment({ userId, appointmentId, decision, rejectionReason }) {
  const doctor = await getDoctorForUser(userId);
  if (!mongoose.isValidObjectId(appointmentId)) {
    throw error('Invalid appointment ID', 400);
  }
  if (!['approved', 'rejected'].includes(decision)) {
    throw error('Decision must be approved or rejected', 400);
  }

  const appointment = await Appointment.findOne({ _id: appointmentId, doctor: doctor._id, status: 'pending' });
  if (!appointment) {
    throw error('Pending appointment request not found', 404);
  }
  if (decision === 'approved' && Array.isArray(doctor.availableSlots) && doctor.availableSlots.length > 0) {
    const requested = appointment.appointmentTime.getTime();
    const slotExists = doctor.availableSlots.some((slot) => new Date(slot).getTime() === requested);
    if (!slotExists) {
      throw error('The requested time is not an available slot', 409);
    }
  }
  try {
    const updated = await Appointment.findOneAndUpdate(
      { _id: appointmentId, doctor: doctor._id, status: 'pending' },
      {
        $set: { status: decision, ...(decision === 'rejected' ? { rejectionReason: rejectionReason || 'The requested time is unavailable.' } : {}) },
      },
      { new: true, runValidators: true },
    );
    if (!updated) {
      throw error('Appointment request was already updated', 409);
    }
    await Notification.create({
      user: updated.patient,
      title: decision === 'approved' ? 'Appointment approved' : 'Appointment rejected',
      message: decision === 'approved'
        ? `Your appointment with ${doctor.name} has been approved.`
        : `Your appointment with ${doctor.name} was rejected${rejectionReason ? `: ${rejectionReason}` : '.'}`,
      appointment: updated._id,
    });
    return updated;
  } catch (caught) {
    if (caught.code === 11000) {
      throw error('That slot has just been booked by another appointment', 409);
    }
    throw caught;
  }
}

async function updateDoctorSlots({ userId, slots }) {
  const doctor = await getDoctorForUser(userId);
  if (!Array.isArray(slots) || slots.length > 100) {
    throw error('slots must be an array with at most 100 dates', 400);
  }
  const parsed = slots.map((slot) => new Date(slot));
  if (parsed.some((slot) => !Number.isFinite(slot.getTime()) || slot <= new Date())) {
    throw error('Each slot must be a valid future date', 400);
  }
  doctor.availableSlots = parsed;
  await doctor.save();
  return doctor;
}

async function getDoctorSlots(userId) {
  const doctor = await getDoctorForUser(userId);
  return doctor.availableSlots || [];
}

module.exports = {
  listDoctors,
  createDoctor,
  listDoctorAppointments,
  decideAppointment,
  updateDoctorSlots,
  getDoctorSlots,
};
