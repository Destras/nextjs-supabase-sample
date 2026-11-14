import { FIELD_VALIDATORS, validateStep } from './validators'

const baseState = {
  paso: 1 as const,
  identidad: {
    nombre: 'Ana García',
    fechaNacimiento: '1990-05-15',
    email: 'ana@example.com',
    telefono: '+5491155550070',
  },
  diagnostico: {
    causaId: 'c-1',
    bloqueoIds: [],
    algoritmoId: 'a-1',
  },
  plan: {
    modalidadId: 'm-1',
    alfabetos: [],
  },
}

describe('FIELD_VALIDATORS', () => {
  it('returns null for valid identidad.nombre', () => {
    expect(FIELD_VALIDATORS['identidad.nombre'](baseState)).toBeNull()
  })

  it('returns an error for empty identidad.nombre', () => {
    const state = {
      ...baseState,
      identidad: { ...baseState.identidad, nombre: '' },
    }
    expect(FIELD_VALIDATORS['identidad.nombre'](state)).toBe(
      'El nombre es requerido',
    )
  })

  it('returns an error for missing diagnostico.causaId', () => {
    const state = {
      ...baseState,
      diagnostico: { ...baseState.diagnostico, causaId: null as string | null },
    }
    expect(FIELD_VALIDATORS['diagnostico.causaId'](state)).toBe(
      'Seleccioná una causa raíz',
    )
  })

  it('returns an error for missing plan.modalidadId', () => {
    const state = {
      ...baseState,
      plan: { ...baseState.plan, modalidadId: null as string | null },
    }
    expect(FIELD_VALIDATORS['plan.modalidadId'](state)).toBe(
      'Seleccioná una modalidad',
    )
  })

  // email is now required
  it('returns El email es requerido for empty identidad.email', () => {
    const state = {
      ...baseState,
      identidad: { ...baseState.identidad, email: '' },
    }
    expect(FIELD_VALIDATORS['identidad.email'](state)).toBe(
      'El email es requerido',
    )
  })

  it('returns El email es requerido for blank-only identidad.email', () => {
    const state = {
      ...baseState,
      identidad: { ...baseState.identidad, email: '   ' },
    }
    expect(FIELD_VALIDATORS['identidad.email'](state)).toBe(
      'El email es requerido',
    )
  })

  it('returns Email inválido for a non-empty malformed email', () => {
    const state = {
      ...baseState,
      identidad: { ...baseState.identidad, email: 'notanemail' },
    }
    expect(FIELD_VALIDATORS['identidad.email'](state)).toBe('Email inválido')
  })

  it('returns null for a valid email', () => {
    expect(FIELD_VALIDATORS['identidad.email'](baseState)).toBeNull()
  })

  // telefono is now required (canal de entrega del OTP por WhatsApp)
  it('returns El teléfono es requerido for empty identidad.telefono', () => {
    const state = {
      ...baseState,
      identidad: { ...baseState.identidad, telefono: '' },
    }
    expect(FIELD_VALIDATORS['identidad.telefono'](state)).toBe(
      'El teléfono es requerido',
    )
  })

  it('returns TELEFONO_INVALIDO for a telefono that does not normalize (no country code)', () => {
    const state = {
      ...baseState,
      identidad: { ...baseState.identidad, telefono: '011 15 55550070' },
    }
    expect(FIELD_VALIDATORS['identidad.telefono'](state)).toBe(
      'Teléfono inválido: tiene que ser un número argentino, con código de área y sin el 0 ni el 15.',
    )
  })

  it('returns TELEFONO_INVALIDO for a telefono that is too short after normalization', () => {
    const state = {
      ...baseState,
      identidad: { ...baseState.identidad, telefono: '+549115555' },
    }
    expect(FIELD_VALIDATORS['identidad.telefono'](state)).toBe(
      'Teléfono inválido: tiene que ser un número argentino, con código de área y sin el 0 ni el 15.',
    )
  })

  it('returns null for a valid telefono with the leading 9', () => {
    const state = {
      ...baseState,
      identidad: { ...baseState.identidad, telefono: '+5491155550070' },
    }
    expect(FIELD_VALIDATORS['identidad.telefono'](state)).toBeNull()
  })

  it('returns null for a telefono with spaces and dashes that normalizes', () => {
    const state = {
      ...baseState,
      identidad: {
        ...baseState.identidad,
        telefono: '+54 9 11-5555-0070',
      },
    }
    expect(FIELD_VALIDATORS['identidad.telefono'](state)).toBeNull()
  })
})

