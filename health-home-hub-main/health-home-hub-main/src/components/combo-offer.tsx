import { Check, Gift, PackageCheck, ShoppingBag } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { comboPackages, comboProducts } from "@/data/combo-offer";
import { cn } from "@/lib/utils";

export type ComboCartItem = {
  productNames: string[];
  count: number;
  price: number;
};

export function ComboOffer({ onAddCombo }: { onAddCombo: (item: ComboCartItem) => void }) {
  const [packCount, setPackCount] = useState(2);
  const [selected, setSelected] = useState<string[]>([]);
  const [added, setAdded] = useState<ComboCartItem | null>(null);

  const pack = comboPackages.find((p) => p.count === packCount)!;
  const complete = selected.length === packCount;

  const choosePack = (count: number) => {
    setPackCount(count);
    setSelected((prev) => prev.slice(0, count));
    setAdded(null);
  };

  const toggle = (id: string) => {
    setAdded(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= packCount) return prev;
      return [...prev, id];
    });
  };

  const addCombo = () => {
    const item: ComboCartItem = {
      productNames: selected.map((id) => comboProducts.find((p) => p.id === id)!.name),
      count: packCount,
      price: pack.price,
    };
    onAddCombo(item);
    setAdded(item);
    setSelected([]);
  };

  return (
    <section id="combo" className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-6">
      <div className="rounded-[2rem] border-2 border-border bg-card p-6 sm:p-10">
        <div className="mb-8 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-coral px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground">
            <Gift className="size-4" /> Combo Offer
          </span>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">কম্বো অফার</h2>
          <p className="mx-auto mt-2 max-w-xl font-bn font-medium text-muted-foreground">
            পছন্দের প্রোডাক্ট বেছে নিন — যত বেশি নেবেন, প্রতিটির দাম তত কম।
          </p>
        </div>

        <div className="mb-3 font-display text-lg font-semibold">Choose Your Combo</div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {comboPackages.map((p) => (
            <button
              key={p.count}
              onClick={() => choosePack(p.count)}
              className={cn(
                "rounded-2xl border-2 p-4 text-left transition hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary",
                packCount === p.count ? "border-foreground bg-sun" : "border-border bg-background",
              )}
            >
              <div className="font-display font-semibold">{p.label}</div>
              <div className="font-bn text-xs font-medium text-muted-foreground">{p.labelBn}</div>
              <div className="mt-2 font-display text-2xl font-bold">৳{p.price}</div>
            </button>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="font-display text-lg font-semibold">
            আপনার প্রোডাক্ট বাছুন
            <span className="ml-2 font-bn text-sm font-medium text-muted-foreground">
              (যেকোনো {packCount}টি)
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm font-semibold">
            <span>Selected: {selected.length} / {packCount}</span>
            <span className="rounded-full bg-primary/15 px-3 py-1 text-primary">Combo Price: ৳{pack.price}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {comboProducts.map((product) => {
            const isSelected = selected.includes(product.id);
            const disabled = !isSelected && selected.length >= packCount;
            return (
              <button
                key={product.id}
                onClick={() => toggle(product.id)}
                aria-pressed={isSelected}
                className={cn(
                  "group overflow-hidden rounded-3xl border-2 bg-background text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary",
                  isSelected ? "border-foreground shadow-[0_5px_0_var(--button-shadow)]" : "border-border hover:-translate-y-1",
                  disabled && "opacity-50",
                )}
              >
                <div className="relative">
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    width={912}
                    height={736}
                    className="aspect-[5/4] w-full object-cover"
                  />
                  <span
                    className={cn(
                      "absolute right-3 top-3 grid size-7 place-items-center rounded-full border-2",
                      isSelected ? "border-foreground bg-primary text-primary-foreground" : "border-border bg-card",
                    )}
                  >
                    {isSelected && <Check className="size-4" />}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-display text-base font-semibold leading-tight">{product.name}</h3>
                  <p className="mt-1 font-bn text-sm font-medium text-muted-foreground">{product.detail}</p>
                  <span
                    className={cn(
                      "mt-3 block rounded-full py-2 text-center text-sm font-semibold",
                      isSelected ? "bg-foreground text-background" : "bg-primary/15 text-primary",
                    )}
                  >
                    {isSelected ? "Selected" : "Select"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col items-center gap-2">
          <Button variant="shop" size="shop" disabled={!complete} onClick={addCombo}>
            <ShoppingBag /> ADD COMBO TO CART
          </Button>
          {!complete && (
            <p className="font-bn text-sm font-medium text-muted-foreground">
              আরও {packCount - selected.length}টি প্রোডাক্ট বাছুন
            </p>
          )}
        </div>

        {added && (
          <div className="mt-8 rounded-3xl bg-secondary p-6">
            <div className="flex items-center gap-2 font-display text-lg font-semibold">
              <PackageCheck className="size-5 text-primary" /> Combo Offer কার্টে যোগ হয়েছে
            </div>
            <div className="mt-3 text-sm font-semibold">Selected Products:</div>
            <ul className="mt-1 space-y-1 text-sm font-medium text-muted-foreground">
              {added.productNames.map((name) => (
                <li key={name}>- {name}</li>
              ))}
            </ul>
            <div className="mt-3 text-sm font-semibold">Quantity: {added.count} Products</div>
            <div className="font-display text-xl font-bold">Combo Price: ৳{added.price}</div>
          </div>
        )}
      </div>
    </section>
  );
}
