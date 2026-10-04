import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, PackageCheck, Trash2 } from "lucide-react";
import { useStore, useResource } from "@/lib/store";
import {
  cartData,
  orderData,
  track,
  trackingConsent,
  useTracking,
} from "@/lib/tracking";
import { api, money } from "@/lib/api";
import type { Order, Quote } from "@/lib/types";
import { Field, ErrorBox, Empty } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { normalizePhone, phonePattern } from "../../shared/phone.mjs";
function useQuote(area: string, coupon: string) {
  const { cart, catalog } = useStore(),
    [quote, setQuote] = useState<Quote | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const body = JSON.stringify({ items: cart, area, coupon });
  useEffect(() => {
    let active = true;
    setLoading(true);
    setQuote(null);
    setError("");
    api<Quote>("/quote", "POST", JSON.parse(body))
      .then((q) => {
        if (active) setQuote(q);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // Catalog is refreshed on focus and every 15 seconds, including when a
    // scheduled coupon becomes available without an underlying record edit.
  }, [body, catalog]);
  return { quote, error, loading };
}
export function Totals({ quote, checkout = false }: { quote: Quote; checkout?: boolean }) {
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd>{money(quote.subtotal)}</dd>
      </div>
      {(checkout || !quote.freeDelivery) && (
        <div className="flex justify-between">
          <dt>Shipping</dt>
          <dd>{quote.shipping ? money(quote.shipping) : "Free"}</dd>
        </div>
      )}
      {!checkout && <div className="flex justify-between">
        <dt>Discount</dt>
        <dd>−{money(quote.discount)}</dd>
      </div>}
      <div className="flex justify-between border-t pt-4 text-xl font-bold">
        <dt>Total</dt>
        <dd>{money(quote.total)}</dd>
      </div>
    </dl>
  );
}
export function Cart() {
  const { cart, setCart, catalog, notice } = useStore(),
    { quote, error } = useQuote("inside", ""),
    [busy, setBusy] = useState(false);
  async function change(index: number, quantity: number) {
    setBusy(true);
    try {
      await setCart(
        quantity
          ? cart.map((x, i) => (i === index ? { ...x, quantity } : x))
          : cart.filter((_, i) => i !== index),
      );
    } catch (e) {
      notice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-8 font-display text-4xl font-bold">
        Your shopping cart
      </h1>
      <ErrorBox error={error} />
      {!cart.length ? (
        <Empty>
          Your cart is empty.{" "}
          <Link to="/shop" className="underline">
            Find something you love
          </Link>
        </Empty>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {cart.map((item, i) => {
              const p =
                item.type === "product"
                  ? catalog.products.find((p) => p.id === item.productId)
                  : null;
              const line = quote?.lines[i];
              return (
                <article
                  className="flex gap-4 rounded-2xl border bg-card p-4"
                  key={i}
                >
                  {(line?.image || p?.images[0]) && (
                    <img
                      src={line?.image || p?.images[0]}
                      alt=""
                      className="size-20 rounded-xl object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold">
                      {line?.name ||
                        p?.name ||
                        (item.type === "combo"
                          ? "Combo"
                          : "Unavailable product")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {line?.variant}
                    </p>
                    {line?.components && (
                      <p className="text-xs">
                        {line.components.map((c) => c.name).join(", ")}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <input
                        aria-label={`Quantity for ${line?.name || "item"}`}
                        type="number"
                        min={1}
                        max={99}
                        className="field w-20"
                        value={item.quantity}
                        disabled={busy}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (n >= 1 && n <= 99) void change(i, n);
                        }}
                      />
                      <strong>
                        {line ? money(line.total) : "Review availability"}
                      </strong>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        aria-label="Remove item"
                        onClick={() => change(i, 0)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <aside className="h-fit rounded-2xl border bg-card p-6">
            {quote && <Totals quote={quote} />}
            <p className="my-4 text-xs text-muted-foreground">
              Shipping shown for Dhaka. Confirm your delivery area at checkout.
            </p>
            <Button
              variant="shop"
              size="shop"
              className="w-full"
              asChild
              disabled={!quote || busy}
            >
              <Link
                to="/checkout"
                aria-disabled={!quote || busy}
                onClick={(e) => {
                  if (!quote || busy) e.preventDefault();
                }}
              >
                Checkout
              </Link>
            </Button>
          </aside>
        </div>
      )}
    </main>
  );
}
export function Checkout() {
  const { cart, catalog, user, refresh, notice } = useStore(),
    navigate = useNavigate(),
    [area, setArea] = useState("inside"),
    [coupon, setCoupon] = useState(""),
    [applied, setApplied] = useState(""),
    [name, setName] = useState(user?.name || ""),
    [phone, setPhone] = useState(""),
    [address, setAddress] = useState(""),
    [payment, setPayment] = useState(
      catalog.settings.codEnabled ? "cod" : "manual",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [draftSaved, setDraftSaved] = useState(false);
  const { quote, error: quoteError, loading } = useQuote(area, applied);
  const [key] = useState(() => {
    const value = sessionStorage.getItem("checkout-key") || crypto.randomUUID();
    sessionStorage.setItem("checkout-key", value);
    return value;
  });
  const config = catalog.settings;
  useEffect(() => {
    setDraftSaved(false);
    const normalized = normalizePhone(phone);
    if (!normalized || !cart.length || busy) return;
    const timer = setTimeout(() => {
      api("/checkout-draft", "PUT", {
        name,
        phone: normalized,
        address,
        items: cart,
        checkoutKey: key,
      })
        .then(() => setDraftSaved(true))
        .catch(() => setDraftSaved(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [name, phone, address, cart, key, busy]);
  const { active } = useTracking(),
    initiated = useRef(false);
  useEffect(() => {
    if (!active || !quote || !cart.length || initiated.current) return;
    initiated.current = true;
    track("InitiateCheckout", () => ({
      ...cartData(cart, catalog),
      value: quote.total / 100,
    }));
  }, [active, quote]);
  if (!cart.length)
    return (
      <main className="p-12">
        <Empty>
          Your cart is empty. <Link to="/shop">Continue shopping</Link>
        </Empty>
      </main>
    );
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link to="/cart" className="text-sm font-semibold">
        ← Back to cart
      </Link>
      <h1 className="my-6 font-display text-3xl font-bold">Checkout</h1>
      <form
        className="grid items-start gap-10 lg:grid-cols-[1fr_360px]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!quote || loading || busy) return;
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          track("AddPaymentInfo", () => ({
            ...cartData(cart, catalog),
            value: quote.total / 100,
          }));
          try {
            const order = await api<Order>("/orders", "POST", {
              name,
              phone,
              address,
              note: form.get("note") || "",
              items: cart,
              area,
              coupon: applied,
              paymentMethod: payment,
              paymentReference: form.get("paymentReference") || "",
              idempotencyKey: key,
              expectedTotal: quote.total,
              tracking: { consent: trackingConsent(), sourceUrl: location.href },
            });
            // Same event ID as the server-side Purchase, so Meta counts it once.
            track("Purchase", () => orderData(order), `purchase_${order.id}`);
            if (order.trackingToken)
              sessionStorage.setItem(
                "tracking:" + order.id,
                order.trackingToken,
              );
            sessionStorage.removeItem("checkout-key");
            navigate("/order-success/" + order.id);
            await refresh();
          } catch (e) {
            setError((e as Error).message);
            await refresh().catch(() => {});
          } finally {
            setBusy(false);
          }
        }}
      >
        <section className="space-y-5">
          <h2 className="text-xl font-bold">Enter delivery details</h2>
          <Field label="Your name">
            <input
              className="field"
              autoComplete="name"
              placeholder="Name"
              required
              minLength={2}
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Mobile number">
            <input
              className="field"
              autoComplete="tel"
              type="tel"
              pattern={phonePattern}
              title="11 digits starting with 01, optionally prefixed with +88"
              placeholder="01XXXXXXXXX"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label="Full address">
            <textarea
              className="field"
              autoComplete="street-address"
              placeholder="Area, Thana & District"
              required
              minLength={8}
              maxLength={1000}
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          {quote && !quote.freeDelivery && <fieldset>
            <legend className="mb-2 text-sm font-semibold">
              Delivery area
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {["inside", "outside"].map((a) => (
                <label
                  key={a}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4"
                >
                  <input
                    type="radio"
                    name="area"
                    value={a}
                    checked={area === a}
                    onChange={() => setArea(a)}
                  />
                  <span>
                    {a === "inside" ? "Inside Dhaka" : "Outside Dhaka"}
                    {!quote?.freeDelivery && (
                      <small className="block text-muted-foreground">
                        {money(
                          a === "inside"
                            ? config.shippingInside
                            : config.shippingOutside,
                        )}
                      </small>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>}
          <div className="flex gap-2">
            <input
              value={coupon}
              className="field"
              placeholder="Coupon code"
              aria-label="Coupon code"
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setApplied(coupon.trim())}
            >
              Apply
            </Button>
            {applied && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setApplied("");
                  setCoupon("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
          <fieldset className="space-y-3">
            <legend className="mb-3 font-semibold">Payment method</legend>
            {config.codEnabled && (
              <label className="flex gap-3">
                <input
                  type="radio"
                  name="payment"
                  checked={payment === "cod"}
                  onChange={() => setPayment("cod")}
                />
                Cash on delivery
              </label>
            )}
            {config.manualEnabled && (
              <label className="flex gap-3">
                <input
                  type="radio"
                  name="payment"
                  checked={payment === "manual"}
                  onChange={() => setPayment("manual")}
                />
                Manual mobile payment
              </label>
            )}
            {payment === "manual" && (
              <div className="rounded-xl border bg-card p-4">
                <p className="mb-3 whitespace-pre-line text-sm">
                  {config.manualInstructions}
                </p>
                <Field label="Transaction reference">
                  <input
                    className="field"
                    name="paymentReference"
                    minLength={4}
                    maxLength={100}
                    required
                  />
                </Field>
                <p className="mt-2 text-xs">
                  Your payment remains unverified until reviewed by the store.
                </p>
              </div>
            )}
          </fieldset>
          <Field label="Order note (optional)">
            <textarea className="field" name="note" rows={2} maxLength={1000} />
          </Field>
          {draftSaved && (
            <p className="text-xs text-muted-foreground">
              Delivery details saved to help complete your checkout.
            </p>
          )}
          <ErrorBox error={error || quoteError} />
        </section>
        <aside className="rounded-2xl border bg-card p-6 lg:sticky lg:top-28">
          <h2 className="mb-5 text-xl font-bold">Order summary</h2>
          {quote?.lines.map((line, i) => (
            <div key={i} className="mb-5 flex gap-3">
              <img
                src={line.image}
                alt=""
                className="size-16 rounded-lg object-cover"
              />
              <div>
                <p className="text-sm font-semibold">{line.name}</p>
                <p className="text-xs text-muted-foreground">
                  {line.variant} × {line.quantity}
                </p>
                <p className="mt-1 text-sm">{money(line.total)}</p>
              </div>
            </div>
          ))}
          {quote && <Totals quote={quote} checkout />}
          <Button
            type="submit"
            variant="shop"
            size="shop"
            className="mt-6 w-full"
            disabled={busy || !quote || loading || !normalizePhone(phone)}
          >
            {busy
              ? "Placing order…"
              : loading
                ? "Updating total…"
                : "Place order"}
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Your order will be saved before confirmation.
          </p>
        </aside>
      </form>
    </main>
  );
}
export function OrderDetails({ order }: { order: Order }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">{order.number}</h2>
          <p className="text-sm text-muted-foreground">
            {order.createdAt} · {order.status}
          </p>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border p-5">
          <h3 className="mb-3 font-bold">Delivery</h3>
          <p>
            {order.name} · {order.phone}
          </p>
          <p className="whitespace-pre-line">{order.address}</p>
          {order.carrier && (
            <p className="mt-3">
              {order.carrier}: {order.trackingNumber}
            </p>
          )}
          <p className="mt-2">{order.shippingNote}</p>
        </div>
        <div className="rounded-xl border p-5">
          <Totals quote={order} />
        </div>
      </div>
      {order.lines.map((l, i) => (
        <div key={i} className="flex items-center gap-4 border-b py-3">
          <img
            src={l.image}
            alt=""
            className="size-14 rounded-lg object-cover"
          />
          <div className="flex-1">
            <strong>{l.name}</strong>
            <p className="text-sm">
              {l.variant} × {l.quantity}
            </p>
            {l.components && (
              <p className="text-xs">
                {l.components.map((c) => c.name).join(", ")}
              </p>
            )}
          </div>
          <span>{money(l.total)}</span>
        </div>
      ))}
      <h3 className="font-bold">Order timeline</h3>
      <ol className="space-y-3">
        {order.events.map((event, i) => (
          <li key={i} className="flex gap-3">
            <CheckCircle2 className="shrink-0 text-primary" size={20} />
            <div>
              <p>{event.message}</p>
              <p className="text-xs text-muted-foreground">{event.createdAt}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
export function OrderSuccess() {
  const { id } = useParams(),
    { data: order, error } = useResource<Order>("/orders/" + id);
  const token = sessionStorage.getItem("tracking:" + id);
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-10 text-center">
        <PackageCheck className="mx-auto mb-5 text-primary" size={64} />
        <h1 className="font-display text-3xl font-bold">
          Thank you for your order
        </h1>
        <p className="mt-3 text-muted-foreground">
          Follow your order progress below.
        </p>
      </div>
      <ErrorBox error={error} />
      {order && (
        <>
          <OrderDetails order={order} />
          {token && (
            <div className="mt-8 rounded-xl bg-secondary p-5">
              <p className="font-semibold">Save your private tracking code</p>
              <p className="mt-2 text-sm">
                Use your order number and this code on the tracking page. Keep
                it private.
              </p>
              <code className="mt-3 block break-all text-xs">{token}</code>
            </div>
          )}
        </>
      )}
      <Link to="/shop" className="action mt-8 inline-flex">
        Continue shopping
      </Link>
    </main>
  );
}
export function Track() {
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="mb-6 text-3xl font-bold">Track your order</h1>
      <form
        className="mb-8 grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setOrder(null);
          const f = new FormData(e.currentTarget);
          try {
            setOrder(
              await api("/track", "POST", {
                number: f.get("number"),
                token: f.get("token"),
              }),
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Order number">
          <input className="field" name="number" required />
        </Field>
        <Field label="Private tracking code">
          <input
            className="field"
            name="token"
            required
            minLength={64}
            maxLength={64}
          />
        </Field>
        <Button disabled={busy}>Find order</Button>
      </form>
      <ErrorBox error={error} />
      {order && <OrderDetails order={order} />}
    </main>
  );
}
