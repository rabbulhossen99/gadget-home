"use client"

import { ArrowUp, MoreVertical } from "lucide-react"
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
} from "recharts"
import { Card } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

const barData = [
  { v: 40 }, { v: 70 }, { v: 45 }, { v: 90 }, { v: 55 }, { v: 75 }, { v: 60 },
]
const lineData = [
  { v: 20 }, { v: 45 }, { v: 30 }, { v: 60 }, { v: 40 }, { v: 75 }, { v: 90 },
]
const donutData = [
  { name: "a", value: 45 },
  { name: "b", value: 30 },
  { name: "c", value: 25 },
]

type Stat = {
  label: string
  value: string
  change: string
  sub: string
  chart: "donut" | "bar" | "line"
}

const stats: Stat[] = [
  { label: "Expense", value: "$14,320", change: "2.5%", sub: "256.129 USD", chart: "donut" },
  { label: "Sales", value: "$14,320", change: "2.5%", sub: "256.129 USD", chart: "bar" },
  { label: "Income", value: "$22,329", change: "+12%", sub: "256.129 USD", chart: "bar" },
  { label: "Growth", value: "$22,329", change: "+12%", sub: "256.129 USD", chart: "line" },
]

function MiniChart({ type }: { type: Stat["chart"] }) {
  if (type === "donut") {
    return (
      <ChartContainer config={{}} className="size-16">
        <PieChart>
          <Pie
            data={donutData}
            dataKey="value"
            innerRadius={18}
            outerRadius={30}
            paddingAngle={2}
            stroke="none"
          >
            <Cell fill="var(--chart-1)" />
            <Cell fill="var(--chart-2)" />
            <Cell fill="var(--chart-5)" />
          </Pie>
        </PieChart>
      </ChartContainer>
    )
  }
  if (type === "bar") {
    return (
      <ChartContainer config={{}} className="h-16 w-24">
        <BarChart data={barData} barCategoryGap={2}>
          <Bar dataKey="v" radius={4}>
            {barData.map((_, i) => (
              <Cell key={i} fill={i % 2 ? "var(--chart-2)" : "var(--chart-1)"} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    )
  }
  return (
    <ChartContainer config={{}} className="h-16 w-24">
      <LineChart data={lineData}>
        <Line dataKey="v" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}

function StatCard({ stat }: { stat: Stat }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{stat.label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-500">
              <ArrowUp className="size-3" />
              {stat.change}
            </span>
            <span className="text-xs text-muted-foreground">{stat.sub}</span>
          </div>
        </div>
        <MoreVertical className="size-4 text-muted-foreground" />
      </div>
      <div className={cn("mt-2 flex", stat.chart === "donut" ? "justify-center" : "justify-end")}>
        <MiniChart type={stat.chart} />
      </div>
    </Card>
  )
}

export function StatCards() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map((s) => (
        <StatCard key={s.label} stat={s} />
      ))}
    </div>
  )
}
