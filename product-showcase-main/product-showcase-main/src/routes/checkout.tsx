import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CreditCard,
  MapPin,
  PackageCheck,
  Phone,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import productImage from "@/assets/vitaboost-main.jpg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CheckoutSearch = {
  package: string;
  quantity: number;
  subtotal: number;
};

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => ({
    package: typeof search["package"] === "string" ? search["package"].slice(0, 40) : "2 Pcs",
    quantity: Math.max(1, Math.min(9, Number(search["quantity"]) || 1)),
    subtotal: Math.max(0, Math.min(100000, Number(search["subtotal"]) || 600)),
  }),
  head: () => ({
    meta: [
      { title: "Checkout | GadgetHome" },
      { name: "description", content: "Enter your delivery details and confirm your GadgetHome order." },
      { property: "og:title", content: "Secure Checkout | GadgetHome" },
      { property: "og:description", content: "Complete your VitaBoost order with cash on delivery across Bangladesh." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutPage,
});

const fieldClass = "mt-2 w-full rounded-lg border border-input bg-card px-4 py-3.5 text-base text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15";

function CheckoutPage() {
  const search = Route.useSearch();
  const [deliveryArea, setDeliveryArea] = useState<"inside" | "outside">("inside");
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);

  const deliveryCharge = deliveryArea === "inside" ? 60 : 120;
  const total = Math.max(0, search.subtotal - discount + deliveryCharge);

  const applyCoupon = () => {
    if (coupon.trim().toUpperCase() === "SAVE10") {
      const amount = Math.round(search.subtotal * 0.1);
      setDiscount(amount);
      setCouponMessage(`৳${amount.toLocaleString()} discount applied`);
      return;
    }
    setDiscount(0);
    setCouponMessage("Coupon code is not valid");
  };

  const submitOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextErrors: Record<string, string> = {};
    const name = String(data.get("name") ?? "").trim();
    const mobile = String(data.get("mobile") ?? "").replace(/\s/g, "");
    const address = String(data.get("address") ?? "").trim();

    if (name.length < 2) nextErrors["name"] = "Please enter your full name";
    if (!/^01\d{9}$/.test(mobile)) nextErrors["mobile"] = "Enter a valid 11-digit mobile number";
    if (address.length < 8) nextErrors["address"] = "Please enter your complete delivery address";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) setConfirmed(true);
  };

  if (confirmed) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5 py-12">
        <section className="w-full max-w-lg text-center">
          <span className="mx-auto grid size-20 place-items-center rounded-full bg-secondary text-primary">
            <PackageCheck className="size-10" />
          </span>
          <p className="mt-7 text-xs font-bold uppercase text-primary">Order confirmed</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">Thank you for your order</h1>
          <p className="mx-auto mt-3 max-w-sm leading-7 text-muted-foreground">
            We’ll call your mobile number to confirm delivery. Please pay ৳{total.toLocaleString()} when your parcel arrives.
          </p>
          <Button asChild size="lg" className="mt-8 w-full sm:w-auto">
            <Link to="/">Continue shopping</Link>
          </Button>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto grid h-20 max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <ShoppingCart className="size-7 shrink-0 text-accent" />
            <span className="truncate font-display text-xl font-semibold sm:text-2xl">Your Shopping Cart</span>
          </div>
          <Button asChild variant="ghost" size="icon" aria-label="Close checkout">
            <Link to="/"><X className="size-6 text-muted-foreground" /></Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition hover:text-primary">
          <ArrowLeft className="size-4" /> Back to Cart
        </Link>

        <form onSubmit={submitOrder} noValidate className="mt-7 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <h1 className="font-display text-xl font-semibold sm:text-2xl">Enter Delivery Details</h1>
            <div className="mt-6 space-y-5">
              <Field label="Your Name" icon={<User />} error={errors["name"]}>
                <input name="name" autoComplete="name" placeholder="Name" aria-invalid={Boolean(errors["name"])} className={cn(fieldClass, errors["name"] && "border-destructive focus:border-destructive focus:ring-destructive/15")} />
              </Field>
              <Field label="Mobile Number" icon={<Phone />} error={errors["mobile"]}>
                <input name="mobile" type="tel" inputMode="numeric" autoComplete="tel" placeholder="01700000000" aria-invalid={Boolean(errors["mobile"])} className={cn(fieldClass, errors["mobile"] && "border-destructive focus:border-destructive focus:ring-destructive/15")} />
              </Field>
              <Field label="Full Address" icon={<MapPin />} error={errors["address"]}>
                <textarea name="address" rows={3} autoComplete="street-address" placeholder="House no, Road no, Area..." aria-invalid={Boolean(errors["address"])} className={cn(fieldClass, "resize-y", errors["address"] && "border-destructive focus:border-destructive focus:ring-destructive/15")} />
              </Field>
            </div>

            <fieldset className="mt-6">
              <legend className="sr-only">Delivery area</legend>
              <div className="grid grid-cols-2 gap-3">
                {(["inside", "outside"] as const).map((area) => {
                  const active = deliveryArea === area;
                  const inside = area === "inside";
                  return (
                    <button key={area} type="button" onClick={() => setDeliveryArea(area)} className={cn("grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border bg-card p-4 text-left transition", active ? "border-primary bg-secondary ring-1 ring-primary" : "border-border hover:border-primary/50")}>
                      <span className="min-w-0"><span className="block text-sm font-bold">{inside ? "Inside Dhaka" : "Outside Dhaka"}</span><span className="mt-1 block text-sm text-muted-foreground">৳{inside ? 60 : 120}</span></span>
                      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", active ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                        {active && <Check className="size-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-6 border-y border-border py-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <input value={coupon} onChange={(event) => setCoupon(event.target.value)} placeholder="COUPON CODE" aria-label="Coupon code" className="min-w-0 rounded-lg border border-input bg-card px-4 py-3 text-sm font-bold uppercase tracking-wider outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15" />
                <Button type="button" variant="outline" onClick={applyCoupon}>Apply</Button>
              </div>
              {couponMessage && <p className={cn("mt-2 text-xs font-semibold", discount ? "text-primary" : "text-destructive")}>{couponMessage}</p>}
            </div>

            <OrderTotals subtotal={search.subtotal} delivery={deliveryCharge} discount={discount} total={total} />

            <div className="mt-5 flex gap-3 rounded-lg border border-border bg-card p-4 text-sm leading-5 text-muted-foreground">
              <CreditCard className="mt-0.5 size-5 shrink-0 text-accent" />
              <p>Payment: <strong className="text-foreground">Cash on Delivery</strong> — pay when you receive the product.</p>
            </div>

            <Button type="submit" variant="buy" size="lg" className="mt-5 w-full">
              Confirm Order <Check className="size-5" />
            </Button>
          </section>

          <aside className="order-first lg:order-last lg:sticky lg:top-8">
            <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
              <h2 className="font-display text-base font-semibold">Order summary</h2>
              <div className="mt-4 grid grid-cols-[72px_minmax(0,1fr)] gap-4 border-t border-border pt-4">
                <img src={productImage} alt="VitaBoost Vitamin C 1000mg" width={144} height={144} className="aspect-square rounded-lg object-cover ring-1 ring-border" />
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-semibold leading-5">VitaBoost Vitamin C 1000mg</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{search.package} · Quantity {search.quantity}</p>
                  <p className="mt-2 text-sm font-bold">৳{search.subtotal.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-4 hidden lg:block">
                <OrderTotals subtotal={search.subtotal} delivery={deliveryCharge} discount={discount} total={total} compact />
              </div>
            </div>
          </aside>
        </form>
      </main>
    </div>
  );
}

function Field({ label, icon, error, children }: { label: string; icon: React.ReactNode; error: string | undefined; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold">
      <span className="flex items-center gap-2">{<span className="text-accent [&_svg]:size-4">{icon}</span>} {label} <span className="text-destructive">*</span></span>
      {children}
      {error && <span role="alert" className="mt-1.5 block text-xs font-semibold text-destructive">{error}</span>}
    </label>
  );
}

function OrderTotals({ subtotal, delivery, discount, total, compact = false }: { subtotal: number; delivery: number; discount: number; total: number; compact?: boolean }) {
  return (
    <dl className={cn("space-y-3 text-sm", compact ? "border-t border-border pt-4" : "mt-5")}>
      <div className="flex justify-between gap-4"><dt>Subtotal:</dt><dd className="font-semibold">৳{subtotal.toLocaleString()}</dd></div>
      <div className="flex justify-between gap-4"><dt>Delivery Charge:</dt><dd className="font-semibold">৳{delivery}</dd></div>
      {discount > 0 && <div className="flex justify-between gap-4 text-primary"><dt>Discount:</dt><dd className="font-semibold">−৳{discount.toLocaleString()}</dd></div>}
      <div className="flex justify-between gap-4 border-t border-border pt-3 font-display text-lg font-semibold"><dt>Total:</dt><dd className="text-accent">৳{total.toLocaleString()}</dd></div>
    </dl>
  );
}