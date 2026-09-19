require('dotenv').config();

const cors = require('cors');
const express = require('express');
const { inspect } = require('util');
const { sql, getPool } = require('./db');

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors({ origin: true }));
app.use(express.json());

const isMandelaEmail = (value) => /^[^\s@]+@mandela\.ac\.za$/i.test(String(value || '').trim());
const isNineDigitStudentNo = (value) => /^\d{9}$/.test(String(value || '').trim());

const publicStudentFields = (row) => ({
  studentId: row.StudentID,
  name: row.Name,
  email: row.Email,
  studentNo: row.StudentNumber,
  programme: row.Programme,
  emergencyPreference: row.EmergencyPreference
});

const errorDetail = (error) => {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return inspect(error, { depth: 4, breakLength: 160 });
};

const validateAuthPayload = ({ name, email, studentNo, password }, requireName = false, requireStudentNo = false) => {
  const errors = {};
  if (requireName && !String(name || '').trim()) errors.name = 'Name is required.';
  if (!String(email || '').trim()) errors.email = 'Email is required.';
  else if (!isMandelaEmail(email)) errors.email = 'Use an @mandela.ac.za email address.';
  if (requireStudentNo) {
    if (!String(studentNo || '').trim()) errors.studentNo = 'Student number is required.';
    else if (!isNineDigitStudentNo(studentNo)) errors.studentNo = 'Student number must be exactly 9 digits.';
  }
  if (!String(password || '').trim()) {
    errors.password = 'Password is required for the prototype form, but is not stored by this API.';
  }
  return errors;
};

app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT DB_NAME() AS databaseName, 1 AS ok');
    res.json({
      ok: true,
      database: result.recordset[0].databaseName
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      error: 'Database connection failed.',
      detail: errorDetail(error)
    });
  }
});

app.post('/api/signup', async (req, res) => {
  const { name, email, studentNo, password } = req.body || {};
  const errors = validateAuthPayload({ name, email, studentNo, password }, true, true);
  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, errors });
  }

  try {
    const pool = await getPool();
    const request = pool.request()
      .input('name', sql.NVarChar(100), String(name).trim())
      .input('email', sql.NVarChar(100), String(email).trim().toLowerCase())
      .input('studentNo', sql.Char(9), String(studentNo).trim())
      .input('programme', sql.NVarChar(100), 'Prototype signup')
      .input('emergencyPreference', sql.NVarChar(50), 'SMS');

    const result = await request.query(`
      INSERT INTO dbo.Student (Name, Email, StudentNumber, Programme, EmergencyPreference)
      OUTPUT inserted.StudentID, inserted.Name, inserted.Email, inserted.StudentNumber, inserted.Programme, inserted.EmergencyPreference
      VALUES (@name, @email, @studentNo, @programme, @emergencyPreference);
    `);

    res.status(201).json({
      ok: true,
      student: publicStudentFields(result.recordset[0]),
      authMode: 'prototype-no-password-storage'
    });
  } catch (error) {
    if (error.number === 2627 || error.number === 2601) {
      return res.status(409).json({
        ok: false,
        error: 'A student with that email or student number already exists.'
      });
    }
    res.status(500).json({
      ok: false,
      error: 'Signup failed.',
      detail: errorDetail(error)
    });
  }
});

app.post('/api/signin', async (req, res) => {
  const { email, password } = req.body || {};
  const errors = validateAuthPayload({ email, password }, false, false);
  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, errors });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar(100), String(email).trim().toLowerCase())
      .query(`
        SELECT TOP 1 StudentID, Name, Email, StudentNumber, Programme, EmergencyPreference
        FROM dbo.Student
        WHERE LOWER(Email) = @email
        ORDER BY StudentID;
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ ok: false, error: 'No student was found for that email.' });
    }

    res.json({
      ok: true,
      student: publicStudentFields(result.recordset[0]),
      authMode: 'prototype-email-lookup-only'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Signin failed.',
      detail: errorDetail(error)
    });
  }
});

app.listen(port, () => {
  console.log(`Guardian API listening on http://localhost:${port}`);
});
