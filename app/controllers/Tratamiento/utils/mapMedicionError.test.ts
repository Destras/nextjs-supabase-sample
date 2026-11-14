import { mapMedicionError } from './mapMedicionError'
import type { MedicionRpcError } from '../TratamientoTypes'

const buildError = (
  overrides: Partial<MedicionRpcError> = {},
): MedicionRpcError => ({
  code: '42501',
  message: 'no_autorizado',
  details: null,
  hint: null,
  ...overrides,
})

describe('mapMedicionError', () => {
  it('maps no_autorizado to the permission-denied copy', () => {
    const error = buildError({ code: '42501', message: 'no_autorizado' })
    expect(mapMedicionError(error)).toEqual({
      mensaje: 'No tenés permiso para registrar mediciones de este paciente.',
      campo: null,
      debeRefetchear: false,
    })
  })

  it('maps medicion_no_editable with motivo "otro_terapeuta" to its specific copy', () => {
    const error = buildError({
      code: '42501',
      message: 'medicion_no_editable',
      details: 'otro_terapeuta',
    })
    expect(mapMedicionError(error)).toEqual({
      mensaje:
        'Esta medición fue registrada por otro terapeuta y no se puede editar.',
      campo: null,
      debeRefetchear: false,
    })
  })

  it('maps medicion_no_editable with an unknown motivo to a generic not-editable copy', () => {
    const error = buildError({
      code: '42501',
      message: 'medicion_no_editable',
      details: 'algo_no_documentado',
    })
    expect(mapMedicionError(error)).toEqual({
      mensaje: 'Esta medición no se puede editar.',
      campo: null,
      debeRefetchear: false,
    })
  })

  it('falls back to the generic copy when the motivo is named like an Object.prototype member', () => {
    const error = buildError({
      code: '42501',
      message: 'medicion_no_editable',
      details: 'constructor',
    })
    expect(mapMedicionError(error)).toEqual({
      mensaje: 'Esta medición no se puede editar.',
      campo: null,
      debeRefetchear: false,
    })
  })

  it('distinguishes the overloaded 42501 by message, not by code', () => {
    const noAutorizado = buildError({ code: '42501', message: 'no_autorizado' })
    const noEditable = buildError({
      code: '42501',
      message: 'medicion_no_editable',
      details: 'no_es_ultima',
    })
    expect(mapMedicionError(noAutorizado).mensaje).not.toEqual(
      mapMedicionError(noEditable).mensaje,
    )
  })

  it('maps etapa_no_iniciada to the "not started" copy', () => {
    const error = buildError({ code: 'P0001', message: 'etapa_no_iniciada' })
    expect(mapMedicionError(error)).toEqual({
      mensaje: 'La medición empieza cuando arranca la etapa.',
      campo: null,
      debeRefetchear: false,
    })
  })

  it('maps conflicto_medicion (PT409 -> HTTP 409) to the §7.2 concurrency copy and flags a refetch', () => {
    const error = buildError({ code: 'PT409', message: 'conflicto_medicion' })
    expect(mapMedicionError(error)).toEqual({
      mensaje:
        'Se registró otra medición mientras cargabas esta. Revisá la última y volvé a intentar.',
      campo: null,
      debeRefetchear: true,
    })
  })

  it('extracts the campo from the detail JSON on valores_invalidos (fuera_de_rango)', () => {
    const error = buildError({
      code: '22023',
      message: 'valores_invalidos',
      details: JSON.stringify({
        motivo: 'fuera_de_rango',
        campo: 'centro-uuid-1',
        valor: 101,
      }),
    })
    expect(mapMedicionError(error).campo).toEqual('centro-uuid-1')
  })

  it('resolves campo to null on a set-level valores_invalidos error (centros_faltantes)', () => {
    const error = buildError({
      code: '22023',
      message: 'valores_invalidos',
      details: JSON.stringify({
        motivo: 'centros_faltantes',
        campos: ['centro-uuid-1', 'centro-uuid-2'],
      }),
    })
    expect(mapMedicionError(error).campo).toEqual(null)
  })

  it('resolves campo to null when details is not valid JSON (defensive, per #324)', () => {
    const error = buildError({
      code: '22023',
      message: 'valores_invalidos',
      details: 'not json at all',
    })
    expect(mapMedicionError(error).campo).toEqual(null)
  })

  it('resolves campo to null when details is null on valores_invalidos', () => {
    const error = buildError({
      code: '22023',
      message: 'valores_invalidos',
      details: null,
    })
    expect(mapMedicionError(error).campo).toEqual(null)
  })

  it('maps a generic not-found error (etapa_no_encontrada) to the generic-refetch copy', () => {
    const error = buildError({ code: 'P0002', message: 'etapa_no_encontrada' })
    const result = mapMedicionError(error)
    expect(result.debeRefetchear).toBe(true)
  })

  it('maps medicion_cierre_requerida to its defense-in-depth copy', () => {
    const error = buildError({
      code: 'P0001',
      message: 'medicion_cierre_requerida',
    })
    expect(mapMedicionError(error)).toEqual({
      mensaje: 'No se puede cerrar sin registrar la medición.',
      campo: null,
      debeRefetchear: false,
    })
  })

  it('falls back to a generic message for an unrecognized error', () => {
    const error = buildError({ code: 'XXXXX', message: 'algo_no_documentado' })
    expect(mapMedicionError(error)).toEqual({
      mensaje: 'Ocurrió un error inesperado. Intentá de nuevo.',
      campo: null,
      debeRefetchear: false,
    })
  })
})
