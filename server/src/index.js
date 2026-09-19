require('dotenv').config();

const bcrypt = require('bcrypt');
const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const path = require('path');
const { Resend } = require('resend');
const { inspect } = require('util');
const crypto = require('crypto');
const { sql, getPool } = require('./db');

const app = express();
const port = Number(process.env.PORT || 3000);
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const passwordResetTokens = new Map();
const sessions = new Map();

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', '..')));

const PATROL_CONTACTS = {
  atlas: {
    id: 'atlas',
    name: 'ATLAS Security',
    phone: process.env.ATLAS_SECURITY_PHONE || '0861 585 585',
    email: process.env.ATLAS_SECURITY_EMAIL || 'info@atlas24.co.za',
    note: 'Official patrol contact details loaded for this coverage area.'
  },
  citywide: {
    id: 'citywide',
    name: 'CityWide Security',
    phone: process.env.CITYWIDE_SECURITY_PHONE || '041 072 084',
    email: process.env.CITYWIDE_SECURITY_EMAIL || 'tech@citywide.co.za',
    note: 'Official patrol contact details loaded for this coverage area.'
  }
};

const AREA_COVERAGE = [
  { area: 'Summerstrand', providers: ['atlas', 'citywide'] },
  { area: 'South End', providers: ['atlas'] },
  { area: 'Walmer', providers: ['atlas', 'citywide'] },
  { area: 'Mount Pleasant', providers: ['atlas'] },
  { area: 'Newton Park', providers: ['atlas', 'citywide'] },
  { area: 'North End', providers: ['atlas', 'citywide'] },
  { area: 'Lorraine', providers: ['atlas', 'citywide'] },
  { area: 'Overbaakens', providers: ['atlas', 'citywide'] },
  { area: 'Sunridge Park', providers: ['atlas'] },
  { area: 'Fernglen', providers: ['atlas'] },
  { area: 'Framesby', providers: ['atlas'] },
  { area: 'Rowallan Park', providers: ['atlas'] },
  { area: 'Parsons Vlei', providers: ['atlas'] },
  { area: 'Linton Grange', providers: ['atlas', 'citywide'] },
  { area: 'Westering', providers: ['atlas', 'citywide'] },
  { area: 'Sherwood', providers: ['atlas', 'citywide'] },
  { area: 'Cotswold', providers: ['atlas', 'citywide'] },
  { area: 'Sydenham', providers: ['atlas'] },
  { area: 'Humewood', providers: ['atlas', 'citywide'] },
  { area: 'Humerail', providers: ['atlas', 'citywide'] },
  { area: 'Bluewater Bay', providers: ['atlas'] },
  { area: 'Swartkops', providers: ['atlas'] },
  { area: 'Coega', providers: ['atlas'] },
  { area: 'Greenbushes', providers: ['atlas'] },
  { area: 'Seaview', providers: ['atlas'] },
  { area: 'Theescombe', providers: ['atlas'] },
  { area: 'Kariega / Uitenhage', providers: ['atlas'] },
  { area: 'Despatch', providers: ['atlas'] },
  { area: 'Walmer Downs', providers: ['citywide'] },
  { area: 'Walmer Heights', providers: ['citywide'] },
  { area: 'Miramar', providers: ['citywide'] },
  { area: 'Central', providers: ['citywide'] },
  { area: 'St Georges Park', providers: ['citywide'] },
  { area: 'Mount Croix', providers: ['citywide'] },
  { area: 'Richmond Hill', providers: ['citywide'] },
  { area: 'Kamma Park', providers: ['citywide'] },
  { area: 'Ben Kamma', providers: ['citywide'] },
  { area: 'Kamma Heights', providers: ['citywide'] },
  { area: 'Kamma Ridge', providers: ['citywide'] },
  { area: 'Lovemore Heights', providers: ['citywide'] },
  { area: 'Lovemore Park', providers: ['citywide'] },
  { area: 'Salisbury Park', providers: ['citywide'] },
  { area: 'Greenacres', providers: ['citywide'] },
  { area: 'Mill Park', providers: ['citywide'] },
  { area: 'Glendinningvale', providers: ['citywide'] },
  { area: 'Mount Road', providers: ['citywide'] },
  { area: 'Kabega Park', providers: ['citywide'] },
  { area: 'Kunene Park', providers: ['citywide'] },
  { area: 'Parsonvlei', providers: ['citywide'] },
  { area: 'Charlo', providers: ['citywide'] },
  { area: 'Broadwood', providers: ['citywide'] },
  { area: 'Brymore', providers: ['citywide'] },
  { area: 'Greenshields Park', providers: ['citywide'] },
  { area: 'Adcockvale', providers: ['citywide'] },
  { area: 'Perridgevale', providers: ['citywide'] }
];

