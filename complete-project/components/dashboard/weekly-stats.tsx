"use client"

import { Tag, ArrowUp } from "lucide-react"
import { Area, AreaChart } from "recharts"
import { Card } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"

const data = [
  { v: 20 }, { v: 45 }, { v: 30 }, { v: 55 }, { v: 40 }, { v: 25 }, { v: 50 }, { v: 35 },
]

const rows = [
  { label: "Top Sales", name: "Johnathan Doe", value: "+68", tone: "text-primary" },
  { label: "Best Seller", name: "MaterialPro Admin", value: "+45", tone: "text-sky-500" },
  { label: "Most Commented", name: "Ample Admin", value: "+14", tone: "text-emerald-500" },
]

export function WeeklyStats() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-foreground">Weekly Stats</h3>
      <p className="text-sm text-muted-foreground">Average sales</p>

      <ChartContainer config={{}} className="mt-3 h-24 w-full">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="weeklyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area dataKey="v" type="monotone" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#weeklyGrad)" />
        </AreaChart>
      </ChartContainer>

      <div className="mt-4 space-y-4">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Tag className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{r.label}</p>
              <p className="truncate text-xs text-muted-foreground">{r.name}</p>
            </div>
            <span className={`flex items-center gap-0.5 text-sm font-semibold ${r.tone}`}>
              <ArrowUp className="size-3" />
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
