"use client"

import { useMemo, useState } from "react"
import {
  Package,
  DollarSign,
  Target,
  Users,
  Code2,
  Check,
  Copy,
  Sparkles,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const STANDARD_EVENTS = [
  "ViewContent",
  "AddToCart",
  "AddToWishlist",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Purchase",
  "Lead",
  "CompleteRegistration",
  "Subscribe",
]

const RULE_TYPES = [
  { value: "url_contains", label: "URL contains" },
  { value: "url_equals", label: "URL equals" },
  { value: "event_equals", label: "Event equals" },
]

const CONTENT_TYPES = ["product", "product_group"]

type FormState = {
  // Product
  name: string
  productId: string
  category: string
  stock: string
  description: string
  price: string
  compareAt: string
  currency: string
  // Meta targeting
  pixelId: string
  datasetId: string
  conversionName: string
  standardEvent: string
  contentType: string
  contentName: string
  contentCategory: string
  conversionValue: string
  ruleType: string
  ruleValue: string
  // Audience
  ageMin: string
  ageMax: string
  genders: string
  countries: string
  interests: string
}

const initialState: FormState = {
  name: "",
  productId: "",
  category: "",
  stock: "",
  description: "",
  price: "",
  compareAt: "",
  currency: "USD",
  pixelId: "",
  datasetId: "",
  conversionName: "",
  standardEvent: "Purchase",
  contentType: "product",
  contentName: "",
  contentCategory: "",
  conversionValue: "",
  ruleType: "url_contains",
  ruleValue: "",
  ageMin: "18",
  ageMax: "65",
  genders: "all",
  countries: "",
  interests: "",
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  desc,
  accent,
}: {
  icon: typeof Package
  title: string
  desc: string
  accent?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={
          accent
            ? "grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"
            : "grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"
        }
      >
        <Icon className="size-5" />
      </span>
      <div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}

export function CreateProductForm() {
  const [form, setForm] = useState<FormState>(initialState)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const pixelSnippet = useMemo(() => {
    const pixelId = form.pixelId || "YOUR_PIXEL_ID"
    const event = form.standardEvent || "Purchase"
    const payload = {
      content_ids: [form.productId || "PRODUCT_ID"],
      content_name: form.contentName || form.name || "Product Name",
      content_category: form.contentCategory || form.category || "Category",
      content_type: form.contentType,
      value: Number(form.conversionValue || form.price || 0),
      currency: form.currency,
    }
    return `<!-- Meta Pixel: ${form.conversionName || "Custom Conversion"} -->
fbq('init', '${pixelId}');
fbq('track', '${event}', ${JSON.stringify(payload, null, 2)});`
  }, [form])

  const handleCopy = () => {
    const markCopied = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }

    // Fallback for sandboxed iframes / insecure contexts where the async
    // Clipboard API is blocked by the permissions policy.
    const legacyCopy = () => {
      try {
        const el = document.createElement("textarea")
        el.value = pixelSnippet
        el.style.position = "fixed"
        el.style.opacity = "0"
        document.body.appendChild(el)
        el.select()
        document.execCommand("copy")
        document.body.removeChild(el)
        markCopied()
      } catch {
        /* clipboard genuinely unavailable */
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      // Attach a rejection handler so a blocked write never escapes as an
      // unhandled promise rejection; degrade to the legacy path instead.
      navigator.clipboard.writeText(pixelSnippet).then(markCopied, legacyCopy)
    } else {
      legacyCopy()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2600)
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="flex flex-col gap-4 xl:col-span-2">
        {/* Product details */}
        <Card className="space-y-5 p-6">
          <SectionHeader icon={Package} title="Product Details" desc="Basic information about the product" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Product name" htmlFor="name">
                <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Nike Air Zoom Pegasus" />
              </Field>
            </div>
            <Field label="Product ID / SKU" htmlFor="productId" hint="Used as the Meta Pixel content_id for this product">
              <Input id="productId" value={form.productId} onChange={(e) => set("productId", e.target.value)} placeholder="SKU-10245" />
            </Field>
            <Field label="Category" htmlFor="category">
              <Input id="category" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Footware" />
            </Field>
            <Field label="Stock quantity" htmlFor="stock">
              <Input id="stock" type="number" value={form.stock} onChange={(e) => set("stock", e.target.value)} placeholder="120" />
            </Field>
            <Field label="Content type" htmlFor="contentType">
              <Select value={form.contentType} onValueChange={(v) => set("contentType", v)}>
                <SelectTrigger id="contentType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="description">
                <Textarea id="description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe the product..." rows={4} />
              </Field>
            </div>
          </div>
        </Card>

        {/* Pricing */}
        <Card className="space-y-5 p-6">
          <SectionHeader icon={DollarSign} title="Pricing & Inventory" desc="Set the price and conversion value" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Price" htmlFor="price">
              <Input id="price" type="number" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="129.00" />
            </Field>
            <Field label="Compare at price" htmlFor="compareAt">
              <Input id="compareAt" type="number" value={form.compareAt} onChange={(e) => set("compareAt", e.target.value)} placeholder="159.00" />
            </Field>
            <Field label="Currency" htmlFor="currency">
              <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["USD", "EUR", "GBP", "INR", "AUD", "CAD"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Card>

        {/* Meta Ads Targeting */}
        <Card className="space-y-5 border-primary/30 bg-primary/[0.03] p-6">
          <div className="flex items-center justify-between">
            <SectionHeader
              icon={Target}
              accent
              title="Meta Ads Targeting"
              desc="Meta Pixel custom conversion for this product"
            />
            <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary">
              <Sparkles className="size-3" /> Pixel
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Meta Pixel ID" htmlFor="pixelId">
              <Input id="pixelId" value={form.pixelId} onChange={(e) => set("pixelId", e.target.value)} placeholder="1234567890123456" />
            </Field>
            <Field label="Dataset ID (Conversions API)" htmlFor="datasetId" hint="Optional — for server-side events">
              <Input id="datasetId" value={form.datasetId} onChange={(e) => set("datasetId", e.target.value)} placeholder="9876543210" />
            </Field>
            <Field label="Custom conversion name" htmlFor="conversionName">
              <Input id="conversionName" value={form.conversionName} onChange={(e) => set("conversionName", e.target.value)} placeholder="Pegasus Purchase" />
            </Field>
            <Field label="Standard event" htmlFor="standardEvent">
              <Select value={form.standardEvent} onValueChange={(v) => set("standardEvent", v)}>
                <SelectTrigger id="standardEvent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STANDARD_EVENTS.map((ev) => (
                    <SelectItem key={ev} value={ev}>{ev}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Content name (content_name)" htmlFor="contentName">
              <Input id="contentName" value={form.contentName} onChange={(e) => set("contentName", e.target.value)} placeholder="Defaults to product name" />
            </Field>
            <Field label="Content category (content_category)" htmlFor="contentCategory">
              <Input id="contentCategory" value={form.contentCategory} onChange={(e) => set("contentCategory", e.target.value)} placeholder="Defaults to category" />
            </Field>
            <Field label="Conversion value" htmlFor="conversionValue" hint="Defaults to product price">
              <Input id="conversionValue" type="number" value={form.conversionValue} onChange={(e) => set("conversionValue", e.target.value)} placeholder="129.00" />
            </Field>
            <div />

            <Separator className="sm:col-span-2" />

            <Field label="Conversion rule" htmlFor="ruleType">
              <Select value={form.ruleType} onValueChange={(v) => set("ruleType", v)}>
                <SelectTrigger id="ruleType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Rule value" htmlFor="ruleValue" hint="e.g. /thank-you or the event name">
              <Input id="ruleValue" value={form.ruleValue} onChange={(e) => set("ruleValue", e.target.value)} placeholder="/products/sku-10245/thank-you" />
            </Field>
          </div>
        </Card>

        {/* Audience */}
        <Card className="space-y-5 p-6">
          <SectionHeader icon={Users} title="Audience Targeting" desc="Detailed targeting for this product's ad set" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Age min" htmlFor="ageMin">
              <Input id="ageMin" type="number" value={form.ageMin} onChange={(e) => set("ageMin", e.target.value)} />
            </Field>
            <Field label="Age max" htmlFor="ageMax">
              <Input id="ageMax" type="number" value={form.ageMax} onChange={(e) => set("ageMax", e.target.value)} />
            </Field>
            <Field label="Genders" htmlFor="genders">
              <Select value={form.genders} onValueChange={(v) => set("genders", v)}>
                <SelectTrigger id="genders">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Countries" htmlFor="countries" hint="Comma separated ISO codes">
              <Input id="countries" value={form.countries} onChange={(e) => set("countries", e.target.value)} placeholder="US, GB, CA" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Interests / detailed targeting" htmlFor="interests" hint="Comma separated">
                <Textarea id="interests" value={form.interests} onChange={(e) => set("interests", e.target.value)} placeholder="Running, Fitness, Athletic shoes" rows={3} />
              </Field>
            </div>
          </div>
        </Card>
      </div>

      {/* Sticky summary + snippet */}
      <div className="xl:col-span-1">
        <div className="flex flex-col gap-4 xl:sticky xl:top-24">
          <Card className="space-y-4 p-6">
            <SectionHeader icon={Code2} title="Pixel Snippet" desc="Live preview of the tracking code" />
            <pre className="max-h-72 overflow-auto rounded-xl bg-foreground p-4 text-xs leading-relaxed text-background">
              <code>{pixelSnippet}</code>
            </pre>
            <Button type="button" variant="outline" className="w-full gap-2" onClick={handleCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy snippet"}
            </Button>
          </Card>

          <Card className="space-y-3 p-6">
            <h3 className="text-base font-bold text-foreground">Publish</h3>
            <p className="text-sm text-muted-foreground">
              Save the product and attach its Meta Pixel custom conversion.
            </p>
            <Button type="submit" className="w-full gap-2">
              {saved ? <Check className="size-4" /> : null}
              {saved ? "Product saved" : "Create product"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setForm(initialState)}>
              Reset
            </Button>
          </Card>
        </div>
      </div>
    </form>
  )
}
