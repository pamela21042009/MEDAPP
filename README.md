# MedApp - Sistema de Gestion de Citas Medicas

MedApp es una aplicacion web para la gestion integral de citas medicas y procesos administrativos de una consulta o centro de salud. El sistema permite administrar usuarios, medicos, pacientes, agenda, horarios, recetas, pagos, reportes, notificaciones, auditoria y configuracion general.

El proyecto esta construido con un backend en Flask y un frontend en React/Vite. La persistencia de datos se realiza mediante Supabase/PostgreSQL a traves de su API REST.

## Descripcion del proyecto

MedApp centraliza los procesos principales de una operacion medica:

- Registro e inicio de sesion de usuarios.
- Recuperacion de contrasena mediante codigo de verificacion.
- Gestion de medicos, especialidades, tarifas y disponibilidad.
- Gestion de pacientes, expediente basico, historial clinico y signos vitales.
- Agenda de citas con creacion, edicion, cancelacion y reagendamiento.
- Control de horarios medicos, recesos, bloqueos y espacios disponibles.
- Emision y consulta de recetas medicas.
- Registro de pagos, recibos, reembolsos y pagos en linea opcionales.
- Reportes operativos y financieros.
- Notificaciones, recordatorios y auditoria de acciones relevantes.
- Configuracion de perfil, contrasena y parametros del sistema.

## Tecnologias utilizadas

### Backend

- Python 3.11+
- Flask 3
- Supabase Python/PostgREST
- python-dotenv
- Gunicorn
- OpenPyXL

### Frontend

- React 18
- React DOM
- React Router DOM 6
- Vite 5
- Tailwind CSS 3
- PostCSS
- Autoprefixer

### Base de datos e integraciones

- Supabase / PostgreSQL
- SMTP para envio de correos
- Twilio para SMS, si se configura
- Stripe Checkout para pagos en linea, si se habilita

## Requisitos de instalacion

Antes de ejecutar el proyecto se recomienda tener instalado:

- Python 3.11 o superior.
- Node.js 18 o superior.
- npm.
- Cuenta o proyecto activo en Supabase.
- Terminal PowerShell o equivalente.
- Git, si se va a clonar desde un repositorio.

## Instalacion del backend

Desde la carpeta raiz del proyecto:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

El archivo `run.py` valida que el proyecto se ejecute usando un entorno virtual local llamado `.venv` o `venv`. Si se intenta ejecutar con Python global, el sistema mostrara instrucciones para usar el entorno correcto.

## Instalacion del frontend

Desde la carpeta `frontend`:

```powershell
cd frontend
npm install
```

Para ejecutar el frontend en modo desarrollo:

```powershell
npm run dev
```

Para generar la version compilada de produccion:

```powershell
npm run build
```

Cuando existe la carpeta `frontend/dist`, Flask puede servir el frontend compilado. En desarrollo, Flask puede redirigir al servidor Vite configurado en `FRONTEND_DEV_ORIGINS`.

## Configuracion

El proyecto utiliza variables de entorno. Crea un archivo `.env` en la raiz del proyecto y completa los valores necesarios.

Ejemplo de configuracion:

```env
SECRET_KEY=cambiar-por-una-clave-segura
FLASK_ENV=development
FLASK_DEBUG=true

SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu_clave_supabase
SUPABASE_SSL_VERIFY=true
SUPABASE_SELECT_CACHE_SECONDS=12

FRONTEND_DEV_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

ADMIN_REGISTER_CODE=ADMIN2025
DOCTOR_REGISTER_CODE=MEDICO2025
PASSWORD_SALT=cambiar-este-salt

DISABLE_REMINDER_WORKER=false
REMINDER_WORKER_ENABLED=true
REMINDER_SCAN_INTERVAL_SECONDS=300
REMINDER_HOURS_DEFAULT=24

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=correo@dominio.com
SMTP_PASSWORD=clave-o-app-password
SMTP_FROM_EMAIL=correo@dominio.com
SMTP_FROM_NAME=MedApp
SMTP_USE_TLS=true
SMTP_USE_SSL=false

SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_MESSAGING_SERVICE_SID=

ONLINE_PAYMENT_ENABLED=false
ONLINE_PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_LOCALE=es-419
ONLINE_PAYMENT_CURRENCY=USD
```

### Variables principales

