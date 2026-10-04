import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useResource } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ErrorBox, Field } from "@/components/shared";
import type { Order } from "@/lib/types";
type Place = { id: string; name: string };
export type CourierOrderState = { version: number; status: string; carrier: string; trackingNumber: string };
type CourierData = { location: any; shipment: any; order: CourierOrderState; logs: any[] };
const sendable = ["pending", "processing", "confirmed"];
// `order.version` must be the current server version; every courier action reports the new
// version and status through onChanged so the order form stays in sync.
export function OrderCourier({ order, unsaved = false, onChanged }: { order: Order; unsaved?: boolean; onChanged: (state: CourierOrderState) => void }) {
  const { data, error: loadError, reload } = useResource<CourierData>(`/admin/orders/${order.id}/courier`);
  const { data: settings } = useResource<any>("/admin/couriers", 0);
  const activeProvider = settings?.pathao?.active ? "pathao" : settings?.steadfast?.active ? "steadfast" : "";
  const [provider, setProvider] = useState(order.courierLocation?.provider || "");
  const [district, setDistrict] = useState(order.courierLocation?.districtId || "");
  const [thana, setThana] = useState(order.courierLocation?.thanaId || "");
  const [area, setArea] = useState(order.courierLocation?.areaId || "");
  const [locationType, setLocationType] = useState(order.courierLocation?.locationType || "");
  const [districts, setDistricts] = useState<Place[]>([]);
  const [thanas, setThanas] = useState<Place[]>([]);
  const [areas, setAreas] = useState<Place[]>([]);
  const [saved, setSaved] = useState(!!order.courierLocation);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState(""), [message, setMessage] = useState("");
  const [consignmentId, setConsignmentId] = useState("");
  const [retry, setRetry] = useState(0);
  const chosen = provider || activeProvider || "steadfast";
  const shipment = data?.shipment;
  const locked = !!shipment && shipment.state !== "rejected";
  // Steadfast's Dhaka list is split into city thanas and suburban upazilas; other districts list upazilas directly.
  const dhaka = chosen === "steadfast" && districts.find(x => x.id === district)?.name === "Dhaka";
  const type = dhaka ? locationType : "";
  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setDistricts([]); setThanas([]); setAreas([]);
    Promise.all([
      api<Place[]>(`/admin/couriers/${chosen}/locations`),
      district ? api<Place[]>(`/admin/couriers/${chosen}/locations?districtId=${encodeURIComponent(district)}${locationType ? `&locationType=${locationType}` : ""}`) : Promise.resolve([]),
      chosen === "pathao" && thana ? api<Place[]>(`/admin/couriers/${chosen}/locations?districtId=${encodeURIComponent(district)}&zoneId=${encodeURIComponent(thana)}`) : Promise.resolve([]),
    ]).then(([a,b,c]) => { if (active) { setDistricts(a); setThanas(b); setAreas(c); } })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [chosen, district, locationType, thana, retry]);
  async function action(fn: () => Promise<CourierOrderState | void>) {
    setBusy(true); setError(""); setMessage("");
    try { const state = await fn(); if (state) onChanged(state); } catch(e) { setError((e as Error).message); }
    finally { setBusy(false); await reload(); }
  }
  const reset = (changes: () => void) => { changes(); setSaved(false); };
  const statusBlocked = !sendable.includes(order.status);
  return <section className="mt-5 space-y-4 rounded-xl border p-4">
    <h3 className="font-bold">Courier information</h3>
    <p className="text-sm text-muted-foreground">Save the delivery location, then send the order to the courier. <Link to="/admin/couriers" className="underline">Courier API settings</Link></p>
    <Field label="Courier provider"><select className="field" disabled={busy || locked} value={chosen} onChange={e => reset(() => { setProvider(e.target.value); setDistrict(""); setThana(""); setArea(""); setLocationType(""); })}>
      <option value="steadfast">Steadfast Courier{activeProvider === "steadfast" ? " (active)" : ""}</option><option value="pathao">Pathao Courier{activeProvider === "pathao" ? " (active)" : ""}</option>
    </select></Field>
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label={chosen === "pathao" ? "District / Courier city" : "District"}>
        <select className="field" disabled={busy || locked || loading} value={district} onChange={e => reset(() => { setDistrict(e.target.value); setThana(""); setArea(""); setLocationType(""); })}>
          <option value="">Select district</option>{districts.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      {dhaka && <Field label="Location type"><select className="field" disabled={busy || locked} value={locationType} onChange={e => reset(() => { setLocationType(e.target.value); setThana(""); })}><option value="">Select type</option><option value="city">Dhaka City Area (Thana)</option><option value="suburban">Dhaka District Suburban Area (Upazila)</option></select></Field>}
      <Field label={chosen === "pathao" ? "Thana / Upazila (Courier zone)" : "Thana / Upazila"}>
        <select className="field" disabled={busy || locked || loading || !district || (dhaka && !locationType)} value={thana} onChange={e => reset(() => { setThana(e.target.value); setArea(""); })}>
          <option value="">Select thana / upazila</option>{thanas.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      {chosen === "pathao" && <Field label="Area (optional)"><select className="field" disabled={busy || locked || loading || !thana} value={area} onChange={e => reset(() => setArea(e.target.value))}><option value="">Select area (optional)</option>{areas.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>}
    </div>
    {loading && <p role="status" className="text-sm">Loading delivery locations…</p>}
    {data?.location && <p className="text-sm">Saved: {[data.location.district, data.location.thana, data.location.area].filter(Boolean).join(" · ")} ({data.location.provider})</p>}
    <ErrorBox error={(error && error !== shipment?.error ? error : "") || loadError} />
    {(error || loadError) && <Button variant="outline" onClick={() => { setRetry(n => n + 1); void reload(); }}>Reload locations and shipment</Button>}
    {message && <p role="status" className="text-sm font-semibold text-emerald-700">{message}</p>}
    {!locked && <div className="flex flex-wrap gap-3">
      <Button variant="outline" disabled={busy || loading || !district || !thana || saved} onClick={() => action(async () => {
        await api(`/admin/orders/${order.id}/courier/location`, "PUT", { provider: chosen, districtId: district, thanaId: thana, ...(type ? { locationType: type } : {}), ...(area ? { areaId: area } : {}), expectedVersion: order.version });
        setSaved(true); setMessage("Delivery location saved.");
        return (await api<CourierData>(`/admin/orders/${order.id}/courier`)).order;
      })}>Save delivery location</Button>
      <Button disabled={unsaved || busy || !data || !saved || data.location?.provider !== chosen || statusBlocked} onClick={() => action(async () => {
        const result = await api<CourierData>(`/admin/orders/${order.id}/courier`, "POST", { provider: chosen, expectedVersion: order.version });
        setMessage(`Courier confirmed the booking. Consignment ${result.shipment?.consignment_id}.`);
        return result.order;
      })}>{busy ? "Working…" : shipment?.state === "rejected" ? "Retry courier booking" : "Send to Courier"}</Button>
    </div>}
    {!locked && unsaved && <p className="text-sm">Save your changes to the order above before sending it to the courier.</p>}
    {!locked && statusBlocked && <p className="text-sm">Move the order to Pending or Processing before sending it.</p>}
    {!locked && saved && data?.location && data.location.provider !== chosen && <p className="text-sm">Save a delivery location for {chosen === "pathao" ? "Pathao" : "Steadfast"} before sending.</p>}
    {shipment && <div className="space-y-2 text-sm">
      <p><strong>{shipment.provider}</strong> · {shipment.courier_status || shipment.state}</p>
      <p>Consignment: {shipment.consignment_id || "Not confirmed"} · Tracking: {shipment.tracking_id || "Not confirmed"}</p>
      {shipment.shipped_at && <p>Shipment date: {shipment.shipped_at}</p>}
      <ErrorBox error={shipment.error || ""} />
      {shipment.state === "booked" && <Button variant="outline" disabled={busy} onClick={() => action(async () => {
        const result = await api<CourierData>(`/admin/orders/${order.id}/courier/track`, "POST", {});
        setMessage(`Shipment status refreshed: ${result.shipment?.courier_status || "unchanged"}.`);
        return result.order;
      })}>Track Shipment</Button>}
      {["submitting","uncertain"].includes(shipment.state) && <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
        <p>The courier did not confirm this booking. Look for order {order.number} in the courier's merchant portal. If it exists, link its consignment ID here. Sending again is blocked to prevent a duplicate parcel.</p>
        <div className="flex flex-wrap gap-2">
          <input className="field w-auto" placeholder="Consignment ID" value={consignmentId} onChange={e => setConsignmentId(e.target.value.trim())} />
          <Button variant="outline" disabled={busy || !/^[a-zA-Z0-9_-]{1,100}$/.test(consignmentId)} onClick={() => action(async () => {
            const result = await api<CourierData>(`/admin/orders/${order.id}/courier/reconcile`, "POST", { consignmentId });
            setMessage("Consignment linked to this order."); setConsignmentId("");
            return result.order;
          })}>Link consignment</Button>
        </div>
      </div>}
    </div>}
    {!!data?.logs?.length && <details><summary className="cursor-pointer text-sm font-semibold">Courier activity</summary>
      <ul className="mt-2 space-y-2 text-sm">{data.logs.map((x: any) => <li key={x.id}>{x.created_at} · {x.message}</li>)}</ul>
    </details>}
  </section>;
}
