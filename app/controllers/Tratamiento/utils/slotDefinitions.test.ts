import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'
import {
  SLOT_DEFINITIONS,
  SLOT_KEYS,
  SEMANA_GRID_TEMPLATE,
} from './slotDefinitions'

describe('SLOT_DEFINITIONS', () => {
  it('mirrors the orden→tipo map hard-coded in public.etapa_plan_completo and public.set_entregas_plan (71_rpcs_pacientes.sql) exactly — SQL cannot import TypeScript, so this array is the only thing standing between an edit here and a silent activation-OTP failure on the backend', () => {
    expect(SLOT_DEFINITIONS).toEqual([
      { key: 'meditacion', orden: 1, source: TIPO_CONTENIDO.VIDEO },
      { key: 'mantra', orden: 2, source: TIPO_CONTENIDO.AUDIO },
      { key: 'egregor', orden: 3, source: TIPO_CONTENIDO.EGREGOR },
      { key: 'cma', orden: 4, source: TIPO_CONTENIDO.CMA },
      { key: 'ic', orden: 5, source: TIPO_CONTENIDO.IC },
    ])
  })

  it('contains exactly 5 slot definitions', () => {
    expect(SLOT_DEFINITIONS).toHaveLength(5)
  })
})

describe('SLOT_KEYS', () => {
  it('returns slot keys in order: meditacion, mantra, egregor, cma, ic', () => {
    expect(SLOT_KEYS).toEqual(['meditacion', 'mantra', 'egregor', 'cma', 'ic'])
  })
})

describe('SEMANA_GRID_TEMPLATE', () => {
  it('gives the 6 content columns (5 slots + frases) the same flexible width after the fixed week label, so the whole grid fits a 1440px screen without horizontal scroll (BETA-026)', () => {
    expect(SEMANA_GRID_TEMPLATE).toBe('96px repeat(6, minmax(0, 1fr))')
  })
})
