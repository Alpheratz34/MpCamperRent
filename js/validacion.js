/* ============================================
   VANROAD - Validación de formularios
   Funciones reutilizables de validación
   ============================================ */

var Validator = (function () {
  'use strict';

  // --- Patrones de validación ---
  var patterns = {
    email: /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
    phone: /^(\+34|0034)?[\s\-]?[6789]\d{2}[\s\-]?\d{3}[\s\-]?\d{3}$/,
    dni: /^[0-9]{8}[A-Za-z]$/,
    passport: /^[A-Za-z0-9]{6,12}$/,
  };

  // --- Marcar un campo como inválido ---
  function setError(input, message) {
    var group = input.closest('.form-group');
    if (group) {
      group.classList.add('has-error');
      var errorEl = group.querySelector('.form-error');
      if (errorEl && message) {
        errorEl.textContent = message;
      }
    }
    input.classList.add('form-input--error');
  }

  // --- Limpiar error de un campo ---
  function clearError(input) {
    var group = input.closest('.form-group');
    if (group) {
      group.classList.remove('has-error');
    }
    input.classList.remove('form-input--error');
  }

  // --- Validar un campo individual ---
  function validateField(input) {
    var value = input.value.trim();
    var type = input.type;
    var required = input.hasAttribute('required');

    // Limpiar error anterior
    clearError(input);

    // Campo requerido vacío
    if (required && value === '') {
      setError(input, 'Este campo es obligatorio');
      return false;
    }

    // Si no es requerido y está vacío, es válido
    if (value === '') return true;

    // Validar email
    if (type === 'email' && !patterns.email.test(value)) {
      setError(input, 'Introduce un email válido');
      return false;
    }

    // Validar teléfono
    if (type === 'tel' && !patterns.phone.test(value.replace(/\s/g, ''))) {
      setError(input, 'Introduce un teléfono válido');
      return false;
    }

    // Validar fechas
    if (type === 'date' && required) {
      var selectedDate = new Date(value);
      var today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        setError(input, 'La fecha debe ser futura');
        return false;
      }
    }

    return true;
  }

  // --- Validar un grupo de campos ---
  function validateForm(formElement) {
    var inputs = formElement.querySelectorAll('.form-input, .form-select');
    var isValid = true;

    inputs.forEach(function (input) {
      if (!validateField(input)) {
        isValid = false;
      }
    });

    // Validar checkboxes requeridos
    var checkboxes = formElement.querySelectorAll('input[type="checkbox"][required]');
    checkboxes.forEach(function (cb) {
      if (!cb.checked) {
        isValid = false;
        var label = cb.closest('.form-checkbox');
        if (label) {
          label.style.color = 'var(--color-error)';
        }
      }
    });

    return isValid;
  }

  // --- Validar DNI/Pasaporte ---
  function validateDNI(value) {
    return patterns.dni.test(value) || patterns.passport.test(value);
  }

  // --- Sanitizar input (prevenir XSS) ---
  function sanitize(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Listener de validación en tiempo real ---
  function attachLiveValidation(formElement) {
    var inputs = formElement.querySelectorAll('.form-input, .form-select');
    inputs.forEach(function (input) {
      input.addEventListener('blur', function () {
        validateField(input);
      });
      input.addEventListener('input', function () {
        if (input.classList.contains('form-input--error')) {
          validateField(input);
        }
      });
    });
  }

  // API pública
  return {
    validateField: validateField,
    validateForm: validateForm,
    validateDNI: validateDNI,
    setError: setError,
    clearError: clearError,
    sanitize: sanitize,
    attachLiveValidation: attachLiveValidation,
  };
})();
