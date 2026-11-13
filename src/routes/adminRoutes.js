const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getStats,
  listDoctors,
  listPatients,
  createDoctorAccount,
  updateDoctor,
  setAccountStatus,
  listAppointments,
} = require('../services/adminService');

const router = express.Router();
router.use(authenticate, authorize('admin'));

router.get('/stats', async (req, res, next) => {
  try {
    return res.json({ stats: await getStats() });
  } catch (error) {
    return next(error);
  }
});

router.get('/doctors', async (req, res, next) => {
  try {
    const doctors = await listDoctors({ search: req.query.search });
    return res.json({ count: doctors.length, doctors });
  } catch (error) {
    return next(error);
  }
});

router.post('/doctors', async (req, res, next) => {
  try {
    const result = await createDoctorAccount(req.body);
    return res.status(201).json({ message: 'Doctor account created', ...result });
  } catch (error) {
    return next(error);
  }
});

router.patch('/doctors/:id', async (req, res, next) => {
  try {
    const doctor = await updateDoctor({ doctorId: req.params.id, ...req.body });
    return res.json({ doctor });
  } catch (error) {
    return next(error);
  }
});

router.patch('/accounts/:id/status', async (req, res, next) => {
  try {
    const user = await setAccountStatus({ userId: req.params.id, active: req.body.active });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
});

router.get('/patients', async (req, res, next) => {
  try {
    const patients = await listPatients({ search: req.query.search });
    return res.json({ count: patients.length, patients });
  } catch (error) {
    return next(error);
  }
});

router.get('/appointments', async (req, res, next) => {
  try {
    const appointments = await listAppointments(req.query);
    return res.json({ count: appointments.length, appointments });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
