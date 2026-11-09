const express = require('express');
const {
  bookAppointment,
  listPatientAppointments,
  cancelAppointment,
  rescheduleAppointment,
} = require('../services/appointmentService');
const {
  authenticate,
  authorize,
} = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, authorize('patient'));

router.post('/', async (req, res, next) => {
  try {
    const appointment = await bookAppointment({
      patientId: req.user.sub,
      doctorId: req.body.doctorId,
      appointmentTime: req.body.appointmentTime,
      reason: req.body.reason,
    });

    return res.status(201).json({
      message: 'Appointment booked successfully',
      appointment,
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/my', async (req, res, next) => {
  try {
    const appointments = await listPatientAppointments(req.user.sub);

    return res.status(200).json({
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const appointment = await cancelAppointment({
      appointmentId: req.params.id,
      patientId: req.user.sub,
    });

    return res.status(200).json({
      message: 'Appointment cancelled successfully',
      appointment,
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/reschedule', async (req, res, next) => {
  try {
    const appointment = await rescheduleAppointment({
      appointmentId: req.params.id,
      patientId: req.user.sub,
      appointmentTime: req.body.appointmentTime,
    });

    return res.status(200).json({
      message: 'Appointment rescheduled successfully',
      appointment,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
