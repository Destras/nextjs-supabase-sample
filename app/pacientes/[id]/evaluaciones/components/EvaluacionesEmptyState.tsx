const EvaluacionesEmptyState = () => (
  <div className="rounded-lg border border-border bg-card p-8 text-center">
    <p className="font-medium text-foreground">Sin evaluaciones todavía</p>
    <p className="mt-2 text-sm text-muted-foreground">
      Este paciente todavía no completó su primera autoevaluación. Las
      evaluaciones se generan desde la app mobile al cierre de cada nivel.
    </p>
  </div>
)

export { EvaluacionesEmptyState }
