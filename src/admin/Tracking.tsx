import { useState } from "react";
import { api } from "@/lib/api";
import { useResource, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ErrorBox, Field } from "@/components/shared";

type Settings = {
  pixelId: string;
  testCode: string;
  accessToken: string;
  configured: boolean;
  tiktokPixelId: string;
  googleMeasurementId: string;
  advancedMatching: boolean;
  serverSide: boolean;
  cookieConsent: boolean;
  dynamicProducts: boolean;
  clearAccessToken?: boolean;
};
type Status = { browserPixel: boolean; serverCapi: boolean; graphVersion: string };
type Delivery = {
  created_at: string;
  event_name: string;
  event_id: string;
  status: string;
  response: string;
};
const events = [
  ["PageView", "Every storefront page"],
  ["ViewContent", "Product page"],
  ["Search", "Shop search"],
  ["AddToCart", "Any add-to-cart button"],
  ["InitiateCheckout", "Checkout page opened"],
  ["AddPaymentInfo", "Order submitted"],
  ["Purchase", "Order placed (value from the stored order)"],
];
const controls = [
  ["advancedMatching", "Meta Advanced Matching", "Sends hashed email, phone and name with server events, and the signed-in customer's details to the pixel."],
  ["serverSide", "Server-side Conversions API", "Mirrors every browser event from the server with the same event ID. Requires an access token."],
  ["cookieConsent", "Require cookie consent", "The pixel loads and events are sent only after the visitor accepts in the cookie banner."],
  ["dynamicProducts", "Dynamic product data", "Includes content IDs and quantities for catalog and dynamic product ads."],
] as const;
const fields = ["pixelId", "testCode", "accessToken", "tiktokPixelId", "googleMeasurementId", "advancedMatching", "serverSide", "cookieConsent", "dynamicProducts"] as const;

