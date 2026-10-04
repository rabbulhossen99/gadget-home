import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Check, ChevronRight, Heart, Minus, Plus, Search, ShieldCheck,
  ShoppingBag, Star, Truck, X, ZoomIn,
} from "lucide-react";
import { useState, type MouseEvent } from "react";

import mainImage from "@/assets/vitaboost-main.jpg";
import sideImage from "@/assets/vitaboost-side.jpg";
import capsulesImage from "@/assets/vitaboost-capsules.jpg";
import lifestyleImage from "@/assets/vitaboost-lifestyle.jpg";
import herbalTea from "@/assets/herbal-tea.jpg.asset.json";
import babyLotion from "@/assets/baby-lotion.jpg.asset.json";
import handSanitizer from "@/assets/hand-sanitizer.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VitaBoost Vitamin C 1000mg | GadgetHome" },
      { name: "description", content: "Shop VitaBoost Vitamin C 1000mg with flexible packages and fast delivery across Bangladesh." },
      { property: "og:title", content: "VitaBoost Vitamin C 1000mg | GadgetHome" },
      { property: "og:description", content: "Daily high-potency immunity support with flexible package savings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductPage,
});

const gallery = [
  { src: mainImage, alt: "VitaBoost Vitamin C bottle with orange and capsules" },
  { src: sideImage, alt: "VitaBoost Vitamin C bottle from the side" },
  { src: capsulesImage, alt: "VitaBoost bottle with orange softgel capsules" },
  { src: lifestyleImage, alt: "VitaBoost Vitamin C in a bright kitchen" },
] as const;

const packages = [
  { label: "1 Pc", price: 350, note: "৳350 / pc", popular: false, best: false },
  { label: "2 Pcs", price: 600, note: "৳300 / pc", popular: true, best: false },
  { label: "3 Pcs", price: 800, note: "৳267 / pc", popular: false, best: false },
  { label: "Family Pack", price: 1000, note: "4 pcs · ৳250 / pc", popular: false, best: true },
] as const;

const related = [
  { category: "Herbal Care", name: "GreenShield Herbal Tea", detail: "Natural daily wellness blend", price: "৳350", image: herbalTea.url },
  { category: "Baby Care", name: "TinySoft Baby Lotion", detail: "Gentle care · 200ml", price: "৳600", image: babyLotion.url },
  { category: "Personal Care", name: "PureGuard Hand Sanitizer", detail: "Quick protection · 250ml", price: "৳280", image: handSanitizer.url },
];

