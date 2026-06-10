/* ═══════════════════════════════════════════════════
   WTE Online — William Thomason English
   PayFast Payment Integration + Coupon System
   ═══════════════════════════════════════════════════ */
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env file if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      const value = rest.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

// ═══ CONFIGURATION ═══
// Replace these with your actual PayFast credentials
const PAYFAST_CONFIG = {
  merchantId:  process.env.PAYFAST_MERCHANT_ID  || '10000100',
  merchantKey: process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a',
  passphrase:  process.env.PAYFAST_PASSPHRASE   || 'jt7NOE43FZPn',
  // Use 'www.payfast.co.za' for live, 'sandbox.payfast.co.za' for testing
  baseUrl:     process.env.PAYFAST_BASE_URL    || 'https://sandbox.payfast.co.za/eng/process',
  validateUrl: process.env.PAYFAST_VALIDATE_URL || 'https://sandbox.payfast.co.za/eng/query/validate',
};

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'wte-admin-2026';

// ═══ MIDDLEWARE ═══
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ═══ DATA STORE (JSON file) ═══
const DATA_DIR = path.join(__dirname, 'data');
const COUPONS_FILE = path.join(DATA_DIR, 'coupons.json');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(COUPONS_FILE)) fs.writeFileSync(COUPONS_FILE, '[]');
  if (!fs.existsSync(STUDENTS_FILE)) fs.writeFileSync(STUDENTS_FILE, '[]');
  if (!fs.existsSync(PAYMENTS_FILE)) fs.writeFileSync(PAYMENTS_FILE, '[]');
}

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e) { return []; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ═══ PAYFAST SIGNATURE GENERATION ═══
function generatePayFastSignature(data, passphrase) {
  // Sort keys alphabetically
  const sorted = {};
  Object.keys(data).sort().forEach(k => {
    if (data[k] !== '' && data[k] !== null && data[k] !== undefined) {
      sorted[k] = data[k];
    }
  });
  // Build query string
  const parts = Object.entries(sorted).map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`);
  let queryString = parts.join('&');
  if (passphrase) {
    queryString += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`;
  }
  return crypto.createHash('md5').update(queryString).digest('hex');
}

function buildPayFastFormData(params) {
  const data = { ...params };
  data.merchant_id = PAYFAST_CONFIG.merchantId;
  data.merchant_key = PAYFAST_CONFIG.merchantKey;
  data.signature = generatePayFastSignature(data, PAYFAST_CONFIG.passphrase);
  return data;
}

// ═══ COUPON HELPERS ═══
function generateCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'WTE-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function validateCoupon(code) {
  const coupons = readJSON(COUPONS_FILE);
  const coupon = coupons.find(c => c.code === code.toUpperCase());
  if (!coupon) return { valid: false, reason: 'Coupon not found' };
  if (coupon.disabled) return { valid: false, reason: 'Coupon has been disabled' };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { valid: false, reason: 'Coupon has expired' };
  }
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, reason: 'Coupon usage limit reached' };
  }
  return { valid: true, coupon };
}

