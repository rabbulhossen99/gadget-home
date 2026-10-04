import { useSyncExternalStore } from "react";
import { api } from "./api";
import type { CartItem, Catalog, Order, User } from "./types";

// Meta Pixel (browser) + Conversions API (server). Each event is sent from the
// browser and mirrored to the server with the same event ID, so Meta counts it
// once. Purchase is reported by the server from the stored order.
type Config = {
  pixelId: string;
  cookieConsent?: boolean;
  advancedMatching?: boolean;
  dynamicProducts?: boolean;
  serverSide?: boolean;
};
export type CustomData = {
  value?: number;
  currency?: "BDT";
  content_ids?: string[];
  content_type?: "product" | "product_group";
  content_name?: string;
  content_category?: string;
  contents?: { id: string; quantity: number; item_price?: number }[];
  num_items?: number;
  search_string?: string;
  order_id?: string;
};
type EventName =
  | "PageView"
  | "ViewContent"
  | "Search"
  | "AddToCart"
  | "InitiateCheckout"
  | "AddPaymentInfo"
  | "Purchase";
type Consent = "granted" | "denied" | null;
declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
  }
}
const CONSENT_KEY = "marketing-consent";
let config: Config = { pixelId: "" },
  consent: Consent = readConsent(),
  loaded = false,
  revoked = false,
  matching: Record<string, string> = {},
  version = 0;
const listeners = new Set<() => void>();
function changed() {
  version++;
  listeners.forEach((listener) => listener());
}
function readConsent(): Consent {
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}
const allowed = () =>
  !!config.pixelId && (!config.cookieConsent || consent === "granted");

// Equivalent of Meta's base pixel snippet, without an inline script.
function install() {
  if (window.fbq) return;
  const fbq: any = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  };
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  // Route changes are tracked explicitly (with event IDs for deduplication),
  // so the pixel's own automatic PageView on history changes is turned off.
  fbq.disablePushState = true;
  fbq.allowDuplicatePageViews = true;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
}
function start() {
  if (!allowed()) return false;
  if (!loaded) {
    install();
    window.fbq("init", config.pixelId, matching);
    loaded = true;
  } else if (revoked) {
    window.fbq("consent", "grant");
    revoked = false;
  }
  return true;
}

export async function initTracking(user: User | null) {
  try {
    config = await api<Config>("/tracking/config");
  } catch {
    config = { pixelId: "" };
  }
  if (config.advancedMatching && user) {
    const [fn, ...rest] = user.name.trim().toLowerCase().split(/\s+/);
    // The pixel normalizes and hashes these before sending.
    matching = {
      em: user.email.trim().toLowerCase(),
      ...(fn ? { fn } : {}),
      ...(rest.length ? { ln: rest[rest.length - 1] } : {}),
      external_id: user.id,
    };
  }
  start();
  changed();
}
export function setConsent(value: Consent) {
  consent = value;
  try {
    if (value) localStorage.setItem(CONSENT_KEY, value);
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
  if (value === "granted") start();
  else if (loaded && !revoked) {
    window.fbq("consent", "revoke");
    revoked = true;
  }
  changed();
}
export const trackingConsent = () => allowed();

export function useTracking() {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
  return {
    active: allowed(),
    needsConsent: !!config.pixelId && !!config.cookieConsent,
    pixel: !!config.pixelId,
    consent,
  };
}

const productFields: (keyof CustomData)[] = [
  "content_ids",
  "contents",
  "content_type",
  "content_name",
  "content_category",
  "num_items",
];
// crypto.randomUUID is only available on HTTPS and localhost.
const uniqueId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
// Tracking must never interrupt shopping, so failures are only logged.
export function track(
  name: EventName,
  data: CustomData | (() => CustomData) = {},
  eventId?: string,
) {
  try {
    if (!start()) return;
    const values = typeof data === "function" ? data() : data;
    const payload = config.dynamicProducts
      ? values
      : (Object.fromEntries(
          Object.entries(values).filter(
            ([key]) => !productFields.includes(key as keyof CustomData),
          ),
        ) as CustomData);
    const id = eventId || `${name.toLowerCase()}_${uniqueId()}`;
    window.fbq("track", name, payload, { eventID: id });
    if (config.serverSide && name !== "Purchase")
      api("/tracking/events", "POST", {
        eventName: name,
        eventId: id,
        sourceUrl: location.href,
        customData: payload,
      }).catch(() => {});
  } catch (error) {
    console.warn(`Meta Pixel ${name} event was not sent`, error);
  }
}

export function cartData(items: CartItem[], catalog: Catalog): CustomData {
  const contents: NonNullable<CustomData["contents"]> = [];
  let value = 0;
  for (const item of items) {
    if (item.type === "product") {
      const variant = catalog.products
        .find((p) => p.id === item.productId)
        ?.variants.find((v) => v.id === item.variantId);
      if (!variant) continue;
      value += variant.price * item.quantity;
      contents.push({
        id: item.productId,
        quantity: item.quantity,
        item_price: variant.price / 100,
      });
    } else {
      const tier = catalog.combos
        .find((c) => c.id === item.comboId)
        ?.tiers.find((t) => t.count === item.productIds.length);
      if (tier) value += tier.price * item.quantity;
      for (const id of item.productIds)
        contents.push({ id, quantity: item.quantity });
    }
  }
  return {
    value: value / 100,
    currency: "BDT",
    content_type: "product",
    content_ids: [...new Set(contents.map((c) => c.id))],
    contents,
    num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
  };
}
export function orderData(order: Order): CustomData {
  const contents = (order.lines || []).flatMap((line) =>
    line.type === "combo"
      ? (line.components || []).map((c) => ({
          id: c.productId!,
          quantity: c.quantity,
        }))
      : [
          {
            id: line.productId!,
            quantity: line.quantity,
            item_price: line.unitPrice / 100,
          },
        ],
  );
  return {
    value: order.total / 100,
    currency: "BDT",
    order_id: order.number,
    content_type: "product",
    content_ids: [...new Set(contents.map((c) => c.id))],
    contents,
    num_items: contents.reduce((sum, c) => sum + c.quantity, 0),
  };
}
