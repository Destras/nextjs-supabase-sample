const toggleIdInArray = (ids: ReadonlyArray<string>, id: string): string[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]

export { toggleIdInArray }
