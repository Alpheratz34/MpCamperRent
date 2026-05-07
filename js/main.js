/* ============================================
   MpCamperRent - Funcionalidad general
   Animaciones scroll, utilidades comunes
   ============================================ */

(function () {
  'use strict';

  // --- Animaciones al hacer scroll (Intersection Observer) ---
  const animatedElements = document.querySelectorAll('.animate-on-scroll');

  if (animatedElements.length > 0 && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target); // Solo animar una vez
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    animatedElements.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    // Fallback: mostrar todo directamente
    animatedElements.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  // --- Establecer fecha mínima en inputs de fecha ---
  const dateInputs = document.querySelectorAll('input[type="date"]');
  if (dateInputs.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    dateInputs.forEach(function (input) {
      input.setAttribute('min', today);
    });
  }

  // --- Smooth scroll para enlaces internos ---
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();

// --- Utilidad: Mostrar notificación toast ---
function showToast(message, type) {
  type = type || 'success';

  var container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  var toast = document.createElement('div');
  toast.className = 'toast' + (type === 'error' ? ' toast--error' : type === 'warning' ? ' toast--warning' : '');
  toast.textContent = message;
  container.appendChild(toast);

  // Auto-eliminar después de 4 segundos
  setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(function () {
      toast.remove();
    }, 300);
  }, 4000);
}

// --- Utilidad: Formatear precio ---
function formatPrice(amount) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

// --- Utilidad: Calcular días entre dos fechas ---
function daysBetween(date1, date2) {
  var d1 = new Date(date1);
  var d2 = new Date(date2);
  var diff = Math.abs(d2 - d1);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// --- Utilidad: Generar referencia de reserva ---
function generateBookingRef() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var ref = 'VR-' + new Date().getFullYear() + '-';
  for (var i = 0; i < 5; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}
