const express = require('express');
const {
  registerUser,
  loginUser,
} = require('../services/authService');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const user = await registerUser(req.body);
    return res.status(201).json({
      message: 'Registration successful',
      user,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const result = await loginUser(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
