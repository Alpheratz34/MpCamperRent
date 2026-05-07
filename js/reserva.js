/* ============================================
   MpCamperRent - Lógica de reserva
   Vehículo único: McLouis MC4 Slim 331 a 139€/día
   ============================================ */

var currentStep = 1;
var bookingData = {
  vehicleName: 'McLouis MC4 Slim 331',
  pricePerDay: 139,
  pickup: 'Valdemoro, Madrid',
};
// Exponer al ámbito global para que el módulo de pagos pueda acceder
window.bookingData = bookingData;

// --- Navegación entre pasos ---
function goToStep(step) {
  'use strict';
  if (step > currentStep && !validateCurrentStep()) return;
  saveStepData();
  currentStep = step;

  document.querySelectorAll('.step-panel').forEach(function (panel) {
    panel.classList.remove('active');
  });
  var activePanel = document.getElementById('step' + step);
  if (activePanel) activePanel.classList.add('active');

  document.querySelectorAll('.stepper__step').forEach(function (stepEl) {
    var stepNum = parseInt(stepEl.getAttribute('data-step'));
    stepEl.classList.remove('active', 'completed');
    if (stepNum === step) stepEl.classList.add('active');
    else if (stepNum < step) stepEl.classList.add('completed');
  });

  updatePriceSummary();
  window.scrollTo({ top: 200, behavior: 'smooth' });
}

// --- Validar paso actual ---
function validateCurrentStep() {
  'use strict';

  if (currentStep === 1) {
    var dateFrom = document.getElementById('bookDateFrom');
    var dateTo = document.getElementById('bookDateTo');

    if (!dateFrom.value || !dateTo.value) { showToast('Selecciona las fechas de tu viaje', 'error'); return false; }

    var from = new Date(dateFrom.value);
    var to = new Date(dateTo.value);
    if (to <= from) { showToast('La fecha de devolución debe ser posterior a la de recogida', 'error'); return false; }
    return true;
  }

  if (currentStep === 2) {
    var name = document.getElementById('bookName');
    var surname = document.getElementById('bookSurname');
    var email = document.getElementById('bookEmail');
    var phone = document.getElementById('bookPhone');
    var dni = document.getElementById('bookDNI');
    var terms = document.getElementById('bookTerms');
    var valid = true;

    [name, surname, email, phone, dni].forEach(function (input) {
      if (!Validator.validateField(input)) valid = false;
    });
    if (dni && dni.value && !Validator.validateDNI(dni.value.trim())) {
      Validator.setError(dni, 'Introduce un DNI o pasaporte válido');
      valid = false;
    }
    if (!terms.checked) { showToast('Debes aceptar los términos y condiciones', 'error'); valid = false; }
    return valid;
  }

  return true;
}

// --- Guardar datos ---
function saveStepData() {
  'use strict';
  if (currentStep === 1) {
    bookingData.dateFrom = document.getElementById('bookDateFrom').value;
    bookingData.dateTo = document.getElementById('bookDateTo').value;
    bookingData.days = daysBetween(bookingData.dateFrom, bookingData.dateTo);
  }
  if (currentStep === 2) {
    bookingData.name = Validator.sanitize(document.getElementById('bookName').value.trim());
    bookingData.surname = Validator.sanitize(document.getElementById('bookSurname').value.trim());
    bookingData.email = Validator.sanitize(document.getElementById('bookEmail').value.trim());
    bookingData.phone = Validator.sanitize(document.getElementById('bookPhone').value.trim());
    bookingData.dni = Validator.sanitize(document.getElementById('bookDNI').value.trim());
    bookingData.notes = Validator.sanitize(document.getElementById('bookNotes').value.trim());
  }
}

// --- Resumen de precio ---
function updatePriceSummary() {
  'use strict';
  var summaryContent = document.getElementById('summaryContent');
  if (!summaryContent) return;

  if (!bookingData.days) {
    summaryContent.innerHTML = '<p style="color: var(--color-text-light); font-size: var(--text-sm);">Selecciona las fechas para ver el resumen.</p>';
    return;
  }

  var subtotal = bookingData.pricePerDay * bookingData.days;
  var iva = subtotal * 0.21;
  var total = subtotal + iva;

  var html = '';
  html += '<div class="price-summary__row"><span>McLouis MC4 Slim 331</span><span>' + bookingData.pricePerDay + '€/día</span></div>';
  html += '<div class="price-summary__row"><span>Días</span><span>' + bookingData.days + '</span></div>';
  html += '<div class="price-summary__row"><span>Subtotal</span><span>' + formatPrice(subtotal) + '</span></div>';
  html += '<div class="price-summary__row"><span>IVA (21%)</span><span>' + formatPrice(iva) + '</span></div>';
  html += '<div class="price-summary__row price-summary__row--total"><span>Total</span><span>' + formatPrice(total) + '</span></div>';
  html += '<div style="margin-top: var(--space-md); padding: var(--space-md); background: var(--color-bg-alt); border-radius: var(--radius-md); font-size: var(--text-sm);">';
  html += '<p><strong>Recogida:</strong> ' + formatDate(bookingData.dateFrom) + '</p>';
  html += '<p><strong>Devolución:</strong> ' + formatDate(bookingData.dateTo) + '</p>';
  html += '<p><strong>Lugar:</strong> Valdemoro, Madrid</p>';
  html += '</div>';
  html += '<div style="margin-top: var(--space-sm); padding: var(--space-md); background: rgba(212,168,83,0.1); border: 1.5px solid rgba(212,168,83,0.4); border-radius: var(--radius-md); font-size: var(--text-xs); color: var(--color-text-secondary);">';
  html += '<strong style="color: var(--color-text);">Fianza: 900€</strong> — se abona en la recogida y se devuelve al retorno.';
  html += '</div>';

  summaryContent.innerHTML = html;
  bookingData.total = total;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

// --- Validación en tiempo real ---
(function () {
  'use strict';
  var step2 = document.getElementById('step2');
  if (step2) Validator.attachLiveValidation(step2);
})();
