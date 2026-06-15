/* ============================================
   MpCamperRent - Configuración del cliente
   
   Estos valores son PÚBLICOS y se exponen al navegador.
   - STRIPE_PUBLIC_KEY: clave publicable de Stripe (empieza por pk_)
   - PAYPAL_CLIENT_ID: client ID público de PayPal
   - API_BASE: URL del backend (vacío en local, URL en producción)
   
   ⚠️ NUNCA pongas aquí claves SECRETAS (sk_, secret_, etc.)
   Las claves secretas van únicamente en server/.env
   ============================================ */

// --- URL base del backend ---
// Vacío en local (mismo origen) — URL completa en producción
var API_BASE = (function () {
  var h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h === '') return '';
  // ⬇️ Sustituye por tu URL real una vez desplegado en Railway / Render / Vercel
  return 'https://TU-APP.up.railway.app';
})();

// --- Stripe (clave PÚBLICA, empieza por pk_test_ o pk_live_) ---
// Obtén la tuya en: https://dashboard.stripe.com/apikeys
// Mientras la dejes con "TU_CLAVE_PUBLICABLE_AQUI", el sistema funciona en
// modo desarrollo (validación local + simulación de pago).
var STRIPE_PUBLIC_KEY = 'pk_live_51TiL8xCr3Ckeq3cfZoYXf3KPTLo3K6RAn0YfKZV0B1z4D6l7wA5EoIgpA9qTkop2qh21JB3B1RTgHuF65hzVeKLN00h42KluE1';

// --- PayPal (Client ID PÚBLICO) ---
// Obtén el tuyo en: https://developer.paypal.com/dashboard/applications
// Mientras lo dejes con "TU_CLIENT_ID_AQUI", se usa el botón mock.
var PAYPAL_CLIENT_ID = 'TU_CLIENT_ID_AQUI';

// --- Exponer al ámbito global para que otros scripts puedan acceder ---
window.API_BASE = API_BASE;
window.STRIPE_PUBLIC_KEY = STRIPE_PUBLIC_KEY;
window.PAYPAL_CLIENT_ID = PAYPAL_CLIENT_ID;

// --- Cargar dinámicamente los SDKs solo si hay claves configuradas ---
// (Evita el coste de cargar Stripe.js/PayPal SDK si estás en modo desarrollo)
(function loadPaymentSDKs() {
  function loadScript(src, attrs) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (attrs) Object.keys(attrs).forEach(function (k) { s.setAttribute(k, attrs[k]); });
    document.head.appendChild(s);
  }

  // Stripe.js
  if (STRIPE_PUBLIC_KEY && !/TU_CLAVE/.test(STRIPE_PUBLIC_KEY)) {
    loadScript('https://js.stripe.com/v3/');
  }

  // PayPal SDK
  if (PAYPAL_CLIENT_ID && !/TU_CLIENT_ID/.test(PAYPAL_CLIENT_ID)) {
    loadScript('https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(PAYPAL_CLIENT_ID) + '&currency=EUR&intent=capture');
  }
})();
