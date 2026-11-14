import type { AlfabetoConNumeros } from '@/app/controllers/Paciente'
import { parseFechaNacimiento } from './fechaNacimientoCodec'
import { normalizarTelefonoAr } from '@/lib/telefonoAr'
import { TELEFONO_INVALIDO, TELEFONO_REQUERIDO } from '@/lib/identidadMessages'

interface FormStateShape {
  readonly paso: 1 | 2 | 3
  readonly identidad: {
    readonly nombre: string
    readonly fechaNacimiento: string | null
    readonly email: string
    readonly telefono: string
  }
  readonly diagnostico: {
    readonly causaId: string | null
    readonly bloqueoIds: ReadonlyArray<string>
    readonly algoritmoId: string | null
  }
  readonly plan: {
    readonly modalidadId: string | null
    readonly alfabetos: ReadonlyArray<AlfabetoConNumeros>
  }
}

type FieldPath =
  | 'identidad.nombre'
  | 'identidad.fechaNacimiento'
  | 'identidad.email'
  | 'identidad.telefono'
  | 'diagnostico.causaId'
  | 'diagnostico.algoritmoId'
  | 'plan.modalidadId'

type Validator = (state: FormStateShape) => string | null

const validateNombre: Validator = (s) => {
  const trimmed = s.identidad.nombre.trim()
  if (trimmed.length === 0) return 'El nombre es requerido'
  if (trimmed.length < 2) return 'Mínimo 2 caracteres'
  if (trimmed.length > 120) return 'Máximo 120 caracteres'
  return null
}

const validateFechaNacimiento: Validator = (s) => {
  const v = s.identidad.fechaNacimiento
  if (v === null || v === '') return 'La fecha de nacimiento es requerida'
  // Parse via the codec (pins to local noon) so getFullYear / date
  // comparisons read calendar-day components regardless of timezone offset.
  // Previous impl used `new Date(v)` which interprets 'yyyy-MM-dd' as UTC
  // midnight and drifts to the previous day in negative-UTC offsets — that
  // caused valid 1900-01-01 inputs to report year=1899.
  const date = parseFechaNacimiento(v)
  if (date === undefined || isNaN(date.getTime())) return 'Fecha inválida'
  const year = date.getFullYear()
  if (year < 1900) return 'Año mínimo 1900'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date > today) return 'No puede ser posterior a hoy'
  return null
}

const validateEmail: Validator = (s) => {
  const v = s.identidad.email.trim()
  if (v === '') return 'El email es requerido'
  const regex = /^.+@.+\..+$/
  if (!regex.test(v)) return 'Email inválido'
  return null
}

const validateTelefono: Validator = (s) => {
  const v = s.identidad.telefono.trim()
  if (v === '') return TELEFONO_REQUERIDO
  // Solo UX: espejo de public.normalizar_telefono_ar. La base sigue siendo la
  // autoridad — el ViewModel manda al RPC lo tipeado con `trim`, no esto (DEC-17).
  if (normalizarTelefonoAr(v) === null) return TELEFONO_INVALIDO
  return null
}

const validateCausa: Validator = (s) =>
  s.diagnostico.causaId ? null : 'Seleccioná una causa raíz'

const validateAlgoritmo: Validator = (s) =>
  s.diagnostico.algoritmoId ? null : 'Seleccioná un algoritmo'

const validateModalidad: Validator = (s) =>
  s.plan.modalidadId ? null : 'Seleccioná una modalidad'

const FIELD_VALIDATORS: Record<FieldPath, Validator> = {
  'identidad.nombre': validateNombre,
  'identidad.fechaNacimiento': validateFechaNacimiento,
  'identidad.email': validateEmail,
  'identidad.telefono': validateTelefono,
  'diagnostico.causaId': validateCausa,
  'diagnostico.algoritmoId': validateAlgoritmo,
  'plan.modalidadId': validateModalidad,
}

const PASO_FIELDS: Record<1 | 2 | 3, ReadonlyArray<FieldPath>> = {
  1: [
    'identidad.nombre',
    'identidad.fechaNacimiento',
    'identidad.email',
    'identidad.telefono',
  ],
  2: ['diagnostico.causaId', 'diagnostico.algoritmoId'],
  3: ['plan.modalidadId'],
}

const validateStep = (
  paso: 1 | 2 | 3,
  state: FormStateShape,
): Record<string, string> => {
  const errors: Record<string, string> = {}
  for (const path of PASO_FIELDS[paso]) {
    const error = FIELD_VALIDATORS[path](state)
    if (error !== null) errors[path] = error
  }
  return errors
}

const isStepValid = (paso: 1 | 2 | 3, state: FormStateShape): boolean =>
  Object.keys(validateStep(paso, state)).length === 0

export type { FieldPath, FormStateShape, Validator }
export { FIELD_VALIDATORS, PASO_FIELDS, validateStep, isStepValid }
