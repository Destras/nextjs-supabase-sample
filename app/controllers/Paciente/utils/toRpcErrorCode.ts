interface RpcErrorLike {
  readonly code?: string
  readonly message: string
}

// SQLSTATE de Postgres que llegan crudos (sin pasar por un `raise` propio).
const UNIQUE_VIOLATION = '23505'
const NOT_NULL_VIOLATION = '23502'
const CHECK_VIOLATION = '23514'
const FOREIGN_KEY_VIOLATION = '23503'
const NUMERIC_VALUE_OUT_OF_RANGE = '22003'
const INVALID_TEXT_REPRESENTATION = '22P02'

const EMAIL_CONSTRAINT = 'pacientes_email_key'
const RANGE_TRIGGER_MESSAGE = 'alfabeto_numero_fuera_de_rango'
const ETAPA_ALFABETOS_RELATION = 'etapa_alfabetos'
const ALFABETO_FK_CONSTRAINT = 'etapa_alfabetos_alfabeto_id_fkey'
// En estos RPCs el único cast a smallint es `(item ->> 'numero')::smallint` de
// p_alfabetos, así que un 22003/22P02 que nombra smallint es un número de
// alfabeto inválido. Los demás 22P02 (p. ej. un uuid mal formado) no se tocan.
const SMALLINT_TYPE = 'smallint'

const ETAPA_ALFABETOS_VIOLATION_CODES: ReadonlyArray<string> = [
  UNIQUE_VIOLATION,
  NOT_NULL_VIOLATION,
  CHECK_VIOLATION,
]
const SMALLINT_CAST_CODES: ReadonlyArray<string> = [
  NUMERIC_VALUE_OUT_OF_RANGE,
  INVALID_TEXT_REPRESENTATION,
]

const esErrorDeNumerosDeAlfabeto = (error: RpcErrorLike): boolean => {
  if (error.message === RANGE_TRIGGER_MESSAGE) return true
  if (error.code === undefined) return false
  if (
    ETAPA_ALFABETOS_VIOLATION_CODES.includes(error.code) &&
    error.message.includes(ETAPA_ALFABETOS_RELATION)
  )
    return true
  if (
    error.code === FOREIGN_KEY_VIOLATION &&
    error.message.includes(ALFABETO_FK_CONSTRAINT)
  )
    return true
  return (
    SMALLINT_CAST_CODES.includes(error.code) &&
    error.message.includes(SMALLINT_TYPE)
  )
}

// Reduce el error de un RPC al código que consumen los ViewModels. Los RPCs propios
// ya lanzan su código en `message` (`telefono_invalido`, `paciente_dado_de_baja`, …);
// el choque contra el índice único del email no pasa por ningún `raise`, así que
// llega como el 23505 crudo de Postgres. Lo reconocemos por SQLSTATE + nombre de la
// restricción (ADR 0010) y lo traducimos al código propio `email_duplicado`.
// Los números de alfabeto inválidos llegan por varios caminos (el trigger de rango
// `alfabeto_numero_fuera_de_rango`, una violación cruda de `etapa_alfabetos`, la FK
// del alfabeto o el cast a smallint) y todos se traducen a `numeros_invalidos`.
const toRpcErrorCode = (error: RpcErrorLike): string => {
  if (
    error.code === UNIQUE_VIOLATION &&
    error.message.includes(EMAIL_CONSTRAINT)
  ) {
    return 'email_duplicado'
  }
  if (esErrorDeNumerosDeAlfabeto(error)) return 'numeros_invalidos'
  return error.message
}

export type { RpcErrorLike }
export { toRpcErrorCode }
