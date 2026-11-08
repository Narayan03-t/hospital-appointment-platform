const express = require('express');
const {
  listDoctors,
  createDoctor,
} = require('../services/doctorService');
const {
  authenticate,
  authorize,
} = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const filters = {};

    if (req.query.specialty) {
      filters.specialty = req.query.specialty;
    }

    if (req.query.available !== undefined) {
      if (!['true', 'false'].includes(req.query.available)) {
        return res.status(400).json({
          error: 'available must be true or false',
        });
      }

      filters.available = req.query.available === 'true';
    }

    const doctors = await listDoctors(filters);

    return res.status(200).json({
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  '/',
  authenticate,
  authorize('admin'),
  async (req, res, next) => {
    try {
      const doctor = await createDoctor(req.body);

      return res.status(201).json({
        message: 'Doctor created successfully',
        doctor,
      });
    } catch (error) {
      return next(error);
    }
  },
);

module.exports = router;
