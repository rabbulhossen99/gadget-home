import { createFileRoute } from "@tanstack/react-router";
import { Baby, HeartPulse, Leaf, Menu, PackageCheck, Pill, Search, ShoppingBag, Sparkles } from "lucide-react";
import { useState } from "react";

import babyLotion from "@/assets/baby-lotion.jpg";
import { ComboOffer, type ComboCartItem } from "@/components/combo-offer";
import herbalTea from "@/assets/herbal-tea.jpg";
import vitaminC from "@/assets/vitamin-c.jpg";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GadgetHome — Health & Wellness in Bangladesh" },
      { name: "description", content: "Shop genuine medicine, personal care, health care, herbal, and baby care products with value packages." },
      { property: "og:title", content: "GadgetHome — Health & Wellness" },
      { property: "og:description", content: "Everyday care, genuine products, and value packages delivered across Bangladesh." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Storefront,
});

const categories = [
  { name: "Medicine", count: "৩২০+ পণ্য", Icon: Pill, tone: "bg-primary/15 text-primary" },
  { name: "Personal Care", count: "১৪৮+ পণ্য", Icon: Sparkles, tone: "bg-coral/15 text-coral" },
  { name: "Health Care", count: "২০৫+ পণ্য", Icon: HeartPulse, tone: "bg-sky/15 text-sky" },
  { name: "Herbal", count: "৯৬+ পণ্য", Icon: Leaf, tone: "bg-sun/20 text-foreground" },
  { name: "Baby Care", count: "৭৪+ পণ্য", Icon: Baby, tone: "bg-grape/15 text-grape" },
];

const packages = [
  { label: "1 Pc", price: "৳350", unit: "৳350 / pc" },
  { label: "2 Pcs", price: "৳600", unit: "৳300 / pc" },
  { label: "3 Pcs", price: "৳800", unit: "৳267 / pc" },
  { label: "Family Pack", price: "৳1,000", unit: "৳250 / pc · 4 pcs", best: true },
];

const products = [
  { category: "Medicine", name: "VitaBoost Vitamin C 1000mg", detail: "প্রতিদিনের রোগ প্রতিরোধে", price: "৳600", old: "৳750", discount: "-20%", image: vitaminC },
  { category: "Herbal", name: "GreenShield Herbal Tea", detail: "প্রাকৃতিক উপাদানে তৈরি", price: "৳350", old: "৳410", discount: "-15%", image: herbalTea },
  { category: "Baby Care", name: "TinySoft Baby Lotion", detail: "নরম ত্বকের জন্য, ২০০ml", price: "৳600", old: "৳670", discount: "-10%", image: babyLotion },
];

