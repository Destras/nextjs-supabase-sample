import {
  withCausa,
  withBloqueoToggled,
  withAlgoritmo,
  withModalidad,
  withAlfabetos,
} from './formStateTransitions'
import type { DiagnosticoPlanState } from './formStateTransitions'

interface StateWithExtra extends DiagnosticoPlanState {
  readonly identidad: { readonly nombre: string }
}

describe('withCausa', () => {
  let state: StateWithExtra

  beforeEach(() => {
    state = {
      identidad: { nombre: 'Ana' },
      diagnostico: { causaId: null, bloqueoIds: [], algoritmoId: null },
      plan: { modalidadId: null, alfabetos: [] },
    }
  })

  it('sets diagnostico.causaId', () => {
    expect(withCausa(state, 'c-1').diagnostico.causaId).toBe('c-1')
  })

  it('preserves an extra field outside diagnostico/plan', () => {
    expect(withCausa(state, 'c-1').identidad).toEqual({ nombre: 'Ana' })
  })
})

describe('withBloqueoToggled', () => {
  let state: StateWithExtra

  beforeEach(() => {
    state = {
      identidad: { nombre: 'Ana' },
      diagnostico: { causaId: null, bloqueoIds: [], algoritmoId: null },
      plan: { modalidadId: null, alfabetos: [] },
    }
  })

  it('adds the bloqueo id when not present', () => {
    expect(withBloqueoToggled(state, 'b-1').diagnostico.bloqueoIds).toEqual([
      'b-1',
    ])
  })

  it('removes the bloqueo id when already present', () => {
    const withOne = withBloqueoToggled(state, 'b-1')
    expect(withBloqueoToggled(withOne, 'b-1').diagnostico.bloqueoIds).toEqual(
      [],
    )
  })

  it('preserves an extra field outside diagnostico/plan', () => {
    expect(withBloqueoToggled(state, 'b-1').identidad).toEqual({
      nombre: 'Ana',
    })
  })
})

describe('withAlgoritmo', () => {
  let state: StateWithExtra

  beforeEach(() => {
    state = {
      identidad: { nombre: 'Ana' },
      diagnostico: { causaId: null, bloqueoIds: [], algoritmoId: null },
      plan: { modalidadId: null, alfabetos: [] },
    }
  })

  it('sets diagnostico.algoritmoId', () => {
    expect(withAlgoritmo(state, 'a-1').diagnostico.algoritmoId).toBe('a-1')
  })

  it('preserves an extra field outside diagnostico/plan', () => {
    expect(withAlgoritmo(state, 'a-1').identidad).toEqual({ nombre: 'Ana' })
  })
})

describe('withModalidad', () => {
  let state: StateWithExtra

  beforeEach(() => {
    state = {
      identidad: { nombre: 'Ana' },
      diagnostico: { causaId: null, bloqueoIds: [], algoritmoId: null },
      plan: { modalidadId: null, alfabetos: [] },
    }
  })

  it('sets plan.modalidadId', () => {
    expect(withModalidad(state, 'm-1').plan.modalidadId).toBe('m-1')
  })

  it('preserves an extra field outside diagnostico/plan', () => {
    expect(withModalidad(state, 'm-1').identidad).toEqual({ nombre: 'Ana' })
  })
})

describe('withAlfabetos', () => {
  let state: StateWithExtra

  beforeEach(() => {
    state = {
      identidad: { nombre: 'Ana' },
      diagnostico: { causaId: null, bloqueoIds: [], algoritmoId: null },
      plan: {
        modalidadId: null,
        alfabetos: [{ alfabetoId: 'af-1', numeros: [1] }],
      },
    }
  })

  it('replaces plan.alfabetos', () => {
    const next = [{ alfabetoId: 'af-2', numeros: [4, 7] }]
    expect(withAlfabetos(state, next).plan.alfabetos).toEqual(next)
  })

  it('preserves an extra field outside diagnostico/plan', () => {
    expect(withAlfabetos(state, []).identidad).toEqual({ nombre: 'Ana' })
  })
})
