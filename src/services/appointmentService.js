const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function bookAppointment({
  patientId,
  doctorId,
  appointmentTime,
  reason,
}) {
  if (
    !mongoose.isValidObjectId(patientId) ||
    !mongoose.isValidObjectId(doctorId)
  ) {
    throw createError('Invalid patient or doctor ID', 400);
  }

  const time = new Date(appointmentTime);

  if (
    typeof appointmentTime !== 'string' ||
    !Number.isFinite(time.getTime()) ||
    time <= new Date()
  ) {
    throw createError('Appointment time must be a valid future date', 400);
  }

  const [patient, doctor] = await Promise.all([
    User.findById(patientId).select('_id role'),
    Doctor.findById(doctorId),
  ]);

  if (!patient || patient.role !== 'patient') {
    throw createError('Patient not found', 404);
  }

  if (!doctor || !doctor.available) {
    throw createError('Doctor not found or unavailable', 404);
  }

  try {
    return await Appointment.create({
      patient: patient._id,
      doctor: doctor._id,
      appointmentTime: time,
      reason,
      status: 'confirmed',
    });
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        'This doctor already has a confirmed appointment at that time',
        409,
      );
    }

    throw error;
  }
}

async function listPatientAppointments(patientId) {
  if (!mongoose.isValidObjectId(patientId)) {
    throw createError('Invalid patient ID', 400);
  }

  return Appointment.find({ patient: patientId })
    .populate('doctor', 'name specialty')
    .sort({ appointmentTime: 1 })
    .lean();
}

async function cancelAppointment({ appointmentId, patientId }) {
  if (
    !mongoose.isValidObjectId(appointmentId) ||
    !mongoose.isValidObjectId(patientId)
  ) {
    throw createError('Invalid appointment or patient ID', 400);
  }

  const appointment = await Appointment.findOneAndUpdate(
    {
      _id: appointmentId,
      patient: patientId,
      status: 'confirmed',
    },
    { $set: { status: 'cancelled' } },
    { new: true, runValidators: true },
  );

  if (!appointment) {
    throw createError(
      'Confirmed appointment not found for this patient',
      404,
    );
  }

  return appointment;
}

async function rescheduleAppointment({
  appointmentId,
  patientId,
  appointmentTime,
}) {
  if (
    !mongoose.isValidObjectId(appointmentId) ||
    !mongoose.isValidObjectId(patientId)
  ) {
    throw createError('Invalid appointment or patient ID', 400);
  }

  const time = new Date(appointmentTime);

  if (
    typeof appointmentTime !== 'string' ||
    !Number.isFinite(time.getTime()) ||
    time <= new Date()
  ) {
    throw createError('Appointment time must be a valid future date', 400);
  }

  try {
    const appointment = await Appointment.findOneAndUpdate(
      {
        _id: appointmentId,
        patient: patientId,
        status: 'confirmed',
      },
      { $set: { appointmentTime: time } },
      { new: true, runValidators: true },
    );

    if (!appointment) {
      throw createError(
        'Confirmed appointment not found for this patient',
        404,
      );
    }

    return appointment;
  } catch (error) {
    if (error.code === 11000) {
      throw createError(
        'This doctor already has a confirmed appointment at that time',
        409,
      );
    }

    throw error;
  }
}

module.exports = {
  bookAppointment,
  listPatientAppointments,
  cancelAppointment,
  rescheduleAppointment,
};
