interface AuroraCardProps {
  kicker: string
  title: React.ReactNode
  children: React.ReactNode
}

const AuroraCard = ({ kicker, title, children }: AuroraCardProps) => (
  <div className="rounded-lg border border-border bg-card p-5">
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <div>
        <div className="eyebrow text-muted-foreground">{kicker}</div>
        <h3 className="mt-1 text-xl font-medium leading-tight tracking-tight">
          {title}
        </h3>
      </div>
    </div>
    {children}
  </div>
)

export { AuroraCard }
export type { AuroraCardProps }
