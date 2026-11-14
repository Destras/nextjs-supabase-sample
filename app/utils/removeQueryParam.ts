// Devuelve `pathname` + el query string sin `key`, conservando el resto de
// params en su orden. No muta `searchParams` (acepta el ReadonlyURLSearchParams
// de `useSearchParams`). Usado para consumir deep links one-shot como
// `?finalizar=1` (MED-008).
const removeQueryParam = (
  pathname: string,
  searchParams: URLSearchParams,
  key: string,
): string => {
  const remaining = new URLSearchParams(searchParams)
  remaining.delete(key)
  const query = remaining.toString()
  return query ? `${pathname}?${query}` : pathname
}

export { removeQueryParam }
