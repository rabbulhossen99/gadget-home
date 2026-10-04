import { useEffect, useRef, useState } from "react";
import { Bell, Check, Volume2, VolumeX } from "lucide-react";
import { useResource } from "@/lib/store";
import type { Order } from "@/lib/types";

type Snapshot = { orders: Order[]; incomplete: Array<{ id: string; updatedAt: string }> };
type Notification = { id: string; text: string; at: number; read: boolean };
const KEY = "gadgethome-admin-notifications";
const MUTE_KEY = "gadgethome-admin-notification-muted";

function playSound() {
  try {
    const context = new AudioContext();
    const now = context.currentTime;
    // A short, alternating alarm tone is easier to hear than a single beep.
    for (let index = 0; index < 6; index += 1) {
      const start = index * 0.38;
      const frequency = index % 2 ? 1320 : 880;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "square";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.22, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + 0.3);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + start);
      oscillator.stop(now + start + 0.3);
    }
  } catch {
    // Browsers may block audio until the admin interacts with the page.
  }
}

export function AdminNotifications() {
  const { data } = useResource<Snapshot>("/admin/overview", 15000);
  const previous = useRef<Snapshot | null>(null);
  const [items, setItems] = useState<Notification[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  });
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === "true");
  const [open, setOpen] = useState(false);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items.slice(0, 30))); }, [items]);
  useEffect(() => { localStorage.setItem(MUTE_KEY, String(muted)); }, [muted]);
  useEffect(() => {
    if (!data) return;
    const old = previous.current;
    previous.current = data;
    if (!old) return;
    const next: Notification[] = [];
    const oldOrders = new Map(old.orders.map((order) => [order.id, order]));
    for (const order of data.orders) {
      const prior = oldOrders.get(order.id);
      if (!prior) next.push({ id: `order-${order.id}`, text: `New order ${order.number} received`, at: Date.now(), read: false });
      else if (prior.status !== order.status && ["processing", "completed"].includes(order.status) && prior.status === "pending")
        next.push({ id: `status-${order.id}-${order.status}`, text: `${order.number} is now ${order.status}`, at: Date.now(), read: false });
    }
    const oldIncomplete = new Set(old.incomplete.map((checkout) => checkout.id));
    for (const checkout of data.incomplete)
      if (!oldIncomplete.has(checkout.id)) next.push({ id: `checkout-${checkout.id}`, text: "New incomplete order started", at: Date.now(), read: false });
    if (next.length) {
      setItems((current) => [...next, ...current].slice(0, 30));
      if (!muted) playSound();
    }
  }, [data, muted]);
  const unread = items.filter((item) => !item.read).length;
  return (
    <div className="relative">
      <button className="relative grid size-10 place-items-center rounded-xl bg-card" aria-label="Notifications" onClick={() => { setOpen(!open); setItems((all) => all.map((item) => ({ ...item, read: true }))); }}>
        <Bell size={19} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border bg-card p-3 shadow-xl">
        <div className="flex items-center justify-between border-b pb-2"><strong>Notifications</strong><button className="text-muted-foreground" aria-label={muted ? "Turn sound on" : "Mute sound"} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button></div>
        {!items.length && <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>}
        <div className="max-h-72 overflow-y-auto">{items.map((item) => <div key={item.id} className="flex gap-2 border-b py-3 text-sm"><Check size={16} className="mt-0.5 text-primary" /><span>{item.text}</span></div>)}</div>
      </div>}
    </div>
  );
}
