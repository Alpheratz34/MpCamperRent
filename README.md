# 🚐 MpCamperRent — Alquiler de Autocaravana

Web profesional para el alquiler de una autocaravana en Valdemoro (Madrid), con pagos seguros (Stripe + PayPal), formulario de reserva multi-paso, páginas legales completas y un logo único en SVG.

---

## ✨ Novedades de esta versión

- 🎨 **Logo único** dibujado en SVG (autocaravana con sol naciente y carretera). Hay dos versiones (`logo.svg` y `logo-light.svg`) para fondos claros y oscuros respectivamente. Favicon SVG incluido.
- 🚐 **Autocaravana de 170 CV** (Ford Transit) — actualizado en todas las páginas.
- 📍 **Recogida en Valdemoro, Madrid** — actualizado en home, reserva, contacto y JS.
- 📜 **Páginas legales completas y funcionales**:
  - `terminos.html` — Términos y condiciones del alquiler (índice navegable, 14 secciones, reservas no reembolsables)
  - `privacidad.html` — Política de privacidad RGPD-compliant
  - `cookies.html` — Política de cookies con tabla detallada
- 💳 **Pagos funcionales**:
  - Stripe Elements y PayPal SDK se cargan dinámicamente solo si están las claves
  - Modo desarrollo robusto: validación con algoritmo de Luhn, formateo automático MM/AA y CVC, detección de marca (Visa/Mastercard/Amex/Discover)
  - El backend ya estaba listo (`/api/stripe/create-payment-intent`, `/api/paypal/create-order`, `/api/paypal/capture-order`)

---

## 📁 Estructura del proyecto

```
MpCamperRent/
│
├── index.html              ← Landing principal
├── vehiculo.html           ← Detalle de la McLouis MC4 Slim 331 (170 CV)
├── reserva.html            ← Reserva en 3 pasos (fechas → datos → pago)
├── nosotros.html           ← Sobre nosotros
├── contacto.html           ← Información de contacto
├── admin.html              ← Panel de administración (bloqueo de fechas)
│
├── terminos.html           ← Términos y condiciones (14 secciones, no reembolsables)
├── privacidad.html         ← Política de privacidad (RGPD)
├── cookies.html            ← Política de cookies
│
├── assets/
│   ├── logo.svg            ← Logo principal (fondo claro)
│   ├── logo-light.svg      ← Logo para fondo oscuro (footer)
│   └── favicon.svg         ← Favicon en SVG
│
├── css/
│   ├── variables.css       ← Tokens de diseño
│   ├── styles.css          ← Reset, tipografía, layout, animaciones
│   ├── components.css      ← Botones, tarjetas, nav, footer, formularios
│   └── responsive.css      ← Media queries (tablet y móvil)
│
├── js/
│   ├── config.js           ← URLs y claves PÚBLICAS (Stripe, PayPal, API_BASE)
│   ├── nav.js              ← Navegación: scroll, menú hamburguesa
│   ├── main.js             ← Animaciones scroll y utilidades
│   ├── validacion.js       ← Validador de formularios reutilizable
│   ├── reserva.js          ← Lógica de los 3 pasos de reserva
│   ├── pago.js             ← Integración Stripe + PayPal (frontend)
│   └── contacto.js         ← Formulario de contacto
│
├── server/
│   ├── server.js           ← Backend Node.js/Express
│   ├── .env.example        ← Plantilla de variables de entorno
│   └── data/bookings.json  ← Persistencia de reservas bloqueadas
│
├── package.json
├── railway.json            ← Configuración Railway (despliegue)
└── README.md
```

---

## 🚀 Cómo empezar

### Opción 1 — Solo frontend (modo desarrollo)

Funciona sin servidor. El pago se simula tras validar la tarjeta con Luhn.

1. Abre la carpeta en VS Code.
2. Instala la extensión **Live Server**.
3. Clic derecho en `index.html` → *Open with Live Server*.

### Opción 2 — Con backend (pagos reales)

```bash
cd MpCamperRent
npm install
cp server/.env.example server/.env
# Edita server/.env con tus claves SECRETAS de Stripe y PayPal
npm start
# Abre http://localhost:3000
```

---

## 💳 Activar pagos reales

### 1. Stripe (tarjeta)

1. Crea cuenta en [stripe.com](https://stripe.com) → *Developers → API Keys*.
2. Pega la **clave secreta** (`sk_test_...`) en `server/.env` → `STRIPE_SECRET_KEY`.
3. Pega la **clave publicable** (`pk_test_...`) en `js/config.js` → `STRIPE_PUBLIC_KEY`.
4. (Opcional) Configura un webhook en Stripe Dashboard hacia `/api/stripe/webhook` y pega el secret en `STRIPE_WEBHOOK_SECRET`.

Tarjeta de prueba: `4242 4242 4242 4242`, CVC `123`, fecha futura.

### 2. PayPal

1. Crea cuenta en [developer.paypal.com](https://developer.paypal.com) → *My Apps*.
2. Pega el **Client ID** en `js/config.js` → `PAYPAL_CLIENT_ID`.
3. Pega el **Client Secret** en `server/.env` → `PAYPAL_CLIENT_SECRET`.
4. Modo `sandbox` para pruebas, `live` para producción (variable `PAYPAL_MODE`).

Una vez configuradas las claves en `js/config.js`, los SDKs (Stripe.js y PayPal SDK) se cargan automáticamente. Si las dejas con los placeholders por defecto, la web sigue funcionando en modo desarrollo.

---

## 🎨 El logo

El logo (`assets/logo.svg`) representa una autocaravana con el sol detrás y una carretera dibujada con las líneas en color dorado. Es 100 % SVG, escalable, ligero (≈ 2 KB) y coincide con la paleta del sitio:

- Verde bosque (`#1B3A2D`) — color principal
- Dorado arena (`#D4A853`) — color de acento
- Crema (`#FAF7F2`) — fondo

Aparece en el nav de todas las páginas (a la izquierda de los enlaces) y en el footer del index (versión `logo-light.svg` con texto crema sobre fondo oscuro).

---

## 🔒 Seguridad

- Datos de tarjeta tokenizados por Stripe (nunca llegan a tu servidor).
- Validación doble: frontend (Luhn + regex) + backend.
- Sanitización XSS de todos los inputs antes de guardarlos.
- Rate limiting por IP (100 req/15min global, 10 req/15min en pagos).
- Cabeceras HTTP seguras (Helmet).
- CORS restringido a los orígenes definidos en `ALLOWED_ORIGINS`.
- Endpoints `/api/admin/*` protegidos con `Authorization: Bearer <ADMIN_TOKEN>`.

---

## ✅ Checklist para producción

- [ ] Dominio propio con HTTPS (Cloudflare, Netlify, etc.)
- [ ] Claves **LIVE** de Stripe (`sk_live_...`, `pk_live_...`)
- [ ] Credenciales **live** de PayPal (`PAYPAL_MODE=live`)
- [ ] `ALLOWED_ORIGINS` con tu dominio real
- [ ] `ADMIN_TOKEN` aleatorio y seguro (`openssl rand -hex 32`)
- [ ] Base de datos para reservas (sustituir `bookings.json`)
- [ ] Servicio de email para confirmaciones (Mailgun, SendGrid, etc.)
- [ ] Datos fiscales reales en términos y privacidad

---

## 📞 Contacto

- Web: <https://mpcamperrent.com>
- Email: <mpcamperrent@gmail.com>
- Tel: 600 14 07 25
- Recogida: Valdemoro, Madrid
