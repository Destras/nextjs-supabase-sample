import { Card, CardContent, CardHeader } from '@/components/ui/card'

// "Todavía no empieza" (DevSpec §7.2/§4.1) — etapa sin `fecha_inicio`. Sin
// acción, precedente de layout: EtapaSinIniciarCard. Header con el mismo kicker
// que EstructuraEmptyState; el segmento del título va en itálica como en el mock.
const EstructuraSinEtapaState = () => (
  <Card>
    <CardHeader>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        Estructura bioenergética
      </p>
      <h3 className="font-display text-2xl text-foreground">
        Todavía <em className="italic">no empieza</em>
      </h3>
    </CardHeader>
    <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">
        La medición empieza cuando arranca la etapa.
      </p>
    </CardContent>
  </Card>
)

export { EstructuraSinEtapaState }
