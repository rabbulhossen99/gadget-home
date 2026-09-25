"use client"

import { useState } from "react"
import {
  Cookie,
  Database,
  Fingerprint,
  Globe,
  ShieldCheck,
  UserX,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

type Toggle = {
  id: string
  title: string
  desc: string
  icon: typeof Cookie
  enabled: boolean
}

const initialToggles: Toggle[] = [
  {
    id: "pixel",
    title: "Meta Pixel tracking",
    desc: "Send browsing and purchase events to Meta for ad optimization.",
    icon: Fingerprint,
    enabled: true,
  },
  {
    id: "capi",
    title: "Conversions API",
    desc: "Server-side event forwarding for improved attribution accuracy.",
    icon: Database,
    enabled: true,
  },
  {
    id: "cookies",
    title: "Cookie consent banner",
    desc: "Require visitor consent before loading non-essential cookies.",
    icon: Cookie,
    enabled: true,
  },
  {
    id: "anon",
    title: "IP anonymization",
    desc: "Mask the last octet of visitor IP addresses before storage.",
    icon: Globe,
    enabled: false,
  },
]

const requests = [
  { name: "Amelia Ford", email: "amelia@example.com", type: "Data export", date: "Sep 20, 2026", status: "Completed" },
  { name: "Marco Silva", email: "marco@example.com", type: "Deletion", date: "Sep 19, 2026", status: "Pending" },
  { name: "Yuki Tanaka", email: "yuki@example.com", type: "Data export", date: "Sep 17, 2026", status: "Completed" },
]

export function PrivacyContent() {
  const [toggles, setToggles] = useState<Toggle[]>(initialToggles)

  const flip = (id: string) =>
    setToggles((prev) => prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)))

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-row flex-wrap items-center gap-4 p-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
          <ShieldCheck className="size-6" />
        </span>
        <div className="flex-1">
          <h3 className="text-base font-bold text-foreground">GDPR &amp; CCPA compliant</h3>
          <p className="text-sm text-muted-foreground">
            Your store meets current data-protection requirements. Last reviewed Sep 15, 2026.
          </p>
        </div>
        <Badge variant="secondary" className="rounded-full bg-emerald-500/10 font-medium text-emerald-600">
          Compliant
        </Badge>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {toggles.map((t) => (
          <Card key={t.id} className="flex flex-row items-start gap-4 p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <t.icon className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{t.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{t.desc}</p>
            </div>
            <Switch checked={t.enabled} onCheckedChange={() => flip(t.id)} aria-label={`Toggle ${t.title}`} />
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <UserX className="size-5 text-primary" />
          <h3 className="text-lg font-bold text-foreground">Data Subject Requests</h3>
        </div>
        <p className="text-sm text-muted-foreground">Export and deletion requests from customers</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3 font-medium">Customer</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.email} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-3">
                    <p className="font-medium text-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{r.type}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.date}</td>
                  <td className="px-3 py-3">
                    <Badge
                      variant="secondary"
                      className={
                        r.status === "Completed"
                          ? "rounded-full bg-emerald-500/10 font-medium text-emerald-600"
                          : "rounded-full bg-amber-500/10 font-medium text-amber-600"
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button variant="ghost" size="sm">
                      {r.status === "Pending" ? "Review" : "View"}
                    </Button>
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