const areaByName = new Map(AREA_COVERAGE.map((entry) => [entry.area.toLowerCase(), entry]));
const isMandelaEmail = (value) => /^[^\s@]+@mandela\.ac\.za$/i.test(String(value || '').trim());
const isNineDigitStudentNo = (value) => /^\d{9}$/.test(String(value || '').trim());
const isStrongEnoughPassword = (value) => String(value || '').length >= 8;

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || '').toLowerCase()}`
});

const publicStudentFields = (row) => ({
  studentId: row.StudentID,
  name: row.Name,
  email: row.Email,
  studentNo: row.StudentNumber,
  programme: row.Programme,
  emergencyPreference: row.EmergencyPreference,
  termsAcceptedAt: row.TermsAcceptedAt
});

const publicContactFields = (row) => row && ({
  id: row.ContactID,
  name: row.Name,
  relation: row.Relationship,
  phone: row.Phone,
  email: row.Email,
  preferredAlertMethod: row.PreferredAlertMethod,
  contactType: row.ContactType,
  official: row.ContactType === 'security-patrol',
  verified: true
});

const createSession = (studentId) => {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    studentId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 8 * 60 * 60 * 1000
  });
  return token;
};

const errorDetail = (error) => {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error.message && error.message !== '[object Object]') return error.message;
  if (error.message && typeof error.originalError === 'object') {
    return inspect(error.originalError, { depth: 4, breakLength: 160 });
  }
  return inspect(error, { depth: 4, breakLength: 160 });
};

const normalizeArea = (area) => String(area || '').trim();
const getAreaCoverage = (area) => areaByName.get(normalizeArea(area).toLowerCase());
const normalizeProvider = (provider) => String(provider || '').trim().toLowerCase();
const getPatrolProvider = (area, provider) => {
  const coverage = getAreaCoverage(area);
  if (!coverage) return null;
  const providerId = normalizeProvider(provider);
  if (!coverage.providers.includes(providerId)) return null;
  return { area: coverage.area, provider: PATROL_CONTACTS[providerId] };
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
  if (!String(password || '').trim()) errors.password = 'Password is required.';
  else if (requireName && !isStrongEnoughPassword(password)) errors.password = 'Use at least 8 characters.';
  return errors;
};

async function sendEmail({ to, subject, html, text }) {
  if (!resend || !to) {
    return { sent: false, reason: 'Email service is not configured.' };
  }

  const response = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'Vigil Campus Safety <onboarding@resend.dev>',
    to,
    subject,
    html,
    text
  });
  return { sent: true, id: response.data?.id || response.id || null };
}

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

app.get('/api/patrol-coverage', (req, res) => {
  res.json({
    ok: true,
    areas: AREA_COVERAGE.map((entry) => ({
      area: entry.area,
      providers: entry.providers.map((id) => PATROL_CONTACTS[id])
    }))
  });
});

app.post('/api/signup', authLimiter, async (req, res) => {
  const { name, email, studentNo, password, area, patrolProvider, termsAccepted } = req.body || {};
  const errors = validateAuthPayload({ name, email, studentNo, password }, true, true);
  const patrol = getPatrolProvider(area, patrolProvider);

  if (!termsAccepted) errors.terms = 'Accept the terms and privacy notice to continue.';
  if (!getAreaCoverage(area)) errors.area = 'Choose a supported area for patrol coverage.';
  else if (!patrol) errors.patrolProvider = 'Choose a patrol provider that covers your selected area.';

  if (Object.keys(errors).length) {
    return res.status(400).json({ ok: false, errors });
  }

  let transaction;

  try {
    transaction = new sql.Transaction(await getPool());
    const passwordHash = await bcrypt.hash(String(password), 12);
    await transaction.begin();

    const studentResult = await new sql.Request(transaction)
      .input('name', sql.NVarChar(100), String(name).trim())
      .input('email', sql.NVarChar(100), String(email).trim().toLowerCase())
      .input('studentNo', sql.Char(9), String(studentNo).trim())
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .input('programme', sql.NVarChar(100), `Prototype signup - ${patrol.area}`)
      .input('emergencyPreference', sql.NVarChar(50), 'SMS')
      .query(`
        INSERT INTO dbo.Student (Name, Email, StudentNumber, PasswordHash, TermsAcceptedAt, Programme, EmergencyPreference)
        OUTPUT inserted.StudentID, inserted.Name, inserted.Email, inserted.StudentNumber, inserted.Programme, inserted.EmergencyPreference, inserted.TermsAcceptedAt
        VALUES (@name, @email, @studentNo, @passwordHash, GETDATE(), @programme, @emergencyPreference);
      `);

    const student = studentResult.recordset[0];
    const contactResult = await new sql.Request(transaction)
      .input('studentId', sql.Int, student.StudentID)
      .input('name', sql.NVarChar(100), patrol.provider.name)
      .input('relationship', sql.NVarChar(50), `Official patrol - ${patrol.area}`)
      .input('phone', sql.NVarChar(20), patrol.provider.phone)
      .input('email', sql.NVarChar(100), patrol.provider.email)
      .input('method', sql.NVarChar(50), 'Phone')
      .input('contactType', sql.NVarChar(30), 'security-patrol')
      .query(`
        INSERT INTO dbo.TrustedContact (StudentID, Name, Relationship, Phone, Email, PreferredAlertMethod, ContactType)
        OUTPUT inserted.ContactID, inserted.Name, inserted.Relationship, inserted.Phone, inserted.Email, inserted.PreferredAlertMethod, inserted.ContactType
        VALUES (@studentId, @name, @relationship, @phone, @email, @method, @contactType);
      `);

    await transaction.commit();

    res.status(201).json({
      ok: true,
      student: publicStudentFields(student),
      patrolContact: publicContactFields(contactResult.recordset[0]),
      authToken: createSession(student.StudentID),
      authMode: 'sql-bcrypt'
    });
  } catch (error) {
    if (transaction && transaction._aborted !== true) {
      try { await transaction.rollback(); } catch (rollbackError) { /* rollback best effort */ }
    }
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

app.post('/api/signin', authLimiter, async (req, res) => {
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
        SELECT TOP 1 StudentID, Name, Email, StudentNumber, Programme, EmergencyPreference, TermsAcceptedAt, PasswordHash
        FROM dbo.Student
        WHERE LOWER(Email) = @email
        ORDER BY StudentID;
      `);

    if (!result.recordset.length) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
    }

    const row = result.recordset[0];
    if (!row.PasswordHash) {
      return res.status(401).json({ ok: false, error: 'This account must reset its password before signing in.' });
    }

    const passwordMatches = await bcrypt.compare(String(password), row.PasswordHash);
    if (!passwordMatches) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
    }

    const contacts = await pool.request()
      .input('studentId', sql.Int, row.StudentID)
      .query(`
        SELECT ContactID, Name, Relationship, Phone, Email, PreferredAlertMethod, ContactType
        FROM dbo.TrustedContact
        WHERE StudentID = @studentId
        ORDER BY CASE WHEN ContactType = N'security-patrol' THEN 0 ELSE 1 END, ContactID;
      `);

    res.json({
      ok: true,
      student: publicStudentFields(row),
      contacts: contacts.recordset.map(publicContactFields),
      authToken: createSession(row.StudentID),
      authMode: 'sql-bcrypt'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Signin failed.',
      detail: errorDetail(error)
    });
  }
});

