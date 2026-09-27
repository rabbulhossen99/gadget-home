import { useState } from "react";
import { Link, useSearchParams, useParams, useNavigate } from "react-router-dom";
import {
  Baby,
  HeartPulse,
  Leaf,
  Pill,
  Sparkles,
  PackageCheck,
  ShoppingBag,
  Check,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { money } from "@/lib/api";
import type { Combo, Product, Section } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ProductCard, Empty } from "@/components/shared";
import { cn } from "@/lib/utils";
const icons = [Pill, Sparkles, HeartPulse, Leaf, Baby];
export function Home() {
  const { catalog } = useStore();
  return (
    <main id="top">
      {catalog.sections.map((section) => (
        <HomeSection key={section.id} section={section} />
      ))}
      {!catalog.sections.length && (
        <Empty>
          No homepage sections have been published.{" "}
          <Link to="/shop">Browse products</Link>
        </Empty>
      )}
    </main>
  );
}
function HomeSection({ section: s }: { section: Section }) {
  const { catalog } = useStore();
  if (s.type === "hero" || s.type === "promotion")
    return (
      <section className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-10">
        <div
          className={cn(
            "relative overflow-hidden rounded-[2rem] bg-primary px-6 py-12 sm:px-12 lg:px-16",
            s.type === "hero" ? "min-h-[510px] lg:py-20" : "bg-sun",
          )}
        >
          <div className="absolute -right-12 -top-20 size-72 rounded-full bg-sun/80" />
          <div className="absolute -bottom-20 right-32 size-48 rounded-full bg-coral/75" />
          {s.image && (
            <img
              src={s.image}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          )}
          <div
            className={cn(
              "relative max-w-2xl",
              s.image && "rounded-2xl bg-background/90 p-6",
            )}
          >
            <span className="mb-6 inline-flex gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background">
              <Leaf size={16} /> {catalog.settings.name}
            </span>
            <h1 className="whitespace-pre-line font-display text-4xl font-bold leading-tight sm:text-6xl lg:text-7xl">
              {s.title}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-foreground/80">
              {s.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="shop" size="shop" asChild>
                <Link to={s.link}>
                  <ShoppingBag />
                  {s.buttonText || "Shop now"}
                </Link>
              </Button>
              {s.type === "hero" && (
                <Button variant="shopOutline" size="shop" asChild>
                  <a href="#packages">
                    <PackageCheck /> প্যাকেজ দেখুন
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  const products = s.productIds.length
    ? catalog.products.filter((p) => s.productIds.includes(p.id))
    : catalog.products.filter((p) => p.featured);
  if (s.type === "packages")
    return (
      <section
        id="packages"
        className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6"
      >
        <div className="rounded-[2rem] bg-foreground p-6 sm:p-12">
          <div className="mb-8 text-center text-background">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              {s.title}
            </h2>
            <p className="mt-2 text-background/70">{s.subtitle}</p>
          </div>
          {products.slice(0, 3).map((p) => (
            <Packages key={p.id} product={p} />
          ))}
        </div>
      </section>
    );
  return (
    <section
      id={
        s.type === "categories"
          ? "category"
          : s.type === "combo"
            ? "combo"
            : "deals"
      }
      className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6"
    >
      <h2 className="font-display text-3xl font-bold sm:text-4xl">{s.title}</h2>
      <p className="mb-6 mt-2 text-muted-foreground">{s.subtitle}</p>
      {s.type === "categories" ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {catalog.categories
            .filter((c) =>
              s.categoryIds.length ? s.categoryIds.includes(c.id) : c.homepage,
            )
            .map((c, i) => {
              const Icon = icons[i % icons.length];
              return (
                <Link
                  to={"/category/" + c.slug}
                  key={c.id}
                  className="rounded-3xl border-2 bg-card p-6 text-center transition hover:-translate-y-1 hover:border-foreground"
                >
                  {c.image ? (
                    <img
                      src={c.image}
                      alt=""
                      className="mx-auto mb-4 size-16 rounded-2xl object-cover"
                    />
                  ) : (
                    <span className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-primary/15 text-primary">
                      <Icon size={32} />
                    </span>
                  )}
                  <h3 className="font-display text-lg font-semibold">
                    {c.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {
                      catalog.products.filter((p) => p.categoryId === c.id)
                        .length
                    }{" "}
                    products
                  </p>
                </Link>
              );
            })}
        </div>
      ) : s.type === "combo" ? (
        catalog.combos.map((c) => <ComboBuilder key={c.id} combo={c} />)
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard product={p} key={p.id} />
          ))}
        </div>
      )}
    </section>
  );
}
function Packages({ product: p }: { product: Product }) {
  const [selected, setSelected] = useState(p.variants[0]?.id),
    { add, notice } = useStore(),
    [busy, setBusy] = useState(false);
  const chosen = p.variants.find((v) => v.id === selected);
  return (
    <div className="mb-8">
      <Link
        to={"/product/" + p.slug}
        className="mb-5 block text-center text-xl font-semibold text-background"
      >
        {p.name}
      </Link>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {p.variants.map((v, i) => (
          <button
            key={v.id}
            onClick={() => setSelected(v.id)}
            disabled={!v.stock}
            className={cn(
              "relative flex min-h-52 flex-col rounded-3xl p-6 text-left",
              i === p.variants.length - 1 ? "bg-sun" : "bg-card",
              selected === v.id && "ring-4 ring-primary",
              !v.stock && "opacity-50",
            )}
          >
            <span className="font-display font-semibold">{v.name}</span>
            <span className="mt-3 text-3xl font-bold">{money(v.price)}</span>
            <span className="mt-1 text-sm text-muted-foreground">
              {money(v.price / v.units)} / pc · {v.units} pcs
            </span>
            <span className="mt-auto rounded-full bg-primary/15 py-2 text-center font-semibold">
              {!v.stock
                ? "Out of stock"
                : selected === v.id
                  ? "Selected"
                  : "Select pack"}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-6 text-center">
        <Button
          variant="shopOutline"
          size="shop"
          disabled={busy || !chosen?.stock}
          onClick={async () => {
            if (!chosen) return;
            setBusy(true);
            try {
              await add({
                type: "product",
                productId: p.id,
                variantId: chosen.id,
                quantity: 1,
              });
            } catch (e) {
              notice((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Add {chosen?.name || "package"} to cart
        </Button>
      </div>
    </div>
  );
}
function ComboBuilder({ combo }: { combo: Combo }) {
  const { catalog, add, notice } = useStore(),
    navigate = useNavigate(),
    [count, setCount] = useState(combo.tiers[0].count),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  const tier = combo.tiers.find((t) => t.count === count);
  return (
    <div className="mb-6 rounded-[2rem] border-2 bg-card p-5 sm:p-8">
      <h3 className="text-2xl font-bold">{combo.name}</h3>
      <p className="mt-2 text-muted-foreground">{combo.description}</p>
      <div className="my-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {combo.tiers.map((t) => (
          <button
            key={t.count}
            onClick={() => {
              setCount(t.count);
              setSelected([]);
            }}
            className={cn(
              "rounded-2xl border-2 p-4 text-left",
              count === t.count ? "border-foreground bg-sun" : "bg-background",
            )}
          >
            <span className="block font-semibold">
              {t.count} {t.count === 1 ? "Product" : "Products"}
            </span>
            <span className="text-2xl font-bold">{money(t.price)}</span>
          </button>
        ))}
      </div>
      <p className="mb-4 font-semibold">
        Selected: {selected.length} / {count}
      </p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {catalog.products
          .filter((p) => combo.productIds.includes(p.id))
          .map((p) => {
            const active = selected.includes(p.id),
              stock = p.variants[0]?.stock;
            return (
              <button
                key={p.id}
                aria-pressed={active}
                disabled={!stock || (!active && selected.length >= count)}
                onClick={() =>
                  setSelected(
                    active
                      ? selected.filter((x) => x !== p.id)
                      : [...selected, p.id],
                  )
                }
                className={cn(
                  "overflow-hidden rounded-3xl border-2 text-left disabled:opacity-40",
                  active ? "border-foreground bg-primary/10" : "border-border",
                )}
              >
                <div className="relative">
                  <img
                    src={p.images[0]}
                    alt=""
                    className="aspect-[5/4] w-full object-cover"
                  />
                  {active && (
                    <Check className="absolute right-2 top-2 rounded-full bg-primary p-1" />
                  )}
                </div>
                <div className="p-4 font-semibold">{p.name}</div>
              </button>
            );
          })}
      </div>
      <div className="mt-7 flex justify-center">
      <Button
        variant="shop"
        size="shop"
        className="min-w-44"
        disabled={busy || !tier}
        onClick={async () => {
          if (selected.length !== count) {
            notice("Please select required products first.");
            return;
          }
          setBusy(true);
          try {
            await add({
              type: "combo",
              comboId: combo.id,
              productIds: selected,
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
        Buy Now - {money(tier?.price || 0)}
      </Button>
      </div>
    </div>
  );
}
export function Shop() {
  const { catalog } = useStore(),
    [params, setParams] = useSearchParams(),
    { slug } = useParams(),
    [sort, setSort] = useState("name");
  const category = catalog.categories.find((c) => c.slug === slug),
    q = params.get("q") || "";
  const ids = new Set(category ? [category.id] : []);
  let previous = 0;
  while (ids.size !== previous) {
    previous = ids.size;
    catalog.categories.forEach((c) => {
      if (c.parentId && ids.has(c.parentId)) ids.add(c.id);
    });
  }
  const products = catalog.products
    .filter(
      (p) =>
        (!slug || ids.has(p.categoryId)) &&
        `${p.name} ${p.detail} ${catalog.categories.find((c) => c.id === p.categoryId)?.name}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "price-asc"
        ? (a.variants[0]?.price || 0) - (b.variants[0]?.price || 0)
        : sort === "price-desc"
          ? (b.variants[0]?.price || 0) - (a.variants[0]?.price || 0)
          : a.name.localeCompare(b.name),
    );
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-bold">
        {slug ? category?.name || "Category not found" : "Shop all products"}
      </h1>
      <div className="my-6 flex flex-wrap gap-3">
        <input
          className="field flex-1"
          aria-label="Search catalog"
          placeholder="Search products…"
          value={q}
          onChange={(e) =>
            setParams(e.target.value ? { q: e.target.value } : {})
          }
        />
        <select
          className="field w-auto"
          aria-label="Sort products"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="name">Name</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </div>
      <nav className="mb-8 flex flex-wrap gap-2">
        <Link className="chip" to="/shop">
          All
        </Link>
        {catalog.categories.map((c) => (
          <Link
            className={cn("chip", c.id === category?.id && "bg-primary")}
            key={c.id}
            to={"/category/" + c.slug}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      <p className="mb-4 text-sm text-muted-foreground">
        {products.length} products
      </p>
      {products.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <Empty>No products match your search.</Empty>
      )}
    </main>
  );
}
