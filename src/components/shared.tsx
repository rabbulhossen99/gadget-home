import { Link, Outlet, useNavigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { Menu, Search, ShoppingBag, X, Home as HomeIcon, Grid2X2, UserRound } from "lucide-react";
import { useStore } from "@/lib/store";
import { money } from "@/lib/api";
import type { Product } from "@/lib/types";
import { Button } from "./ui/button";
export function StoreLayout() {
  const { catalog, cart, user } = useStore(),
    [menu, setMenu] = useState(false),
    [query, setQuery] = useState(""),
    navigate = useNavigate();
  const settings = catalog.settings;
  return (
    <div className="min-h-screen bg-background text-foreground">
      {settings.announcement && (
        <div className="bg-foreground px-4 py-2 text-center font-bn text-xs font-semibold text-background sm:text-sm">
          {settings.announcement}
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:gap-5">
          <Link to="/" className="shrink-0 font-display text-2xl font-bold">
            {settings.name}
          </Link>
          <nav className="order-last hidden w-full items-center gap-6 border-t border-border/50 pt-3 text-sm font-semibold lg:flex">
            <Link to="/shop">Shop</Link>
            <Link to="/#category">Categories</Link>
            <Link to="/#packages">Packages</Link>
            <Link to="/#combo">Combo Offer</Link>
          </nav>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate("/shop?q=" + encodeURIComponent(query));
            }}
            className="ml-auto hidden flex-1 items-center gap-2 rounded-full border bg-card px-4 py-2.5 md:flex lg:max-w-xl"
          >
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search products"
              placeholder="পণ্য বা ক্যাটাগরি খুঁজুন…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </form>
          <Button
            asChild
            variant="outline"
            size="icon"
            className="relative ml-auto rounded-full md:ml-0"
          >
            <Link to="/cart" aria-label="Shopping cart">
              <ShoppingBag />
              <span className="absolute -right-2 -top-2 rounded-full bg-coral px-1.5 text-xs text-white">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </Link>
          </Button>
          <Link
            className="hidden text-sm font-semibold sm:block"
            to={user ? "/account" : "/login"}
          >
            {user ? "My account" : "Sign in"}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle navigation"
          >
            {menu ? <X /> : <Menu />}
          </Button>
        </div>
        {menu && (
          <nav
            className="flex flex-wrap gap-5 border-t p-4 lg:hidden"
            onClick={() => setMenu(false)}
          >
            <Link to="/shop">Shop & search</Link>
            <Link to="/account">Account</Link>
            <Link to="/track">Track order</Link>
            <Link to="/policy/contact">Contact</Link>
          </nav>
        )}
      </header>
      <Outlet />
      <nav aria-label="Mobile shopping navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card px-2 py-2 text-[10px] font-medium shadow-sm md:hidden">
        <Link to="/" className="flex flex-col items-center gap-1"><HomeIcon size={20} />Home</Link>
        <Link to="/#category" className="flex flex-col items-center gap-1"><Grid2X2 size={20} />Categories</Link>
        <Link to="/shop" className="flex flex-col items-center gap-1"><Search size={20} />Search</Link>
        <Link to="/cart" className="flex flex-col items-center gap-1"><ShoppingBag size={20} />Cart</Link>
        <Link to={user ? "/account" : "/login"} className="flex flex-col items-center gap-1"><UserRound size={20} />Account</Link>
      </nav>
      <footer className="mt-6 bg-foreground pb-16 text-background md:pb-0">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-6 py-12 md:grid-cols-4">
          <div>
            <h2 className="font-display text-2xl font-bold">{settings.name}</h2>
            <p className="mt-3 text-background/70">{settings.footer}</p>
          </div>
          <div>
            <h3 className="mb-3 font-bold">Shop</h3>
            {catalog.categories
              .filter((c) => !c.parentId)
              .map((c) => (
                <Link
                  className="mb-2 block text-sm text-background/70"
                  key={c.id}
                  to={"/category/" + c.slug}
                >
                  {c.name}
                </Link>
              ))}
          </div>
          <div>
            <h3 className="mb-3 font-bold">Support</h3>
            {["delivery", "returns", "privacy", "contact"].map((p) => (
              <Link
                className="mb-2 block text-sm capitalize text-background/70"
                key={p}
                to={"/policy/" + p}
              >
                {p}
              </Link>
            ))}
            <Link to="/track">Track order</Link>
          </div>
          <div>
            <h3 className="mb-3 font-bold">Payment</h3>
            {settings.codEnabled && <p>Cash on delivery</p>}
            {settings.manualEnabled && <p>Manual mobile payment</p>}
            <Link className="mt-5 block text-sm text-background/60" to="/admin">
              Store administration
            </Link>
          </div>
        </div>
        <p className="border-t border-background/10 py-5 text-center text-sm text-background/60">
          © {new Date().getFullYear()} {settings.name}
        </p>
      </footer>
    </div>
  );
}
export function ProductCard({ product }: { product: Product }) {
  const { catalog, add, notice } = useStore(),
    v = product.variants.find((v) => v.active),
    [busy, setBusy] = useState(false),
    navigate = useNavigate();
  if (!v) return null;
  const category = catalog.categories.find((c) => c.id === product.categoryId);
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border-2 border-border bg-card shadow-sm">
      <Link to={"/product/" + product.slug} className="relative block">
        <img
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          className="aspect-square w-full bg-muted/20 object-contain p-2 sm:p-3"
        />
        {v.compareAt && v.compareAt > v.price ? (
          <span className="absolute left-2 top-2 rounded-full bg-coral px-2 py-1 text-[10px] font-bold text-white sm:left-3 sm:top-3 sm:px-3 sm:text-xs">
            −{Math.round((1 - v.price / v.compareAt) * 100)}%
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <Link
          to={"/category/" + category?.slug}
          className="text-[10px] font-bold uppercase text-primary sm:text-xs"
        >
          {category?.name}
        </Link>
        <h3 className="mt-1 line-clamp-2 font-display text-base font-semibold leading-tight sm:text-lg">
          <Link to={"/product/" + product.slug}>{product.name}</Link>
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm">{product.detail}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-3 sm:gap-2">
          <span className="text-lg font-bold sm:text-xl">{money(v.price)}</span>
          {v.compareAt && (
            <span className="text-sm text-muted-foreground line-through">
              {money(v.compareAt)}
            </span>
          )}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-1.5 pt-3 sm:gap-2 sm:pt-4">
          <Button
            variant="shop"
            size="sm"
            className="h-9 w-full rounded-xl px-1 text-[10px] sm:h-10 sm:px-2 sm:text-xs"
            disabled={busy || !v.stock}
            onClick={async () => {
              setBusy(true);
              try {
                await add({
                  type: "product",
                  productId: product.id,
                  variantId: v.id,
                  quantity: 1,
                });
              } catch (e) {
                notice((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {!v.stock ? "Out of stock" : busy ? "Adding…" : "Add to cart"}
          </Button>
          <Button
            variant="buyNow"
            size="sm"
            className="h-9 w-full rounded-xl border-0 bg-[#F59E0B] px-1 text-[10px] font-medium text-white transition-colors duration-200 hover:bg-[#D97706] hover:text-white sm:h-10 sm:px-2 sm:text-xs"
            disabled={busy || !v.stock}
            onClick={async () => {
              setBusy(true);
              try {
                await add({
                  type: "product",
                  productId: product.id,
                  variantId: v.id,
                  quantity: 1,
                });
                navigate("/checkout");
              } catch (e) {
                notice((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Buy now
          </Button>
        </div>
      </div>
    </article>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}
export function ErrorBox({ error }: { error: string }) {
  return error ? (
    <p
      role="alert"
      className="my-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800"
    >
      {error}
    </p>
  ) : null;
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
      {children}
    </div>
  );
}
