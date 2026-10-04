"use client"

import { ArrowUpRight } from "lucide-react"
import { Area, AreaChart } from "recharts"
import { Card } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { Switch } from "@/components/ui/switch"

const data = [
  { v: 30 }, { v: 55 }, { v: 35 }, { v: 60 }, { v: 40 }, { v: 70 }, { v: 45 }, { v: 65 },
]

export function MonthlyEarnings() {
  return (
    <Card className="flex flex-col p-6">
      <div className="flex items-start justify-between">
        <p className="font-semibold text-foreground">Monthly Earnings</p>
        <Switch defaultChecked aria-label="Toggle monthly earnings" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-3xl font-bold text-foreground">$8,320</span>
        <ArrowUpRight className="size-5 text-emerald-500" />
        <span className="text-sm font-semibold text-emerald-500">+12%</span>
      </div>

      <ChartContainer config={{}} className="mt-4 h-24 w-full">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            dataKey="v"
            type="monotone"
            stroke="var(--chart-2)"
            strokeWidth={2.5}
            fill="url(#earnGrad)"
          />
        </AreaChart>
      </ChartContainer>
    </Card>
  )
}
