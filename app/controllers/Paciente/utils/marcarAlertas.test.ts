import { marcarAlertas } from './marcarAlertas'
import type { Paciente } from '../PacienteTypes'
import { PACIENTE_STATE } from '../PacienteTypes'
import type { Alerta } from '../../Alerta'
import { ALERTA_TIPO } from '../../Alerta'

const buildPaciente = (overrides: Partial<Paciente> = {}): Paciente =>
  ({
    id: 'p-1',
    nombre: 'Juan',
    tieneAlerta: false,
    ultimoScore: null,
    state: PACIENTE_STATE.ACTIVE,
    ...overrides,
  }) as Paciente

const buildAlerta = (overrides: Partial<Alerta> = {}): Alerta =>
  ({
    tipo: ALERTA_TIPO.MES_3,
    pacienteId: 'p-1',
    eventoRef: 'ev-1',
    ...overrides,
  }) as Alerta

describe('marcarAlertas', () => {
  let pacientes: ReadonlyArray<Paciente>

  beforeEach(() => {
    pacientes = [buildPaciente({ id: 'p-1' }), buildPaciente({ id: 'p-2' })]
  })

  it('marca al paciente que tiene una alerta activa', () => {
    const result = marcarAlertas(pacientes, [
      buildAlerta({ pacienteId: 'p-1' }),
    ])

    expect(result[0].tieneAlerta).toBe(true)
  })

  it('no marca al paciente que no tiene ninguna alerta', () => {
    const result = marcarAlertas(pacientes, [
      buildAlerta({ pacienteId: 'p-1' }),
    ])

    expect(result[1].tieneAlerta).toBe(false)
  })

  it('marca por CUALQUIER tipo de alerta, no solo score_bajo — un mes_3 también cuenta', () => {
    const result = marcarAlertas(pacientes, [
      buildAlerta({ pacienteId: 'p-2', tipo: ALERTA_TIPO.EVAL_VENCIDA }),
    ])

    expect(result[1].tieneAlerta).toBe(true)
  })

  it('un paciente con score bajo pero SIN alerta activa no queda marcado — la alerta fue atendida', () => {
    const conScoreBajo = [buildPaciente({ id: 'p-3', ultimoScore: 2 })]

    expect(marcarAlertas(conScoreBajo, [])[0].tieneAlerta).toBe(false)
  })

  it('sin alertas devuelve a todos sin marcar', () => {
    expect(marcarAlertas(pacientes, []).every((p) => !p.tieneAlerta)).toBe(true)
  })
})
