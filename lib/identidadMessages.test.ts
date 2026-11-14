import {
  AYUDA_EMAIL_BLOQUEADO,
  TELEFONO_INVALIDO,
  TELEFONO_REQUERIDO,
  FECHA_NACIMIENTO_REQUERIDA,
  EMAIL_DUPLICADO,
  PACIENTE_DADO_DE_BAJA,
  mapIdentidadRpcError,
  resolverEmailDuplicado,
} from './identidadMessages'

describe('mapIdentidadRpcError', () => {
  it('maps telefono_invalido to its copy', () => {
    expect(mapIdentidadRpcError('telefono_invalido')).toBe(TELEFONO_INVALIDO)
  })

  it('maps telefono_requerido to its copy', () => {
    expect(mapIdentidadRpcError('telefono_requerido')).toBe(TELEFONO_REQUERIDO)
  })

  it('maps fecha_nacimiento_requerida to its copy', () => {
    expect(mapIdentidadRpcError('fecha_nacimiento_requerida')).toBe(
      FECHA_NACIMIENTO_REQUERIDA,
    )
  })

  it('maps paciente_dado_de_baja to a legible Spanish message', () => {
    expect(mapIdentidadRpcError('paciente_dado_de_baja')).toBe(
      'Ese email pertenece a un paciente que se dio de baja, así que no se puede usar en otra ficha.',
    )
  })

  it('maps email_duplicado to the generic copy of ADR 0010', () => {
    expect(mapIdentidadRpcError('email_duplicado')).toBe(
      'Ese email ya está registrado en otro paciente. Usá el email propio del paciente.',
    )
  })

  it('maps email_bloqueado_por_cuenta to its Spanish copy', () => {
    expect(mapIdentidadRpcError('email_bloqueado_por_cuenta')).toBe(
      'No se puede cambiar el email: el paciente ya activó su cuenta.',
    )
  })

  it('returns null for any other code', () => {
    expect(mapIdentidadRpcError('no_autorizado')).toBeNull()
  })

  it('returns null for a key inherited from Object.prototype', () => {
    expect(mapIdentidadRpcError('constructor')).toBeNull()
  })
})

describe('AYUDA_EMAIL_BLOQUEADO', () => {
  it('explains why the email cannot be changed, without claiming which email the paciente logs in with', () => {
    expect(AYUDA_EMAIL_BLOQUEADO).toBe(
      'El paciente ya activó su cuenta, así que el email no se puede cambiar desde acá.',
    )
  })
})

describe('resolverEmailDuplicado', () => {
  let ficha: {
    id: string
    nombre: string
    dadoDeBaja: boolean
    accesible: boolean
  }
  let veTodasLasFichas: boolean

  beforeEach(() => {
    ficha = {
      id: 'pac-1',
      nombre: 'Sofía Rodríguez',
      dadoDeBaja: false,
      accesible: true,
    }
    veTodasLasFichas = false
  })

  it('names the ficha and exposes it for the link when the terapeuta has an open asignación', () => {
    expect(resolverEmailDuplicado(ficha, veTodasLasFichas)).toEqual({
      mensaje: 'Ese email ya está en la ficha de Sofía Rodríguez',
      fichaDuplicada: {
        id: 'pac-1',
        nombre: 'Sofía Rodríguez',
        accesible: true,
      },
    })
  })

  it('uses the generic copy, naming nobody, for a ficha whose asignación is closed', () => {
    expect(
      resolverEmailDuplicado({ ...ficha, accesible: false }, veTodasLasFichas),
    ).toEqual({
      mensaje: EMAIL_DUPLICADO,
      fichaDuplicada: null,
    })
  })

  it('uses the generic copy for a ficha dada de baja the terapeuta no longer has open', () => {
    expect(
      resolverEmailDuplicado(
        { ...ficha, dadoDeBaja: true, accesible: false },
        veTodasLasFichas,
      ),
    ).toEqual({
      mensaje: EMAIL_DUPLICADO,
      fichaDuplicada: null,
    })
  })

  it('falls back to the generic copy, naming nobody, when no ficha is visible', () => {
    expect(resolverEmailDuplicado(null, veTodasLasFichas)).toEqual({
      mensaje: EMAIL_DUPLICADO,
      fichaDuplicada: null,
    })
  })

  it('uses the baja copy, without a link, when an own open ficha is dada de baja', () => {
    expect(
      resolverEmailDuplicado({ ...ficha, dadoDeBaja: true }, veTodasLasFichas),
    ).toEqual({
      mensaje: PACIENTE_DADO_DE_BAJA,
      fichaDuplicada: null,
    })
  })

  it('still names, without a link, a ficha with no open asignación for an admin', () => {
    expect(
      resolverEmailDuplicado({ ...ficha, accesible: false }, true),
    ).toEqual({
      mensaje: 'Ese email ya está en la ficha de Sofía Rodríguez',
      fichaDuplicada: {
        id: 'pac-1',
        nombre: 'Sofía Rodríguez',
        accesible: false,
      },
    })
  })

  it('keeps the baja copy for an admin when the ficha is dada de baja', () => {
    expect(
      resolverEmailDuplicado(
        { ...ficha, dadoDeBaja: true, accesible: false },
        true,
      ),
    ).toEqual({
      mensaje: PACIENTE_DADO_DE_BAJA,
      fichaDuplicada: null,
    })
  })
})
