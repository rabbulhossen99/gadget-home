import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  Truck,
  User,
} from "lucide-react";

import productImage from "@/assets/vitaboost-main.jpg";
import { Button } from "@/components/ui/button";

type OrderSuccessSearch = {
  orderId: string;
  name: string;
  mobile: string;
  address: string;
  package: string;
  quantity: number;
  subtotal: number;
  delivery: number;
  discount: number;
  total: number;
};

export const Route = createFileRoute("/order-success")({
  validateSearch: (search: Record<string, unknown>): OrderSuccessSearch => ({
    orderId: typeof search["orderId"] === "string" ? search["orderId"].slice(0, 20) : "VH-000000",
    name: typeof search["name"] === "string" ? search["name"].slice(0, 80) : "Customer",
    mobile: typeof search["mobile"] === "string" ? search["mobile"].slice(0, 20) : "",
    address: typeof search["address"] === "string" ? search["address"].slice(0, 200) : "",
    package: typeof search["package"] === "string" ? search["package"].slice(0, 40) : "2 Pcs",
    quantity: Math.max(1, Math.min(9, Number(search["quantity"]) || 1)),
    subtotal: Math.max(0, Math.min(100000, Number(search["subtotal"]) || 600)),
    delivery: Math.max(0, Math.min(1000, Number(search["delivery"]) || 60)),
    discount: Math.max(0, Math.min(100000, Number(search["discount"]) || 0)),
    total: Math.max(0, Math.min(100000, Number(search["total"]) || 660)),
  }),
  head: () => ({
    meta: [
      { title: "Order Confirmed | GadgetHome" },
      {
        name: "description",
        content: "Your GadgetHome order has been confirmed. Track your delivery and pay cash on arrival.",
      },
      { property: "og:title", content: "Order Confirmed | GadgetHome" },
      {
        property: "og:description",
        content: "Your GadgetHome order has been confirmed. Pay cash on delivery when it arrives.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrderSuccessPage,
});

function OrderSuccessPage() {
  const order = Route.useSearch();
  const etaLabel = order.delivery <= 60 ? "24–48 hours" : "2–4 days";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-20 max-w-3xl items-center gap-3 px-5 sm:px-8">
          <ShoppingBag className="size-7 shrink-0 text-accent" />
          <span className="font-display text-xl font-semibold sm:text-2xl">GadgetHome</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <section className="text-center">
          <span className="mx-auto grid size-20 place-items-center rounded-full bg-secondary text-primary">
            <CheckCircle2 className="size-11" />
          </span>
          <p className="mt-7 text-xs font-bold uppercase tracking-widest text-primary">Order confirmed</p>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Thank you{order.name ? `, ${order.name.split(" ")[0]}` : ""}!</h1>
          <p className="mx-auto mt-3 max-w-md leading-7 text-muted-foreground">
            Your order has been placed successfully. We’ll call <strong className="text-foreground">{order.mobile || "your number"}</strong> to confirm delivery. Please keep <strong className="text-foreground">৳{order.total.toLocaleString()}</strong> ready for cash on delivery.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold">
            <span className="text-muted-foreground">Order ID:</span>
            <span className="text-accent">{order.orderId}</span>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Ordered item */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-display text-base font-semibold">Order summary</h2>
            <div className="mt-4 grid grid-cols-[72px_minmax(0,1fr)] gap-4 border-t border-border pt-4">
              <img
                src={productImage}
                alt="VitaBoost Vitamin C 1000mg"
                width={144}
                height={144}
                className="aspect-square rounded-lg object-cover ring-1 ring-border"
              />
              <div className="min-w-0">
                <h3 className="font-display text-sm font-semibold leading-5">VitaBoost Vitamin C 1000mg</h3>
                <p className="mt-1 text-xs text-muted-foreground">{order.package} · Quantity {order.quantity}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-semibold">৳{order.subtotal.toLocaleString()}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Delivery</dt><dd className="font-semibold">৳{order.delivery}</dd></div>
                  {order.discount > 0 && (
                    <div className="flex justify-between gap-4 text-primary"><dt>Discount</dt><dd className="font-semibold">−৳{order.discount.toLocaleString()}</dd></div>
                  )}
                  <div className="flex justify-between gap-4 border-t border-border pt-2 font-display text-lg font-semibold"><dt>Total</dt><dd className="text-accent">৳{order.total.toLocaleString()}</dd></div>
                </dl>
              </div>
            </div>
          </div>

          {/* Delivery + timeline */}
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="font-display text-base font-semibold">Delivery details</h2>
              <ul className="mt-4 space-y-3 text-sm">
                {order.name && (
                  <li className="flex items-start gap-3"><User className="mt-0.5 size-4 shrink-0 text-accent" /><span className="text-muted-foreground">{order.name}</span></li>
                )}
                {order.mobile && (
                  <li className="flex items-start gap-3"><Phone className="mt-0.5 size-4 shrink-0 text-accent" /><span className="text-muted-foreground">{order.mobile}</span></li>
                )}
                {order.address && (
                  <li className="flex items-start gap-3"><MapPin className="mt-0.5 size-4 shrink-0 text-accent" /><span className="text-muted-foreground">{order.address}</span></li>
                )}
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold"><Truck className="size-4 text-accent" /> Delivery status</h2>
              <ol className="mt-4 space-y-4">
                <TimelineStep icon={<CheckCircle2 className="size-4" />} title="Order confirmed" subtitle="Your order has been received" active />
                <TimelineStep icon={<Package className="size-4" />} title="Packing" subtitle="Preparing your parcel" />
                <TimelineStep icon={<Clock className="size-4" />} title={`Arriving in ${etaLabel}`} subtitle="Our team will call to confirm" />
              </ol>
            </div>
          </div>
        </section>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" variant="buy" className="w-full sm:w-auto">
            <Link to="/"><ShoppingBag className="size-5" /> Continue shopping</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
            <Link to="/checkout" search={{ package: order.package, quantity: order.quantity, subtotal: order.subtotal } as any}>View order</Link>
          </Button>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Need help with your order? Call us at <a href="tel:+8809600000000" className="font-semibold text-primary">09600-000000</a>.
        </p>
      </main>
    </div>
  );
}

function TimelineStep({
  icon,
  title,
  subtitle,
  active = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  active?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className={active ? "grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" : "grid size-8 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground"}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </li>
  );
}
