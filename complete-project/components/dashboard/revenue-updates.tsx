"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"

const data = [
  { month: "Jan", footware: -2, fashionware: 1.5 },
  { month: "Feb", footware: 2.5, fashionware: 1 },
  { month: "Mar", footware: 1.5, fashionware: -1.5 },
  { month: "Apr", footware: 3.5, fashionware: 2 },
  { month: "May", footware: 1, fashionware: -1 },
  { month: "Jun", footware: 2.5, fashionware: -2 },
]

const config = {
  footware: { label: "Footware", color: "var(--chart-1)" },
  fashionware: { label: "Fashionware", color: "var(--chart-2)" },
}

export function RevenueUpdates() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-foreground">Revenue Updates</h3>
      <p className="text-sm text-muted-foreground">Overview of Profit</p>

      <ChartContainer config={config} className="mt-4 h-64 w-full">
        <BarChart data={data} barGap={2}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={32} domain={[-4, 4]} ticks={[-4, -2, 0, 2, 4]} />
          <Bar dataKey="footware" fill="var(--color-footware)" radius={8} barSize={10} />
          <Bar dataKey="fashionware" fill="var(--color-fashionware)" radius={8} barSize={10} />
        </BarChart>
      </ChartContainer>

      <div className="mt-2 flex items-center justify-center gap-6">
        <Legend color="var(--chart-1)" label="Footware" />
        <Legend color="var(--chart-2)" label="Fashionware" />
      </div>
    </Card>
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
