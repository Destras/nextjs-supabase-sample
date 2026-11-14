/**
 * Normaliza un string para búsqueda tolerante: caso-insensible y acento-insensible.
 *
 * Descompone con NFD y remueve los diacríticos combinantes (`\p{Diacritic}`),
 * luego pasa a minúsculas. Nota: bajo NFD la `ñ` (U+00F1) se descompone en
 * `n` + tilde combinante (U+0303), que es un diacrítico → `ñ` colapsa a `n`
 * (p. ej. "niño" → "nino"). Es el comportamiento de búsqueda deseado (tolerante).
 *
 * No hace `trim`: el caller decide si recorta el query antes de comparar.
 *
 * Pura, sin side effects. Usada por la búsqueda de pacientes y por el filtro
 * del SearchableCombobox para que toda la app busque igual.
 */
const normalizeForSearch = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export { normalizeForSearch }