function detail(row: Delivery) {
  try {
    const r = JSON.parse(row.response);
    return row.status === "delivered" ? `Received ${r.events_received ?? "?"}${r.test ? " · test" : ""}` : r.message || "Failed";
  } catch {
    return "";
  }
}
export function Tracking() {
  const { data, error, reload } = useResource<{ settings: Settings; status: Status; events: Delivery[] }>("/admin/tracking"),
    { notice } = useStore();
  const [form, setForm] = useState<Settings | null>(null),
    [show, setShow] = useState(false),
    [eventName, setEventName] = useState("PageView"),
    [testing, setTesting] = useState(false),
    [saving, setSaving] = useState(false),
    [result, setResult] = useState<any>(null);
  if (!data) return error ? <ErrorBox error={error} /> : <div className="panel p-8">Loading tracking settings…</div>;
  const value = form || data.settings,
    { status } = data,
    dirty = !!form,
    update = (next: Partial<Settings>) => setForm({ ...value, ...next });
  const save = async () => {
    setSaving(true);
    try {
      await api("/admin/tracking", "PUT", {
        ...Object.fromEntries(fields.map((key) => [key, value[key]])),
        clearAccessToken: !!form?.clearAccessToken,
      });
      setForm(null);
      await reload();
      notice("Tracking settings saved");
    } catch (e) {
      notice((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await api("/admin/tracking/test", "POST", { eventName }));
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setTesting(false);
      void reload();
    }
  };
  const route = !status.browserPixel ? "Off" : status.serverCapi ? "Browser + Server" : "Browser only";
  const badge = (on: boolean) => (on ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground");
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <section className="rounded-[2rem] border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-xl font-bold">◉ Meta Pixel & Conversions API (CAPI)</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track PageView, ViewContent, Search, AddToCart, InitiateCheckout, AddPaymentInfo & Purchase events for Facebook and Instagram Ads.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-2 text-xs font-bold ${badge(status.browserPixel)}`}>
              Browser Pixel {status.browserPixel ? "active ✓" : "not configured"}
            </span>
            <span className={`rounded-full px-3 py-2 text-xs font-bold ${badge(status.serverCapi)}`}>
              Server CAPI {status.serverCapi ? "active ✓" : "off"}
            </span>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm">
          <strong>🛡 Deduplicated browser + server tracking</strong>
          <p className="mt-2">
            The browser pixel and the server-side Conversions API send each event with a shared event_id, so Meta counts it once. Purchase values come from the
            stored order, not the browser. Graph API {status.graphVersion}.
          </p>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="1. Meta Pixel ID">
            <input className="field" inputMode="numeric" value={value.pixelId} onChange={(e) => update({ pixelId: e.target.value })} placeholder="e.g. 123456789012345" />
          </Field>
          <Field label="2. Test Event Code (Optional for Testing)">
            <input className="field" value={value.testCode} onChange={(e) => update({ testCode: e.target.value })} placeholder="TEST12345 from Events Manager → Test events" />
          </Field>
        </div>
        {value.testCode && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            ⚠ Test Event Code is active. Server events, including real customer purchases, are sent as test events and will not be attributed to live ads. Remove it
            when testing is finished.
          </div>
        )}
        <div className="mt-5">
          <Field label="3. Conversions API (CAPI) Access Token">
            <div className="flex flex-wrap gap-2">
              <input
                className="field min-w-0 flex-1"
                type={show ? "text" : "password"}
                autoComplete="off"
                value={value.accessToken || ""}
                disabled={!!value.clearAccessToken}
                placeholder={value.clearAccessToken ? "Token will be removed on save" : data.settings.configured ? "Saved securely; leave blank to keep" : "Access token"}
                onChange={(e) => update({ accessToken: e.target.value })}
              />
              <Button type="button" variant="outline" onClick={() => setShow(!show)}>
                {show ? "Hide Token" : "Show Token"}
              </Button>
              {data.settings.configured && (
                <Button type="button" variant="outline" onClick={() => update({ accessToken: "", clearAccessToken: !value.clearAccessToken })}>
                  {value.clearAccessToken ? "Keep saved token" : "Remove saved token"}
                </Button>
              )}
            </div>
          </Field>
        </div>
        <div className="mt-5 rounded-2xl border bg-secondary p-5">
          <h3 className="font-bold">⚡ Live Meta CAPI Diagnostic Tool</h3>
          <p className="text-sm text-muted-foreground">Send a test event to the Graph API with your saved settings to check the token and connection.</p>
          {!data.settings.testCode && (
            <p className="mt-2 text-sm text-amber-700">Without a saved Test Event Code, this event is recorded as real website traffic.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <select className="field w-auto" value={eventName} onChange={(e) => setEventName(e.target.value)}>
              {events.map(([x]) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <Button disabled={testing || dirty} onClick={test}>
              {testing ? "Testing…" : "🚀 Test Conversions API"}
            </Button>
            {dirty && <span className="self-center text-sm text-muted-foreground">Save your changes before testing.</span>}
          </div>
          {result && (
            <div className={`mt-4 rounded-xl p-4 text-sm ${result.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
              {result.error
                ? `✕ Meta CAPI Connection Failed: ${result.error}`
                : `✓ Meta CAPI Connected · Pixel ${result.pixelId} · ${result.eventName} received (${result.eventsReceived}) · Event ID ${result.eventId}${result.testEventCode ? ` · Test code ${result.testEventCode}` : ""}`}
            </div>
          )}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {events.map(([name, where]) => (
            <div key={name} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
              <span>
                <strong>{name}</strong>
                <span className="block text-xs text-muted-foreground">{where}</span>
              </span>
              <span className={route === "Off" ? "text-muted-foreground" : "text-emerald-600"}>{route}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[2rem] border bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold">Advanced Tracking Controls</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {controls.map(([key, label, hint]) => (
            <label key={key} className="flex items-start gap-3 rounded-xl border p-4 text-sm">
              <input className="mt-1" type="checkbox" checked={!!value[key]} onChange={(e) => update({ [key]: e.target.checked })} />
              <span>
                <strong>{label}</strong>
                <span className="block text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        {!value.cookieConsent && (
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            ⚠ With consent turned off, the pixel loads for every visitor. Make sure your privacy policy and local law allow this.
          </p>
        )}
      </section>
      <section className="rounded-[2rem] border bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold">Recent server deliveries</h2>
        <p className="mt-1 text-sm text-muted-foreground">The latest Conversions API responses from Meta. Updates automatically.</p>
        {data.events.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Time</th>
                  <th className="p-2">Event</th>
                  <th className="p-2">Event ID</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((row) => (
                  <tr key={row.event_id + row.created_at} className="border-t">
                    <td className="whitespace-nowrap p-2">{new Date(row.created_at.replace(" ", "T") + "Z").toLocaleString()}</td>
                    <td className="p-2 font-semibold">{row.event_name}</td>
                    <td className="max-w-48 truncate p-2 font-mono text-xs">{row.event_id}</td>
                    <td className={`p-2 font-semibold ${row.status === "delivered" ? "text-emerald-600" : "text-red-600"}`}>{row.status}</td>
                    <td className="p-2">{detail(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-secondary p-4 text-sm">No server events have been sent yet.</p>
        )}
      </section>
      <section className="rounded-[2rem] border bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold">◔ Other Multi-Channel Tracking (TikTok & Google)</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Field label="TikTok Pixel ID">
            <input className="field" value={value.tiktokPixelId} onChange={(e) => update({ tiktokPixelId: e.target.value })} />
          </Field>
          <Field label="Google Tag / GA4 Measurement ID">
            <input className="field" value={value.googleMeasurementId} onChange={(e) => update({ googleMeasurementId: e.target.value })} />
          </Field>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">These IDs are saved for reference only. TikTok and Google tags are not loaded on the storefront yet.</p>
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className={`rounded-full px-3 py-2 text-xs font-bold ${dirty ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
            {dirty ? "● You have unsaved changes" : "● All settings up to date ✓"}
          </span>
          <div className="flex gap-3">
            <Button variant="outline" disabled={!dirty || saving} onClick={() => setForm(null)}>
              Clear
            </Button>
            <Button disabled={!dirty || saving} onClick={save}>
              {saving ? "Saving…" : "▣ Save Settings"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
