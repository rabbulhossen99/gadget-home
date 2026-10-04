"use client"

import { useState } from "react"
import { Store, CreditCard, Bell, Plug } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const notifications = [
  { id: "orders", label: "New orders", desc: "Email me when an order is placed", on: true },
  { id: "lowstock", label: "Low stock", desc: "Alert when inventory drops below threshold", on: true },
  { id: "payouts", label: "Payouts", desc: "Notify on settlement transfers", on: false },
  { id: "digest", label: "Weekly digest", desc: "Summary of store performance", on: true },
]

const integrations = [
  { name: "Meta Ads", desc: "Pixel & Conversions API", connected: true },
  { name: "Stripe", desc: "Payment processing", connected: true },
  { name: "Klaviyo", desc: "Email marketing", connected: false },
  { name: "Google Analytics", desc: "Web analytics", connected: false },
]

export function SettingsContent() {
  const [notifState, setNotifState] = useState(
    Object.fromEntries(notifications.map((n) => [n.id, n.on])),
  )

  return (
    <Tabs defaultValue="store" className="flex flex-col gap-5">
      <TabsList className="w-full max-w-md">
        <TabsTrigger value="store" className="gap-2">
          <Store className="size-4" />
          Store
        </TabsTrigger>
        <TabsTrigger value="billing" className="gap-2">
          <CreditCard className="size-4" />
          Billing
        </TabsTrigger>
        <TabsTrigger value="notifications" className="gap-2">
          <Bell className="size-4" />
          Alerts
        </TabsTrigger>
        <TabsTrigger value="integrations" className="gap-2">
          <Plug className="size-4" />
          Apps
        </TabsTrigger>
      </TabsList>

      <TabsContent value="store">
        <Card className="p-6">
          <h3 className="text-lg font-bold text-foreground">Store details</h3>
          <p className="text-sm text-muted-foreground">Basic information about your store</p>
          <Separator className="my-5" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="store-name">Store name</Label>
              <Input id="store-name" defaultValue="eMart" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="store-email">Support email</Label>
              <Input id="store-email" type="email" defaultValue="support@emart.shop" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select defaultValue="usd">
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usd">USD — US Dollar</SelectItem>
                  <SelectItem value="eur">EUR — Euro</SelectItem>
                  <SelectItem value="gbp">GBP — British Pound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tz">Timezone</Label>
              <Select defaultValue="pst">
                <SelectTrigger id="tz">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pst">Pacific (PST)</SelectItem>
                  <SelectItem value="est">Eastern (EST)</SelectItem>
                  <SelectItem value="utc">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline">Cancel</Button>
            <Button>Save changes</Button>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="billing">
        <Card className="p-6">
          <h3 className="text-lg font-bold text-foreground">Plan &amp; billing</h3>
          <p className="text-sm text-muted-foreground">Manage your subscription and payment method</p>
          <Separator className="my-5" />
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 p-5">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-foreground">Growth plan</p>
                <Badge variant="secondary" className="rounded-full bg-primary/10 font-medium text-primary">
                  Current
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">$79 / month · renews Oct 21, 2026</p>
            </div>
            <Button variant="outline">Change plan</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
                <CreditCard className="size-5" />
              </span>
              <div>
                <p className="font-semibold text-foreground">Visa ending 4242</p>
                <p className="text-sm text-muted-foreground">Expires 08 / 28</p>
              </div>
            </div>
            <Button variant="ghost">Update</Button>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="notifications">
        <Card className="p-6">
          <h3 className="text-lg font-bold text-foreground">Notifications</h3>
          <p className="text-sm text-muted-foreground">Choose which emails you receive</p>
          <Separator className="my-5" />
          <div className="flex flex-col gap-4">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">{n.label}</p>
                  <p className="text-sm text-muted-foreground">{n.desc}</p>
                </div>
                <Switch
                  checked={notifState[n.id]}
                  onCheckedChange={(v) => setNotifState((s) => ({ ...s, [n.id]: v }))}
                  aria-label={`Toggle ${n.label}`}
                />
              </div>
            ))}
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="integrations">
        <Card className="p-6">
          <h3 className="text-lg font-bold text-foreground">Connected apps</h3>
          <p className="text-sm text-muted-foreground">Extend your store with integrations</p>
          <Separator className="my-5" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {integrations.map((i) => (
              <div
                key={i.name}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Plug className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.desc}</p>
                  </div>
                </div>
                <Button variant={i.connected ? "outline" : "default"} size="sm">
                  {i.connected ? "Manage" : "Connect"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
