"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  Eye,
  MousePointerClick,
  ShoppingCart,
  CheckCircle2,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChartContainer } from "@/components/ui/chart"

const funnelSteps = [
  { label: "ViewContent", value: 128400, icon: Eye, pct: "100%" },
  { label: "AddToCart", value: 42300, icon: ShoppingCart, pct: "32.9%" },
  { label: "InitiateCheckout", value: 18700, icon: MousePointerClick, pct: "14.6%" },
  { label: "Purchase", value: 9240, icon: CheckCircle2, pct: "7.2%" },
]

const eventTrend = [
  { day: "Mon", purchases: 620, views: 12400 },
  { day: "Tue", purchases: 810, views: 15100 },
  { day: "Wed", purchases: 540, views: 11800 },
  { day: "Thu", purchases: 1120, views: 18200 },
  { day: "Fri", purchases: 1340, views: 21400 },
  { day: "Sat", purchases: 1580, views: 24900 },
  { day: "Sun", purchases: 1230, views: 19800 },
]

const trendConfig = {
  purchases: { label: "Purchases", color: "var(--chart-1)" },
  views: { label: "Views", color: "var(--chart-2)" },
}

const sourceData = [
  { name: "Meta Ads", value: 52 },
  { name: "Instagram", value: 24 },
  { name: "Organic", value: 15 },
  { name: "Direct", value: 9 },
]

const sourceColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-5)", "var(--chart-3)"]

const sourceConfig = {
  value: { label: "Share" },
}

const attributionData = [
  { name: "1-day click", value: 4200 },
  { name: "7-day click", value: 6800 },
  { name: "1-day view", value: 2100 },
  { name: "28-day click", value: 8300 },
]

const attributionConfig = {
  value: { label: "Conversions", color: "var(--chart-1)" },
}

export function AnalyticsContent() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {funnelSteps.map((s, i) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-5" />
              </span>
              <Badge variant="secondary" className="rounded-full bg-primary/10 font-medium text-primary">
                {s.pct}
              </Badge>
            </div>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Step {i + 1}
            </p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{s.value.toLocaleString()}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <h3 className="text-lg font-bold text-foreground">Pixel Events</h3>
          <p className="text-sm text-muted-foreground">Purchases vs. content views this week</p>
          <ChartContainer config={trendConfig} className="mt-4 h-72 w-full">
            <LineChart data={eventTrend} margin={{ left: 4, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={44} />
              <Line dataKey="views" type="monotone" stroke="var(--color-views)" strokeWidth={2.5} dot={false} />
              <Line dataKey="purchases" type="monotone" stroke="var(--color-purchases)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ChartContainer>
          <div className="mt-2 flex items-center justify-center gap-6">
            <Legend color="var(--chart-2)" label="Views" />
            <Legend color="var(--chart-1)" label="Purchases" />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-bold text-foreground">Traffic Sources</h3>
          <p className="text-sm text-muted-foreground">Where conversions originate</p>
          <ChartContainer config={sourceConfig} className="mx-auto mt-4 h-48 w-48">
            <PieChart>
              <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2} stroke="none">
                {sourceData.map((_, i) => (
                  <Cell key={i} fill={sourceColors[i]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="mt-4 flex flex-col gap-2">
            {sourceData.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <Legend color={sourceColors[i]} label={s.name} />
                <span className="font-semibold text-foreground">{s.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-foreground">Attribution Windows</h3>
        <p className="text-sm text-muted-foreground">Conversions by Meta attribution setting</p>
        <ChartContainer config={attributionConfig} className="mt-4 h-64 w-full">
          <BarChart data={attributionData} margin={{ left: 4, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v / 1000}k`} />
            <Bar dataKey="value" radius={8} barSize={44}>
              {attributionData.map((_, i) => (
                <Cell key={i} fill={i % 2 ? "var(--chart-2)" : "var(--chart-1)"} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </Card>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  )
}
