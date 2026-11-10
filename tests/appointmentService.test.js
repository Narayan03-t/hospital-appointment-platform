const Appointment = require('../src/models/Appointment');
const Doctor = require('../src/models/Doctor');
const User = require('../src/models/User');
const {
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
} = require('../src/services/appointmentService');

jest.mock('../src/models/Appointment', () => ({
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock('../src/models/Doctor', () => ({
  findById: jest.fn(),
}));

jest.mock('../src/models/User', () => ({
  findById: jest.fn(),
}));

const patientId = '507f1f77bcf86cd799439011';
const doctorId = '507f1f77bcf86cd799439012';
const appointmentId = '507f1f77bcf86cd799439013';
const futureTime = '2030-01-01T10:00:00.000Z';

function setupValidBooking() {
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({
      _id: patientId,
      role: 'patient',
    }),
  });

  Doctor.findById.mockResolvedValue({
    _id: doctorId,
    available: true,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('bookAppointment', () => {
  test('rejects invalid patient or doctor IDs', async () => {
    await expect(
      bookAppointment({
        patientId: 'invalid',
        doctorId,
        appointmentTime: futureTime,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(Appointment.create).not.toHaveBeenCalled();
  });

  test('rejects an invalid or past appointment time', async () => {
    await expect(
      bookAppointment({
        patientId,
        doctorId,
        appointmentTime: 'invalid-date',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      bookAppointment({
        patientId,
        doctorId,
        appointmentTime: '2000-01-01T10:00:00.000Z',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(Appointment.create).not.toHaveBeenCalled();
  });

  test('rejects a missing or non-patient user', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    Doctor.findById.mockResolvedValue({ _id: doctorId, available: true });

    await expect(
      bookAppointment({ patientId, doctorId, appointmentTime: futureTime }),
    ).rejects.toMatchObject({ statusCode: 404 });

    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: patientId, role: 'admin' }),
    });

    await expect(
      bookAppointment({ patientId, doctorId, appointmentTime: futureTime }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(Appointment.create).not.toHaveBeenCalled();
  });

  test('rejects a missing or unavailable doctor', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: patientId, role: 'patient' }),
    });
    Doctor.findById.mockResolvedValue(null);

    await expect(
      bookAppointment({ patientId, doctorId, appointmentTime: futureTime }),
    ).rejects.toMatchObject({ statusCode: 404 });

    Doctor.findById.mockResolvedValue({
      _id: doctorId,
      available: false,
    });

    await expect(
      bookAppointment({ patientId, doctorId, appointmentTime: futureTime }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(Appointment.create).not.toHaveBeenCalled();
  });

  test('creates a confirmed appointment for a valid patient and doctor', async () => {
    setupValidBooking();
    const createdAppointment = {
      _id: appointmentId,
      patient: patientId,
      status: 'confirmed',
    };
    Appointment.create.mockResolvedValue(createdAppointment);

    await expect(
      bookAppointment({
        patientId,
        doctorId,
        appointmentTime: futureTime,
        reason: 'Routine consultation',
      }),
    ).resolves.toBe(createdAppointment);

    expect(Appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        patient: patientId,
        doctor: doctorId,
        appointmentTime: new Date(futureTime),
        reason: 'Routine consultation',
        status: 'confirmed',
      }),
    );
  });

  test('maps duplicate confirmed-slot errors to HTTP 409', async () => {
    setupValidBooking();
    Appointment.create.mockRejectedValue({ code: 11000 });

    await expect(
      bookAppointment({ patientId, doctorId, appointmentTime: futureTime }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'This doctor already has a confirmed appointment at that time',
    });
  });

  test('rethrows unexpected database errors', async () => {
    setupValidBooking();
    const databaseError = new Error('Unexpected database failure');
    Appointment.create.mockRejectedValue(databaseError);

    await expect(
      bookAppointment({ patientId, doctorId, appointmentTime: futureTime }),
    ).rejects.toBe(databaseError);
  });
});

describe('cancelAppointment', () => {
  test('rejects invalid appointment or patient IDs', async () => {
    await expect(
      cancelAppointment({ appointmentId: 'invalid', patientId }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('cancels only a confirmed appointment belonging to the patient', async () => {
    const cancelledAppointment = {
      _id: appointmentId,
      patient: patientId,
      status: 'cancelled',
    };
    Appointment.findOneAndUpdate.mockResolvedValue(cancelledAppointment);

    await expect(
      cancelAppointment({ appointmentId, patientId }),
    ).resolves.toBe(cancelledAppointment);

    expect(Appointment.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: appointmentId,
        patient: patientId,
        status: 'confirmed',
      },
      { $set: { status: 'cancelled' } },
      { new: true, runValidators: true },
    );
  });

  test('returns 404 when no confirmed appointment belongs to the patient', async () => {
    Appointment.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      cancelAppointment({ appointmentId, patientId }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('rescheduleAppointment', () => {
  test('rejects invalid IDs and invalid or past times', async () => {
    await expect(
      rescheduleAppointment({
        appointmentId: 'invalid',
        patientId,
        appointmentTime: futureTime,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      rescheduleAppointment({
        appointmentId,
        patientId,
        appointmentTime: 'invalid-date',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      rescheduleAppointment({
        appointmentId,
        patientId,
        appointmentTime: '2000-01-01T10:00:00.000Z',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('reschedules a confirmed appointment belonging to the patient', async () => {
    const updatedAppointment = {
      _id: appointmentId,
      patient: patientId,
      appointmentTime: new Date(futureTime),
      status: 'confirmed',
    };
    Appointment.findOneAndUpdate.mockResolvedValue(updatedAppointment);

    await expect(
      rescheduleAppointment({
        appointmentId,
        patientId,
        appointmentTime: futureTime,
      }),
    ).resolves.toBe(updatedAppointment);

    expect(Appointment.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: appointmentId,
        patient: patientId,
        status: 'confirmed',
      },
      { $set: { appointmentTime: new Date(futureTime) } },
      { new: true, runValidators: true },
    );
  });

  test('returns 409 when the new slot is already booked', async () => {
    Appointment.findOneAndUpdate.mockRejectedValue({ code: 11000 });

    await expect(
      rescheduleAppointment({
        appointmentId,
        patientId,
        appointmentTime: futureTime,
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'This doctor already has a confirmed appointment at that time',
    });
  });

  test('returns 404 when no confirmed appointment belongs to the patient', async () => {
    Appointment.findOneAndUpdate.mockResolvedValue(null);

    await expect(
      rescheduleAppointment({
        appointmentId,
        patientId,
        appointmentTime: futureTime,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
