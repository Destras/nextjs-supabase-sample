import type { MedicionRpcError, MedicionErrorUi } from '../TratamientoTypes'

// ---------------------------------------------------------------------------
// #324 — verification-deferral constraint (read before touching this file)
//
// All Docker/local-Supabase verification for medir-chakras (including the R1
// REST probe, task 1.17: "does PostgREST surface hint/details to the browser
// client?") was deferred to a single pass at the end of the whole
// implementation. That probe has NOT run — nobody has verified `hint`/
// `details` reach this code as separate wire fields.
//
// Consequence: this mapper reads the offending field name from the `campo`
// key EMBEDDED INSIDE the `22023` error's `detail` JSON string (design part 1
// §1.1: `detail = {"motivo":"fuera_de_rango","campo":"<uuid>","valor":101}`),
// NOT from `hint` (a separate wire field) as an alternative source. This
// removes the dependency on the unrun probe entirely. If the probe later
// shows `hint`/`details` DO surface as expected, that becomes an optional
// simplification — never a rework (see sdd/medir-chakras/verification-
// deferral).
// ---------------------------------------------------------------------------

// Map y no un objeto: `details` viene crudo de la base, e indexar un objeto con
// un valor arbitrario devuelve lo que herede de Object.prototype (`constructor`,
// `toString`, …), que no es nullish y por lo tanto se cuela por el `??` en vez de
// caer al mensaje genérico. Mismo bug que ya apareció en identidadMessages y en
// useEditarPacienteViewModel (activacionPorTelefono, code review).
const MOTIVO_NO_EDITABLE_MENSAJES = new Map<string, string>([
  [
    'automatica',
    'Esta medición fue generada automáticamente al cerrar la etapa y no se puede editar.',
  ],
  [
    'otro_terapeuta',
    'Esta medición fue registrada por otro terapeuta y no se puede editar.',
  ],
  [
    'no_es_ultima',
    'Solo se puede editar la última medición registrada de la etapa.',
  ],
  [
    'etapa_posterior_iniciada',
    'No se puede editar: ya se inició una etapa posterior.',
  ],
  ['sin_asignacion', 'Ya no tenés una asignación activa con este paciente.'],
])

const mapMotivoNoEditable = (details: string | null): string =>
  MOTIVO_NO_EDITABLE_MENSAJES.get(details ?? '') ??
  'Esta medición no se puede editar.'

// Extracts the `campo` key embedded inside the `22023` error's `detail` JSON
// (present for field-level errors like `fuera_de_rango`; absent for
// set-level errors like `centros_faltantes`, which carry `campos` — plural —
// instead). Defensive against malformed/non-JSON `details` — never throws.
const extractCampoFromDetails = (details: string | null): string | null => {
  if (details === null) return null
  try {
    const parsed = JSON.parse(details) as { campo?: unknown }
    return typeof parsed.campo === 'string' ? parsed.campo : null
  } catch {
    return null
  }
}

// Single source of truth for the medicion-estructura error catalog (design
// part 1 §1.9). Switches on `message` — NEVER on `code` — because `42501` is
// overloaded between `no_autorizado` and `medicion_no_editable` (R2); keying
// on `code` alone would make these two indistinguishable.
const mapMedicionError = (error: MedicionRpcError): MedicionErrorUi => {
  switch (error.message) {
    case 'no_autorizado':
      return {
        mensaje: 'No tenés permiso para registrar mediciones de este paciente.',
        campo: null,
        debeRefetchear: false,
      }

    case 'medicion_no_editable':
      return {
        mensaje: mapMotivoNoEditable(error.details),
        campo: null,
        debeRefetchear: false,
      }

    case 'etapa_no_iniciada':
      return {
        mensaje: 'La medición empieza cuando arranca la etapa.',
        campo: null,
        debeRefetchear: false,
      }

    // Wire code PT409 (HTTP 409) — nunca 40001, que PostgREST reintenta en
    // loop hasta un 504 (MED-007). Copy literal de DevSpec §7.2.
    case 'conflicto_medicion':
      return {
        mensaje:
          'Se registró otra medición mientras cargabas esta. Revisá la última y volvé a intentar.',
        campo: null,
        debeRefetchear: true,
      }

    case 'valores_invalidos':
      return {
        mensaje: 'Revisá los valores ingresados.',
        campo: extractCampoFromDetails(error.details),
        debeRefetchear: false,
      }

    case 'etapa_no_encontrada':
    case 'etapa_activa_no_encontrada':
    case 'medicion_no_encontrada':
    case 'etapa_cerrada':
      return {
        mensaje:
          'Ocurrió un problema al procesar la medición. Actualizá la página e intentá de nuevo.',
        campo: null,
        debeRefetchear: true,
      }

    // Defensa en profundidad — la UI nunca debería llegar a levantar esto
    // (el ViewModel enruta a cerrarEtapaConMedicion antes de que el RPC lo
    // evalúe), pero si sucede, no debe quedar sin copy.
    case 'medicion_cierre_requerida':
      return {
        mensaje: 'No se puede cerrar sin registrar la medición.',
        campo: null,
        debeRefetchear: false,
      }

    default:
      return {
        mensaje: 'Ocurrió un error inesperado. Intentá de nuevo.',
        campo: null,
        debeRefetchear: false,
      }
  }
}

export { mapMedicionError }
