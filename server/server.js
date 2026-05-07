/* ============================================
   MpCamperRent - Servidor Backend
   Node.js + Express — Stripe + PayPal + Email
   ============================================ */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Seguridad — Helmet con CSP relajada para los CDNs y SDKs de pago que usa la web
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      // Permitimos scripts inline (la web los usa) y los CDNs de flatpickr,
      // Stripe.js y PayPal SDK
      'script-src': [
        "'self'",
        "'unsafe-inline'",
        'https://cdn.jsdelivr.net',
        'https://js.stripe.com',
        'https://www.paypal.com',
        'https://www.paypalobjects.com',
      ],
      'script-src-attr': ["'unsafe-inline'"], // permitir onclick=""
      // Estilos inline (style="...") se usan mucho en el HTML, además de
      // Google Fonts y el CSS de flatpickr
      'style-src': [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdn.jsdelivr.net',
      ],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      // Imágenes: las propias + los CDN externos que usamos en el showcase
      // del vehículo y de los kayaks
      'img-src': [
        "'self'",
        'data:',
        'https://www.mclouis.com',
        'https://behumax.com',
      ],
      // Conexiones AJAX a las pasarelas de pago y nuestro propio backend
      'connect-src': ["'self'", 'https://api.stripe.com', 'https://www.paypal.com'],
      // Iframes de Stripe Elements y de PayPal
      'frame-src': ["'self'", 'https://js.stripe.com', 'https://www.paypal.com', 'https://www.sandbox.paypal.com'],
    },
  },
  // Algunas políticas estrictas de Helmet pueden romper iframes legítimos
  crossOriginEmbedderPolicy: false,
}));
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('CORS no permitido'));
  },
  methods: ['GET', 'POST', 'DELETE'],
}));
app.use(express.json({ limit: '10kb' }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Demasiadas peticiones.' } });
app.use('/api/', apiLimiter);

const paymentLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Demasiados intentos de pago.' } });

app.use(express.static(path.join(__dirname, '..')));

// --- Gestión de reservas bloqueadas ---
const DATA_DIR = path.join(__dirname, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BOOKINGS_FILE)) fs.writeFileSync(BOOKINGS_FILE, '[]', 'utf8');

function readBookings() {
  try { return JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf8')); }
  catch { return []; }
}

function writeBookings(data) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function isAdmin(req) {
  return req.headers['authorization'] === `Bearer ${process.env.ADMIN_TOKEN}`;
}

// GET /api/disponibilidad — fechas bloqueadas (público, sin etiquetas privadas)
app.get('/api/disponibilidad', (req, res) => {
  const bookings = readBookings();
  res.json(bookings.map(b => ({ from: b.from, to: b.to })));
});

// GET /api/admin/reservas — listado completo con etiquetas (solo admin)
app.get('/api/admin/reservas', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado.' });
  res.json(readBookings());
});

// POST /api/admin/reserva — añadir reserva bloqueada
app.post('/api/admin/reserva', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado.' });
  const { from, to, label } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'Fechas obligatorias.' });
  if (new Date(to) < new Date(from)) return res.status(400).json({ error: 'La fecha fin debe ser posterior al inicio.' });
  const bookings = readBookings();
  const newBooking = { id: Date.now().toString(), from, to, label: label || '' };
  bookings.push(newBooking);
  writeBookings(bookings);
  console.log(`[MpCamperRent] Reserva bloqueada: ${from} → ${to} (${label || 'sin etiqueta'})`);
  res.json({ success: true, booking: newBooking });
});

// DELETE /api/admin/reserva/:id — eliminar reserva bloqueada
app.delete('/api/admin/reserva/:id', (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado.' });
  const before = readBookings();
  const after = before.filter(b => b.id !== req.params.id);
  if (before.length === after.length) return res.status(404).json({ error: 'Reserva no encontrada.' });
  writeBookings(after);
  res.json({ success: true });
});

// --- Stripe ---
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  console.log('[MpCamperRent] Stripe configurado');
} else {
  console.warn('[MpCamperRent] ⚠️ STRIPE_SECRET_KEY no configurada');
}

app.post('/api/stripe/create-payment-intent', paymentLimiter, async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe no configurado.' });
    const { amount, currency, bookingRef, customerEmail } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Cantidad inválida.' });
    if (!bookingRef) return res.status(400).json({ error: 'Referencia requerida.' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), currency: currency || 'eur',
      metadata: { bookingRef, customerEmail: customerEmail || '' },
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
    console.log(`[MpCamperRent] PaymentIntent: ${paymentIntent.id} — ${bookingRef}`);
  } catch (error) {
    console.error('[MpCamperRent] Error Stripe:', error.message);
    res.status(500).json({ error: 'Error al procesar el pago.' });
  }
});

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(400).send('Webhook no configurado');
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret); }
  catch (err) { return res.status(400).send('Firma inválida'); }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    console.log(`[MpCamperRent] ✅ Pago: ${intent.id} — Reserva: ${intent.metadata.bookingRef}`);
  } else if (event.type === 'payment_intent.payment_failed') {
    console.log(`[MpCamperRent] ❌ Fallo: ${event.data.object.id}`);
  }
  res.json({ received: true });
});

// --- PayPal ---
const PAYPAL_API = process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken() {
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  return (await response.json()).access_token;
}

app.post('/api/paypal/create-order', paymentLimiter, async (req, res) => {
  try {
    const { amount, currency, bookingRef } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Cantidad inválida.' });
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: bookingRef, amount: { currency_code: currency || 'EUR', value: amount.toFixed(2) }, description: `MpCamperRent ${bookingRef}` }] }),
    });
    const order = await response.json();
    res.json({ orderID: order.id });
  } catch (error) { res.status(500).json({ error: 'Error PayPal.' }); }
});

app.post('/api/paypal/capture-order', paymentLimiter, async (req, res) => {
  try {
    const { orderID } = req.body;
    if (!orderID) return res.status(400).json({ error: 'ID requerido.' });
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
    res.json(await response.json());
  } catch (error) { res.status(500).json({ error: 'Error capturando pago.' }); }
});

// --- Inicio ---
app.listen(PORT, () => {
  console.log(`\n  🚐 MpCamperRent Server — http://localhost:${PORT}\n`);
  if (!process.env.STRIPE_SECRET_KEY) console.warn('  ⚠️  STRIPE_SECRET_KEY no configurada');
  if (!process.env.PAYPAL_CLIENT_ID) console.warn('  ⚠️  PAYPAL_CLIENT_ID no configurada\n');
});