| Variable | Descripcion |
| --- | --- |
| `SECRET_KEY` | Clave secreta de Flask para sesiones. Debe cambiarse en produccion. |
| `FLASK_ENV` | Ambiente de ejecucion: `development` o `production`. |
| `FLASK_DEBUG` | Activa o desactiva el modo debug. |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_KEY` | Clave de acceso a Supabase/PostgREST. |
| `SUPABASE_SELECT_CACHE_SECONDS` | Segundos de cache local para lecturas repetidas a Supabase. |
| `FRONTEND_DEV_ORIGINS` | Origenes permitidos del frontend en desarrollo. |
| `ADMIN_REGISTER_CODE` | Codigo requerido para registro administrativo. |
| `DOCTOR_REGISTER_CODE` | Codigo requerido para registrar cuentas de medico. |
| `PASSWORD_SALT` | Salt usado por el sistema de contrasenas. |
| `DISABLE_REMINDER_WORKER` | Permite desactivar el worker de recordatorios. |
| `SMTP_*` | Configuracion para envio de correos. |
| `TWILIO_*` | Configuracion opcional para envio de SMS. |
| `STRIPE_*` | Configuracion opcional para pagos en linea. |

## Ejecucion del proyecto

### Backend

Desde la raiz del proyecto:

```powershell
.\.venv\Scripts\python.exe run.py
```

Tambien se puede usar el script incluido:

```powershell
.\start-backend.ps1
```

El backend se ejecuta por defecto en:

```text
http://localhost:5000
```

### clonar el repositorio
git clone https://github.com/pamela21042009/MEDAPP.git


### Crear cuenta de secretaria

La cuenta de secretaria no se registra desde el formulario publico. Se crea internamente con el script incluido:

```powershell
.\.venv\Scripts\python.exe create_secretary_user.py --email secretaria@clinica.com --password "ClaveSegura123" --name "Secretaria Principal"
```

Si el correo ya existe, el script actualiza esa cuenta con el rol `secretaria`, la activa y reemplaza su contrasena.

### Frontend en desarrollo

En otra terminal:

```powershell
cd frontend
npm run dev
```

El frontend se ejecuta por defecto en:

```text
http://localhost:5173
```

## Estructura del proyecto

```text
medapp/
  app/
    __init__.py              # Factory create_app, Blueprints, CORS y guardas de autenticacion
    config.py                # Configuracion central de la aplicacion
    routes/                  # Rutas y Blueprints por modulo
    controllers/             # Coordinacion entre peticiones, servicios y respuestas
    services/                # Logica de negocio e integraciones
    models/                  # Modelos o estructuras base del dominio

  frontend/
    src/
      App.jsx                # Rutas principales de React
      main.jsx               # Punto de entrada del frontend
      context/               # Contexto de autenticacion
      pages/                 # Pantallas funcionales
      components/            # Componentes de UI y estructura
      lib/                   # Clientes API por modulo
    public/                  # Recursos publicos
    dist/                    # Build de produccion generado por Vite
    package.json             # Dependencias y scripts del frontend

  docs/                      # Documentacion del proyecto
  outputs/                   # Archivos generados para entregas
  requirements.txt           # Dependencias Python
  run.py                     # Punto de entrada del backend
  start-backend.ps1          # Script auxiliar para iniciar backend en Windows
  README.md                  # Documentacion principal del proyecto
```

## Modulos principales

| Modulo | Ruta principal | Descripcion |
| --- | --- | --- |
| Autenticacion | `/auth` | Login, registro, sesion, logout y recuperacion de contrasena. |
| Dashboard | `/dashboard` | Resumen general, indicadores y metricas. |
| Agenda | `/agenda` | Gestion de citas, eventos, disponibilidad y slots. |
| Medicos | `/doctors` | Registro, consulta, actualizacion y desactivacion de medicos. |
| Pacientes | `/patients` | Expedientes, datos clinicos, signos vitales y documentos. |
| Horarios | `/schedule` | Configuracion de horarios, recesos y bloqueos. |
| Recetas | `/prescriptions` | Creacion y consulta de recetas medicas. |
| Pagos | `/payments` | Cobros, recibos, reembolsos y pagos en linea. |
| Reportes | `/reports` | Indicadores, exportaciones y analisis operativo. |
| Notificaciones | `/notifications` | Alertas, recordatorios y marcado de lectura. |
| Auditoria | `/audit` | Consulta de eventos y trazabilidad. |
| Configuracion | `/settings` | Perfil, contrasena y parametros del sistema. |

## Endpoints API representativos

| Modulo | Endpoints |
| --- | --- |
| Auth | `/auth/api/login`, `/auth/api/me`, `/auth/api/logout`, `/auth/api/register` |
| Agenda | `/agenda/api/events`, `/agenda/api/appointments`, `/agenda/api/slots` |
| Doctores | `/doctors/api/list`, `/doctors/api/bootstrap`, `/doctors/api/<id>` |
| Pacientes | `/patients/api/search`, `/patients/api/list`, `/patients/api/<id>` |
| Pagos | `/payments/api/list`, `/payments/api`, `/payments/api/stats` |
| Reportes | `/reports/api/bootstrap`, `/reports/api/revenue`, `/reports/export/excel` |
| Recetas | `/prescriptions/api/list`, `/prescriptions/api/medications` |
| Notificaciones | `/notifications/api/unread`, `/notifications/api/read-all` |
| Configuracion | `/settings/api/profile`, `/settings/api/password`, `/settings/api/system` |
| Auditoria | `/audit/api/recent` |

## Mantenimiento recomendado

- Mantener actualizado `requirements.txt` y revisar vulnerabilidades de dependencias Python.
- Ejecutar `npm audit` y actualizar dependencias frontend cuando sea necesario.
- Rotar credenciales sensibles de Supabase, SMTP, Twilio y Stripe.
- Mantener respaldos de la base de datos en Supabase/PostgreSQL.
- Revisar logs de errores del backend, especialmente `DatabaseService`, correos, SMS, pagos y recordatorios.
- Verificar periodicamente usuarios, roles y accesos administrativos.
- Documentar migraciones o cambios estructurales de base de datos.
- Probar los flujos criticos despues de cada cambio: login, agenda, pacientes, pagos y reportes.

## Consideraciones de seguridad

- No subir archivos `.env` con credenciales reales.
- Cambiar `SECRET_KEY` y `PASSWORD_SALT` antes de usar el sistema en produccion.
- Ejecutar produccion con `FLASK_DEBUG=false`.
- Usar HTTPS para proteger cookies y sesiones.
- Evitar exponer claves privadas de Supabase, Stripe, SMTP o Twilio en el frontend.
- Para un ambiente productivo formal se recomienda migrar el almacenamiento de contrasenas a `bcrypt` o `argon2`.

## Documentacion generada

En la carpeta `docs/`  se incluyen documentos de apoyo del proyecto, como acta, manual tecnico y cronograma.

## Creditos

Proyecto desarrollado como sistema academico/profesional para la gestion de citas medicas.

- Nombre del proyecto: MedApp.
- Equipo responsable: Pamela Reding
- Responsable proyecto: Jose Rijo
- Fecha de documentacion:  30 abril de 2026.