function ProductPage() {
  const navigate = useNavigate({ from: "/" });
  const [selectedImage, setSelectedImage] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [selectedPackage, setSelectedPackage] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [cartCount, setCartCount] = useState(0);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"details" | "usage" | "reviews">("details");

  const chosenPackage = packages[selectedPackage] ?? packages[0];
  const chosenImage = gallery[selectedImage] ?? gallery[0];
  const total = chosenPackage.price * quantity;

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2200);
  };

  const addToCart = () => {
    setCartCount((count) => count + quantity);
    flash(`${quantity} × ${chosenPackage.label} added to cart`);
  };

  const buyNow = () => {
    navigate({
      to: "/checkout",
      search: { package: chosenPackage.label, quantity, subtotal: total },
    });
  };

  const updateZoom = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setZoomPosition({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground md:pb-0">
      <div className="bg-foreground px-4 py-2.5 text-center text-xs font-medium text-background">
        Free express shipping on Family Pack orders · 100% original products
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6">
          <a href="#top" className="min-w-0 truncate font-display text-xl font-semibold">Gadget<span className="text-primary">Home</span></a>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <nav className="hidden items-center gap-6 text-sm font-semibold md:flex">
              <a href="#details" className="hover:text-primary">Product details</a>
              <a href="#reviews" className="hover:text-primary">Reviews</a>
              <a href="#related" className="hover:text-primary">More products</a>
            </nav>
            <Button variant="ghost" size="icon" aria-label="Search"><Search /></Button>
            <Button variant="outline" size="icon" className="relative" aria-label={`Cart with ${cartCount} items`}>
              <ShoppingBag />
              {cartCount > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-accent text-[10px] text-accent-foreground">{cartCount}</span>}
            </Button>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9">
        <nav aria-label="Breadcrumb" className="mb-6 flex min-w-0 items-center gap-2 overflow-hidden text-xs font-semibold text-muted-foreground">
          <a href="#related" className="shrink-0 hover:text-primary">Home</a><ChevronRight className="size-3 shrink-0" />
          <a href="#related" className="shrink-0 hover:text-primary">Supplements</a><ChevronRight className="size-3 shrink-0" />
          <span className="truncate text-foreground">Vitamin C 1000mg</span>
        </nav>

        <section className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <div
              className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border"
              onMouseMove={updateZoom}
              onMouseEnter={() => setZoomed(true)}
              onMouseLeave={() => setZoomed(false)}
              onClick={() => setZoomed((value) => !value)}
              role="button"
              tabIndex={0}
              aria-label="Zoom product image"
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setZoomed((value) => !value); }}
            >
              <img
                src={chosenImage.src}
                alt={chosenImage.alt}
                width={1200}
                height={1200}
                className="product-image size-full object-cover"
                style={{ transform: zoomed ? "scale(1.8)" : "scale(1)", transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%` }}
              />
              <span className="absolute left-4 top-4 rounded-full bg-accent px-3 py-1.5 text-[10px] font-bold text-accent-foreground">20% OFF</span>
              <span className="absolute bottom-4 right-4 grid size-10 place-items-center rounded-full bg-card/90 text-foreground shadow-sm"><ZoomIn className="size-4" /></span>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3 sm:gap-4">
              {gallery.map((image, index) => (
                <button key={image.src} onClick={() => { setSelectedImage(index); setZoomed(false); }} className={cn("aspect-square overflow-hidden rounded-lg bg-card ring-1 ring-border transition hover:ring-primary", selectedImage === index && "ring-2 ring-primary")} aria-label={`View product photo ${index + 1}`}>
                  <img src={image.src} alt="" width={220} height={220} loading="lazy" className="size-full object-cover" />
                </button>
              ))}
            </div>
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ZoomIn className="size-3.5" /> Hover or tap the main photo to zoom</p>
          </div>

          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <div className="text-xs font-bold uppercase text-primary">Immune defense</div>
              <h1 className="mt-2 text-balance font-display text-3xl font-semibold leading-tight sm:text-4xl">VitaBoost Vitamin C 1000mg</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">High-potency daily immunity and antioxidant support in an easy-to-take capsule.</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1 font-bold text-accent"><Star className="size-4 fill-current" /> 4.9</span>
                <a href="#reviews" className="text-muted-foreground underline-offset-4 hover:underline">128 reviews</a>
                <span className="flex items-center gap-1 font-semibold text-primary"><span className="size-2 rounded-full bg-primary" /> In stock</span>
              </div>
              <div className="mt-7 flex items-end gap-3 border-y border-border py-5">
                <span className="font-display text-3xl font-semibold">৳{chosenPackage.price.toLocaleString()}</span>
                <span className="mb-1 text-lg text-muted-foreground line-through">৳750</span>
                <span className="mb-1 ml-auto text-xs font-bold text-accent">Save 20%</span>
              </div>

              <fieldset className="mt-7">
                <legend className="mb-3 text-xs font-bold uppercase text-muted-foreground">Select package</legend>
                <div className="grid grid-cols-2 gap-3">
                  {packages.map((pack, index) => (
                    <button key={pack.label} onClick={() => setSelectedPackage(index)} className={cn("relative min-h-20 rounded-lg border-2 bg-card p-3 text-left transition", selectedPackage === index ? "border-primary bg-secondary" : "border-transparent ring-1 ring-border hover:border-primary/40")}>
                      {pack.best && <span className="absolute -top-2 right-2 rounded bg-foreground px-2 py-0.5 text-[9px] font-bold text-background">BEST VALUE</span>}
                      <span className="block text-sm font-bold">{pack.label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{pack.note}</span>
                      {pack.popular && <span className="mt-1 block text-[10px] font-bold text-primary">MOST POPULAR</span>}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                <div className="flex h-12 items-center rounded-lg border border-border bg-card p-1">
                  <Button variant="ghost" size="icon" className="size-9" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity"><Minus /></Button>
                  <span className="w-8 text-center text-sm font-bold" aria-live="polite">{quantity}</span>
                  <Button variant="ghost" size="icon" className="size-9" onClick={() => setQuantity((value) => Math.min(9, value + 1))} aria-label="Increase quantity"><Plus /></Button>
                </div>
                <Button size="lg" onClick={addToCart}><ShoppingBag /> Add to cart</Button>
              </div>
              <Button variant="buy" size="lg" className="mt-3 w-full" onClick={buyNow}>Buy now · ৳{total.toLocaleString()}</Button>

              <div className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6">
                <div className="flex gap-3"><Truck className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="text-sm font-bold">Fast delivery</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">Dhaka ৳60 · 48 hours</p></div></div>
                <div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="text-sm font-bold">Original product</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">Quality guaranteed</p></div></div>
              </div>
            </div>
          </div>
        </section>

        <section id="details" className="mt-20 scroll-mt-24">
          <div className="flex gap-7 overflow-x-auto border-b border-border">
            {(["details", "usage", "reviews"] as const).map((item) => (
              <button key={item} onClick={() => setTab(item)} className={cn("shrink-0 border-b-2 pb-4 text-sm font-bold capitalize", tab === item ? "border-primary text-foreground" : "border-transparent text-muted-foreground")}>{item === "details" ? "Product details" : item}</button>
            ))}
          </div>
          <div className="grid gap-12 py-10 lg:grid-cols-2">
            {tab === "details" && <>
              <div className="max-w-xl"><h2 className="font-display text-2xl font-semibold">Daily immunity support</h2><p className="mt-4 leading-7 text-muted-foreground">VitaBoost 1000mg provides a high-potency dose of Vitamin C to support your body’s natural defenses. The gentle formula is designed for convenient everyday use.</p><ul className="mt-6 space-y-3">{["Antioxidant protection against free radicals", "Supports normal collagen production", "Easy-to-take vegetarian capsules", "Non-GMO and gluten-free formula"].map((benefit) => <li key={benefit} className="flex gap-3 text-sm"><Check className="size-5 shrink-0 text-primary" />{benefit}</li>)}</ul></div>
              <div className="rounded-xl bg-card p-6 ring-1 ring-border"><h3 className="font-display text-sm font-semibold uppercase text-muted-foreground">Product attributes</h3><dl className="mt-5 divide-y divide-border">{[["Strength", "1000mg per capsule"], ["Form", "Vegetarian capsules"], ["Pack size", "60 capsules"], ["Origin", "GMP-certified facility"], ["Shelf life", "24 months"], ["Storage", "Cool, dry place"]].map(([term, value]) => <div key={term} className="grid grid-cols-2 gap-4 py-3 text-sm"><dt className="text-muted-foreground">{term}</dt><dd className="text-right font-semibold">{value}</dd></div>)}</dl></div>
            </>}
            {tab === "usage" && <div className="max-w-xl lg:col-span-2"><h2 className="font-display text-2xl font-semibold">Suggested use</h2><p className="mt-4 leading-7 text-muted-foreground">Take one capsule daily with water, preferably after a meal. Do not exceed the recommended serving. Consult a healthcare professional if pregnant, nursing, taking medicine, or managing a health condition.</p></div>}
            {tab === "reviews" && <div id="reviews" className="lg:col-span-2"><div className="grid gap-8 sm:grid-cols-[220px_1fr]"><div><div className="font-display text-5xl font-semibold">4.9</div><div className="mt-2 flex text-accent">★★★★★</div><p className="mt-2 text-sm text-muted-foreground">Based on 128 verified reviews</p></div><div className="space-y-3">{[92, 6, 2, 0, 0].map((value, index) => <div key={index} className="grid grid-cols-[28px_1fr_34px] items-center gap-3 text-xs"><span>{5-index}★</span><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{width: `${value}%`}} /></div><span>{value}%</span></div>)}</div></div></div>}
          </div>
        </section>

        <section id="related" className="mb-16 mt-16 scroll-mt-24">
          <div className="mb-7"><h2 className="font-display text-2xl font-semibold">Complete your wellness routine</h2><p className="mt-2 text-sm text-muted-foreground">More everyday essentials from GadgetHome</p></div>
          <div className="grid gap-5 sm:grid-cols-3">
            {related.map((product) => <article key={product.name} className="group"><div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-card ring-1 ring-border"><img src={product.image} alt={product.name} width={912} height={736} loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-[1.03]" /><Button variant="ghost" size="icon" className="absolute right-3 top-3 bg-card/90" aria-label={`Save ${product.name}`}><Heart /></Button></div><div className="mt-4 flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[10px] font-bold uppercase text-primary">{product.category}</p><h3 className="mt-1 truncate font-display text-base font-semibold">{product.name}</h3><p className="mt-1 text-xs text-muted-foreground">{product.detail}</p><p className="mt-2 font-bold">{product.price}</p></div><Button size="icon" className="mt-1 shrink-0" onClick={() => { setCartCount((count) => count + 1); flash(`${product.name} added`); }} aria-label={`Add ${product.name} to cart`}><Plus /></Button></div></article>)}
          </div>
        </section>
      </main>

      {message && <div role="status" className="fixed bottom-24 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-lg md:bottom-6"><Check className="size-4 text-primary" />{message}</div>}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-3 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
          <div className="pr-2"><p className="text-[10px] text-muted-foreground">Total</p><p className="font-display text-base font-semibold">৳{total.toLocaleString()}</p></div>
          <Button variant="outline" className="px-2" onClick={addToCart}>Add to cart</Button>
          <Button variant="buy" className="px-2" onClick={buyNow}>Buy now</Button>
        </div>
      </div>
    </div>
  );
}