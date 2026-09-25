"use client"

import { useState } from "react"
import {
  BadgePercent,
  CalendarClock,
  Copy,
  Megaphone,
  Plus,
  Tag,
  Ticket,
  TrendingUp,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type CampaignStatus = "Active" | "Scheduled" | "Ended"

type Coupon = {
  code: string
  type: string
  value: string
  used: number
  limit: number
  status: CampaignStatus
}

const initialCoupons: Coupon[] = [
  { code: "SUMMER25", type: "Percentage", value: "25% off", used: 842, limit: 2000, status: "Active" },
  { code: "FREESHIP", type: "Shipping", value: "Free shipping", used: 1204, limit: 5000, status: "Active" },
  { code: "WELCOME10", type: "Fixed", value: "$10 off", used: 356, limit: 1000, status: "Active" },
  { code: "BLACKFRI", type: "Percentage", value: "40% off", used: 0, limit: 10000, status: "Scheduled" },
  { code: "SPRING15", type: "Percentage", value: "15% off", used: 990, limit: 990, status: "Ended" },
]

const statusStyles: Record<CampaignStatus, string> = {
  Active: "bg-emerald-500/10 text-emerald-600",
  Scheduled: "bg-blue-500/10 text-blue-600",
  Ended: "bg-muted text-muted-foreground",
}

type Campaign = {
  name: string
  channel: string
  reach: string
  conversions: string
  status: CampaignStatus
  enabled: boolean
}

const initialCampaigns: Campaign[] = [
  { name: "Fall Footware Push", channel: "Meta Ads", reach: "128K", conversions: "3.2%", status: "Active", enabled: true },
  { name: "Retargeting — Cart Abandon", channel: "Meta Ads", reach: "42K", conversions: "5.8%", status: "Active", enabled: true },
  { name: "New Arrivals Teaser", channel: "Instagram", reach: "0", conversions: "—", status: "Scheduled", enabled: false },
]

const metrics = [
  { label: "Active coupons", value: "3", icon: Ticket },
  { label: "Redemptions (30d)", value: "2,402", icon: BadgePercent },
  { label: "Revenue from promos", value: "$18,940", icon: TrendingUp },
  { label: "Avg. discount", value: "22%", icon: Tag },
]

export function PromotionsContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns)
  const [copied, setCopied] = useState<string | null>(null)

  const copyCode = (code: string) => {
    setCopied(code)
    setTimeout(() => setCopied(null), 1400)
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).catch(() => {})
    }
  }

  const toggle = (name: string) =>
    setCampaigns((prev) =>
      prev.map((c) => (c.name === name ? { ...c, enabled: !c.enabled } : c)),
    )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="p-5">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <m.icon className="size-5" />
            </span>
            <p className="mt-4 text-sm text-muted-foreground">{m.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{m.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-foreground">Coupon Codes</h3>
              <p className="text-sm text-muted-foreground">Discount codes available at checkout</p>
            </div>
            <Button size="sm" className="gap-2">
              <Plus className="size-4" />
              New coupon
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {initialCoupons.map((c) => (
              <div
                key={c.code}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 p-4"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Ticket className="size-5" />
                </span>
                <div className="min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-bold text-foreground">{c.code}</p>
                    <button
                      onClick={() => copyCode(c.code)}
                      className="text-muted-foreground transition hover:text-foreground"
                      aria-label={`Copy ${c.code}`}
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {copied === c.code ? "Copied!" : `${c.type} · ${c.value}`}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-6">
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold text-foreground">
                      {c.used.toLocaleString()} / {c.limit.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">redeemed</p>
                  </div>
                  <Badge variant="secondary" className={cn("rounded-full font-medium", statusStyles[c.status])}>
                    {c.status}
                  </Badge>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (c.used / c.limit) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Megaphone className="size-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Campaigns</h3>
          </div>
          <p className="text-sm text-muted-foreground">Ad campaigns driving traffic</p>

          <div className="mt-4 flex flex-col gap-3">
            {campaigns.map((c) => (
              <div key={c.name} className="rounded-2xl border border-border/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.channel}</p>
                  </div>
                  <Switch checked={c.enabled} onCheckedChange={() => toggle(c.name)} aria-label={`Toggle ${c.name}`} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Reach <span className="font-semibold text-foreground">{c.reach}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Conv. <span className="font-semibold text-foreground">{c.conversions}</span>
                  </span>
                  <Badge variant="secondary" className={cn("rounded-full font-medium", statusStyles[c.status])}>
                    {c.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-primary/[0.06] p-4">
            <CalendarClock className="size-5 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">
              Black Friday campaign goes live in <span className="font-semibold text-foreground">9 days</span>.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
