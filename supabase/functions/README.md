# Edge Functions

Edge Functions (Deno) del backend. Todas desactivan el `verify_jwt` built-in y validan
la autorización en código, porque necesitan leer claims del token o aceptar más de un
tipo de llamador (ver `supabase/config.toml`).

| Función                 | Incluida | Qué hace                                                                                                                                                 |
| ----------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `terapeuta-invitations` | ✅       | Ciclo de vida de la invitación de terapeutas (invitar, reenviar, revocar, desactivar, reactivar). Solo admins; usa la Auth Admin API con `service_role`. |
| `paciente-cuenta`       | ✅       | Baja voluntaria de la cuenta del paciente. El `user_id` sale del claim `sub` del token, nunca del body, para evitar un IDOR.                             |
| `patient-activation`    | ❌       | Activación de la cuenta del paciente desde la app mobile con un código de un solo uso más un segundo factor.                                             |
| `paciente-auth`         | ❌       | Cambio de contraseña del paciente con un código enviado al teléfono de la ficha.                                                                         |
| `paciente-invitacion`   | ❌       | Emisión y entrega por WhatsApp del mensaje de bienvenida y del código de activación.                                                                     |

## Por qué faltan tres funciones

Esta es una versión pública de muestra de un sistema que está en producción. Las
funciones marcadas con ❌ son endpoints públicos (sin sesión) que implementan los flujos
de autenticación del paciente. Su código, y el de las funciones SQL que usan
(`supabase/schemas/73_otps_functions.sql`), se omite a propósito: las funciones SQL
conservan la firma, los permisos y los grants, pero el cuerpo es un stub que lanza una
excepción.

Efectos en esta copia:

- El webconsole sigue invocando `paciente-invitacion` al guardar un plan
  (`app/controllers/Paciente/api/dispararInvitacion.ts`). La llamada falla y la UI lo
  trata como "no se pudo saber si salió el mensaje", que es un caso ya contemplado.
- No hay tests de esos flujos en `supabase/tests/`.

## Principios de diseño de los flujos omitidos

- Los códigos se guardan hasheados con HMAC-SHA256 y un pepper que vive en Supabase Vault;
  el texto plano nunca se persiste.
- Las funciones SQL son `security definer` con `search_path = ''` y solo las ejecuta
  `service_role`: ni `anon` ni `authenticated` tienen `EXECUTE`.
- El pedido de un código responde siempre lo mismo, exista o no la ficha.
- La entrega por WhatsApp falla cerrada: sin proveedor configurado, no hay envío.
