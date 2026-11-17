/* Dashboard charts. Colors come from the design tokens; status colors keep their meaning everywhere. */

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatMonth } from '@/features/documents/shared'
import type { Dashboard } from '@/types/api'

const TOKENS = {
  brand: 'var(--brand)',
  success: 'var(--success)',
  warning: '#d48a1a',
  destructive: 'var(--destructive)',
  grid: 'var(--border)',
  axis: 'var(--muted-foreground)',
}

const tooltipStyle = {
  contentStyle: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontSize: 12,
    padding: '6px 10px',
  },
  labelStyle: { color: 'var(--foreground)', fontWeight: 500, marginBottom: 2 },
  itemStyle: { color: 'var(--foreground)', padding: 0 },
  cursor: { fill: 'var(--muted)' },
}

const axisProps = {
  tick: { fontSize: 11, fill: TOKENS.axis },
  axisLine: false,
  tickLine: false,
}

export function StatusDonut({ metrics }: { metrics: Dashboard['metrics'] }) {
  const slices = [
    { name: 'Valid', value: metrics.valid, color: TOKENS.success },
    { name: 'Expiring soon', value: metrics.expiring_soon, color: TOKENS.warning },
    { name: 'Expired', value: metrics.expired, color: TOKENS.destructive },
  ]
  return (
    <div className="flex items-center gap-6">
      <div className="relative size-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices.filter((slice) => slice.value > 0)}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {slices
                .filter((slice) => slice.value > 0)
                .map((slice) => (
                  <Cell key={slice.name} fill={slice.color} />
                ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{metrics.total}</span>
          <span className="text-xs text-muted-foreground">documents</span>
        </div>
      </div>
      <ul className="flex flex-col gap-2.5 text-[13px]">
        {slices.map((slice) => (
          <li key={slice.name} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: slice.color }} aria-hidden />
            <span className="w-28 text-muted-foreground">{slice.name}</span>
            <span className="font-medium tabular-nums">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function UpcomingExpirationsChart({ data }: { data: Dashboard['upcoming_expirations'] }) {
  const rows = data.map((item) => ({ label: formatMonth(item.month), count: item.count }))
  return (
    <div className="h-56" role="img" aria-label={`Documents expiring per month: ${rows.map((r) => `${r.label} ${r.count}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
          <CartesianGrid vertical={false} stroke={TOKENS.grid} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} />
          <Tooltip {...tooltipStyle} formatter={(value) => [value, 'Expiring']} />
          <Bar dataKey="count" fill={TOKENS.brand} radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Horizontal bars for counts by name: document types, locations, departments. */
export function HorizontalBars({ rows, label }: { rows: Array<{ name: string; count: number }>; label: string }) {
  const height = Math.max(120, rows.length * 34 + 16)
  return (
    <div style={{ height }} role="img" aria-label={`${label}: ${rows.map((r) => `${r.name} ${r.count}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            {...axisProps}
            tick={{ fontSize: 12, fill: 'var(--foreground)' }}
          />
          <Tooltip {...tooltipStyle} formatter={(value) => [value, 'Documents']} />
          <Bar
            dataKey="count"
            fill={TOKENS.brand}
            radius={[0, 3, 3, 0]}
            maxBarSize={18}
            isAnimationActive={false}
            label={{ position: 'right', fontSize: 11, fill: TOKENS.axis }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
