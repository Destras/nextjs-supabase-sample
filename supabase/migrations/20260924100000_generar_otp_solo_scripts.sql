-- activacionPorTelefono — paciente-invitacion deja de emitir el OTP.
--
-- El código de activación lo pide el paciente desde la app (request-otp →
-- solicitar_otp_activacion, 15 min). Al completarse el plan, el panel solo manda
-- la bienvenida. generar_otp_activacion queda sin callers en las Edge Functions:
-- solo la usan los scripts de dev (.scripts/get-otp.sh, setup-otp-local.sh) y el
-- e2e. Esta migración solo actualiza su comentario; no cambia comportamiento.

comment on function public.generar_otp_activacion(uuid) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';
