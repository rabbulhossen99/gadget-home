import { useEffect, useRef, useState } from "react";
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
import { track, useTracking } from "@/lib/tracking";
import { money } from "@/lib/api";
import type { Category, Combo, Product, Section } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ProductCard, Empty } from "@/components/shared";
import { cn } from "@/lib/utils";
const icons = [Pill, Sparkles, HeartPulse, Leaf, Baby];
export function Home() {
  const { catalog } = useStore();
  const heroSections = catalog.sections
    .filter((section) => section.type === "hero")
    .flatMap((section) => [
      section,
      ...(section.banner2Image
        ? [{
            ...section,
            id: section.id + "-banner-2",
            image: section.banner2Image,
            mobileImage: "",
            title: section.banner2Heading || "",
            subtitle: section.banner2Description || "",
            buttonText: section.banner2ButtonText || "",
            link: section.banner2RedirectUrl || "",
          }]
        : []),
    ]);
  const otherSections = catalog.sections.filter((section) => section.type !== "hero");
  return (
    <main id="top">
      {heroSections.length > 0 && <HeroCarousel sections={heroSections} />}
      {otherSections.map((section) => (
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
function HeroCarousel({ sections }: { sections: Section[] }) {
  const [index, setIndex] = useState(0);
  const startX = useRef(0);
  useEffect(() => {
    if (sections.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % sections.length), 4500);
    return () => window.clearInterval(timer);
  }, [sections.length]);
  return (
    <section
      className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6 sm:py-5"
      onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const delta = e.changedTouches[0].clientX - startX.current;
        if (Math.abs(delta) < 40 || sections.length < 2) return;
        setIndex((i) => (i + (delta < 0 ? 1 : -1) + sections.length) % sections.length);
      }}
    >
      <div className="relative overflow-hidden rounded-[2rem] bg-primary">
        {sections.map((section, i) => (
          <div
            key={section.id}
            className={cn(
              "transition-opacity duration-700",
              i === index ? "relative opacity-100" : "pointer-events-none absolute inset-0 opacity-0",
            )}
          >
            <HeroBanner section={section} />
          </div>
        ))}
        {sections.length > 1 && (
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {sections.map((section, i) => (
              <button
                key={section.id}
                aria-label={`Show banner ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn("size-2 rounded-full bg-white/50", i === index && "bg-white")}
              />
            ))}
          </div>
        )}
      </div>
      <div className="mx-auto mt-4 h-px max-w-6xl bg-border/60 sm:mt-6" aria-hidden="true" />
    </section>
  );
}
function HeroBanner({ section: s }: { section: Section }) {
  const content = (
    <>
      <div className="absolute -right-12 -top-20 size-72 rounded-full bg-sun/80" />
      <div className="absolute -bottom-20 right-32 size-48 rounded-full bg-coral/75" />
      {s.image && (
        <picture>
          {s.mobileImage && <source media="(max-width: 767px)" srcSet={s.mobileImage} />}
          <img src={s.image} alt="" className="absolute inset-0 size-full object-contain" />
        </picture>
      )}
      {(s.title || s.subtitle || s.buttonText) && (
        <div className={cn("relative max-w-2xl", s.image && "rounded-2xl bg-background/90 p-6")}>
          <span className="mb-6 inline-flex gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold text-background">
            <Leaf size={16} />
          </span>
          {s.title && <h1 className="whitespace-pre-line font-display text-4xl font-bold leading-tight sm:text-6xl">{s.title}</h1>}
          {s.subtitle && <p className="mt-5 max-w-xl text-lg text-foreground/80">{s.subtitle}</p>}
          {s.buttonText && <Button variant="shop" size="shop"><ShoppingBag />{s.buttonText}</Button>}
        </div>
      )}
    </>
  );
  const body = <div className="relative min-h-[360px] overflow-hidden px-6 py-12 sm:min-h-[510px] sm:px-12 lg:px-16 lg:py-20">{content}</div>;
  return s.link ? <Link to={s.link} className="block">{body}</Link> : body;
}
function HomeSection({ section: s }: { section: Section }) {
  const { catalog } = useStore();
  const [showAllProducts, setShowAllProducts] = useState(false);
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
            <picture>
              {s.mobileImage && <source media="(max-width: 767px)" srcSet={s.mobileImage} />}
              <img
                src={s.image}
                alt=""
                className="absolute inset-0 size-full object-contain"
              />
            </picture>
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
                    <PackageCheck /> Explore Package
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
        className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8"
      >
          <div className="mb-5 text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl lg:text-4xl">
              {s.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">{s.subtitle}</p>
          </div>
        <div className="rounded-[2rem] border border-border bg-card p-4 text-foreground shadow-sm sm:p-6">
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
      className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8"
    >
      <h2 className="text-center font-display text-3xl font-bold sm:text-4xl">
        {s.type === "categories" ? "Shop by Category" : s.title}
      </h2>
      <p className="mb-5 mt-2 text-center text-muted-foreground">
        {s.type === "categories"
          ? "Explore our collections and find products that fit your lifestyle."
          : s.subtitle}
      </p>
      {s.type === "categories" ? (
        <>
          <CategoryCarousel
            categories={catalog.categories.filter((c) =>
              s.categoryIds.length ? s.categoryIds.includes(c.id) : c.homepage,
            )}
            productCount={(id) =>
              catalog.products.filter((p) => p.categoryId === id).length
            }
          />
          <div className="mx-auto mt-5 h-px max-w-6xl bg-border/60 sm:mt-6" aria-hidden="true" />
        </>
      ) : s.type === "combo" ? (
        <div className="rounded-[2rem] border border-border bg-card p-4 text-foreground shadow-sm sm:p-6">
          {catalog.combos.map((c) => <ComboBuilder key={c.id} combo={c} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            {products.slice(0, s.type === "products" && !showAllProducts ? 8 : undefined).map((p) => (
              <ProductCard product={p} key={p.id} />
            ))}
          </div>
          {s.type === "products" && products.length > 8 && !showAllProducts && (
            <div className="mt-6 text-center">
              <Button variant="outline" className="rounded-full px-6" onClick={() => setShowAllProducts(true)}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
function CategoryCarousel({
  categories,
  productCount,
}: {
  categories: Category[];
  productCount: (id: string) => number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);
  const looped = [...categories, ...categories];
  useEffect(() => {
    if (categories.length < 2) return;
    const timer = window.setInterval(() => {
      const el = scroller.current;
      if (!el || dragging.current) return;
      const card = el.querySelector<HTMLElement>("[data-category-card]");
      el.scrollBy({ left: (card?.offsetWidth || 280) + 16, behavior: "smooth" });
    }, 2800);
    return () => window.clearInterval(timer);
  }, [categories.length]);
  const onScroll = () => {
    const el = scroller.current;
    if (el && el.scrollLeft >= el.scrollWidth / 2) el.scrollLeft -= el.scrollWidth / 2;
  };
  return (
    <div
      ref={scroller}
      onScroll={onScroll}
      onPointerDown={(e) => {
        dragging.current = true;
        startX.current = e.clientX;
        startScroll.current = scroller.current?.scrollLeft || 0;
      }}
      onPointerMove={(e) => {
        if (dragging.current && scroller.current)
          scroller.current.scrollLeft = startScroll.current - (e.clientX - startX.current);
      }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
      className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden"
    >
      {looped.map((c, i) => {
        const Icon = icons[i % icons.length];
        return (
          <Link
            to={"/category/" + c.slug}
            key={`${c.id}-${i}`}
            data-category-card
            className="flex min-w-0 basis-[38%] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:basis-[24%] lg:basis-[17%]"
          >
            {c.image ? (
              <img src={c.image} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <Icon size={30} />
              </span>
            )}
            <div className="min-w-0">
              <h3 className="font-display text-sm font-semibold leading-tight sm:text-base">{c.name}</h3>
              <p className="text-xs text-muted-foreground">{productCount(c.id)} products</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
function Packages({ product: p }: { product: Product }) {
  const [selected, setSelected] = useState(
      p.variants.find((variant) => /^1\s*pc$/i.test(variant.name.trim()))?.id ||
        p.variants[0]?.id,
    ),
    { add, notice } = useStore(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false);
  const chosen = p.variants.find((v) => v.id === selected);
  return (
    <div className="mb-6 grid gap-5 last:mb-0 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center lg:gap-8">
      <Link to={"/product/" + p.slug} className="mx-auto block w-full max-w-[220px] overflow-hidden rounded-2xl border border-border bg-background">
        <img src={p.images[0]} alt={p.name} className="aspect-square w-full object-contain p-3" />
      </Link>
      <div className="min-w-0">
        <Link
          to={"/product/" + p.slug}
          className="mb-3 block text-center text-lg font-semibold text-foreground sm:mb-5 sm:text-xl"
        >
          {p.name}
        </Link>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {p.variants.map((v, i) => (
          <button
            key={v.id}
            onClick={() => setSelected(v.id)}
            disabled={!v.stock}
            className={cn(
              "relative flex min-w-0 flex-col rounded-2xl p-3 text-left sm:p-4",
              "bg-[#FAF7EF]",
              selected === v.id && "border-primary bg-sun ring-2 ring-primary/30",
              !v.stock && "opacity-50",
            )}
          >
            <span className="font-display text-sm font-semibold sm:text-base">{v.name}</span>
            <span className="mt-1 text-xl font-bold sm:text-2xl">{money(v.price)}</span>
            <span className="mt-1 text-[11px] text-muted-foreground sm:text-sm">
              {money(v.price / v.units)} / pc · {v.units} pcs
            </span>
            <span className="mt-2 rounded-full bg-primary/15 py-1 text-center text-xs font-semibold">
              {!v.stock
                ? "Out of stock"
                : selected === v.id
                  ? "Selected"
                  : "Select pack"}
            </span>
          </button>
        ))}
        </div>
        <div className="mt-4 text-center">
        <Button
          variant="buyNow"
          size="shop"
          className="h-11 w-full rounded-full bg-[#F59E0B] px-5 py-2 text-sm text-white transition-colors duration-200 hover:bg-[#D97706] hover:text-white sm:w-auto sm:min-w-64"
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
              navigate("/checkout");
            } catch (e) {
              notice((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Buy Now - {chosen?.name || "Package"}
        </Button>
        </div>
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
    <div className="mb-4 last:mb-0">
      <h3 className="text-center text-lg font-bold sm:text-xl">{combo.name}</h3>
      <p className="mt-1 text-center text-xs text-muted-foreground sm:text-sm">Choose your everyday essentials</p>
      <div className="my-4 grid grid-cols-4 gap-2 sm:gap-3">
        {combo.tiers.map((t) => (
          <button
            key={t.count}
            onClick={() => {
              setCount(t.count);
              setSelected([]);
            }}
            className={cn(
              "min-w-0 rounded-2xl border-2 p-2 text-left text-foreground sm:p-3",
              count === t.count
                ? "border-foreground bg-sun"
                : "border-border bg-[#FAF7EF]",
            )}
          >
            <span className="block truncate text-xs font-semibold sm:text-sm">
              {t.count} {t.count === 1 ? "Product" : "Products"}
            </span>
            <span className="text-sm font-bold sm:text-xl">{money(t.price)}</span>
          </button>
        ))}
      </div>
      <p className="mb-3 text-sm font-semibold text-foreground">
        Selected: {selected.length} / {count}
      </p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
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
                  "min-w-0 overflow-hidden rounded-2xl border-2 bg-background text-left text-foreground shadow-sm disabled:opacity-40",
                  active ? "border-foreground bg-primary/10" : "border-border",
                )}
              >
                <div className="relative">
                  <img
                    src={p.images[0]}
                    alt=""
                    className="aspect-square w-full bg-muted/20 object-contain p-1 sm:p-2"
                  />
                  {active && (
                    <Check className="absolute right-2 top-2 rounded-full bg-primary p-1" />
                  )}
                </div>
                <div className="line-clamp-2 p-1.5 text-[10px] font-semibold leading-tight sm:p-2 sm:text-xs">{p.name}</div>
              </button>
            );
          })}
      </div>
      <div className="mt-4 flex justify-center">
      <Button
        variant="buyNow"
        size="shop"
        className="h-10 w-full min-w-44 rounded-full px-5 text-sm text-white sm:w-auto"
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
    q = params.get("q") || "",
    { active } = useTracking();
  useEffect(() => {
    const term = q.trim();
    if (!active || !term) return;
    // Wait until typing pauses so each search is reported once.
    const timer = setTimeout(
      () => track("Search", { search_string: term.slice(0, 200) }),
      800,
    );
    return () => clearTimeout(timer);
  }, [q, active]);
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
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
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
