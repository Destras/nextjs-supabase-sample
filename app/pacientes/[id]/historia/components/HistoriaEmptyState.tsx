const HistoriaEmptyState = () => (
  <div className="rounded-lg border border-border bg-card p-8 text-center">
    <p className="font-medium text-foreground">Sin etapas de tratamiento</p>
    <p className="mt-2 text-sm text-muted-foreground">
      Este paciente todavía no tiene etapas de tratamiento registradas.
    </p>
  </div>
)

export { HistoriaEmptyState }
