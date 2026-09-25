import { useState } from "react";
import { Link } from "react-router-dom";
import { Package, ShoppingBag, Users, Wallet, Download } from "lucide-react";
import { useResource, useStore } from "@/lib/store";
import { money, csv, download, api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ErrorBox, Empty } from "@/components/shared";
import type { Order } from "@/lib/types";
export function Dashboard({ mode = "dashboard" }: { mode?: string }) {
  const { data, error } = useResource<any>("/admin/overview"),
    { user } = useStore(),
    [days, setDays] = useState(30);
  if (!data)
    return (
      <>
        <ErrorBox error={error} />
        <p>Loading store activity…</p>
      </>
    );
  const orders: Order[] = data.orders.filter(
    (o: Order) =>
      new Date(o.createdAt + "Z").getTime() >= Date.now() - days * 86400000,
  );
  const valid = orders.filter(
      (o) => !["cancelled", "returned"].includes(o.status),
    ),
    paid = orders.filter((o) => o.paymentStatus === "paid");
  const revenue = paid.reduce((s, o) => s + o.total, 0),
    avg = valid.length
      ? valid.reduce((s, o) => s + o.total, 0) / valid.length
      : 0;
  const byDay = Array.from({ length: Math.min(days, 30) }, (_, i) => {
    const date = new Date(Date.now() - (Math.min(days, 30) - 1 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      date,
      total: paid
        .filter((o) => o.createdAt.startsWith(date))
        .reduce((s, o) => s + o.total, 0),
    };
  });
  const max = Math.max(1, ...byDay.map((d) => d.total));
  return (
    <>
      <div className="mb-6 flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {mode === "dashboard"
              ? "Dashboard"
              : mode === "reports"
                ? "Reports"
                : "Analytics"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Based on recorded orders and payment status.
          </p>
        </div>
        <select
          className="field w-auto"
          aria-label="Date range"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          {[7, 30, 90, 365].map((n) => (
            <option key={n} value={n}>
              Last {n} days
            </option>
          ))}
        </select>
      </div>
      <ErrorBox error={error} />
      {mode === "dashboard" && (
        <section className="mb-5 flex justify-between overflow-hidden rounded-2xl bg-blue-100 p-6">
          <div>
            <p className="text-sm">Your store at a glance</p>
            <h2 className="mt-2 text-2xl font-bold">
              Welcome back, {user?.name}
            </h2>
            <p className="my-4 text-sm">
              {orders.filter((o) => o.status === "pending").length} pending
              orders · {data.lowStock.length} packages running low
            </p>
            <Button asChild>
              <Link to="/admin/orders">Manage orders</Link>
            </Button>
          </div>
          <img
            src="/assets/welcome-illustration.png"
            alt=""
            className="hidden h-44 w-48 object-contain sm:block"
          />
        </section>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Recorded payments", value: money(revenue), Icon: Wallet },
          { label: "Orders", value: orders.length, Icon: ShoppingBag },
          {
            label: "Registered customers",
            value: data.customers.length,
            Icon: Users,
          },
          { label: "Average active order", value: money(avg), Icon: Package },
        ].map(({ label, value, Icon }) => (
          <section key={label} className="panel">
            <Icon
              className="mb-5 rounded-xl bg-primary/10 p-2 text-primary"
              size={40}
            />
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </section>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[2fr_1fr]">
        <section className="panel">
          <h2 className="text-lg font-bold">Recorded payments by order date</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Last {byDay.length} days. Payment status is maintained by the
            administrator.
          </p>
          <div
            className="mt-6 flex h-48 items-end gap-1"
            role="img"
            aria-label="Daily recorded payments bar chart"
          >
            {byDay.map((d) => (
              <div
                className="flex h-full flex-1 flex-col justify-end"
                key={d.date}
                title={`${d.date}: ${money(d.total)}`}
              >
                <div
                  className="min-h-1 rounded-t bg-primary/75"
                  style={{ height: `${(d.total / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{byDay[0].date}</span>
            <span>{byDay.at(-1)?.date}</span>
          </div>
          <details className="mt-4 text-sm">
            <summary>View chart data</summary>
            <div className="mt-3 max-h-44 overflow-auto">
              {byDay.map((d) => (
                <p key={d.date}>
                  {d.date}: {money(d.total)}
                </p>
              ))}
            </div>
          </details>
        </section>
        <section className="panel">
          <h2 className="mb-4 text-lg font-bold">Order lifecycle</h2>
          {[
            "pending",
            "confirmed",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
            "returned",
          ].map((status) => (
            <div
              key={status}
              className="flex justify-between border-b py-3 text-sm"
            >
              <span className="capitalize">{status}</span>
              <strong>
                {orders.filter((o) => o.status === status).length}
              </strong>
            </div>
          ))}
        </section>
      </div>
      {mode === "reports" ? (
        <section className="panel mt-5">
          <h2 className="mb-5 text-lg font-bold">Download reports</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() =>
                download(
                  "sales.csv",
                  csv([
                    [
                      "Order",
                      "Date",
                      "Status",
                      "Payment",
                      "Subtotal BDT",
                      "Shipping BDT",
                      "Discount BDT",
                      "Total BDT",
                    ],
                    ...orders.map((o) => [
                      o.number,
                      o.createdAt,
                      o.status,
                      o.paymentStatus,
                      o.subtotal / 100,
                      o.shipping / 100,
                      o.discount / 100,
                      o.total / 100,
                    ]),
                  ]),
                )
              }
            >
              <Download />
              Sales report
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                download(
                  "inventory.csv",
                  csv([
                    [
                      "Product",
                      "Package",
                      "SKU",
                      "Status",
                      "Stock",
                      "Price BDT",
                    ],
                    ...data.products.flatMap((p: any) =>
                      p.variants.map((v: any) => [
                        p.name,
                        v.name,
                        v.sku,
                        p.status,
                        v.stock,
                        v.price / 100,
                      ]),
                    ),
                  ]),
                )
              }
            >
              <Download />
              Inventory report
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                download(
                  "customers.csv",
                  csv([
                    ["Name", "Email", "Joined"],
                    ...data.customers.map((c: any) => [
                      c.name,
                      c.email,
                      c.created_at,
                    ]),
                  ]),
                )
              }
            >
              <Download />
              Customer report
            </Button>
          </div>
        </section>
      ) : (
        <section className="panel mt-5">
          <h2 className="mb-5 text-lg font-bold">Low stock alerts</h2>
          {data.lowStock.length ? (
            data.lowStock.map((v: any) => (
              <div
                className="flex justify-between gap-4 border-b py-3"
                key={v.product + v.id}
              >
                <span>
                  {v.product} · {v.name}
                </span>
                <strong>{v.stock} left</strong>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              All active packages are above your low-stock threshold.
            </p>
          )}
          <Link
            className="mt-4 block text-sm text-primary"
            to="/admin/products"
          >
            Manage inventory →
          </Link>
        </section>
      )}
    </>
  );
}
export function Customers() {
  const { data, error } = useResource<any>("/admin/overview"),
    [q, setQ] = useState("");
  const customers = new Map<string, any>();
  for (const c of data?.customers || [])
    customers.set(c.email, { ...c, orders: [], registered: true });
  for (const o of data?.orders || []) {
    const key = o.email || o.phone;
    let c = customers.get(key);
    if (!c) {
      c = {
        id: key,
        name: o.name,
        email: o.email,
        phone: o.phone,
        registered: false,
        orders: [],
      };
      customers.set(key, c);
    }
    c.phone = o.phone;
    c.orders.push(o);
  }
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Customers</h1>
      <input
        className="field mb-5 max-w-md"
        placeholder="Search name, email or phone"
        aria-label="Search customers"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ErrorBox error={error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Account</th>
              <th>Orders</th>
              <th>Active order value</th>
            </tr>
          </thead>
          <tbody>
            {[...customers.values()]
              .filter((c) =>
                `${c.name} ${c.email} ${c.phone}`
                  .toLowerCase()
                  .includes(q.toLowerCase()),
              )
              .map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    {c.email}
                    <p className="text-xs">{c.phone}</p>
                  </td>
                  <td>{c.registered ? "Registered" : "Guest"}</td>
                  <td>{c.orders.length}</td>
                  <td>
                    {money(
                      c.orders
                        .filter(
                          (o: Order) =>
                            !["cancelled", "returned"].includes(o.status),
                        )
                        .reduce((s: number, o: Order) => s + o.total, 0),
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!customers.size && <Empty>No customers yet.</Empty>}
    </>
  );
}
export function Reviews() {
  const { data, error, reload } = useResource<any[]>("/admin/reviews"),
    { notice } = useStore();
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">Product reviews</h1>
      <ErrorBox error={error} />
      <div className="space-y-4">
        {data?.map((r) => (
          <section className="panel" key={r.id}>
            <h2 className="font-bold">
              {r.name} · {r.rating} stars
            </h2>
            <p className="mt-2">{r.comment}</p>
            <p className="my-3 text-xs text-muted-foreground">
              Product: {r.product_id} · Verified delivered purchase
            </p>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await api("/admin/reviews/" + r.id, "PATCH", {
                    approved: !r.approved,
                  });
                  await reload();
                } catch (e) {
                  notice((e as Error).message);
                }
              }}
            >
              {r.approved ? "Unpublish" : "Approve and publish"}
            </Button>
          </section>
        ))}
        {!data?.length && <Empty>No reviews awaiting moderation.</Empty>}
      </div>
    </>
  );
}
export function Privacy() {
  const { data, error, reload } = useResource<any[]>("/admin/privacy-requests"),
    { notice } = useStore(),
    { data: overview } = useResource<any>("/admin/overview"),
    [confirmId, setConfirmId] = useState<string | null>(null);
  return (
    <>
      <h1 className="mb-5 text-2xl font-bold">Privacy & audit</h1>
      <section className="panel mb-5">
        <h2 className="font-bold">Customer data handling</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Only essential cookies are used. Abandoned checkout details are
          captured after consent and removed after the configured retention
          period. Review your store policies and legal retention obligations
          before completing deletion requests.
        </p>
        <Link
          to="/admin/settings"
          className="mt-3 inline-block text-sm text-primary"
        >
          Edit policies and retention →
        </Link>
      </section>
      <ErrorBox error={error} />
      <section className="panel">
        <h2 className="mb-4 text-lg font-bold">Customer requests</h2>
        {data?.map((r) => (
          <form
            key={r.id + r.status}
            className="mb-5 space-y-3 rounded-xl border p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api("/admin/privacy-requests/" + r.id, "PATCH", {
                  status: f.get("status"),
                  note: f.get("note"),
                });
                await reload();
                notice("Request updated");
              } catch (e) {
                notice((e as Error).message);
              }
            }}
          >
            <p className="font-semibold">
              {r.name} · {r.email}
            </p>
            <p className="text-sm">
              {r.type} request · {r.created_at}
            </p>
            <select
              name="status"
              className="field"
              defaultValue={r.status}
              aria-label="Request status"
            >
              {["pending", "completed", "declined"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <textarea
              name="note"
              className="field"
              defaultValue={r.note || ""}
              placeholder="Record the action taken and any retained records"
              aria-label="Resolution note"
            />
            <Button>Save request status</Button>
            <div className="flex flex-wrap gap-3 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    download(
                      "customer-data.json",
                      JSON.stringify(
                        await api("/admin/customers/" + r.user_id + "/export"),
                        null,
                        2,
                      ),
                      "application/json",
                    );
                  } catch (e) {
                    notice((e as Error).message);
                  }
                }}
              >
                Export customer data
              </Button>
              {r.type === "deletion" &&
                r.status === "pending" &&
                (confirmId === r.id ? (
                  <div className="rounded-xl border border-red-200 p-4">
                    <p className="mb-3 text-sm">
                      Permanently anonymize this account and its order contact
                      details? Financial records will remain. This cannot be
                      undone.
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={async () => {
                        try {
                          await api(
                            "/admin/privacy-requests/" + r.id + "/anonymize",
                            "POST",
                            { confirmed: true },
                          );
                          await reload();
                          setConfirmId(null);
                          notice("Customer data anonymized");
                        } catch (e) {
                          notice((e as Error).message);
                        }
                      }}
                    >
                      Confirm anonymization
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setConfirmId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmId(r.id)}
                  >
                    Fulfill deletion request
                  </Button>
                ))}
            </div>
          </form>
        ))}
        {!data?.length && (
          <p className="text-sm text-muted-foreground">No customer requests.</p>
        )}
      </section>
      <section className="panel mt-5">
        <h2 className="mb-4 text-lg font-bold">
          Recent administrative activity
        </h2>
        <div className="max-h-80 overflow-auto">
          {overview?.audit.map((a: any) => (
            <div key={a.id} className="border-b py-3 text-sm">
              <strong>{a.action}</strong>
              <p className="break-all text-xs text-muted-foreground">
                {a.target} · {a.created_at}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
