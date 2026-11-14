interface CausaEtapa {
  readonly numeroEtapa: number
  readonly fraseEsperada: string
}

interface Causa {
  readonly id: string
  readonly codigo: string
  readonly nombre: string
  readonly definicion: string
  readonly emocionesEsperadas: ReadonlyArray<string>
  readonly activo: boolean
  readonly etapas: ReadonlyArray<CausaEtapa>
}

interface Bloqueo {
  readonly id: string
  readonly codigo: string
  readonly nombre: string
  readonly descripcion: string
  readonly activo: boolean
}

interface AlgoritmoEtapa {
  readonly numeroEtapa: number
  readonly fraseEsperada: string
}

interface Algoritmo {
  readonly id: string
  readonly codigo: string
  readonly nombre: string
  readonly definicion: string
  readonly comportamiento: string
  readonly comportamientoBadge: string
  readonly activo: boolean
  readonly etapas: ReadonlyArray<AlgoritmoEtapa>
}

interface Diagnostico {
  readonly causa: Causa
  readonly bloqueos: ReadonlyArray<Bloqueo>
  readonly algoritmo: Algoritmo
}

interface Modalidad {
  readonly id: string
  readonly codigo: string
  readonly nombre: string
  readonly tipoDiscoNombre: string | null
  readonly cantidadSesiones: number | null
  readonly cantidadNiveles: number
  readonly duracionMesesEstimada: number | null
  readonly descripcionCorta: string
  readonly activo: boolean
}

interface Alfabeto {
  readonly id: string
  readonly codigo: string
  readonly nombre: string
  readonly descripcion: string | null
  readonly rangoMax: number
  readonly orden: number
  readonly activo: boolean
}

interface AlfabetoCargado {
  readonly alfabetoId: string
  readonly nombre: string
  readonly numeros: ReadonlyArray<number>
}

// Fila del embed `etapa_alfabetos(numero, alfabetos(id, nombre, orden))` que traen
// las consultas de la ficha y de la historia: una por número (ADR 0015).
interface EtapaAlfabetoEmbed {
  readonly numero: number
  readonly alfabetos: {
    readonly id: string
    readonly nombre: string
    readonly orden: number
  } | null
}

interface FilaNumeroDeAlfabeto {
  readonly alfabetoId: string
  readonly numero: number
}

// Un grupo por alfabeto: la primera fila que apareció (para leer el resto de sus
// datos) y sus números sin duplicados, de menor a mayor.
interface GrupoDeAlfabeto<F extends FilaNumeroDeAlfabeto> {
  readonly primera: F
  readonly numeros: ReadonlyArray<number>
}

interface AllDiagnosticos {
  readonly causa: ReadonlyArray<Causa>
  readonly bloqueos: ReadonlyArray<Bloqueo>
  readonly algoritmo: ReadonlyArray<Algoritmo>
  readonly modalidades: ReadonlyArray<Modalidad>
  readonly alfabetos: ReadonlyArray<Alfabeto>
}

export type {
  Diagnostico,
  AllDiagnosticos,
  AlfabetoCargado,
  EtapaAlfabetoEmbed,
  FilaNumeroDeAlfabeto,
  GrupoDeAlfabeto,
}
