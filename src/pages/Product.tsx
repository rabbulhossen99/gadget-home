import { useState, type MouseEvent } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Minus,
  Plus,
  ShieldCheck,
  Truck,
  ZoomIn,
} from "lucide-react";
import { useStore, useResource } from "@/lib/store";
import { api, money } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Empty, ErrorBox, ProductCard } from "@/components/shared";
import { cn } from "@/lib/utils";
import type { Product as ProductType } from "@/lib/types";
export function Product() {
  const { slug } = useParams(),
    { catalog } = useStore();
  const product = catalog.products.find((p) => p.slug === slug);
  return product ? (
    <ProductDetails key={product.id} product={product} />
  ) : (
    <main className="p-12">
      <Empty>
        Product unavailable. <Link to="/shop">Continue shopping</Link>
      </Empty>
    </main>
  );
}
function ProductDetails({ product: p }: { product: ProductType }) {
  const { catalog, add, notice, user } = useStore(),
    navigate = useNavigate(),
    [selected, setSelected] = useState(p.variants[0]?.id),
    [photo, setPhoto] = useState(0),
    [zoom, setZoom] = useState(false),
    [position, setPosition] = useState({ x: 50, y: 50 }),
    [quantity, setQuantity] = useState(1),
    [tab, setTab] = useState("details"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const { data: reviews, reload } = useResource<
    { id: string; name: string; rating: number; comment: string }[]
  >("/products/" + p.id + "/reviews");
  const v = p.variants.find((v) => v.id === selected),
    category = catalog.categories.find((c) => c.id === p.categoryId);
  async function buy(checkout = false) {
    if (!v) return;
    setBusy(true);
    try {
      await add({
        type: "product",
        productId: p.id,
        variantId: v.id,
        quantity,
      });
      if (checkout) navigate("/checkout");
    } catch (e) {
      notice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 md:pb-8">
      <nav className="mb-6 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Link to="/">Home</Link>
        <ChevronRight size={14} />
        <Link to={"/category/" + category?.slug}>{category?.name}</Link>
        <ChevronRight size={14} />
        <span>{p.name}</span>
      </nav>
      <section className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <div
            role="button"
            tabIndex={0}
            aria-label="Zoom product image"
            className="relative aspect-square cursor-zoom-in overflow-hidden rounded-xl bg-card ring-1 ring-border"
            onMouseMove={(e: MouseEvent<HTMLDivElement>) => {
              const r = e.currentTarget.getBoundingClientRect();
              setPosition({
                x: ((e.clientX - r.left) / r.width) * 100,
                y: ((e.clientY - r.top) / r.height) * 100,
              });
            }}
            onMouseEnter={() => setZoom(true)}
            onMouseLeave={() => setZoom(false)}
            onClick={() => setZoom(!zoom)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setZoom(!zoom);
              }
            }}
          >
            <img
              src={p.images[photo] || p.images[0]}
              alt={p.name}
              className="size-full object-cover transition-transform duration-300"
              style={{
                transform: zoom ? "scale(1.8)" : "scale(1)",
                transformOrigin: `${position.x}% ${position.y}%`,
              }}
            />
            <ZoomIn
              className="absolute bottom-4 right-4 rounded-full bg-card p-2"
              size={40}
            />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {p.images.map((image, i) => (
              <button
                aria-label={`View product photo ${i + 1}`}
                className={cn(
                  "aspect-square overflow-hidden rounded-lg ring-1 ring-border",
                  photo === i && "ring-2 ring-primary",
                )}
                key={image + i}
                onClick={() => {
                  setPhoto(i);
                  setZoom(false);
                }}
              >
                <img src={image} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Hover or tap the main photo to zoom
          </p>
        </div>
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <p className="text-xs font-bold uppercase text-primary">
              {category?.name}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              {p.name}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {p.detail}
            </p>
            <div className="mt-4 flex gap-4 text-sm">
              <button onClick={() => setTab("reviews")}>
                {reviews?.length
                  ? `${(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)} ★ · ${reviews.length} reviews`
                  : "No reviews yet"}
              </button>
              <span className="font-semibold">
                {v?.stock ? `${v.stock} in stock` : "Out of stock"}
              </span>
            </div>
            <div className="my-7 flex items-end gap-3 border-y py-5">
              <span className="text-3xl font-bold">{money(v?.price || 0)}</span>
              {v?.compareAt && (
                <span className="text-lg text-muted-foreground line-through">
                  {money(v.compareAt)}
                </span>
              )}
            </div>
            <fieldset>
              <legend className="mb-3 text-xs font-bold uppercase text-muted-foreground">
                Select package
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {p.variants.map((pack) => (
                  <button
                    key={pack.id}
                    aria-pressed={selected === pack.id}
                    onClick={() => {
                      setSelected(pack.id);
                      setQuantity(1);
                    }}
                    className={cn(
                      "min-h-20 rounded-lg border-2 bg-card p-3 text-left",
                      selected === pack.id
                        ? "border-primary bg-secondary"
                        : "border-transparent ring-1 ring-border",
                    )}
                  >
                    <span className="block text-sm font-bold">{pack.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {money(pack.price)} ·{" "}
                      {pack.stock ? "Available" : "Out of stock"}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="mt-6 grid grid-cols-[auto_1fr] gap-3">
              <div className="flex items-center rounded-lg border bg-card p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus />
                </Button>
                <span className="w-8 text-center">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={quantity >= Math.min(99, v?.stock || 0)}
                  onClick={() => setQuantity(quantity + 1)}
                  aria-label="Increase quantity"
                >
                  <Plus />
                </Button>
              </div>
              <Button
                variant="shop"
                disabled={busy || !v?.stock}
                onClick={() => buy()}
              >
                Add to cart
              </Button>
            </div>
            <Button
              size="shop"
              className="mt-3 w-full bg-coral text-white"
              disabled={busy || !v?.stock}
              onClick={() => buy(true)}
            >
              Buy now · {money((v?.price || 0) * quantity)}
            </Button>
            <div className="mt-8 grid grid-cols-2 gap-4 border-t pt-6">
              <div className="flex gap-3">
                <Truck className="shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-bold">Delivery</p>
                  <p className="text-xs text-muted-foreground">
                    Dhaka {money(catalog.settings.shippingInside)}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="shrink-0 text-primary" />
                <Link to="/policy/returns" className="text-sm font-bold">
                  Return policy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mt-16">
        <div className="flex gap-7 border-b">
          {["details", "usage", "reviews"].map((t) => (
            <button
              className={cn(
                "border-b-2 pb-4 text-sm font-bold capitalize",
                tab === t
                  ? "border-primary"
                  : "border-transparent text-muted-foreground",
              )}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="py-8">
          {tab === "details" ? (
            <div className="grid gap-8 md:grid-cols-2">
              <p className="whitespace-pre-line leading-8">{p.description}</p>
              {p.attributes.length > 0 && (
                <dl className="rounded-xl bg-card p-6">
                  {p.attributes.map((a) => (
                    <div
                      className="flex justify-between gap-4 border-b py-3"
                      key={a.name}
                    >
                      <dt className="text-muted-foreground">{a.name}</dt>
                      <dd>{a.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ) : tab === "usage" ? (
            <p className="whitespace-pre-line leading-8">{p.usage}</p>
          ) : (
            <div className="space-y-5">
              {reviews?.map((r) => (
                <article key={r.id} className="rounded-xl border bg-card p-5">
                  <strong>
                    {r.name} · {r.rating} ★
                  </strong>
                  <p className="mt-2">{r.comment}</p>
                </article>
              ))}
              {!reviews?.length && <p>No published reviews yet.</p>}
              {user ? (
                <form
                  className="max-w-lg space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    setError("");
                    try {
                      await api("/products/" + p.id + "/reviews", "POST", {
                        rating: Number(f.get("rating")),
                        comment: f.get("comment"),
                      });
                      notice("Review submitted for moderation");
                      await reload();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <h3 className="font-bold">Review a delivered purchase</h3>
                  <select name="rating" className="field" aria-label="Rating">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} stars
                      </option>
                    ))}
                  </select>
                  <textarea
                    name="comment"
                    className="field"
                    required
                    minLength={5}
                    maxLength={2000}
                    aria-label="Your review"
                  />
                  <ErrorBox error={error} />
                  <Button>Submit review</Button>
                </form>
              ) : (
                <Link to="/login" className="underline">
                  Sign in to review a delivered purchase
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="mb-6 font-display text-2xl font-bold">
          Complete your wellness routine
        </h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {catalog.products
            .filter((x) => x.id !== p.id)
            .slice(0, 3)
            .map((p) => (
              <ProductCard product={p} key={p.id} />
            ))}
        </div>
      </section>
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t bg-card p-3 md:hidden">
        <Button
          variant="outline"
          className="flex-1"
          disabled={busy || !v?.stock}
          onClick={() => buy()}
        >
          Add to cart
        </Button>
        <Button
          className="flex-1 bg-coral text-white"
          disabled={busy || !v?.stock}
          onClick={() => buy(true)}
        >
          Buy now
        </Button>
      </div>
    </main>
  );
}