function Storefront() {
  const [cartCount, setCartCount] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState("Family Pack");

  const addToCart = (label?: string) => {
    if (label) setSelectedPackage(label);
    setCartCount((count) => count + 1);
  };

  const addCombo = (_item: ComboCartItem) => {
    setCartCount((count) => count + 1);
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <div className="bg-foreground px-4 py-2 text-center font-bn text-xs font-semibold text-background sm:text-sm">
        🚚 সারা বাংলাদেশে ২৪ ঘণ্টায় ডেলিভারি · ৳৫০০+ অর্ডারে ফ্রি শিপিং · অরিজিনাল প্রোডাক্ট গ্যারান্টি
      </div>

      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 py-4 sm:px-6">
          <a href="#top" className="shrink-0 font-display text-2xl font-bold">Gadget<span className="text-primary">Home</span></a>
          <nav className="hidden items-center gap-6 text-sm font-semibold lg:flex">
            <a href="#category" className="transition-colors hover:text-primary">Categories</a>
            <a href="#deals" className="transition-colors hover:text-primary">Deals</a>
            <a href="#packages" className="transition-colors hover:text-primary">Packages</a>
            <a href="#combo" className="transition-colors hover:text-primary">Combo Offer</a>
          </nav>
          <label className="ml-auto hidden flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 shadow-sm md:flex lg:max-w-xl">
            <Search className="size-4 text-muted-foreground" />
            <input aria-label="Search products" placeholder="পণ্য, ব্র্যান্ড বা ক্যাটাগরি খুঁজুন…" className="min-w-0 flex-1 bg-transparent font-bn text-sm outline-none placeholder:text-muted-foreground" />
          </label>
          <Button variant="outline" size="icon" className="relative rounded-full" aria-label={`Cart with ${cartCount} items`}>
            <ShoppingBag />
            {cartCount > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-coral text-[11px] font-bold text-primary-foreground">{cartCount}</span>}
          </Button>
          <Button variant="shop" className="hidden sm:inline-flex">Sign in</Button>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu /></Button>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-10">
          <div className="relative min-h-[510px] overflow-hidden rounded-[2rem] bg-primary px-6 py-12 sm:px-12 lg:px-16 lg:py-20">
            <div className="absolute -right-12 -top-20 size-72 rounded-full bg-sun/80" />
            <div className="absolute -bottom-20 right-32 size-48 rounded-full bg-coral/75" />
            <div className="absolute right-8 top-10 size-14 rounded-full bg-sky/80" />
            <div className="absolute bottom-10 right-72 size-8 rounded-full bg-card/70" />
            <div className="relative max-w-2xl">
              <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-bold uppercase tracking-widest text-background"><Leaf className="size-4" /> ১০০% অরিজিনাল</span>
              <h1 className="font-display text-5xl font-bold leading-[0.98] sm:text-6xl lg:text-7xl">স্বাস্থ্য যত্ন,<br />সাশ্রয়ী দামে।</h1>
              <p className="mt-5 max-w-xl font-bn text-lg font-medium text-foreground/80">ওষুধ, পার্সোনাল কেয়ার, হার্বাল ও বেবি কেয়ার — এক জায়গায়, দ্রুত ডেলিভারি। Family Pack নিলে সাশ্রয় সবচেয়ে বেশি।</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="shop" size="shop" asChild><a href="#deals"><ShoppingBag /> এখনই কিনুন</a></Button>
                <Button variant="shopOutline" size="shop" asChild><a href="#packages"><PackageCheck /> প্যাকেজ দেখুন</a></Button>
              </div>
            </div>
          </div>
        </section>

        <section id="category" className="mx-auto max-w-[1440px] px-4 pb-2 pt-4 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div><h2 className="font-display text-3xl font-bold sm:text-4xl">ক্যাটাগরি</h2><p className="mt-1 font-bn font-medium text-muted-foreground">আপনার প্রয়োজন অনুযায়ী বেছে নিন</p></div>
            <a href="#deals" className="font-semibold text-primary hover:underline">সব ক্যাটাগরি →</a>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5 lg:gap-4">
            {categories.map(({ name, count, Icon, tone }) => (
              <a key={name} href="#deals" className="group rounded-3xl border-2 border-border bg-card p-4 text-center transition hover:-translate-y-1 hover:border-foreground sm:p-6">
                <div className={cn("mx-auto mb-4 grid size-16 place-items-center rounded-2xl", tone)}><Icon className="size-8" /></div>
                <div className="font-display text-base font-semibold sm:text-lg">{name}</div><div className="mt-1 font-bn text-sm font-medium text-muted-foreground">{count}</div>
              </a>
            ))}
          </div>
        </section>

        <section id="packages" className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6">
          <div className="rounded-[2rem] bg-foreground p-6 sm:p-12">
            <div className="mb-8 text-center"><h2 className="font-display text-3xl font-bold text-background sm:text-4xl">Quantity / Package Options</h2><p className="mx-auto mt-2 max-w-lg font-bn font-medium text-background/60">একই product-এর জন্য আলাদা আলাদা প্যাকেজ — যত বেশি নেবেন, তত সাশ্রয়।</p></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {packages.map((pack) => (
                <button key={pack.label} onClick={() => setSelectedPackage(pack.label)} className={cn("relative flex min-h-52 flex-col rounded-3xl p-6 text-left transition hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary", pack.best ? "bg-sun" : "bg-card", selectedPackage === pack.label && "ring-4 ring-primary")}>
                  {pack.best && <span className="absolute -top-3 right-5 rounded-full bg-coral px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">Best value</span>}
                  <div className="font-display font-semibold">{pack.label}</div><div className="mt-3 font-display text-3xl font-bold">{pack.price}</div><div className="mt-1 text-sm font-medium text-muted-foreground">{pack.unit}</div>
                  <span className={cn("mt-auto block rounded-full py-2.5 text-center font-semibold", pack.best ? "bg-foreground text-background" : "bg-primary/15 text-primary")}>{selectedPackage === pack.label ? "Selected" : "Select pack"}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-center"><Button variant="shopOutline" size="shop" onClick={() => addToCart(selectedPackage)}>Add {selectedPackage} to cart</Button></div>
          </div>
        </section>

        <section id="deals" className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-6">
          <h2 className="mb-6 font-display text-3xl font-bold sm:text-4xl">আজকের সেরা ডিল</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {products.map((product) => (
              <article key={product.name} className="overflow-hidden rounded-3xl border-2 border-border bg-card">
                <div className="relative"><img src={product.image} alt={product.name} loading="lazy" width={912} height={736} className="aspect-[5/4] w-full object-cover" /><span className="absolute left-3 top-3 rounded-full bg-coral px-3 py-1 text-xs font-bold text-primary-foreground">{product.discount}</span></div>
                <div className="p-5"><div className="text-xs font-bold uppercase tracking-wide text-primary">{product.category}</div><h3 className="mt-1 font-display text-lg font-semibold">{product.name}</h3><p className="mt-1 font-bn text-sm font-medium text-muted-foreground">{product.detail}</p><div className="mt-3 flex items-center gap-2"><span className="font-display text-xl font-bold">{product.price}</span><span className="text-sm text-muted-foreground line-through">{product.old}</span></div><Button variant="shop" className="mt-4 w-full" onClick={() => addToCart()}>Add to cart</Button></div>
              </article>
            ))}
          </div>
        </section>

        <ComboOffer onAddCombo={addCombo} />
      </main>

      <footer className="bg-foreground text-background"><div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-8 px-6 py-12 md:flex-row"><div className="max-w-sm"><div className="font-display text-2xl font-bold">Gadget<span className="text-primary">Home</span></div><p className="mt-3 font-bn font-medium text-background/60">বাংলাদেশের বিশ্বস্ত অনলাইন ফার্মেসি ও হেলথ কেয়ার স্টোর।</p></div><div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3"><div><div className="mb-3 font-display font-semibold">Shop</div><div className="space-y-2 text-background/60"><div>Medicine</div><div>Personal Care</div><div>Health Care</div></div></div><div><div className="mb-3 font-display font-semibold">Support</div><div className="space-y-2 text-background/60"><div>Delivery</div><div>Returns</div><div>Contact</div></div></div><div><div className="mb-3 font-display font-semibold">Payment</div><div className="space-y-2 text-background/60"><div>bKash</div><div>Nagad</div><div>Cash on delivery</div></div></div></div></div><div className="border-t border-background/10 py-5 text-center text-sm text-background/50">© 2026 GadgetHome Store · All rights reserved.</div></footer>
    </div>
  );
}