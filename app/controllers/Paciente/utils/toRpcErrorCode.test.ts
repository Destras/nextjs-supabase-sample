import { toRpcErrorCode } from './toRpcErrorCode'

describe('toRpcErrorCode', () => {
  let duplicateKeyMessage: string

  beforeEach(() => {
    duplicateKeyMessage =
      'duplicate key value violates unique constraint "pacientes_email_key"'
  })

  it('returns email_duplicado for a 23505 on pacientes_email_key', () => {
    expect(
      toRpcErrorCode({ code: '23505', message: duplicateKeyMessage }),
    ).toBe('email_duplicado')
  })

  it('returns the raw message for a 23505 on another constraint', () => {
    expect(
      toRpcErrorCode({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "pacientes_pkey"',
      }),
    ).toBe('duplicate key value violates unique constraint "pacientes_pkey"')
  })

  it('returns the raw message when the constraint is named under another code', () => {
    expect(
      toRpcErrorCode({ code: 'P0001', message: duplicateKeyMessage }),
    ).toBe(duplicateKeyMessage)
  })

  it('returns the raw message when the error carries no code', () => {
    expect(toRpcErrorCode({ message: 'paciente_dado_de_baja' })).toBe(
      'paciente_dado_de_baja',
    )
  })

  it('returns numeros_invalidos for the range trigger message', () => {
    expect(toRpcErrorCode({ message: 'alfabeto_numero_fuera_de_rango' })).toBe(
      'numeros_invalidos',
    )
  })

  it.each(['23505', '23502', '23514'])(
    'returns numeros_invalidos for a %s that mentions etapa_alfabetos',
    (code) => {
      expect(
        toRpcErrorCode({
          code,
          message: 'violates constraint "etapa_alfabetos_pkey"',
        }),
      ).toBe('numeros_invalidos')
    },
  )

  it('keeps the raw message for etapa_alfabetos under an unrelated code', () => {
    expect(
      toRpcErrorCode({ code: 'P0001', message: 'etapa_alfabetos boom' }),
    ).toBe('etapa_alfabetos boom')
  })

  it('returns numeros_invalidos for a 23503 on etapa_alfabetos_alfabeto_id_fkey', () => {
    expect(
      toRpcErrorCode({
        code: '23503',
        message:
          'insert or update on table "etapa_alfabetos" violates foreign key constraint "etapa_alfabetos_alfabeto_id_fkey"',
      }),
    ).toBe('numeros_invalidos')
  })

  it('keeps the raw message for a 23503 on another foreign key', () => {
    expect(
      toRpcErrorCode({
        code: '23503',
        message:
          'insert or update on table "etapas_tratamiento" violates foreign key constraint "etapas_tratamiento_modalidad_id_fkey"',
      }),
    ).toBe(
      'insert or update on table "etapas_tratamiento" violates foreign key constraint "etapas_tratamiento_modalidad_id_fkey"',
    )
  })

  it.each([
    ['22003', 'value "40000" is out of range for type smallint'],
    ['22P02', 'invalid input syntax for type smallint: "abc"'],
  ])(
    'returns numeros_invalidos for a %s on the smallint numero cast',
    (code, message) => {
      expect(toRpcErrorCode({ code, message })).toBe('numeros_invalidos')
    },
  )

  it('keeps the raw message for a 22P02 on another type', () => {
    expect(
      toRpcErrorCode({
        code: '22P02',
        message: 'invalid input syntax for type uuid: "x"',
      }),
    ).toBe('invalid input syntax for type uuid: "x"')
  })
})
