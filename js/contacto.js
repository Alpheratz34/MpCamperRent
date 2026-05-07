/* ============================================
   MpCamperRent - Formulario de contacto
   ============================================ */
(function () {
  'use strict';
  var form = document.getElementById('contactForm');
  if (!form) return;

  Validator.attachLiveValidation(form);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!Validator.validateForm(form)) { showToast('Revisa los campos marcados en rojo.', 'error'); return; }
    var privacy = document.getElementById('contactPrivacy');
    if (!privacy.checked) { showToast('Debes aceptar la política de privacidad.', 'error'); return; }

    var formData = {
      name: Validator.sanitize(document.getElementById('contactName').value.trim()),
      email: Validator.sanitize(document.getElementById('contactEmail').value.trim()),
      subject: document.getElementById('contactSubject').value,
      message: Validator.sanitize(document.getElementById('contactMessage').value.trim()),
    };

    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;"></span> Enviando...';

    (async function () {
      try {
        var res = await fetch('/api/contacto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          var data = await res.json();
          throw new Error(data.error || 'Error desconocido');
        }
        form.style.display = 'none';
        document.getElementById('contactSuccess').style.display = 'block';
        showToast('¡Mensaje enviado correctamente!');
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Enviar mensaje';
        showToast('No se pudo enviar el mensaje. Inténtalo de nuevo o llámanos al 600 14 07 25.', 'error');
        console.error('[MpCamperRent] Error contacto:', err.message);
      }
    })();
  });
})();
