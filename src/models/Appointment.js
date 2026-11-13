const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    appointmentTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'confirmed', 'rejected', 'cancelled', 'completed'],
      default: 'confirmed',
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true },
);

// Prevent duplicate confirmed appointments for a doctor at the same time.
appointmentSchema.index(
  { doctor: 1, appointmentTime: 1 },
  {
    unique: true,
    name: 'doctor_active_appointment_slot',
    partialFilterExpression: { status: { $in: ['approved', 'confirmed'] } },
  },
);

module.exports = mongoose.model('Appointment', appointmentSchema);
