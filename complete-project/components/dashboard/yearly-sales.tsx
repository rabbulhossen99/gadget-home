"use client"

import { Bar, BarChart, XAxis } from "recharts"
import { Card } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"

const data = [
  { m: "Jan", v: 40 }, { m: "Feb", v: 65 }, { m: "Mar", v: 45 },
  { m: "Apr", v: 80 }, { m: "May", v: 55 }, { m: "Jun", v: 95 },
  { m: "Jul", v: 60 }, { m: "Aug", v: 50 },
]

export function YearlySales() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-foreground">Yearly Sales</h3>
      <p className="text-sm text-muted-foreground">Every Month</p>

      <ChartContainer config={{}} className="mt-4 h-56 w-full">
        <BarChart data={data}>
          <XAxis dataKey="m" tickLine={false} axisLine={false} tickMargin={8} />
          <Bar dataKey="v" fill="var(--chart-2)" radius={6} barSize={18} />
        </BarChart>
      </ChartContainer>
    </Card>
  )
}
