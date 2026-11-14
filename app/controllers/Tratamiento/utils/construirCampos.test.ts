import { construirCampos } from './construirCampos'
import type { CentroEnergetico, Medicion } from '@/app/controllers/Tratamiento'

const buildCentro = (
  overrides: Partial<CentroEnergetico> = {},
): CentroEnergetico => ({
  id: 'centro-1',
  codigo: 'CE-01',
  nombre: 'Chakra Corona',
  etiquetaPaciente: 'Chakra Corona',
  orden: 1,
  ...overrides,
})

const buildMedicion = (overrides: Partial<Medicion> = {}): Medicion => ({
  id: 'medicion-1',
  etapaId: 'etapa-1',
  momento: 'apertura',
  estructuraGeneral: 55,
  deltaEstructura: null,
  registradaEn: '2026-01-01T00:00:00Z',
  autor: { id: 'u1', nombre: 'Ana' },
  copiadaDe: null,
  esPropia: true,
  editable: true,
  motivoNoEditable: null,
  valores: [],
  ...overrides,
})

describe('construirCampos', () => {
  it('builds one campo per centro plus estructura general, ordered by orden', () => {
    const centros = [
      buildCentro({ id: 'c2', nombre: 'Garganta', orden: 2 }),
      buildCentro({ id: 'c1', nombre: 'Corona', orden: 1 }),
    ]

    const campos = construirCampos(centros, null)

    expect(campos.map((c) => c.key)).toEqual(['c1', 'c2', 'estructura_general'])
    expect(campos[campos.length - 1]).toEqual({
      key: 'estructura_general',
      label: 'Estructura general',
      centroId: null,
      valorAnterior: null,
    })
  })

  it('all campos have valorAnterior null when there is no previous medición (apertura)', () => {
    const centros = [buildCentro()]

    const campos = construirCampos(centros, null)

    expect(campos.every((c) => c.valorAnterior === null)).toBe(true)
  })

  it('precarga valorAnterior from the previous medición for each centro and estructura general', () => {
    const centros = [
      buildCentro({ id: 'c1', orden: 1 }),
      buildCentro({ id: 'c2', nombre: 'Garganta', orden: 2 }),
    ]
    const previa = buildMedicion({
      estructuraGeneral: 70,
      valores: [
        {
          centroId: 'c1',
          codigo: 'CE-01',
          nombre: 'Corona',
          orden: 1,
          activo: true,
          valor: 60,
          delta: null,
        },
        {
          centroId: 'c2',
          codigo: 'CE-06',
          nombre: 'Garganta',
          orden: 2,
          activo: true,
          valor: 65,
          delta: null,
        },
      ],
    })

    const campos = construirCampos(centros, previa)

    expect(campos.find((c) => c.key === 'c1')?.valorAnterior).toBe(60)
    expect(campos.find((c) => c.key === 'c2')?.valorAnterior).toBe(65)
    expect(
      campos.find((c) => c.key === 'estructura_general')?.valorAnterior,
    ).toBe(70)
  })

  it('a centro missing from the previous medición (recently added) gets valorAnterior null', () => {
    const centros = [buildCentro({ id: 'c-nuevo', orden: 1 })]
    const previa = buildMedicion({ valores: [] })

    const campos = construirCampos(centros, previa)

    expect(campos.find((c) => c.key === 'c-nuevo')?.valorAnterior).toBeNull()
  })

  it('returns only the estructura general campo when there are no active centros', () => {
    const campos = construirCampos([], null)

    expect(campos).toHaveLength(1)
    expect(campos[0].key).toBe('estructura_general')
  })
})
