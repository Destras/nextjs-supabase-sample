'use client'

import { Bar, BarChart, Cell, LabelList, XAxis, YAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import type { ChartSlot } from '../controllers'

interface EvolucionChartProps {
  readonly slots: ReadonlyArray<ChartSlot>
}

const chartConfig = {
  score: { label: 'Score' },
} satisfies ChartConfig

const EvolucionChart = ({ slots }: EvolucionChartProps) => (
  <ChartContainer config={chartConfig} className="h-64 w-full">
    <BarChart data={[...slots]}>
      <XAxis dataKey="numeroNivel" tickFormatter={(n: number) => `N${n}`} />
      <YAxis hide domain={[0, 5]} />
      <Bar dataKey="score" radius={4}>
        <LabelList dataKey="realScore" position="top" />
        {slots.map((slot) => (
          <Cell
            key={slot.nivelId}
            fill={slot.isPending ? 'var(--muted)' : 'var(--primary)'}
            fillOpacity={slot.isPending ? 0.25 : 1}
          >
            <title>
              {slot.isPending ? 'Pendiente' : `Score: ${slot.score}`}
            </title>
          </Cell>
        ))}
      </Bar>
    </BarChart>
  </ChartContainer>
)

export { EvolucionChart }
export type { EvolucionChartProps }
