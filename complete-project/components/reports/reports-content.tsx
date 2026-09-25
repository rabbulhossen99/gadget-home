"use client"

import { useState } from "react"
import {
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Clock,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ReportType = {
  id: string
  title: string
  desc: string
  format: "CSV" | "PDF" | "XLSX"
  icon: typeof FileText
}

const reportTypes: ReportType[] = [
  { id: "sales", title: "Sales summary", desc: "Orders, revenue and refunds by day", format: "CSV", icon: FileSpreadsheet },
  { id: "products", title: "Product performance", desc: "Units sold and conversion per SKU", format: "XLSX", icon: FileSpreadsheet },
  { id: "pixel", title: "Pixel events", desc: "All Meta Pixel events with attribution", format: "CSV", icon: FileText },
  { id: "customers", title: "Customer export", desc: "Contacts and lifetime value", format: "CSV", icon: FileText },
  { id: "tax", title: "Tax report", desc: "Collected tax by region", format: "PDF", icon: FileText },
  { id: "payouts", title: "Payout statement", desc: "Gateway settlements and fees", format: "PDF", icon: FileText },
]

type Generated = {
  name: string
  range: string
  size: string
  created: string
  status: "Ready" | "Processing"
}

const generated: Generated[] = [
  { name: "Sales summary — September", range: "Sep 1 – Sep 21", size: "48 KB", created: "2 hours ago", status: "Ready" },
  { name: "Pixel events — Q3", range: "Jul 1 – Sep 21", size: "1.2 MB", created: "Yesterday", status: "Ready" },
  { name: "Product performance — August", range: "Aug 1 – Aug 31", size: "96 KB", created: "3 days ago", status: "Ready" },
  { name: "Customer export — Full", range: "All time", size: "—", created: "Just now", status: "Processing" },
]

const ranges = ["Last 7 days", "Last 30 days", "This quarter", "Year to date"] as const

export function ReportsContent() {
  const [range, setRange] = useState<(typeof ranges)[number]>("Last 30 days")
  const [generating, setGenerating] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const generate = (id: string) => {
    setGenerating(id)
    setDone(null)
    setTimeout(() => {
      setGenerating(null)
      setDone(id)
      setTimeout(() => setDone(null), 2000)
    }, 1400)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h3 className="text-base font-bold text-foreground">Report range</h3>
          <p className="text-sm text-muted-foreground">Applied to every report you generate below</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-full bg-muted p-1">
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
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reportTypes.map((r) => (
          <Card key={r.id} className="flex flex-col p-6">
            <div className="flex items-start justify-between">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <r.icon className="size-5" />
              </span>
              <Badge variant="secondary" className="rounded-full font-medium">
                {r.format}
              </Badge>
            </div>
            <h4 className="mt-4 text-base font-bold text-foreground">{r.title}</h4>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{r.desc}</p>
            <Button
              variant="outline"
              className="mt-4 w-full gap-2"
              onClick={() => generate(r.id)}
              disabled={generating === r.id}
            >
              {generating === r.id ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating…
                </>
              ) : done === r.id ? (
                <>
                  <Check className="size-4" />
                  Ready to download
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Generate report
                </>
              )}
            </Button>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-bold text-foreground">Recent Exports</h3>
        <p className="text-sm text-muted-foreground">Download previously generated reports</p>

        <div className="mt-4 flex flex-col gap-3">
          {generated.map((g) => (
            <div
              key={g.name}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 p-4"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
                <FileText className="size-5" />
              </span>
              <div className="min-w-[160px]">
                <p className="font-semibold text-foreground">{g.name}</p>
                <p className="text-xs text-muted-foreground">
                  {g.range} · {g.size}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-4">
                <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                  <Clock className="size-3.5" />
                  {g.created}
                </span>
                {g.status === "Ready" ? (
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Download className="size-4" />
                    Download
                  </Button>
                ) : (
                  <Badge variant="secondary" className="gap-1.5 rounded-full bg-amber-500/10 font-medium text-amber-600">
                    <Loader2 className="size-3 animate-spin" />
                    Processing
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
