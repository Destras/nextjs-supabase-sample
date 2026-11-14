-- Seeds the documentos_legales v1.0 rows (consentimiento informado +
-- terminos y condiciones) that the mobile app must accept before account
-- creation.
--
-- NOTA: en esta copia de muestra ambos textos son de EJEMPLO, no los
-- documentos legales reales.
--
-- DML is not captured by `supabase db diff` (see supabase-migration skill
-- caveats) -- hand-authored, mirroring the precedent at
-- 20260830170000_seed_estado_baja_voluntaria.sql (literal values,
-- `on conflict (...) do nothing`).
--
-- NORMALIZATION RULE (the mobile app's hardcoded consent constant MUST
-- reproduce these exact bytes, and supabase/tests/legal_documents.sql
-- BLOCK 11 pins the resulting hash):
--   1. UTF-8 encoding.
--   2. LF line endings only.
--   3. NO trailing newline -- contenido_md's last byte is the last character
--      of the document text, not a newline.
--   4. Hash recipe used by the drift guard:
--      encode(sha256(convert_to(contenido_md, 'UTF8')), 'hex')
--      Pinned consent v1.0 value: 351d070db8e3d4f854a60e07187ed9de9f3ce9bbfe2b389b7dd92cb270622b08
--
-- publicado_at: consent = 2026-09-13 00:00 -03 (fixed publication date,
-- matches the literal date embedded in the text -- NOT now()). terms =
-- 2026-08-29 00:00 -03 (matches "Última actualización").

insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
values (
  'CONSENTIMIENTO_APP_PACIENTE',
  '1.0',
  'Consentimiento informado — Aurora',
  $consentimiento_v1$## Consentimiento informado — Aurora (texto de ejemplo)

**Versión 1.0 — 13 de septiembre de 2026**

> Este es un texto de ejemplo para la copia de muestra del proyecto. No es el documento legal real.

### Sobre el programa

Al iniciar el programa aceptás participar de un proceso de acompañamiento organizado en etapas. El programa **no es una práctica médica ni psicológica** y no reemplaza ningún tratamiento indicado por un profesional de la salud.

### Sobre el registro mensual

Una vez al mes vas a completar un breve registro en la aplicación. Tu tratante puede verlo para acompañarte mejor.

### Sobre tu participación

Podés interrumpir el proceso en cualquier momento y por cualquier motivo.

### Sobre tus datos

Tus datos se tratan según la Política de Privacidad. Podés pedir la eliminación de tu cuenta desde la aplicación.

### Declaración

Leí y comprendí este documento.$consentimiento_v1$,
  '2026-09-13 00:00:00-03'
)
on conflict (tipo, version) do nothing;

insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
values (
  'TERMINOS_CONDICIONES_APP_PACIENTE',
  '1.0',
  'Términos y condiciones de uso',
  $terminos_v1$# Términos y condiciones de uso (texto de ejemplo)

**Aplicación:** Aurora
**Titular:** Empresa de Ejemplo S.A.
**Última actualización:** 29 de agosto de 2026

> Este es un texto de ejemplo para la copia de muestra del proyecto. No es el documento legal real.

## 1. Aceptación

Al crear una cuenta o utilizar la aplicación, aceptás estos términos.

## 2. Uso de la cuenta

La cuenta es personal. Si detectás un uso no autorizado, avisá a soporte@aurora.example.

## 3. Cambios

Podemos actualizar estos términos. Si el cambio es sustancial, te lo vamos a notificar antes de que entre en vigencia.$terminos_v1$,
  '2026-08-29 00:00:00-03'
)
on conflict (tipo, version) do nothing;
