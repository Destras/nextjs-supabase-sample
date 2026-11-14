'use client'

import { useState } from 'react'
import type { AlfabetoConNumeros } from '@/app/controllers/Paciente'
import type {
  AlfabetosElegidos,
  CatalogoAlfabetos,
} from './utils/alfabetoListUtils'
import {
  alfabetosDisponibles,
  quitarAlfabeto,
  quitarNumero,
  setNumerosDeAlfabeto,
} from './utils/alfabetoListUtils'

interface UseAlfabetosPickerParams {
  readonly catalogo: CatalogoAlfabetos
  readonly value: AlfabetosElegidos
  readonly onChange: (next: AlfabetosElegidos) => void
}

// Qué Popover está abierto: el de "agregar" (alfabetoId null hasta elegir uno de
// la lista) o el de "editar" de una fila.
interface PopoverAbierto {
  readonly modo: 'agregar' | 'editar'
  readonly alfabetoId: string | null
}

interface AlfabetoPickerFila {
  readonly alfabetoId: string
  readonly nombre: string
  // `null` si el alfabeto ya no está en el catálogo (no se conoce su rango).
  readonly rangoLabel: string | null
  readonly numeros: ReadonlyArray<number>
  readonly editando: boolean
}

interface AlfabetoPickerOpcion {
  readonly id: string
  readonly etiqueta: string
}

// Grilla del Popover abierto, una vez que hay un alfabeto elegido.
interface GrillaDeNumeros {
  readonly nombre: string
  readonly rangoMax: number
  readonly opciones: ReadonlyArray<number>
}

interface AlfabetosPickerState {
  readonly filas: ReadonlyArray<AlfabetoPickerFila>
  readonly opcionesParaAgregar: ReadonlyArray<AlfabetoPickerOpcion>
  readonly agregarAbierto: boolean
  readonly grilla: GrillaDeNumeros | null
  readonly borrador: ReadonlyArray<number>
  readonly onAgregarOpenChange: (open: boolean) => void
  readonly onEditarOpenChange: (alfabetoId: string, open: boolean) => void
  readonly onElegirAlfabeto: (alfabetoId: string) => void
  readonly onChangeBorrador: (next: ReadonlyArray<number>) => void
  readonly onListo: () => void
  readonly onQuitarNumero: (alfabetoId: string, numero: number) => void
  readonly onQuitarAlfabeto: (alfabetoId: string) => void
}

const rangoLabel = (rangoMax: number): string => `(1–${rangoMax})`

const grillaDe = (
  catalogo: CatalogoAlfabetos,
  alfabetoId: string,
): GrillaDeNumeros => {
  const alfabeto = catalogo.find((a) => a.id === alfabetoId)
  const rangoMax = alfabeto?.rangoMax ?? 0
  return {
    nombre: alfabeto?.nombre ?? alfabetoId,
    rangoMax,
    opciones: Array.from({ length: rangoMax }, (_, i) => i + 1),
  }
}

// Estado efímero del AlfabetosPicker (qué Popover está abierto y el borrador de
// números de la grilla). El borrador se aplica recién al cerrar el Popover — por
// Listo, Escape o click afuera — y un borrador vacío deja el alfabeto afuera.
const useAlfabetosPicker = ({
  catalogo,
  value,
  onChange,
}: UseAlfabetosPickerParams): AlfabetosPickerState => {
  const [abierto, setAbierto] = useState<PopoverAbierto | null>(null)
  const [borrador, setBorrador] = useState<ReadonlyArray<number>>([])

  const cerrar = (): void => {
    if (abierto?.alfabetoId) {
      onChange(
        setNumerosDeAlfabeto(value, catalogo, abierto.alfabetoId, borrador),
      )
    }
    setAbierto(null)
    setBorrador([])
  }

  const onAgregarOpenChange = (open: boolean): void => {
    if (!open) return cerrar()
    setBorrador([])
    setAbierto({ modo: 'agregar', alfabetoId: null })
  }

  const onEditarOpenChange = (alfabetoId: string, open: boolean): void => {
    if (!open) return cerrar()
    const fila = value.find((a) => a.alfabetoId === alfabetoId)
    setBorrador(fila?.numeros ?? [])
    setAbierto({ modo: 'editar', alfabetoId })
  }

  const filas = value.map((item: AlfabetoConNumeros): AlfabetoPickerFila => {
    const alfabeto = catalogo.find((a) => a.id === item.alfabetoId)
    return {
      alfabetoId: item.alfabetoId,
      nombre: alfabeto?.nombre ?? item.alfabetoId,
      rangoLabel: alfabeto ? rangoLabel(alfabeto.rangoMax) : null,
      numeros: item.numeros,
      editando:
        abierto?.modo === 'editar' && abierto.alfabetoId === item.alfabetoId,
    }
  })

  return {
    filas,
    opcionesParaAgregar: alfabetosDisponibles(catalogo, value).map((a) => ({
      id: a.id,
      etiqueta: `${a.nombre} ${rangoLabel(a.rangoMax)}`,
    })),
    agregarAbierto: abierto?.modo === 'agregar',
    grilla: abierto?.alfabetoId ? grillaDe(catalogo, abierto.alfabetoId) : null,
    borrador,
    onAgregarOpenChange,
    onEditarOpenChange,
    onElegirAlfabeto: (alfabetoId) =>
      setAbierto({ modo: 'agregar', alfabetoId }),
    onChangeBorrador: setBorrador,
    onListo: cerrar,
    onQuitarNumero: (alfabetoId, numero) =>
      onChange(quitarNumero(value, alfabetoId, numero)),
    onQuitarAlfabeto: (alfabetoId) =>
      onChange(quitarAlfabeto(value, alfabetoId)),
  }
}

export type {
  AlfabetosPickerState,
  AlfabetoPickerFila,
  AlfabetoPickerOpcion,
  GrillaDeNumeros,
  UseAlfabetosPickerParams,
}
export { useAlfabetosPicker }
