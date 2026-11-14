interface EtapaRowRaw {
  numero_etapa: number
  frase_esperada: string
}

interface Etapa {
  readonly numeroEtapa: number
  readonly fraseEsperada: string
}

const mapEtapasRows = (rows: ReadonlyArray<EtapaRowRaw>): Etapa[] =>
  rows
    .slice()
    .sort((a, b) => a.numero_etapa - b.numero_etapa)
    .map((e) => ({
      numeroEtapa: e.numero_etapa,
      fraseEsperada: e.frase_esperada,
    }))

export type { EtapaRowRaw }
export { mapEtapasRows }
