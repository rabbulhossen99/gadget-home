import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useResource, useStore } from "@/lib/store";
import { api, money, csv, download } from "@/lib/api";
import type { Order } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, ErrorBox, Empty } from "@/components/shared";
import { OrderDetails } from "@/pages/Checkout";
const transitions: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [],
  returned: [],
};
export function Orders() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const setQuery = (value: string) => setParams(value ? { q: value } : {});
  const { data, error, reload } = useResource<Order[]>("/admin/orders"),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<Order | null>(null),
    { notice } = useStore();
  const orders =
    data?.filter(
      (o) =>
        (!status || o.status === status) &&
        `${o.number} ${o.name} ${o.phone} ${o.email}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) || [];
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders & sales</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage every stage, from confirmation to delivery.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            download(
              "orders.csv",
              csv([
                [
                  "Order",
                  "Created",
                  "Customer",
                  "Phone",
                  "Status",
                  "Payment",
                  "Total BDT",
                ],
                ...orders.map((o) => [
                  o.number,
                  o.createdAt,
                  o.name,
                  o.phone,
                  o.status,
                  o.paymentStatus,
                  o.total / 100,
                ]),
              ]),
            )
          }
        >
          Export filtered orders
        </Button>
      </div>
      <ErrorBox error={error} />
      {selected ? (
        <OrderEditor
          key={selected.id}
          order={selected}
          onClose={() => setSelected(null)}
          onSave={async () => {
            await reload();
            setSelected(null);
            notice("Order updated");
          }}
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-3">
            <input
              className="field max-w-md"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order, customer, phone or email"
              aria-label="Search orders"
            />
            <select
              className="field w-auto"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Order status filter"
            >
              <option value="">All statuses</option>
              {Object.keys(transitions).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{o.number}</strong>
                      <p className="text-xs text-muted-foreground">
                        {o.createdAt}
                      </p>
                    </td>
                    <td>
                      {o.name}
                      <p className="text-xs text-muted-foreground">{o.phone}</p>
                    </td>
                    <td>
                      <span className="chip">{o.status}</span>
                    </td>
                    <td>{o.paymentStatus.replaceAll("_", " ")}</td>
                    <td>{money(o.total)}</td>
                    <td>
                      <Button variant="outline" onClick={() => setSelected(o)}>
                        View order
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!orders.length && <Empty>No orders match these filters.</Empty>}
        </>
      )}
    </>
  );
}
function OrderEditor({
  order,
  onSave,
  onClose,
}: {
  order: Order;
  onSave: () => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
      status: order.status,
      paymentStatus: order.paymentStatus,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      shippingNote: order.shippingNote,
      name: order.name,
      phone: order.phone,
      address: order.address,
      expectedVersion: order.version,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={onClose}>
        ← All orders
      </Button>
      <section className="panel">
        <OrderDetails order={order} />
        <div className="mt-6 grid gap-4 border-t pt-5 text-sm sm:grid-cols-2">
          <p>Email: {order.email || "Not provided"}</p>
          <p>Payment method: {order.paymentMethod}</p>
          <p>Transaction reference: {order.paymentReference || "None"}</p>
          <p>Customer note: {order.note || "None"}</p>
        </div>
      </section>
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const { name, phone, address, ...rest } = form;
            await api("/admin/orders/" + order.id, "PATCH", {
              ...rest,
              ...(["pending", "confirmed", "processing"].includes(order.status)
                ? { name, phone, address }
                : {}),
            });
            await onSave();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="mb-5 text-xl font-bold">Update order</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Order status">
            <select
              className="field"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {[order.status, ...transitions[order.status]].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Payment status">
            <select
              className="field"
              value={form.paymentStatus}
              onChange={(e) =>
                setForm({ ...form, paymentStatus: e.target.value })
              }
            >
              {["unpaid", "pending_verification", "paid", "refunded"].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Shipping carrier">
            <input
              className="field"
              value={form.carrier}
              onChange={(e) => setForm({ ...form, carrier: e.target.value })}
            />
          </Field>
          <Field label="Tracking number">
            <input
              className="field"
              value={form.trackingNumber}
              onChange={(e) =>
                setForm({ ...form, trackingNumber: e.target.value })
              }
            />
          </Field>
        </div>
        <div className="mt-5">
          {["pending", "confirmed", "processing"].includes(order.status) && (
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <Field label="Recipient name">
                <input
                  className="field"
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Recipient phone">
                <input
                  className="field"
                  required
                  pattern="01[0-9]{9}"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Delivery address">
                  <textarea
                    className="field"
                    required
                    minLength={8}
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                  />
                </Field>
              </div>
            </div>
          )}
          <Field label="Shipping information visible to customer">
            <textarea
              className="field"
              value={form.shippingNote}
              onChange={(e) =>
                setForm({ ...form, shippingNote: e.target.value })
              }
            />
          </Field>
        </div>
        {["cancelled", "returned"].includes(form.status) &&
          form.status !== order.status && (
            <p className="mt-4 text-sm">
              Saving will restore inventory once. Record any actual payment
              refund separately; this action does not transfer money.
            </p>
          )}
        <ErrorBox error={error} />
        <Button disabled={busy} className="mt-5">
          {busy ? "Saving…" : "Save order update"}
        </Button>
      </form>
    </div>
  );
}
export function Incomplete() {
  const { data, error, reload } = useResource<any>("/admin/overview"),
    { notice } = useStore(),
    [query, setQuery] = useState("");
  return (
    <>
      <h1 className="mb-3 text-2xl font-bold">Incomplete orders</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Only checkout details saved with customer consent appear here. Converted
        checkouts are removed from this list.
      </p>
      <input
        className="field mb-5 max-w-md"
        aria-label="Search incomplete orders"
        placeholder="Search customer or phone"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ErrorBox error={error} />
      <div className="space-y-4">
        {data?.incomplete
          .filter((c: any) =>
            `${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()),
          )
          .map((c: any) => (
            <article key={c.id} className="panel">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h2 className="font-bold">
                    {c.name || "Guest"} · {c.phone}
                  </h2>
                  <p className="text-sm">{c.email}</p>
                  <p className="mt-2 text-sm">{c.address}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Last saved: {c.updatedAt}
                  </p>
                </div>
                <select
                  className="field h-fit w-auto"
                  aria-label="Incomplete order status"
                  value={c.status}
                  onChange={async (e) => {
                    try {
                      await api("/admin/incomplete/" + c.id, "PATCH", {
                        status: e.target.value,
                      });
                      await reload();
                    } catch (e) {
                      notice((e as Error).message);
                    }
                  }}
                >
                  {["incomplete", "contacted", "closed"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="mt-4 text-sm">
                {c.items.map((item: any, i: number) => (
                  <p key={i}>
                    {item.quantity} ×{" "}
                    {item.type === "combo"
                      ? "Combo"
                      : data.products.find((p: any) => p.id === item.productId)
                          ?.name || "Unavailable product"}
                    {item.type === "product"
                      ? ` / ${data.products.find((p: any) => p.id === item.productId)?.variants.find((v: any) => v.id === item.variantId)?.name || item.variantId}`
                      : ""}
                  </p>
                ))}
              </div>
            </article>
          ))}
        {!data?.incomplete.length && <Empty>No incomplete checkouts.</Empty>}
      </div>
    </>
  );
}
