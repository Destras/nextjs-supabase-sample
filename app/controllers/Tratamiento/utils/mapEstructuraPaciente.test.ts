import { mapEstructuraPaciente } from './mapEstructuraPaciente'
import type { EstructuraPacienteRaw } from './mapEstructuraPaciente'
import { EtapaStatus } from '../TratamientoTypes'

const baseValor = {
  centro_id: 'centro-1',
  codigo: 'CE-01',
  nombre: 'Corona',
  orden: 1,
  activo: true,
  valor: 70,
}

const buildRaw = (
  overrides: Partial<EstructuraPacienteRaw> = {},
): EstructuraPacienteRaw => ({
  paciente_id: 'paciente-1',
  puede_medir: true,
  es_admin: false,
  centros_activos: [
    {
      id: 'centro-1',
      codigo: 'CE-01',
      nombre: 'Corona',
      etiqueta_paciente: 'Corona',
      orden: 1,
    },
  ],
  etapas: [],
  ...overrides,
})

describe('mapEstructuraPaciente', () => {
  it('maps the top-level paciente fields', () => {
    const raw = buildRaw({
      paciente_id: 'p-9',
      puede_medir: false,
      es_admin: true,
    })
    const result = mapEstructuraPaciente(raw)
    expect({
      pacienteId: result.pacienteId,
      puedeMedir: result.puedeMedir,
      esAdmin: result.esAdmin,
    }).toEqual({ pacienteId: 'p-9', puedeMedir: false, esAdmin: true })
  })

  it('maps centrosActivos renaming etiqueta_paciente to etiquetaPaciente', () => {
    const raw = buildRaw({
      centros_activos: [
        {
          id: 'centro-1',
          codigo: 'CE-01',
          nombre: 'Corona',
          etiqueta_paciente: 'Mi Corona',
          orden: 1,
        },
      ],
    })
    const result = mapEstructuraPaciente(raw)
    expect(result.centrosActivos).toEqual([
      {
        id: 'centro-1',
        codigo: 'CE-01',
        nombre: 'Corona',
        etiquetaPaciente: 'Mi Corona',
        orden: 1,
      },
    ])
  })

  it.each([
    ['pendiente', EtapaStatus.PENDIENTE],
    ['activa', EtapaStatus.EN_CURSO],
    ['finalizada', EtapaStatus.FINALIZADA],
    ['abandonada', EtapaStatus.ABANDONADA],
  ])('maps etapa.estado "%s" to EtapaStatus.%s', (estado, expected) => {
    const raw = buildRaw({
      etapas: [
        {
          id: 'etapa-1',
          ordinal: 1,
          fecha_inicio: '2025-01-01',
          fecha_finalizacion: null,
          estado,
          iniciada: true,
          mediciones: [],
        },
      ],
    })
    const result = mapEstructuraPaciente(raw)
    expect(result.etapas[0].estado).toEqual(expected)
  })

  it('sets medicionActual to null when the etapa has no mediciones', () => {
    const raw = buildRaw({
      etapas: [
        {
          id: 'etapa-1',
          ordinal: 1,
          fecha_inicio: null,
          fecha_finalizacion: null,
          estado: 'pendiente',
          iniciada: false,
          mediciones: [],
        },
      ],
    })
    const result = mapEstructuraPaciente(raw)
    expect(result.etapas[0].medicionActual).toEqual(null)
  })

  it('sets medicionActual to the last medicion of the etapa', () => {
    const raw = buildRaw({
      etapas: [
        {
          id: 'etapa-1',
          ordinal: 1,
          fecha_inicio: '2025-01-01',
          fecha_finalizacion: null,
          estado: 'activa',
          iniciada: true,
          mediciones: [
            {
              id: 'med-1',
              momento: 'apertura',
              estructura_general: 50,
              registrada_en: '2025-01-01T00:00:00Z',
              registrada_por: { id: 't-1', nombre: 'Ana' },
              copiada_de: null,
              es_propia: true,
              editable: false,
              editable_motivo: 'no_es_ultima',
              valores: [baseValor],
            },
            {
              id: 'med-2',
              momento: 'seguimiento',
              estructura_general: 60,
              registrada_en: '2025-02-01T00:00:00Z',
              registrada_por: { id: 't-1', nombre: 'Ana' },
              copiada_de: null,
              es_propia: true,
              editable: true,
              editable_motivo: null,
              valores: [{ ...baseValor, valor: 80 }],
            },
          ],
        },
      ],
    })
    const result = mapEstructuraPaciente(raw)
    expect(result.etapas[0].medicionActual?.id).toEqual('med-2')
  })

  it('suppresses deltaEstructura for the first medicion of an etapa (apertura)', () => {
    const raw = buildRaw({
      etapas: [
        {
          id: 'etapa-1',
          ordinal: 1,
          fecha_inicio: '2025-01-01',
          fecha_finalizacion: null,
          estado: 'activa',
          iniciada: true,
          mediciones: [
            {
              id: 'med-1',
              momento: 'apertura',
              estructura_general: 50,
              registrada_en: '2025-01-01T00:00:00Z',
              registrada_por: { id: 't-1', nombre: 'Ana' },
              copiada_de: null,
              es_propia: true,
              editable: false,
              editable_motivo: 'no_es_ultima',
              valores: [baseValor],
            },
          ],
        },
      ],
    })
    const result = mapEstructuraPaciente(raw)
    expect(result.etapas[0].mediciones[0].deltaEstructura).toEqual(null)
  })

  it('computes deltaEstructura for a seguimiento against the previous medicion of the same etapa', () => {
    const raw = buildRaw({
      etapas: [
        {
          id: 'etapa-1',
          ordinal: 1,
          fecha_inicio: '2025-01-01',
          fecha_finalizacion: null,
          estado: 'activa',
          iniciada: true,
          mediciones: [
            {
              id: 'med-1',
              momento: 'apertura',
              estructura_general: 50,
              registrada_en: '2025-01-01T00:00:00Z',
              registrada_por: { id: 't-1', nombre: 'Ana' },
              copiada_de: null,
              es_propia: true,
              editable: false,
              editable_motivo: 'no_es_ultima',
              valores: [baseValor],
            },
            {
              id: 'med-2',
              momento: 'seguimiento',
              estructura_general: 65,
              registrada_en: '2025-02-01T00:00:00Z',
              registrada_por: { id: 't-1', nombre: 'Ana' },
              copiada_de: null,
              es_propia: true,
              editable: true,
              editable_motivo: null,
              valores: [{ ...baseValor, valor: 90 }],
            },
          ],
        },
      ],
    })
    const result = mapEstructuraPaciente(raw)
    expect(result.etapas[0].mediciones[1].deltaEstructura).toEqual(15)
  })

  it('computes the per-centro delta against the same centro in the previous medicion', () => {
    const raw = buildRaw({
      etapas: [
        {
          id: 'etapa-1',
          ordinal: 1,
          fecha_inicio: '2025-01-01',
          fecha_finalizacion: null,
          estado: 'activa',
          iniciada: true,
          mediciones: [
            {
              id: 'med-1',
              momento: 'apertura',
              estructura_general: 50,
              registrada_en: '2025-01-01T00:00:00Z',
              registrada_por: { id: 't-1', nombre: 'Ana' },
              copiada_de: null,
              es_propia: true,
              editable: false,
              editable_motivo: 'no_es_ultima',
              valores: [{ ...baseValor, valor: 70 }],
            },
            {
              id: 'med-2',
              momento: 'seguimiento',
              estructura_general: 65,
              registrada_en: '2025-02-01T00:00:00Z',
              registrada_por: { id: 't-1', nombre: 'Ana' },
              copiada_de: null,
              es_propia: true,
              editable: true,
              editable_motivo: null,
              valores: [{ ...baseValor, valor: 90 }],
            },
          ],
        },
      ],
    })
    const result = mapEstructuraPaciente(raw)
    expect(result.etapas[0].mediciones[1].valores[0].delta).toEqual(20)
  })

  it('resolves the per-centro delta to null for a new centro absent from the previous medicion', () => {
    const raw = buildRaw({
      etapas: [
        {
          id: 'etapa-1',
          ordinal: 1,
          fecha_inicio: '2025-01-01',
          fecha_finalizacion: null,
          estado: 'activa',
          iniciada: true,
          mediciones: [
            {
              id: 'med-1',
              momento: 'apertura',
              estructura_general: 50,
              registrada_en: '2025-01-01T00:00:00Z',
              registrada_por: { id: 't-1', nombre: 'Ana' },
              copiada_de: null,
              es_propia: true,
              editable: false,
              editable_motivo: 'no_es_ultima',
              valores: [baseValor],
            },
            {
              id: 'med-2',
              momento: 'seguimiento',
              estructura_general: 65,
              registrada_en: '2025-02-01T00:00:00Z',
              registrada_por: { id: 't-1', nombre: 'Ana' },
              copiada_de: null,
              es_propia: true,
              editable: true,
              editable_motivo: null,
              valores: [
                baseValor,
                {
                  centro_id: 'centro-2',
                  codigo: 'CE-02',
                  nombre: 'Garganta',
                  orden: 2,
                  activo: true,
                  valor: 40,
                },
              ],
            },
          ],
        },
      ],
    })
    const result = mapEstructuraPaciente(raw)
    const nuevo = result.etapas[0].mediciones[1].valores.find(
      (v) => v.centroId === 'centro-2',
    )
    expect(nuevo?.delta).toEqual(null)
  })

  it('keeps a deactivated centro in valores with activo false, without dropping it', () => {
    const raw = buildRaw({
      etapas: [
        {
          id: 'etapa-1',
          ordinal: 1,
          fecha_inicio: '2025-01-01',
          fecha_finalizacion: null,
          estado: 'activa',
          iniciada: true,
          mediciones: [
            {
              id: 'med-1',
              momento: 'apertura',
              estructura_general: 50,
              registrada_en: '2025-01-01T00:00:00Z',
              registrada_por: { id: 't-1', nombre: 'Ana' },
              copiada_de: null,
              es_propia: true,
              editable: false,
              editable_motivo: 'no_es_ultima',
              valores: [{ ...baseValor, activo: false }],
            },
          ],
        },
      ],
    })
    const result = mapEstructuraPaciente(raw)
    expect(result.etapas[0].mediciones[0].valores[0].activo).toBe(false)
  })

  it('suppresses deltaEstructura for cierre_automatico even though a previous medicion exists', () => {
    const raw = buildRaw({
      etapas: [
        {
          id: 'etapa-1',
          ordinal: 1,
          fecha_inicio: '2025-01-01',
          fecha_finalizacion: '2025-03-01',
          estado: 'abandonada',
          iniciada: true,
          mediciones: [
            {
              id: 'med-1',
              momento: 'apertura',
              estructura_general: 50,
              registrada_en: '2025-01-01T00:00:00Z',
              registrada_por: { id: 't-1', nombre: 'Ana' },
              copiada_de: null,
              es_propia: true,
              editable: false,
              editable_motivo: 'no_es_ultima',
              valores: [baseValor],
            },
            {
              id: 'med-2',
              momento: 'cierre_automatico',
              estructura_general: 50,
              registrada_en: '2025-03-01T00:00:00Z',
              registrada_por: null,
              copiada_de: 'med-1',
              es_propia: false,
              editable: false,
              editable_motivo: 'automatica',
              valores: [baseValor],
            },
          ],
        },
      ],
    })
    const result = mapEstructuraPaciente(raw)
    expect(result.etapas[0].mediciones[1].deltaEstructura).toEqual(null)
  })

  it('maps autor to null when registrada_por is null (cierre_automatico)', () => {
    const raw = buildRaw({
      etapas: [
        {
          id: 'etapa-1',
          ordinal: 1,
          fecha_inicio: '2025-01-01',
          fecha_finalizacion: '2025-03-01',
          estado: 'finalizada',
          iniciada: true,
          mediciones: [
            {
              id: 'med-1',
              momento: 'cierre_automatico',
              estructura_general: 50,
              registrada_en: '2025-03-01T00:00:00Z',
              registrada_por: null,
              copiada_de: 'med-0',
              es_propia: false,
              editable: false,
              editable_motivo: 'automatica',
              valores: [baseValor],
            },
          ],
        },
      ],
    })
    const result = mapEstructuraPaciente(raw)
    expect(result.etapas[0].mediciones[0].autor).toEqual(null)
  })

  it('maps autor to the id/nombre object when registrada_por is present', () => {
    const raw = buildRaw({
      etapas: [
        {
          id: 'etapa-1',
          ordinal: 1,
          fecha_inicio: '2025-01-01',
          fecha_finalizacion: null,
          estado: 'activa',
          iniciada: true,
          mediciones: [
            {
              id: 'med-1',
              momento: 'apertura',
              estructura_general: 50,
              registrada_en: '2025-01-01T00:00:00Z',
              registrada_por: { id: 't-1', nombre: 'Ana Pérez' },
              copiada_de: null,
              es_propia: true,
              editable: false,
              editable_motivo: 'no_es_ultima',
              valores: [baseValor],
            },
          ],
        },
      ],
    })
    const result = mapEstructuraPaciente(raw)
    expect(result.etapas[0].mediciones[0].autor).toEqual({
      id: 't-1',
      nombre: 'Ana Pérez',
    })
  })
})
