import { OrderCourier, type CourierOrderState } from "./OrderCourier";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useResource, useStore } from "@/lib/store";
import { api, money, csv, download } from "@/lib/api";
import type { Order } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, ErrorBox, Empty } from "@/components/shared";
import { OrderDetails } from "@/pages/Checkout";
const transitions: Record<string, string[]> = {
  pending: ["processing", "on-hold", "cancelled", "pending-payment"],
  processing: ["on-hold", "completed", "cancelled"],
  "on-hold": ["pending", "processing", "cancelled"],
  "pending-payment": ["pending", "processing", "on-hold", "cancelled"],
  completed: ["refunded"],
  refunded: [],
  cancelled: ["pending"],
};
const statusLabels: Record<string, string> = { "on-hold": "On Hold", "pending-payment": "Pending Payment" };
const label = (s: string) => statusLabels[s] || s.replace(/^./, (c) => c.toUpperCase());
const statusTone = (status: string) => ({
  pending: "border-amber-200 bg-amber-100 text-amber-800",
  processing: "border-blue-200 bg-blue-100 text-blue-800",
  "on-hold": "border-violet-200 bg-violet-100 text-violet-800",
  cancelled: "border-red-200 bg-red-100 text-red-800",
  completed: "border-green-200 bg-green-100 text-green-800",
}[status] || "");
export function Orders() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const setQuery = (value: string) => setParams(value ? { q: value } : {});
  const { data, error, reload } = useResource<Order[]>("/admin/orders"),
    [status, setStatus] = useState(""),
    [selected, setSelected] = useState<Order | null>(null),
    { notice } = useStore();
  const ordered = [...(data || [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const serials = new Map(ordered.map((order, index) => [order.id, String(index + 1).padStart(2, "0")]));
  const orders =
    [...ordered].reverse().filter(
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
                  "Total BDT",
                ],
                ...orders.map((o) => [
                  o.number,
                  o.createdAt,
                  o.name,
                  o.phone,
                  o.status,
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
                <option key={s} value={s}>{label(s)}</option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order No.</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>

                  <th>Courier</th><th>Tracking ID</th><th>Courier Status</th><th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{serials.get(o.id)}</strong></td>
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
                      <span className={`chip border ${statusTone(o.status)}`}>{label(o.status)}</span>
                    </td>

                    <td>{o.courierShipment?.provider || o.carrier || "—"}</td><td>{o.courierShipment?.tracking_id || o.trackingNumber || "—"}</td><td>{o.courierShipment?.courier_status || o.courierShipment?.state || "—"}</td><td>{money(o.total)}</td>
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
const editable = (o: Order) => ({
  status: o.status,
  carrier: o.carrier,
  trackingNumber: o.trackingNumber,
  shippingNote: o.shippingNote,
  name: o.name,
  phone: o.phone,
  address: o.address,
  note: o.note || "",
});
function OrderEditor({
  order: initial,
  onSave,
  onClose,
}: {
  order: Order;
  onSave: () => Promise<void>;
  onClose: () => void;
}) {
  // The editor keeps the latest server copy, since saves and courier actions change the order version.
  const [order, setOrder] = useState(initial),
    [form, setForm] = useState({ ...editable(initial), expectedVersion: initial.version }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    { notice } = useStore();
  const unsaved = Object.entries(editable(order)).some(
    ([key, value]) => form[key as keyof typeof form] !== value,
  );
  const courierChanged = (state: CourierOrderState) => {
    setOrder((o) => ({ ...o, ...state }));
    // Reload the full order so the timeline shows courier events.
    api<Order[]>("/admin/orders")
      .then((all) => {
        const fresh = all.find((o) => o.id === order.id);
        if (fresh && fresh.version === state.version) setOrder(fresh);
      })
      .catch(() => {});
    // Fields the courier changed are refreshed; other unsaved edits are kept.
    setForm((f) => ({
      ...f,
      status: state.status,
      carrier: state.carrier,
      trackingNumber: state.trackingNumber,
      expectedVersion: state.version,
    }));
  };
  async function autoSaveStatus(status: string) {
    const nextForm = { ...form, status };
    setBusy(true);
    setError("");
    try {
      const { name, phone, address, ...rest } = nextForm;
      const updated = await api<Order>("/admin/orders/" + order.id, "PATCH", {
        ...rest,
        name,
        phone,
        address,
      });
      setOrder((o) => ({ ...o, ...updated }));
      setForm({ ...editable(updated), expectedVersion: updated.version });
      await onSave();
      notice("Order updated");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
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
      <ConfirmedOrderEdit key={order.version} order={order} onSaved={async (next) => { setOrder(next); setForm({ ...editable(next), expectedVersion: next.version }); await onSave(); }} />
      <form
        className="panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const { name, phone, address, ...rest } = form;
            const updated = await api<Order>("/admin/orders/" + order.id, "PATCH", {
              ...rest,
              ...(["pending", "pending-payment", "on-hold", "confirmed", "processing"].includes(order.status)
                ? { name, phone, address }
                : {}),
            });
            setOrder((o) => ({ ...o, ...updated }));
            setForm({ ...editable(updated), expectedVersion: updated.version });
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
              onChange={(e) => {
                const nextStatus = e.target.value;
                setForm({ ...form, status: nextStatus });
                if ((["pending", "processing"].includes(order.status) || nextStatus === "on-hold") && nextStatus !== order.status)
                  void autoSaveStatus(nextStatus);
              }}
            >
              {[order.status, ...(transitions[order.status] || [])].map((s) => (
                <option key={s} value={s}>{label(s)}</option>
              ))}
            </select>
          </Field>          <Field label="Shipping carrier">
            <input
              className="field"
              value={form.carrier}
              readOnly={["confirmed", "processing", "shipped", "delivered", "completed"].includes(order.status)}
              onChange={(e) => setForm({ ...form, carrier: e.target.value })}
            />
          </Field>
          <Field label="Tracking number">
            <input
              className="field"
              value={form.trackingNumber}
              readOnly={["confirmed", "processing", "shipped", "delivered", "completed"].includes(order.status)}
              onChange={(e) =>
                setForm({ ...form, trackingNumber: e.target.value })
              }
            />
          </Field>
        </div>
        <div className="mt-5">
          {["pending", "pending-payment", "on-hold", "confirmed", "processing"].includes(order.status) && (
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <Field label="Recipient name">
                <input
                  className="field"
                  required
                  minLength={2}
                  value={form.name}
                  readOnly={["confirmed", "processing"].includes(order.status)}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Recipient phone">
                <input
                  className="field"
                  required
                  pattern="01[0-9]{9}"
                  value={form.phone}
                  readOnly={["confirmed", "processing"].includes(order.status)}
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
                    readOnly={["confirmed", "processing"].includes(order.status)}
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
          <Field label="Customer note">
            <textarea className="field" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
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
      <OrderCourier order={order} unsaved={unsaved} onChanged={courierChanged} />
    </div>
  );
}
function ConfirmedOrderEdit({ order, onSaved }: { order: Order; onSaved: (order: Order) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState((order.items || []).map((item) => ({ ...item })));
  const [discount, setDiscount] = useState(order.discount || 0);
  const [shipping, setShipping] = useState(order.shipping || 0);
  const [customerInfo, setCustomerInfo] = useState({ name: order.name, phone: order.phone, address: order.address, note: order.note || "" });
  const [note, setNote] = useState(order.note || "");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [finalAmount, setFinalAmount] = useState(order.total);
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0); const finalTotal = Math.max(0, subtotal + shipping - discount);
  useEffect(() => { setFinalAmount(finalTotal); }, [subtotal, discount, shipping]);
  if (!editing) return <div className="panel"><Button type="button" onClick={() => setEditing(true)}>Edit Order</Button></div>;
  return <form className="panel" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(""); try { const next = await api<Order>(`/admin/orders/${order.id}/edit`, "PATCH", { items: items.map(({ id, quantity }) => ({ id, quantity })), discount: Math.max(0, Math.round(discount)), shipping: Math.max(0, Math.round(shipping)), customerInfo, expectedVersion: order.version }); await onSaved(next); setEditing(false); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
    <h2 className="mb-4 text-xl font-bold">Edit Order</h2>
    <div className="space-y-3">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><strong>{item.name}</strong><p className="text-xs text-muted-foreground">{money(item.unitPrice)} each</p></div><div className="flex items-center gap-2"><Button type="button" size="icon" variant="outline" onClick={() => setItems(items.map((x) => x.id === item.id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}>−</Button><input aria-label={`Quantity for ${item.name}`} className="field w-16 text-center" type="number" min="1" max="999" value={item.quantity} onChange={(e) => setItems(items.map((x) => x.id === item.id ? { ...x, quantity: Math.max(1, Math.min(999, Number(e.target.value) || 1)) } : x))} /><Button type="button" size="icon" variant="outline" onClick={() => setItems(items.map((x) => x.id === item.id ? { ...x, quantity: x.quantity + 1 } : x))}>+</Button><Button type="button" variant="destructive" size="sm" onClick={() => items.length > 1 && confirm("Remove this product from the order?") && setItems(items.filter((x) => x.id !== item.id))}>Remove</Button></div></div>)}</div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Discount (BDT)"><input className="field" type="number" min="0" step="1" placeholder="Enter discount amount (BDT)" value={discount / 100} onChange={(e) => { if (/^\d*$/.test(e.target.value)) setDiscount(Number(e.target.value || 0) * 100); }} /></Field><Field label="Shipping (BDT)"><input className="field" type="number" min="0" step="0.01" value={(shipping / 100).toFixed(2)} onChange={(e) => setShipping(Math.max(0, Math.round(Number(e.target.value || 0) * 100)))} /></Field><Field label="Final payable amount (BDT)"><input className="field" type="number" min="0" step="0.01" value={finalTotal / 100} readOnly /></Field><Field label="Customer name"><input className="field" value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} /></Field><Field label="Customer phone"><input className="field" value={customerInfo.phone} onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })} /></Field><Field label="Delivery address"><textarea className="field" value={customerInfo.address} onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })} /></Field><Field label="Customer note"><textarea className="field" value={note} onChange={(e) => { setNote(e.target.value); setCustomerInfo({ ...customerInfo, note: e.target.value }); }} /></Field></div>
    <dl className="mt-5 space-y-2 text-sm"><div className="flex justify-between"><dt>Original subtotal</dt><dd>{money(subtotal)}</dd></div><div className="flex justify-between"><dt>Shipping</dt><dd>{money(shipping)}</dd></div><div className="flex justify-between"><dt>Discount</dt><dd>−{money(discount)}</dd></div><div className="flex justify-between text-lg font-bold"><dt>Final payable</dt><dd>{money(finalTotal)}</dd></div></dl>{finalAmount !== finalTotal && <p className="mt-3 text-sm text-amber-700">Manual price adjustment applied by Admin</p>}<ErrorBox error={error} /><Button disabled={busy || !items.length} className="mt-5">{busy ? "Saving…" : "Save Order Changes"}</Button>
  </form>;
}
export function Incomplete() {
  const { data, error, reload } = useResource<any>("/admin/overview"),
    { notice } = useStore(),
    navigate = useNavigate(),
    [query, setQuery] = useState("");
  return (
    <>
      <h1 className="mb-3 text-2xl font-bold">Incomplete orders</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Checkout details are saved once a valid Bangladesh mobile number is
        entered. Converted checkouts are removed from this list.
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
                    <option key={s}>{label(s)}</option>
                  ))}
                </select>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <Button type="button" onClick={async (e) => {
                  const button = e.currentTarget;
                  button.disabled = true;
                  try {
                    await api("/admin/incomplete/" + c.id + "/confirm", "POST", {});
                    notice("Order confirmed and moved to Orders & Sales");
                    navigate("/admin/orders");
                  } catch (e) { notice((e as Error).message); }
                  finally { button.disabled = false; }
                }}>Confirm Order</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await api("/admin/incomplete/" + c.id, "DELETE");
                      await reload();
                    } catch (e) {
                      notice((e as Error).message);
                    }
                  }}
                >
                  Remove incomplete order
                </Button>
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
