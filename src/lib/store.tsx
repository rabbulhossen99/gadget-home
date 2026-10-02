import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { api, setCsrf } from "./api";
import { cartData, track } from "./tracking";
import type { Catalog, CartItem, User } from "./types";
type Store = {
  catalog: Catalog;
  cart: CartItem[];
  user: User | null;
  refresh: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setCart: (items: CartItem[]) => Promise<void>;
  add: (item: CartItem) => Promise<void>;
  notice: (message: string) => void;
  logout: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [cart, setCartState] = useState<CartItem[]>([]),
    [user, setUser] = useState<User | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const cartRef = useRef<CartItem[]>([]),
    queue = useRef(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    cartRevision = useRef(0);
  const notice = useCallback((text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 5000);
  }, []);
  const refreshSession = useCallback(async () => {
    const s = await api("/session");
    setCsrf(s.csrf);
    setUser(s.user);
  }, []);
  const refresh = useCallback(async () => {
    const revision = cartRevision.current;
    const [c, items] = await Promise.all([
      api<Catalog>("/catalog"),
      api<CartItem[]>("/cart"),
    ]);
    setCatalog(c);
    if (revision === cartRevision.current) {
      setCartState(items);
      cartRef.current = items;
    }
  }, []);
  useEffect(() => {
    let active = true;
    refreshSession()
      .then(refresh)
      .catch((e) => active && setError(e.message));
    const focus = () => refresh().catch(() => {});
    const interval = setInterval(focus, 15000);
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", focus);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh, refreshSession]);
  const setCart = async (items: CartItem[]) => {
    cartRevision.current++;
    const result = await api<CartItem[]>("/cart", "PUT", items);
    cartRevision.current++;
    setCartState(result);
    cartRef.current = result;
  };
  const addItem = (item: CartItem) => {
    const task = queue.current
      .catch(() => {})
      .then(async () => {
        const next = structuredClone(cartRef.current);
        const equal = (a: CartItem) =>
          a.type === item.type &&
          (a.type === "product" && item.type === "product"
            ? a.productId === item.productId && a.variantId === item.variantId
            : a.type === "combo" &&
              item.type === "combo" &&
              a.comboId === item.comboId &&
              [...a.productIds].sort().join() ===
                [...item.productIds].sort().join());
        const existing = next.find(equal);
        if (existing) existing.quantity += item.quantity;
        else next.push(item);
        await setCart(next);
        if (catalog) track("AddToCart", () => cartData([item], catalog));
        notice("Added to your cart");
      });
    queue.current = task;
    return task;
  };
  const logout = async () => {
    await api("/auth/logout", "POST");
    await refreshSession();
    await refresh();
  };
  if (error)
    return (
      <main className="mx-auto max-w-xl p-10">
        <h1 className="text-2xl font-bold">Unable to load the store</h1>
        <p role="alert" className="my-5">
          {error}
        </p>
        <button className="action" onClick={() => location.reload()}>
          Try again
        </button>
      </main>
    );
  if (!catalog)
    return (
      <div className="p-16 text-center" role="status">
        Loading your store…
      </div>
    );
  return (
    <Context.Provider
      value={{
        catalog,
        cart,
        user,
        refresh,
        refreshSession,
        setCart,
        add: addItem,
        notice,
        logout,
      }}
    >
      {children}
      {message && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[100] w-[min(90vw,480px)] -translate-x-1/2 rounded-2xl bg-foreground p-4 text-center text-background shadow-xl"
        >
          {message}
        </div>
      )}
    </Context.Provider>
  );
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error("Store provider is missing");
  return store;
}
export function useResource<T>(path: string, interval = 15000) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      const result = await api<T>(path);
      setData(result);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [path]);
  useEffect(() => {
    void reload();
    if (!interval) return;
    const timer = setInterval(reload, interval);
    return () => clearInterval(timer);
  }, [reload, interval]);
  return { data, error, reload };
}
