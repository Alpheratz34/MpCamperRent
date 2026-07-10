/* ============================================
   MpCamperRent - Integración de pagos
   Stripe (tarjeta) + PayPal SDK
   
   FUNCIONAMIENTO:
   - Modo PRODUCCIÓN: si Stripe.js / PayPal SDK están cargados Y hay claves
     configuradas en js/config.js, usa la pasarela real.
   - Modo DESARROLLO: si no hay SDKs cargados, valida la tarjeta con
     algoritmo de Luhn y simula el pago para poder probar el flujo completo.
   
   SEGURIDAD:
   - NUNCA almacenamos datos de tarjeta en nuestro servidor.
   - Stripe Elements tokeniza los datos directamente en el navegador.
   - El client_secret se genera en el BACKEND.
   ============================================ */

(function () {
  'use strict';

  // ---------- Estado global del módulo ----------
  var paymentMethod = 'card';
  var stripe = null;
  var stripeElements = null;
  var cardElement = null;
  var paypalRendered = false;

  // ---------- Helpers ----------
  function $(id) { return document.getElementById(id); }

  function showToastSafe(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type);
    else console.log('[MpCamperRent]', type || 'info', msg);
  }

  function getApiBase() {
    return (typeof window.API_BASE === 'string') ? window.API_BASE : '';
  }

  // ---------- Validaciones de tarjeta (modo desarrollo) ----------

  // Algoritmo de Luhn para validar el número de tarjeta
  function isValidLuhn(cardNumber) {
    var digits = String(cardNumber).replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    var sum = 0;
    var alt = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var n = parseInt(digits.charAt(i), 10);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return (sum % 10) === 0;
  }

  // Detecta el tipo de tarjeta a partir del número (para feedback visual)
  function detectCardBrand(num) {
    var n = String(num).replace(/\D/g, '');
    if (/^4/.test(n)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
    if (/^3[47]/.test(n)) return 'Amex';
    if (/^(6011|65|64[4-9]|622)/.test(n)) return 'Discover';
    return '';
  }

  // Valida la fecha de caducidad MM/AA
  function isValidExpiry(value) {
    var m = /^(\d{2})\/(\d{2})$/.exec(String(value).trim());
    if (!m) return false;
    var month = parseInt(m[1], 10);
    var year = 2000 + parseInt(m[2], 10);
    if (month < 1 || month > 12) return false;
    var now = new Date();
    var expiry = new Date(year, month, 0, 23, 59, 59);
    return expiry >= now;
  }

  // Valida el CVC (3 o 4 dígitos)
  function isValidCVC(value) {
    return /^\d{3,4}$/.test(String(value).trim());
  }

  // ---------- Formateo automático de inputs ----------

  function attachCardInputFormatting() {
    var num = $('devCardNumber');
    var exp = $('devCardExpiry');
    var cvc = $('devCardCVC');

    if (num) {
      num.addEventListener('input', function (e) {
        var v = e.target.value.replace(/\D/g, '').slice(0, 19);
        // Agrupa en bloques de 4
        e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
        // Mostrar la marca detectada como pista visual
        var brand = detectCardBrand(v);
        e.target.setAttribute('data-brand', brand);
      });
    }
    if (exp) {
      exp.addEventListener('input', function (e) {
        var v = e.target.value.replace(/\D/g, '').slice(0, 4);
        if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
        e.target.value = v;
      });
    }
    if (cvc) {
      cvc.addEventListener('input', function (e) {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
      });
    }
  }

  // ---------- Inicialización Stripe ----------

  function initStripe() {
    if (typeof Stripe === 'undefined') {
      console.log('[MpCamperRent] Stripe.js no cargado — usando modo desarrollo.');
      return;
    }
    var publicKey = (window.STRIPE_PUBLIC_KEY || '').trim();
    if (!publicKey || /TU_CLAVE/.test(publicKey)) {
      console.log('[MpCamperRent] STRIPE_PUBLIC_KEY no configurada — usando modo desarrollo.');
      return;
    }

    try {
      stripe = Stripe(publicKey);
      stripeElements = stripe.elements({
        fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500&display=swap' }],
      });
      cardElement = stripeElements.create('card', {
        style: {
          base: {
            fontFamily: 'Outfit, sans-serif',
            fontSize: '16px',
            color: '#1A1A1A',
            '::placeholder': { color: '#8A8A8A' },
          },
          invalid: { color: '#C43E3E', iconColor: '#C43E3E' },
        },
        hidePostalCode: true,
      });

      var container = $('card-element');
      if (container) {
        // Sustituimos los inputs de desarrollo por el iframe seguro de Stripe
        container.innerHTML = '';
        cardElement.mount('#card-element');
        // Ocultamos los inputs separados (caducidad/CVC) porque el iframe
        // de Stripe los incluye todos en uno solo
        var devFields = document.querySelectorAll('#devCardExpiryGroup, #devCardCVCGroup');
        devFields.forEach(function (el) { el.style.display = 'none'; });
      }

      cardElement.on('change', function (event) {
        if (event.error) showToastSafe(event.error.message, 'error');
      });

      console.log('[MpCamperRent] Stripe inicializado correctamente');
    } catch (err) {
      console.error('[MpCamperRent] Error inicializando Stripe:', err);
    }
  }

  // ---------- Inicialización PayPal ----------

  function initPayPal() {
    if (typeof paypal === 'undefined') {
      console.log('[MpCamperRent] PayPal SDK no cargado — usando modo desarrollo.');
      return;
    }
    if (paypalRendered) return;

    var container = $('paypal-button-container');
    if (!container) return;

    try {
      container.innerHTML = '';

      paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay' },
        createOrder: function () {
          // Asegurar que tenemos los datos de la reserva listos
          if (!window.bookingData || !window.bookingData.total) {
            showToastSafe('Completa los pasos anteriores antes de pagar', 'error');
            return Promise.reject(new Error('Datos de reserva incompletos'));
          }
          if (!window.bookingData.ref) window.bookingData.ref = generateBookingRef();

          return fetch(getApiBase() + '/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: window.bookingData.total,
              currency: 'EUR',
              bookingRef: window.bookingData.ref,
            }),
          })
            .then(function (res) {
              if (!res.ok) throw new Error('Error servidor PayPal');
              return res.json();
            })
            .then(function (data) { return data.orderID; });
        },
        onApprove: function (data) {
          return fetch(getApiBase() + '/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderID: data.orderID, bookingRef: window.bookingData.ref }),
          })
            .then(function (res) { return res.json(); })
            .then(function (details) { handlePaymentSuccess('paypal', details); });
        },
        onError: function (err) {
          console.error('[MpCamperRent] Error PayPal:', err);
          showToastSafe('Error con PayPal. Inténtalo de nuevo o usa otro método.', 'error');
        },
        onCancel: function () {
          showToastSafe('Pago cancelado por el usuario.', 'warning');
        },
      }).render('#paypal-button-container').then(function () {
        paypalRendered = true;
        var confirmBtn = $('confirmPayBtn');
        if (confirmBtn) confirmBtn.style.display = 'none';
      });
    } catch (err) {
      console.error('[MpCamperRent] Error inicializando PayPal:', err);
      paypalRendered = false;
    }
  }

  // ---------- Selección de método de pago ----------

  function selectPaymentMethod(method) {
    paymentMethod = method;

    var cardForm = $('cardPaymentForm');
    var paypalForm = $('paypalPaymentForm');
    var cardBtn = $('payCardBtn');
    var paypalBtn = $('payPaypalBtn');
    var confirmBtn = $('confirmPayBtn');

    if (method === 'card') {
      cardForm.style.display = 'block';
      paypalForm.style.display = 'none';
      cardBtn.className = 'btn btn--primary';
      paypalBtn.className = 'btn btn--outline-dark';
      confirmBtn.style.display = '';
      confirmBtn.innerHTML = 'Confirmar y pagar';
    } else {
      cardForm.style.display = 'none';
      paypalForm.style.display = 'block';
      cardBtn.className = 'btn btn--outline-dark';
      paypalBtn.className = 'btn btn--primary';
      confirmBtn.style.display = paypalRendered ? 'none' : '';
      initPayPal();
    }
  }

  // ---------- Procesar pago ----------

  function processPayment() {
    if (paymentMethod === 'card') processCardPayment();
    else processPayPalPayment();
  }

  function processCardPayment() {
    var confirmBtn = $('confirmPayBtn');
    var cardName = $('cardName');

    // Validación común: nombre del titular
    if (!cardName.value.trim()) {
      showToastSafe('Introduce el nombre que aparece en la tarjeta', 'error');
      cardName.focus();
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Procesando...';

    // ----- Modo producción con Stripe -----
    if (stripe && cardElement) {
      // Asegurar que existe la referencia
      if (!window.bookingData.ref) window.bookingData.ref = generateBookingRef();

      fetch(getApiBase() + '/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(window.bookingData.total * 100),
          currency: 'eur',
          bookingRef: window.bookingData.ref,
          customerEmail: window.bookingData.email,
        }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Error en el servidor');
          return res.json();
        })
        .then(function (data) {
          return stripe.confirmCardPayment(data.clientSecret, {
            payment_method: {
              card: cardElement,
              billing_details: {
                name: cardName.value.trim(),
                email: window.bookingData.email,
              },
            },
          });
        })
        .then(function (result) {
          if (result.error) {
            showToastSafe(result.error.message, 'error');
            resetPayButton();
          } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
            handlePaymentSuccess('stripe', result.paymentIntent);
          }
        })
        .catch(function (err) {
          console.error('[MpCamperRent] Error Stripe:', err);
          showToastSafe('Error de conexión con la pasarela de pago.', 'error');
          resetPayButton();
        });
      return;
    }

    // ----- Modo desarrollo (sin Stripe.js) -----
    var num = $('devCardNumber');
    var exp = $('devCardExpiry');
    var cvc = $('devCardCVC');

    if (!num || !exp || !cvc) {
      showToastSafe('No se encuentran los campos de tarjeta', 'error');
      resetPayButton();
      return;
    }

    var rawNum = num.value.replace(/\s/g, '');

    if (!rawNum) {
      showToastSafe('Introduce el número de tarjeta', 'error');
      num.focus();
      resetPayButton();
      return;
    }
    if (!isValidLuhn(rawNum)) {
      showToastSafe('El número de tarjeta no es válido', 'error');
      num.focus();
      resetPayButton();
      return;
    }
    if (!isValidExpiry(exp.value)) {
      showToastSafe('La fecha de caducidad no es válida (formato MM/AA y futura)', 'error');
      exp.focus();
      resetPayButton();
      return;
    }
    if (!isValidCVC(cvc.value)) {
      showToastSafe('El código CVC debe tener 3 o 4 dígitos', 'error');
      cvc.focus();
      resetPayButton();
      return;
    }

    console.log('[MpCamperRent] Modo desarrollo — pago simulado correctamente');
    setTimeout(function () {
      window.bookingData.ref = generateBookingRef();
      handlePaymentSuccess('stripe-dev', {
        id: 'pi_dev_' + Date.now(),
        brand: detectCardBrand(rawNum) || 'Tarjeta',
        last4: rawNum.slice(-4),
      });
    }, 1500);
  }

  function processPayPalPayment() {
    // Si PayPal real está cargado, el botón ya gestiona todo el flujo
    if (typeof paypal !== 'undefined' && paypalRendered) return;

    // Modo desarrollo: simulamos la redirección
    var confirmBtn = $('confirmPayBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Redirigiendo a PayPal...';

    setTimeout(function () {
      window.bookingData.ref = generateBookingRef();
      handlePaymentSuccess('paypal-dev', { id: 'pp_dev_' + Date.now() });
    }, 1800);
  }

  // ---------- Confirmación ----------

  function handlePaymentSuccess(provider, details) {
    if (!window.bookingData.ref) window.bookingData.ref = generateBookingRef();
    var refEl = $('bookingRef');
    if (refEl) refEl.textContent = window.bookingData.ref;

    document.querySelectorAll('.step-panel').forEach(function (p) { p.classList.remove('active'); });
    $('stepConfirm').classList.add('active');
    document.querySelectorAll('.stepper__step').forEach(function (s) {
      s.classList.add('completed');
      s.classList.remove('active');
    });

    showToastSafe('¡Pago completado! Tu reserva está confirmada.', 'success');
    console.log('[MpCamperRent] Reserva completa:', {
      ref: window.bookingData.ref,
      vehicle: window.bookingData.vehicleName,
      customer: window.bookingData.name + ' ' + window.bookingData.surname,
      email: window.bookingData.email,
      pickup: window.bookingData.pickup,
      dates: window.bookingData.dateFrom + ' → ' + window.bookingData.dateTo,
      total: window.bookingData.total,
      provider: provider,
      paymentId: details && details.id,
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetPayButton() {
    var btn = $('confirmPayBtn');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Confirmar y pagar';
    }
  }

  // ---------- Utilidades ----------

  function generateBookingRef() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var ref = 'MP-' + new Date().getFullYear() + '-';
    for (var i = 0; i < 5; i++) ref += chars.charAt(Math.floor(Math.random() * chars.length));
    return ref;
  }

  // ---------- Exponer al ámbito global ----------
  window.selectPaymentMethod = selectPaymentMethod;
  window.processPayment = processPayment;
  window.generateBookingRef = generateBookingRef;
  window.initPayPal = initPayPal;

  // ---------- Inicialización al cargar la página ----------
  document.addEventListener('DOMContentLoaded', function () {
    attachCardInputFormatting();
    initStripe();
    initPayPal();

    // Botón de PayPal "mock" (solo se usa si el SDK real no está cargado)
    var mockPaypalBtn = $('paypalMockBtn');
    if (mockPaypalBtn) {
      mockPaypalBtn.addEventListener('click', function () { processPayPalPayment(); });
    }
  });
})();
