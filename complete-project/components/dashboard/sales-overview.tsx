"use client"

import { Cell, Label, Pie, PieChart } from "recharts"
import { Card } from "@/components/ui/card"
import { ChartContainer } from "@/components/ui/chart"

const data = [
  { name: "Profit", value: 62 },
  { name: "Expense", value: 38 },
]

export function SalesOverview() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-foreground">Sales Overview</h3>
      <p className="text-sm text-muted-foreground">Every Month</p>

      <ChartContainer config={{}} className="mx-auto mt-2 h-56 w-full">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={70}
            outerRadius={95}
            startAngle={90}
            endAngle={-270}
            paddingAngle={2}
            stroke="none"
          >
            <Cell fill="var(--chart-1)" />
            <Cell fill="var(--chart-3)" />
            <Label
              content={({ viewBox }) => {
                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                        $800,325
                      </tspan>
                    </text>
                  )
                }
              }}
            />
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricTile value="$21,256" label="Profit" tone="bg-primary/10 text-primary" />
        <MetricTile value="$22,325" label="Expense" tone="bg-sky-500/10 text-sky-500" />
      </div>
    </Card>
  )
}

function MetricTile({ value, label, tone }: { value: string; label: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
      <span className={`grid size-9 place-items-center rounded-lg ${tone}`}>
        <span className="size-4 rounded-sm bg-current opacity-70" />
      </span>
      <div>
        <p className="text-base font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