// ═══ API: CREATE CHECKOUT ═══
app.post('/api/payfast/checkout', (req, res) => {
  const { couponCode, studentName, studentEmail, studentPhone } = req.body;

  // Validate coupon
  const validation = validateCoupon(couponCode);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.reason });
  }
  const coupon = validation.coupon;

  // Calculate amount
  let amount = coupon.price;
  // PayFast requires amount in cents (ZAR) or the currency's minor unit
  // For EUR, amount is in cents
  const payfastAmount = Math.round(amount * 100);

  // Generate unique payment ID
  const paymentId = 'WTE-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  // Build PayFast data
  const payfastData = buildPayFastFormData({
    merchant_id: PAYFAST_CONFIG.merchantId,
    merchant_key: PAYFAST_CONFIG.merchantKey,
    return_url: `${getBaseUrl(req)}/thank-you?pid=${paymentId}`,
    cancel_url: `${getBaseUrl(req)}/join?ref=${couponCode}&cancelled=1`,
    notify_url: `${getBaseUrl(req)}/api/payfast/itn`,
    name_first: studentName || '',
    email_address: studentEmail || '',
    cell_number: studentPhone || '',
    m_payment_id: paymentId,
    amount: payfastAmount.toFixed(2),
    item_name: coupon.description || `WTE Lesson — ${coupon.name}`,
    item_description: `William Thomason English — ${coupon.lessons} lesson(s) at EUR ${coupon.price.toFixed(2)}/session`,
    custom_str1: couponCode,
    custom_str2: studentName || '',
    custom_str3: studentEmail || '',
    custom_int1: coupon.lessons || 1,
  });

  // Store pending payment
  const payments = readJSON(PAYMENTS_FILE);
  payments.push({
    id: paymentId,
    couponCode,
    studentName,
    studentEmail,
    studentPhone,
    amount,
    lessons: coupon.lessons || 1,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
  writeJSON(PAYMENTS_FILE, payments);

  res.json({
    success: true,
    paymentId,
    payfastUrl: PAYFAST_CONFIG.baseUrl,
    formData: payfastData,
  });
});

// ═══ API: PAYFAST ITN (Instant Transaction Notification) ═══
app.post('/api/payfast/itn', (req, res) => {
  const data = req.body;

  // Verify signature
  const receivedSignature = data.signature;
  delete data.signature;
  const computedSignature = generatePayFastSignature(data, PAYFAST_CONFIG.passphrase);

  if (receivedSignature !== computedSignature) {
    console.error('PayFast ITN: Invalid signature');
    return res.status(400).send('Invalid signature');
  }

  // Verify with PayFast server (optional but recommended for production)
  // For now, we trust the signature

  const paymentId = data.m_payment_id;
  const pfPaymentId = data.pf_payment_id;
  const paymentStatus = data.payment_status; // COMPLETE, FAILED, CANCELLED
  const amountGross = parseFloat(data.amount_gross);
  const couponCode = data.custom_str1;
  const studentName = data.custom_str2;
  const studentEmail = data.custom_str3;

  console.log(`PayFast ITN: Payment ${paymentId} status=${paymentStatus} amount=${amountGross}`);

  // Update payment record
  const payments = readJSON(PAYMENTS_FILE);
  const paymentIdx = payments.findIndex(p => p.id === paymentId);
  if (paymentIdx >= 0) {
    payments[paymentIdx].status = paymentStatus.toLowerCase();
    payments[paymentIdx].pfPaymentId = pfPaymentId;
    payments[paymentIdx].amountReceived = amountGross;
    payments[paymentIdx].itnReceivedAt = new Date().toISOString();
    payments[paymentIdx].itnData = data;
    writeJSON(PAYMENTS_FILE, payments);
  }

  // If payment COMPLETE, register student and increment coupon usage
  if (paymentStatus === 'COMPLETE') {
    // Register student
    const students = readJSON(STUDENTS_FILE);
    const existingIdx = students.findIndex(s => s.email === studentEmail);
    const studentRecord = {
      name: studentName,
      email: studentEmail,
      couponCode,
      paymentId,
      pfPaymentId,
      amountPaid: amountGross,
      lessons: data.custom_int1 || 1,
      lessonsUsed: 0,
      status: 'active',
      registeredAt: new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      students[existingIdx] = studentRecord;
    } else {
      students.push(studentRecord);
    }
    writeJSON(STUDENTS_FILE, students);

    // Increment coupon usage
    const coupons = readJSON(COUPONS_FILE);
    const couponIdx = coupons.findIndex(c => c.code === couponCode);
    if (couponIdx >= 0) {
      coupons[couponIdx].usedCount = (coupons[couponIdx].usedCount || 0) + 1;
      coupons[couponIdx].lastUsedAt = new Date().toISOString();
      writeJSON(COUPONS_FILE, coupons);
    }

    console.log(`Student registered: ${studentName} (${studentEmail}) via coupon ${couponCode}`);
  }

  // Must return 200 OK
  res.status(200).send('OK');
});

