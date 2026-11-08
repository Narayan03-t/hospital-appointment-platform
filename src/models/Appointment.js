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
      enum: ['confirmed', 'cancelled', 'completed'],
      default: 'confirmed',
      required: true,
    },
    reason: {
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
    partialFilterExpression: { status: 'confirmed' },
  },
);

module.exports = mongoose.model('Appointment', appointmentSchema);
