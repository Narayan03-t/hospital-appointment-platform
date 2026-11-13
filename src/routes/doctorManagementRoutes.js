const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  listDoctorAppointments,
  decideAppointment,
  updateDoctorSlots,
  getDoctorSlots,
} = require('../services/doctorService');

const router = express.Router();
router.use(authenticate, authorize('doctor'));

router.get('/appointments', async (req, res, next) => {
  try {
    const appointments = await listDoctorAppointments(req.user.sub, req.query.status);
    return res.json({ count: appointments.length, appointments });
  } catch (error) {
    return next(error);
  }
});

router.patch('/appointments/:id/decision', async (req, res, next) => {
  try {
    const appointment = await decideAppointment({
      userId: req.user.sub,
      appointmentId: req.params.id,
      decision: req.body.decision,
      rejectionReason: req.body.rejectionReason,
    });
    return res.json({ message: `Appointment ${req.body.decision}`, appointment });
  } catch (error) {
    return next(error);
  }
});

router.put('/slots', async (req, res, next) => {
  try {
    const doctor = await updateDoctorSlots({ userId: req.user.sub, slots: req.body.slots });
    return res.json({ message: 'Availability updated', slots: doctor.availableSlots });
  } catch (error) {
    return next(error);
  }
});

router.get('/slots', async (req, res, next) => {
  try {
    const slots = await getDoctorSlots(req.user.sub);
    return res.json({ slots });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
