'use client'

import type { JSX } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Chip } from '@/app/pacientes/components/Chip'
import { useAlfabetosPicker } from '../controllers'
import type {
  AlfabetosElegidos,
  CatalogoAlfabetos,
  GrillaDeNumeros,
} from '../controllers'

interface AlfabetosPickerProps {
  readonly catalogo: CatalogoAlfabetos
  readonly value: AlfabetosElegidos
  readonly onChange: (next: AlfabetosElegidos) => void
  readonly disabled?: boolean
}

interface NumerosGridProps {
  readonly grilla: GrillaDeNumeros
  readonly borrador: ReadonlyArray<number>
  readonly onChangeBorrador: (next: ReadonlyArray<number>) => void
  readonly onListo: () => void
}

const NumerosGrid = ({
  grilla,
  borrador,
  onChangeBorrador,
  onListo,
}: NumerosGridProps): JSX.Element => (
  <div className="flex flex-col gap-3">
    <div className="text-sm font-medium text-foreground">
      {grilla.nombre} · del 1 al {grilla.rangoMax}
    </div>
    <ToggleGroup
      type="multiple"
      variant="outline"
      spacing={1}
      aria-label={`Números de ${grilla.nombre}`}
      className="grid w-fit grid-cols-10"
      value={borrador.map(String)}
      onValueChange={(next) => onChangeBorrador(next.map(Number))}
    >
      {grilla.opciones.map((n) => (
        <ToggleGroupItem
          key={n}
          value={String(n)}
          aria-label={String(n)}
          className="h-8 w-8 px-0 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground"
        >
          {n}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
    <div className="flex justify-end">
      <Button type="button" size="sm" onClick={onListo}>
        Listo
      </Button>
    </div>
  </div>
)

// El estado efímero (Popover abierto + borrador de la grilla) vive en
// useAlfabetosPicker: el picker se reusa en alta, edición y nuevo tratamiento, y
// así ninguno de los tres ViewModels carga con él (mismo patrón que
// EditarTerapeutaModal con su hook).
const AlfabetosPicker = ({
  catalogo,
  value,
  onChange,
  disabled = false,
}: AlfabetosPickerProps): JSX.Element => {
  const {
    filas,
    opcionesParaAgregar,
    agregarAbierto,
    grilla,
    borrador,
    onAgregarOpenChange,
    onEditarOpenChange,
    onElegirAlfabeto,
    onChangeBorrador,
    onListo,
    onQuitarNumero,
    onQuitarAlfabeto,
  } = useAlfabetosPicker({ catalogo, value, onChange })

  return (
    <div className="flex flex-col gap-3">
      {filas.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin alfabetos cargados.</p>
      )}

      {/* La fila mide su propio ancho (container query): en la columna angosta
          del alta los chips bajan debajo del nombre y usan todo el ancho; en
          anchos cómodos (Editar) va todo en una línea. */}
      {filas.map((fila) => (
        <div key={fila.alfabetoId} className="@container">
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 @lg:grid-cols-[minmax(10rem,auto)_1fr_auto]">
            <div className="col-start-1 row-start-1 text-sm font-medium text-foreground">
              {fila.nombre}{' '}
              {fila.rangoLabel !== null && (
                <span className="font-normal text-muted-foreground">
                  {fila.rangoLabel}
                </span>
              )}
            </div>
            <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-center gap-1.5 @lg:col-span-1 @lg:col-start-2 @lg:row-start-1">
              {fila.numeros.map((n) => (
                <Chip key={n}>
                  {n}
                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Quitar ${n} de ${fila.nombre}`}
                      className="size-3 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
                      onClick={() => onQuitarNumero(fila.alfabetoId, n)}
                    >
                      <X className="size-3" aria-hidden="true" />
                    </Button>
                  )}
                </Chip>
              ))}
            </div>
            {!disabled && (
              <div className="col-start-2 row-start-1 flex items-center gap-1 @lg:col-start-3">
                <Popover
                  open={fila.editando}
                  onOpenChange={(open) =>
                    onEditarOpenChange(fila.alfabetoId, open)
                  }
                >
                  <PopoverTrigger asChild>
                    <Button type="button" variant="ghost" size="sm">
                      Editar números
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto">
                    {grilla !== null && (
                      <NumerosGrid
                        grilla={grilla}
                        borrador={borrador}
                        onChangeBorrador={onChangeBorrador}
                        onListo={onListo}
                      />
                    )}
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar ${fila.nombre}`}
                  onClick={() => onQuitarAlfabeto(fila.alfabetoId)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}

      {!disabled && opcionesParaAgregar.length > 0 && (
        <div>
          <Popover open={agregarAbierto} onOpenChange={onAgregarOpenChange}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Plus className="size-4" aria-hidden="true" />
                Agregar alfabeto
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto">
              {grilla !== null ? (
                <NumerosGrid
                  grilla={grilla}
                  borrador={borrador}
                  onChangeBorrador={onChangeBorrador}
                  onListo={onListo}
                />
              ) : (
                <ul className="flex min-w-56 flex-col gap-1">
                  {opcionesParaAgregar.map((opcion) => (
                    <li key={opcion.id}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => onElegirAlfabeto(opcion.id)}
                      >
                        {opcion.etiqueta}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  )
}

export { AlfabetosPicker }
export type { AlfabetosPickerProps }
