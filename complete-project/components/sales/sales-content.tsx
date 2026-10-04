"use client"

import { useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Download,
  Package,
  ShoppingBag,
  Users,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartContainer } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

const revenueData = [
  { day: "Mon", revenue: 4200, orders: 32 },
  { day: "Tue", revenue: 5100, orders: 41 },
  { day: "Wed", revenue: 3800, orders: 28 },
  { day: "Thu", revenue: 6200, orders: 53 },
  { day: "Fri", revenue: 7400, orders: 64 },
  { day: "Sat", revenue: 8900, orders: 78 },
  { day: "Sun", revenue: 6800, orders: 57 },
]

const chartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
}

type Metric = {
  label: string
  value: string
  change: string
  up: boolean
  icon: typeof DollarSign
}

const metrics: Metric[] = [
  { label: "Total revenue", value: "$42,400", change: "12.5%", up: true, icon: DollarSign },
  { label: "Orders", value: "353", change: "8.2%", up: true, icon: ShoppingBag },
  { label: "New customers", value: "128", change: "3.1%", up: true, icon: Users },
  { label: "Refunds", value: "$1,240", change: "1.4%", up: false, icon: Package },
]

type OrderStatus = "Paid" | "Pending" | "Refunded"

type Order = {
  id: string
  customer: string
  product: string
  date: string
  amount: string
  status: OrderStatus
}

const orders: Order[] = [
  { id: "#ORD-7821", customer: "Amelia Ford", product: "Nike Air Zoom Pegasus", date: "Sep 21, 2026", amount: "$129.00", status: "Paid" },
  { id: "#ORD-7820", customer: "Liam Chen", product: "Adidas Ultraboost 22", date: "Sep 21, 2026", amount: "$189.00", status: "Paid" },
  { id: "#ORD-7819", customer: "Sofia Rossi", product: "Puma RS-X Reinvention", date: "Sep 20, 2026", amount: "$99.00", status: "Pending" },
  { id: "#ORD-7818", customer: "Noah Patel", product: "New Balance 574 Core", date: "Sep 20, 2026", amount: "$84.00", status: "Paid" },
  { id: "#ORD-7817", customer: "Emma Novak", product: "Converse Chuck 70", date: "Sep 19, 2026", amount: "$74.00", status: "Refunded" },
  { id: "#ORD-7816", customer: "Oliver Reyes", product: "Vans Old Skool Pro", date: "Sep 19, 2026", amount: "$68.00", status: "Paid" },
]

const statusStyles: Record<OrderStatus, string> = {
  Paid: "bg-emerald-500/10 text-emerald-600",
  Pending: "bg-amber-500/10 text-amber-600",
  Refunded: "bg-rose-500/10 text-rose-600",
}

const ranges = ["7 days", "30 days", "90 days"] as const

export function SalesContent() {
  const [range, setRange] = useState<(typeof ranges)[number]>("7 days")
  const [filter, setFilter] = useState<"All" | OrderStatus>("All")

  const visibleOrders = filter === "All" ? orders : orders.filter((o) => o.status === filter)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="p-5">
            <div className="flex items-start justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <m.icon className="size-5" />
              </span>
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs font-semibold",
                  m.up ? "text-emerald-500" : "text-rose-500",
                )}
              >
                {m.up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {m.change}
              </span>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{m.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-foreground">Revenue Overview</h3>
            <p className="text-sm text-muted-foreground">Daily revenue across your store</p>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-muted p-1">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  range === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <ChartContainer config={chartConfig} className="mt-4 h-64 w-full">
          <AreaChart data={revenueData} margin={{ left: 0, right: 8 }}>
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `$${v / 1000}k`} />
            <Area
              dataKey="revenue"
              type="monotone"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              fill="url(#fillRevenue)"
            />
          </AreaChart>
        </ChartContainer>
      </Card>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-foreground">Recent Orders</h3>
            <p className="text-sm text-muted-foreground">Latest transactions from your store</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-muted p-1">
              {(["All", "Paid", "Pending", "Refunded"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition",
                    filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="size-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3 font-medium">Order</th>
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Product</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Amount</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((o) => (
                <tr key={o.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-3 font-medium text-foreground">{o.id}</td>
                  <td className="px-3 py-3 text-foreground">{o.customer}</td>
                  <td className="px-3 py-3 text-muted-foreground">{o.product}</td>
                  <td className="px-3 py-3 text-muted-foreground">{o.date}</td>
                  <td className="px-3 py-3 font-semibold text-foreground">{o.amount}</td>
                  <td className="px-3 py-3">
                    <Badge variant="secondary" className={cn("rounded-full font-medium", statusStyles[o.status])}>
                      {o.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