app.post('/api/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!isMandelaEmail(email)) {
    return res.status(400).json({ ok: false, errors: { email: 'Use an @mandela.ac.za email address.' } });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.NVarChar(100), String(email).trim().toLowerCase())
      .query('SELECT TOP 1 StudentID, Email FROM dbo.Student WHERE LOWER(Email) = @email;');

    if (result.recordset.length) {
      const token = crypto.randomBytes(24).toString('hex');
      passwordResetTokens.set(token, {
        studentId: result.recordset[0].StudentID,
        email: result.recordset[0].Email,
        expiresAt: Date.now() + 15 * 60 * 1000
      });
      const resetUrl = `${process.env.API_PUBLIC_BASE_URL || `http://localhost:${port}`}/index.html?token=${token}`;
      const delivery = await sendEmail({
        to: result.recordset[0].Email,
        subject: 'Vigil password reset',
        text: `Use this reset link within 15 minutes: ${resetUrl}`,
        html: `<p>Use this reset link within 15 minutes:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
      });
      return res.json({
        ok: true,
        message: delivery.sent ? 'If that account exists, a reset email has been queued.' : 'Email is not configured. Use the demo reset token shown below.',
        demoResetToken: delivery.sent ? undefined : token,
        resetUrl: delivery.sent ? undefined : resetUrl
      });
    }

    res.json({
      ok: true,
      message: 'If that account exists, a reset email has been queued.'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Password reset request failed.',
      detail: errorDetail(error)
    });
  }
});

app.post('/api/reset-password', authLimiter, async (req, res) => {
  const { token, password } = req.body || {};
  const record = passwordResetTokens.get(String(token || ''));
  if (!record || record.expiresAt < Date.now()) {
    return res.status(400).json({ ok: false, error: 'Reset token is invalid or expired.' });
  }
  if (!String(password || '').trim()) {
    return res.status(400).json({ ok: false, errors: { password: 'Enter a new password.' } });
  }
  if (!isStrongEnoughPassword(password)) {
    return res.status(400).json({ ok: false, errors: { password: 'Use at least 8 characters.' } });
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 12);
    const pool = await getPool();
    await pool.request()
      .input('studentId', sql.Int, record.studentId)
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .query('UPDATE dbo.Student SET PasswordHash = @passwordHash WHERE StudentID = @studentId;');
    passwordResetTokens.delete(String(token));
    res.json({ ok: true, authToken: createSession(record.studentId) });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Password reset failed.',
      detail: errorDetail(error)
    });
  }
});

app.post('/api/notify-emergency', async (req, res) => {
  const { studentName, studentNo, emergencyType, location, recipients } = req.body || {};
  const uniqueRecipients = Array.from(new Set((Array.isArray(recipients) ? recipients : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)));
  if (!uniqueRecipients.length && !process.env.CAMPUS_SECURITY_EMAIL) {
    return res.json({ ok: true, sent: false, message: 'No configured email recipients; notification simulated.' });
  }

  try {
    const targets = uniqueRecipients.length ? uniqueRecipients : [process.env.CAMPUS_SECURITY_EMAIL];
    const delivery = await sendEmail({
      to: targets,
      subject: `Vigil emergency alert: ${emergencyType || 'SOS'}`,
      text: `Emergency alert for ${studentName || 'student'} (${studentNo || 'unknown'}). Location: ${location || 'not provided'}.`,
      html: `<p><strong>Emergency alert:</strong> ${emergencyType || 'SOS'}</p><p>Student: ${studentName || 'student'} (${studentNo || 'unknown'})</p><p>Location: ${location || 'not provided'}</p>`
    });
    res.json({ ok: true, ...delivery });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Emergency notification failed.',
      detail: errorDetail(error)
    });
  }
});

app.post('/api/alerts/:id/status', async (req, res) => {
  const { status } = req.body || {};
  const allowed = new Set(['New', 'Acknowledged', 'ResponderDispatched', 'Resolved', 'FalseAlarm']);
  if (!allowed.has(status)) {
    return res.status(400).json({ ok: false, error: 'Unsupported status.' });
  }

  try {
    const pool = await getPool();
    await pool.request()
      .input('id', sql.Int, Number(req.params.id))
      .input('status', sql.NVarChar(50), status)
      .query(`
        UPDATE dbo.EmergencyAlert
        SET Status = @status,
            AcknowledgedAt = CASE WHEN @status <> N'New' AND AcknowledgedAt IS NULL THEN GETDATE() ELSE AcknowledgedAt END
        WHERE AlertID = @id;
      `);
    res.json({ ok: true, status });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Alert status update failed.',
      detail: errorDetail(error)
    });
  }
});

app.get('/api/analytics/summary', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.EmergencyAlert) AS totalAlerts,
        (SELECT COUNT(*) FROM dbo.IncidentReport) AS totalReports,
        (SELECT COUNT(*) FROM dbo.TrustedContact WHERE ContactType = N'security-patrol') AS officialPatrolContacts,
        (SELECT AVG(CAST(DATEDIFF(SECOND, TriggeredAt, AcknowledgedAt) AS FLOAT))
         FROM dbo.EmergencyAlert
         WHERE TriggeredAt IS NOT NULL AND AcknowledgedAt IS NOT NULL) AS avgAckSeconds;
    `);
    res.json({ ok: true, summary: result.recordset[0] });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Analytics summary failed.',
      detail: errorDetail(error)
    });
  }
});

app.listen(port, () => {
  console.log(`Vigil API listening on http://localhost:${port}`);
});
