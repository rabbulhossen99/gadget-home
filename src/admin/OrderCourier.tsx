import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useResource } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ErrorBox, Field } from "@/components/shared";
import type { Order } from "@/lib/types";
type Place = { id: string; name: string };
export function OrderCourier({ order, onVersion }: { order: Order; onVersion: (version: number) => void }) {
  const { data, error: loadError, reload } = useResource<any>(`/admin/orders/${order.id}/courier`);
  const [provider, setProvider] = useState(order.courierLocation?.provider || "steadfast");
  const [district, setDistrict] = useState(order.courierLocation?.districtId || "");
  const [thana, setThana] = useState(order.courierLocation?.thanaId || "");
  const [area, setArea] = useState(order.courierLocation?.areaId || "");
  const [districts, setDistricts] = useState<Place[]>([]);
  const [thanas, setThanas] = useState<Place[]>([]);
  const [areas, setAreas] = useState<Place[]>([]);
  const [version, setVersion] = useState(order.version);
  const [saved, setSaved] = useState(!!order.courierLocation);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [consignmentId, setConsignmentId] = useState("");
  const [retry, setRetry] = useState(0);
  const shipment = data?.shipment;
  const locked = !!shipment && shipment.state !== "rejected";
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setDistricts([]); setThanas([]); setAreas([]);
    Promise.all([
      api<Place[]>(`/admin/couriers/${provider}/locations`),
      district ? api<Place[]>(`/admin/couriers/${provider}/locations?districtId=${encodeURIComponent(district)}`) : Promise.resolve([]),
      thana ? api<Place[]>(`/admin/couriers/${provider}/locations?districtId=${encodeURIComponent(district)}&zoneId=${encodeURIComponent(thana)}`) : Promise.resolve([]),
    ]).then(([a,b,c]) => { if (active) { setDistricts(a); setThanas(b); setAreas(c); } })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [provider, district, thana, retry]);
  async function action(fn: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await fn(); await reload(); } catch(e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="mt-5 space-y-4 rounded-xl border p-4">
    <h3 className="font-bold">Courier information</h3>
    <p className="text-sm text-muted-foreground">Select the delivery location here before sending the order. <Link to="/admin/couriers" className="underline">Courier API settings</Link></p>
    <Field label="Courier provider"><select className="field" disabled={busy || locked} value={provider} onChange={e => { setProvider(e.target.value); setDistrict(""); setThana(""); setSaved(false); }}>
      <option value="steadfast">Steadfast Courier</option><option value="pathao">Pathao Courier</option>
    </select></Field>
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label={provider === "pathao" ? "District / Courier city" : "District"}>
        <select className="field" disabled={busy || locked || loading} value={district} onChange={e => { setDistrict(e.target.value); setThana(""); setSaved(false); }}>
          <option value="">Select district</option>{districts.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      {provider === "pathao" && <Field label="Area (optional)"><select className="field" disabled={busy || locked || loading || !thana} value={area} onChange={e => { setArea(e.target.value); setSaved(false); }}><option value="">Select area (optional)</option>{areas.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>}
      <Field label={provider === "pathao" ? "Thana / Upazila (Courier zone)" : "Thana / Upazila"}>
        <select className="field" disabled={busy || locked || loading || !district} value={thana} onChange={e => { setThana(e.target.value); setSaved(false); }}>
          <option value="">Select thana / upazila</option>{thanas.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
    </div>
    {loading && <p role="status" className="text-sm">Loading delivery locations…</p>}
    {data?.location && <p className="text-sm">Saved: {data.location.district} · {data.location.thana} ({data.location.provider})</p>}
    <ErrorBox error={error || loadError} />
    {(error || loadError) && <Button variant="outline" onClick={() => { setRetry(n => n + 1); void reload(); }}>Reload locations and shipment</Button>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {!locked && <div className="flex flex-wrap gap-3">
      <Button variant="outline" disabled={busy || loading || !district || !thana || saved} onClick={() => action(async () => {
        const result = await api<any>(`/admin/orders/${order.id}/courier/location`, "PUT", { provider, districtId: district, thanaId: thana, ...(area ? { areaId: area } : {}), expectedVersion: version });
        setVersion(result.version); onVersion(result.version); setSaved(true); setMessage("Delivery location saved.");
      })}>Save delivery location</Button>
      <Button disabled={busy || !data || !saved || !["processing","confirmed"].includes(order.status)} onClick={() => action(async () => {
        await api(`/admin/orders/${order.id}/courier`, "POST", { provider, expectedVersion: version });
        setMessage("Courier confirmed the booking. Reload the order before further edits.");
      })}>{busy ? "Working…" : shipment?.state === "rejected" ? "Retry courier booking" : "Send to Courier"}</Button>
    </div>}
    {!["processing","confirmed"].includes(order.status) && !locked && <p className="text-sm">Move the order to Processing before sending it.</p>}
    {shipment && <div className="space-y-2 text-sm">
      <p>{shipment.provider} · {shipment.courier_status || shipment.state}</p>
      <p>Consignment: {shipment.consignment_id || "Not confirmed"} · Tracking: {shipment.tracking_id || "Not confirmed"}</p>
      {shipment.shipped_at && <p>Shipment date: {shipment.shipped_at}</p>}
      <ErrorBox error={shipment.error || ""} />
      {shipment.state === "booked" && <Button variant="outline" disabled={busy} onClick={() => action(async () => {
        await api(`/admin/orders/${order.id}/courier/track`, "POST", {}); setMessage("Shipment status refreshed.");
      })}>Track Shipment</Button>}
      {["submitting","uncertain"].includes(shipment.state) && <p>Booking is unconfirmed. Check the courier portal before taking further action; another submission is blocked to prevent duplicates.</p>}
    </div>}
    {!!data?.logs?.length && <details><summary className="cursor-pointer text-sm font-semibold">Courier activity</summary>
      <ul className="mt-2 space-y-2 text-sm">{data.logs.map((x: any) => <li key={x.id}>{x.created_at} · {x.message}</li>)}</ul>
    </details>}
  </section>;
}