// ═══ API: VALIDATE COUPON (for join page) ═══
app.get('/api/coupons/validate', (req, res) => {
  const code = (req.query.code || '').toUpperCase();
  if (!code) return res.json({ valid: false, reason: 'No code provided' });
  const result = validateCoupon(code);
  if (result.valid) {
    res.json({
      valid: true,
      coupon: {
        code: result.coupon.code,
        name: result.coupon.name,
        description: result.coupon.description,
        price: result.coupon.price,
        originalPrice: result.coupon.originalPrice,
        lessons: result.coupon.lessons,
        expiresAt: result.coupon.expiresAt,
      }
    });
  } else {
    res.json(result);
  }
});

// ═══ API: ADMIN — AUTHENTICATE ═══
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    // In production, store this token server-side with expiry
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// ═══ API: ADMIN — LIST COUPONS ═══
app.get('/api/admin/coupons', adminAuth, (req, res) => {
  const coupons = readJSON(COUPONS_FILE);
  res.json(coupons);
});

// ═══ API: ADMIN — CREATE COUPON ═══
app.post('/api/admin/coupons', adminAuth, (req, res) => {
  const { name, description, price, originalPrice, lessons, maxUses, expiresAt, email } = req.body;

  if (!name || !price) {
    return res.status(400).json({ error: 'Name and price are required' });
  }

  const coupons = readJSON(COUPONS_FILE);
  const code = generateCouponCode();

  const coupon = {
    code,
    name,
    description: description || '',
    price: parseFloat(price),
    originalPrice: originalPrice ? parseFloat(originalPrice) : parseFloat(price),
    lessons: parseInt(lessons) || 1,
    maxUses: maxUses ? parseInt(maxUses) : null,
    usedCount: 0,
    expiresAt: expiresAt || null,
    email: email || null, // optional: restrict to specific email
    disabled: false,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };

  coupons.push(coupon);
  writeJSON(COUPONS_FILE, coupons);

  const baseUrl = getBaseUrl(req);
  const joinLink = `${baseUrl}/join?ref=${code}`;

  res.json({ success: true, coupon, joinLink });
});

// ═══ API: ADMIN — TOGGLE COUPON ═══
app.post('/api/admin/coupons/:code/toggle', adminAuth, (req, res) => {
  const coupons = readJSON(COUPONS_FILE);
  const idx = coupons.findIndex(c => c.code === req.params.code);
  if (idx < 0) return res.status(404).json({ error: 'Coupon not found' });
  coupons[idx].disabled = !coupons[idx].disabled;
  writeJSON(COUPONS_FILE, coupons);
  res.json({ success: true, disabled: coupons[idx].disabled });
});

// ═══ API: ADMIN — DELETE COUPON ═══
app.delete('/api/admin/coupons/:code', adminAuth, (req, res) => {
  const coupons = readJSON(COUPONS_FILE);
  const filtered = coupons.filter(c => c.code !== req.params.code);
  writeJSON(COUPONS_FILE, filtered);
  res.json({ success: true });
});

// ═══ API: ADMIN — LIST STUDENTS ═══
app.get('/api/admin/students', adminAuth, (req, res) => {
  const students = readJSON(STUDENTS_FILE);
  res.json(students);
});

// ═══ API: ADMIN — LIST PAYMENTS ═══
app.get('/api/admin/payments', adminAuth, (req, res) => {
  const payments = readJSON(PAYMENTS_FILE);
  res.json(payments);
});

// ═══ API: GET SINGLE PAYMENT (for status polling) ═══
app.get('/api/payments/:id', (req, res) => {
  const payments = readJSON(PAYMENTS_FILE);
  const payment = payments.find(p => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: 'Not found' });
  res.json(payment);
});

// ═══ ADMIN AUTH MIDDLEWARE ═══
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  // Simple token check — in production use JWT or session
  if (!token || token.length < 32) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ═══ HELPERS ═══
function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

// ═══ START SERVER ═══
ensureDataDir();

app.listen(PORT, () => {
  console.log(`WTE Online running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`PayFast mode: ${PAYFAST_CONFIG.baseUrl.includes('sandbox') ? 'SANDBOX' : 'LIVE'}`);
});
