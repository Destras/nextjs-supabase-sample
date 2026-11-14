'use client'

import { useCallback, type JSX } from 'react'
import { format } from 'date-fns'
import { CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { FormState } from '../controllers'
import { AYUDA_EMAIL_BLOQUEADO, AYUDA_TELEFONO } from '@/lib/identidadMessages'

interface IdentidadStepProps {
  readonly identidad: FormState['identidad']
  readonly errores: Readonly<Record<string, string>>
  readonly avisoTelefono: string | null
  readonly onChange: (
    field: keyof FormState['identidad'],
    value: string | null,
  ) => void
  readonly onBlur: (field: keyof FormState['identidad']) => void
  readonly fechaNacimientoDate: Date | undefined
  readonly fechaNacimientoMin: Date
  readonly fechaNacimientoMax: Date
  readonly onSelectFechaNacimiento: (date: Date | null) => void
  // Solo la edición lo pasa: el paciente ya activó su cuenta y el email de la
  // ficha no se puede cambiar (BETA-030). En el alta nunca aplica.
  readonly emailBloqueado?: boolean
}

const IdentidadStep = ({
  identidad,
  errores,
  avisoTelefono,
  onChange,
  onBlur,
  fechaNacimientoDate,
  fechaNacimientoMin,
  fechaNacimientoMax,
  onSelectFechaNacimiento,
  emailBloqueado = false,
}: IdentidadStepProps): JSX.Element => {
  const isCalendarDateDisabled = useCallback(
    (date: Date) => date > fechaNacimientoMax || date < fechaNacimientoMin,
    [fechaNacimientoMin, fechaNacimientoMax],
  )

  const onCalendarSelect = useCallback(
    (date: Date | undefined) => onSelectFechaNacimiento(date ?? null),
    [onSelectFechaNacimiento],
  )

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* Left card — form fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del paciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Nombre completo */}
            <div className="space-y-2">
              <Label htmlFor="identidad-nombre">Nombre completo</Label>
              <Input
                id="identidad-nombre"
                placeholder="Ej: María Echeverría"
                value={identidad.nombre}
                onChange={(e) => onChange('nombre', e.target.value)}
                onBlur={() => onBlur('nombre')}
                aria-invalid={!!errores['identidad.nombre']}
                aria-describedby={
                  errores['identidad.nombre']
                    ? 'error-identidad-nombre'
                    : undefined
                }
              />
              {errores['identidad.nombre'] && (
                <p
                  id="error-identidad-nombre"
                  className="text-sm text-destructive"
                >
                  {errores['identidad.nombre']}
                </p>
              )}
            </div>

            {/* Fecha de nacimiento + Teléfono.
                `grid-cols-1 … grid-cols-2` es el mapeo de `grid-2` del mock
                (class-mapping de /aurora-ui); antes era `grid-cols-2` fijo, que
                desbordaba. El corte va en `xl` y no en el `md` del mapeo porque
                acá la celda de la fecha lleva además el botón de limpiar: con
                el sidebar de 260px, a 1024 el card queda en ~330px y la fecha
                se trunca. Apilado se lee entero. */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {/* DatePicker — Fecha de nacimiento */}
              <div className="space-y-2">
                <Label>Fecha de nacimiento</Label>
                {/* `min-w-0` en los dos niveles: sin esto el track de la grilla
                    no puede achicarse por debajo del contenido y la celda
                    desborda sobre la del teléfono (se veía a ~1024px, con la ✕
                    encima del input de al lado). */}
                <div className="flex min-w-0 gap-1">
                  <Popover
                    onOpenChange={(open) => {
                      if (!open) onBlur('fechaNacimiento')
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'min-w-0 flex-1 justify-start overflow-hidden text-left font-normal',
                          !identidad.fechaNacimiento && 'text-muted-foreground',
                        )}
                        aria-invalid={!!errores['identidad.fechaNacimiento']}
                        aria-describedby={
                          errores['identidad.fechaNacimiento']
                            ? 'error-identidad-fecha'
                            : undefined
                        }
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        {fechaNacimientoDate
                          ? format(fechaNacimientoDate, 'dd/MM/yyyy')
                          : 'Seleccionar'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        startMonth={fechaNacimientoMin}
                        endMonth={fechaNacimientoMax}
                        selected={fechaNacimientoDate}
                        onSelect={onCalendarSelect}
                        disabled={isCalendarDateDisabled}
                      />
                    </PopoverContent>
                  </Popover>
                  {identidad.fechaNacimiento && (
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      aria-label="Limpiar fecha"
                      className="shrink-0"
                      onClick={() => onSelectFechaNacimiento(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {errores['identidad.fechaNacimiento'] && (
                  <p
                    id="error-identidad-fecha"
                    className="text-sm text-destructive"
                  >
                    {errores['identidad.fechaNacimiento']}
                  </p>
                )}
              </div>

              {/* Teléfono */}
              <div className="space-y-2">
                <Label htmlFor="identidad-telefono">Teléfono</Label>
                {/* El '+54' es prefijo fijo, no se tipea (ACT-001): todos los
                    pacientes son de Argentina (ADR-0008), así que pedirlo era
                    fricción sin información. Decorativo para el lector de
                    pantalla — lo que el campo espera lo dice AYUDA_TELEFONO. */}
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
                  >
                    +54
                  </span>
                  <Input
                    id="identidad-telefono"
                    className="pl-11"
                    inputMode="tel"
                    placeholder="11 5123 4567"
                    value={identidad.telefono}
                    onChange={(e) => onChange('telefono', e.target.value)}
                    onBlur={() => onBlur('telefono')}
                    aria-invalid={!!errores['identidad.telefono']}
                    aria-describedby={[
                      'ayuda-identidad-telefono',
                      errores['identidad.telefono']
                        ? 'error-identidad-telefono'
                        : avisoTelefono
                          ? 'aviso-identidad-telefono'
                          : null,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                </div>
                <p
                  id="ayuda-identidad-telefono"
                  className="text-xs text-muted-foreground"
                >
                  {AYUDA_TELEFONO}
                </p>
                {errores['identidad.telefono'] ? (
                  <p
                    id="error-identidad-telefono"
                    className="text-sm text-destructive"
                  >
                    {errores['identidad.telefono']}
                  </p>
                ) : (
                  avisoTelefono && (
                    <p
                      id="aviso-identidad-telefono"
                      className="text-sm text-warning"
                    >
                      {avisoTelefono}
                    </p>
                  )
                )}
              </div>
            </div>

            <Separator />

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="identidad-email">Email</Label>
              <Input
                id="identidad-email"
                type="email"
                placeholder="paciente@correo.com"
                value={identidad.email}
                onChange={(e) => onChange('email', e.target.value)}
                onBlur={() => onBlur('email')}
                disabled={emailBloqueado}
                aria-invalid={!!errores['identidad.email']}
                aria-describedby={[
                  'ayuda-identidad-email',
                  errores['identidad.email'] ? 'error-identidad-email' : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              <p
                id="ayuda-identidad-email"
                className="text-xs text-muted-foreground"
              >
                {emailBloqueado
                  ? AYUDA_EMAIL_BLOQUEADO
                  : 'Con este email el paciente entra a la app. La bienvenida y el código para activarla le llegan por WhatsApp, no por email.'}
              </p>
              {errores['identidad.email'] && (
                <p
                  id="error-identidad-email"
                  className="text-sm text-destructive"
                >
                  {errores['identidad.email']}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Right card — informative */}
      <Card>
        <CardHeader>
          <div className="eyebrow text-muted-foreground">Por qué importa</div>
          <CardTitle className="mt-1 text-lg">
            El <em className="italic font-light">primer punto</em>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">
            Antes de cualquier diagnóstico energético, capturamos quién es el
            paciente. Estos datos arman el lazo administrativo y se mantienen
            estables a lo largo del tratamiento.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export { IdentidadStep }
export type { IdentidadStepProps }
