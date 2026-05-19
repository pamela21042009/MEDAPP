# Sistema De Autenticacion Y Roles

## Estructura

```text
medapp/
  app/
    routes/
      auth.py              # login JWT, invitaciones, recuperar contrasena
      doctors.py           # perfiles medicos; creacion directa bloqueada
      api_helpers.py       # usuario actual, roles, filtros por doctor
    services/
      security.py          # JWT, bcrypt, tokens de invitacion
      email_service.py     # SMTP
      database.py          # Supabase client
  frontend/src/
    pages/
      LoginPage.jsx
      AcceptInvitationPage.jsx
      DoctorFormPage.jsx
    components/app/
      ProtectedRoute.jsx
    lib/
      auth.js
      doctors.js
```

## Variables De Entorno

```env
SECRET_KEY=change-me
JWT_SECRET_KEY=change-me-to-a-long-random-secret
JWT_ACCESS_TOKEN_MINUTES=60
BCRYPT_ROUNDS=12
INVITATION_TOKEN_PEPPER=another-long-random-secret
DOCTOR_INVITE_EXPIRE_HOURS=24
INVITE_BASE_URL=https://mihospital.com

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your-server-side-key
SUPABASE_SERVICE_ROLE_KEY=optional-service-role-key

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=MedApp
```

## Tablas Supabase

Ejecuta:

```sql
-- medapp/docs/auth_invitation_schema.sql
```

La tabla `doctor_invitations` guarda solo `token_hash`, no el token en claro. El enlace contiene el token una sola vez.

## Endpoints

```text
POST /auth/api/login
POST /auth/api/logout
GET  /auth/api/me

POST /auth/api/admin/doctors/invite
GET  /auth/api/invitations/verify?token=TOKEN
POST /auth/api/invitations/accept

POST /auth/api/forgot-password
POST /auth/api/verify-code
POST /auth/api/new-password
```

## Flujo

1. El admin inicia sesion.
2. El admin entra a `Medicos > Nuevo medico`.
3. Flask valida que el usuario sea `admin`.
4. Flask crea un usuario `doctor` inactivo y un perfil en `doctors` inactivo.
5. Flask genera un token seguro con `secrets.token_urlsafe`.
6. Flask guarda `sha256(INVITATION_TOKEN_PEPPER + token)` en Supabase.
7. Flask calcula `expires_at = now + 24 horas`.
8. Flask envia el enlace `https://mihospital.com/verify?token=...`.
9. React lee `token` desde la URL.
10. React llama `GET /auth/api/invitations/verify`.
11. Flask valida existencia, expiracion, uso previo y revocacion.
12. El doctor crea contrasena.
13. Flask guarda la contrasena con bcrypt, activa `users`, marca `email_verified`, activa `doctors` y marca `used_at`.
14. Flask emite JWT y lo guarda en cookie `HttpOnly`.
15. React redirige al dashboard medico.

## Proteccion De Rutas

Frontend:

```jsx
<ProtectedRoute roles={["admin"]}>
  <AuditPage />
</ProtectedRoute>

<ProtectedRoute roles={["doctor"]}>
  <PatientsPage />
</ProtectedRoute>
```

Backend:

```python
if role() != "admin":
    return fail("Solo un administrador puede realizar esta accion.", 403)
```

El JWT se acepta desde cookie `HttpOnly` o header:

```text
Authorization: Bearer JWT
```

## Seguridad

- Contrasenas con bcrypt.
- JWT firmado con `JWT_SECRET_KEY`.
- Token de invitacion aleatorio, hasheado en base de datos y de un solo uso.
- Expiracion configurable, por defecto 24 horas.
- Cuenta de doctor inactiva hasta aceptar invitacion.
- Creacion directa de doctores bloqueada en `/doctors/api`.
- Rutas React protegidas por rol.
- Rutas Flask revisan rol desde JWT/sesion.
- Passwords SHA antiguos se migran a bcrypt automaticamente en el siguiente login exitoso.
