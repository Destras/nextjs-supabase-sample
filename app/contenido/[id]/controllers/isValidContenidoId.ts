const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isValidContenidoId = (id: string): boolean => UUID_PATTERN.test(id)

export { isValidContenidoId }