describe('validateStep', () => {
  it('returns empty errors for a fully valid paso 1', () => {
    expect(validateStep(1, baseState)).toEqual({})
  })

  it('returns all errors for paso 1 with empty identidad', () => {
    const state = {
      ...baseState,
      identidad: {
        nombre: '',
        fechaNacimiento: null,
        email: 'invalid',
        telefono: '',
      },
    }
    expect(validateStep(1, state)).toEqual({
      'identidad.nombre': 'El nombre es requerido',
      'identidad.email': 'Email inválido',
      'identidad.telefono': 'El teléfono es requerido',
      'identidad.fechaNacimiento': 'La fecha de nacimiento es requerida',
    })
  })

  it('returns El email es requerido for paso 1 with empty email', () => {
    const state = {
      ...baseState,
      identidad: { ...baseState.identidad, email: '' },
    }
    expect(validateStep(1, state)).toEqual({
      'identidad.email': 'El email es requerido',
    })
  })

  it('returns El teléfono es requerido for paso 1 with empty telefono', () => {
    const state = {
      ...baseState,
      identidad: { ...baseState.identidad, telefono: '' },
    }
    expect(validateStep(1, state)).toEqual({
      'identidad.telefono': 'El teléfono es requerido',
    })
  })

  it('returns errors only for paso 2 fields when validating step 2', () => {
    const state = {
      ...baseState,
      identidad: { ...baseState.identidad, nombre: '' },
      diagnostico: { ...baseState.diagnostico, causaId: null as string | null },
    }
    const errors = validateStep(2, state)
    expect(errors).toEqual({
      'diagnostico.causaId': 'Seleccioná una causa raíz',
    })
    expect(errors['identidad.nombre']).toBeUndefined()
  })

  it('returns errors only for paso 3 fields when validating step 3', () => {
    const state = {
      ...baseState,
      plan: { ...baseState.plan, modalidadId: null as string | null },
    }
    expect(validateStep(3, state)).toEqual({
      'plan.modalidadId': 'Seleccioná una modalidad',
    })
  })
})

describe('FIELD_VALIDATORS — identidad.fechaNacimiento boundary', () => {
  const stateWith = (fechaNacimiento: string | null) => ({
    ...baseState,
    identidad: { ...baseState.identidad, fechaNacimiento },
  })

  // DOB is now required (2º factor del OTP en la activación)
  it('rejects null fecha as required', () => {
    expect(FIELD_VALIDATORS['identidad.fechaNacimiento'](stateWith(null))).toBe(
      'La fecha de nacimiento es requerida',
    )
  })

  it('rejects empty fecha as required', () => {
    expect(FIELD_VALIDATORS['identidad.fechaNacimiento'](stateWith(''))).toBe(
      'La fecha de nacimiento es requerida',
    )
  })

  it('accepts the lower boundary 1900-01-01', () => {
    // Regression: previous impl used `new Date('1900-01-01')` which resolves
    // to UTC midnight and reports year=1899 in negative-UTC timezones.
    expect(
      FIELD_VALIDATORS['identidad.fechaNacimiento'](stateWith('1900-01-01')),
    ).toBeNull()
  })

  it('rejects 1899-12-31 as below the minimum', () => {
    expect(
      FIELD_VALIDATORS['identidad.fechaNacimiento'](stateWith('1899-12-31')),
    ).toBe('Año mínimo 1900')
  })

  it('accepts a date deep in the valid range', () => {
    expect(
      FIELD_VALIDATORS['identidad.fechaNacimiento'](stateWith('1990-05-15')),
    ).toBeNull()
  })

  it('rejects a malformed date string', () => {
    expect(
      FIELD_VALIDATORS['identidad.fechaNacimiento'](stateWith('not-a-date')),
    ).toBe('Fecha inválida')
  })
})
