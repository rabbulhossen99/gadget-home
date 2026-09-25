import { useState } from "react";
import { Plus, Trash2, Copy } from "lucide-react";
import { useResource, useStore } from "@/lib/store";
import { api, clean, money } from "@/lib/api";
import type { Product, Category, Variant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, ErrorBox, Empty } from "@/components/shared";
import { EditorField, ImageInput } from "./Content";
const variant = (): Variant => ({
  id: crypto.randomUUID(),
  name: "Standard",
  sku: "",
  price: 0,
  compareAt: null,
  stock: 0,
  units: 1,
  active: true,
});
export function Products() {
  const { data, error, reload } = useResource<Product[]>(
      "/admin/content/products",
    ),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState<Product | null>(null),
    { refresh, notice } = useStore();
  return (
    <>
      <div className="mb-6 flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Products & inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One catalog for your website, cart, and checkout.
          </p>
        </div>
        <Button
          onClick={() =>
            setEditing({
              id: crypto.randomUUID(),
              version: 0,
              name: "",
              slug: "",
              categoryId: "",
              detail: "",
              description: "",
              usage: "",
              attributes: [],
              images: [""],
              status: "draft",
              featured: false,
              variants: [variant()],
              targeting: {},
            })
          }
        >
          <Plus />
          Add product
        </Button>
      </div>
      <ErrorBox error={error} />
      {editing ? (
        <ProductEditor
          key={editing.id}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSave={async () => {
            await reload();
            await refresh();
            setEditing(null);
            notice("Product saved");
          }}
        />
      ) : (
        <>
          <input
            className="field mb-5 max-w-md"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products or SKU"
            aria-label="Search products"
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data
                  ?.filter((p) =>
                    `${p.name} ${p.variants.map((v) => v.sku).join(" ")}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <img
                            src={p.images[0]}
                            alt=""
                            className="size-12 rounded-lg object-cover"
                          />
                          <div>
                            <strong>{p.name}</strong>
                            <p className="text-xs text-muted-foreground">
                              {p.variants.length} package(s)
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="chip">{p.status}</span>
                      </td>
                      <td>{money(p.variants[0]?.price || 0)}</td>
                      <td>
                        {p.variants.reduce((s, v) => s + v.stock, 0)} packages
                      </td>
                      <td>
                        <Button variant="outline" onClick={() => setEditing(p)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!data?.length && (
            <Empty>Add your first product to get started.</Empty>
          )}
        </>
      )}
    </>
  );
}
function ProductEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: Product;
  onSave: () => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Product>(structuredClone(initial)),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    { data: categories } = useResource<Category[]>(
      "/admin/content/categories",
      0,
    ),
    { notice } = useStore();
  const set = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));
  const target = (key: string, value: string) =>
    set("targeting", { ...form.targeting, [key]: value });
  const snippet = `fbq('track', ${JSON.stringify(form.targeting?.standardEvent || "ViewContent")}, ${JSON.stringify({ content_ids: [form.id], content_name: form.name, content_type: form.targeting?.contentType || "product", value: (form.variants[0]?.price || 0) / 100, currency: "BDT" }, null, 2)});`;
  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api("/admin/content/products/" + form.id, "PUT", {
            data: clean(form),
            ...(form.version ? { version: form.version } : {}),
          });
          await onSave();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="panel">
          <h2 className="mb-5 text-lg font-bold">Product information</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Product name">
              <input
                className="field"
                value={form.name}
                required
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="URL slug">
              <input
                className="field"
                value={form.slug}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                onChange={(e) => set("slug", e.target.value)}
              />
            </Field>
            <EditorField
              field={{
                key: "categoryId",
                label: "Category / subcategory",
                type: "category",
              }}
              value={form.categoryId}
              onChange={(v) => set("categoryId", v)}
              options={{ products: [], categories: categories || [] }}
            />
            <EditorField
              field={{
                key: "status",
                label: "Status",
                type: "select",
                options: ["active", "draft", "archived"],
              }}
              value={form.status}
              onChange={(v) => set("status", v)}
            />
          </div>
          <div className="mt-5 space-y-5">
            <Field label="Short description">
              <input
                className="field"
                value={form.detail}
                maxLength={200}
                onChange={(e) => set("detail", e.target.value)}
              />
            </Field>
            <Field label="Full description">
              <textarea
                className="field"
                rows={5}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <Field label="Usage instructions">
              <textarea
                className="field"
                rows={3}
                value={form.usage}
                onChange={(e) => set("usage", e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => set("featured", e.target.checked)}
              />
              Featured product
            </label>
          </div>
        </section>
        <section className="panel">
          <h2 className="mb-4 text-lg font-bold">Product images</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            First image appears on product cards. JPEG, PNG or WebP; maximum 5
            MB each.
          </p>
          <div className="space-y-5">
            {form.images.map((url, i) => (
              <div key={i}>
                <ImageInput
                  value={url}
                  onChange={(v) =>
                    set(
                      "images",
                      form.images.map((u, j) => (i === j ? v : u)),
                    )
                  }
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={i === 0}
                    onClick={() => {
                      const images = [...form.images];
                      [images[i - 1], images[i]] = [images[i], images[i - 1]];
                      set("images", images);
                    }}
                  >
                    Move earlier
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={form.images.length === 1}
                    onClick={() =>
                      set(
                        "images",
                        form.images.filter((_, j) => i !== j),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            type="button"
            className="mt-4"
            variant="outline"
            disabled={form.images.length >= 12}
            onClick={() => set("images", [...form.images, ""])}
          >
            Add image
          </Button>
        </section>
      </div>
      <section className="panel">
        <h2 className="text-lg font-bold">Packages, variants & inventory</h2>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          Each package has its own SKU and stock quantity. Stock is counted in
          sellable packages.
        </p>
        {form.variants.map((v, i) => {
          const update = (k: string, value: any) =>
            set(
              "variants",
              form.variants.map((x, j) => (i === j ? { ...x, [k]: value } : x)),
            );
          return (
            <div key={v.id} className="mb-4 rounded-xl border p-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="Package / variant name">
                  <input
                    className="field"
                    value={v.name}
                    required
                    onChange={(e) => update("name", e.target.value)}
                  />
                </Field>
                <Field label="SKU">
                  <input
                    className="field"
                    value={v.sku}
                    onChange={(e) => update("sku", e.target.value)}
                  />
                </Field>
                <EditorField
                  field={{
                    key: "price",
                    label: "Selling price (৳)",
                    type: "money",
                  }}
                  value={v.price}
                  onChange={(n) => update("price", n)}
                />
                <EditorField
                  field={{
                    key: "compareAt",
                    label: "Original price (৳)",
                    type: "money",
                    nullable: true,
                  }}
                  value={v.compareAt}
                  onChange={(n) => update("compareAt", n)}
                />
                <Field label="Packages in stock">
                  <input
                    className="field"
                    type="number"
                    min={0}
                    step={1}
                    value={v.stock}
                    onChange={(e) => update("stock", Number(e.target.value))}
                  />
                </Field>
                <Field label="Pieces in each package">
                  <input
                    className="field"
                    type="number"
                    min={1}
                    value={v.units}
                    onChange={(e) => update("units", Number(e.target.value))}
                  />
                </Field>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={v.active}
                    onChange={(e) => update("active", e.target.checked)}
                  />
                  Active
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={form.variants.length === 1}
                  onClick={() =>
                    set(
                      "variants",
                      form.variants.filter((_, j) => i !== j),
                    )
                  }
                >
                  <Trash2 />
                  Remove package
                </Button>
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          onClick={() => set("variants", [...form.variants, variant()])}
        >
          Add package / variant
        </Button>
      </section>
      <section className="panel">
        <h2 className="mb-4 text-lg font-bold">Product attributes</h2>
        {form.attributes.map((a, i) => (
          <div className="mb-3 flex gap-3" key={i}>
            <input
              className="field"
              placeholder="Attribute name"
              aria-label="Attribute name"
              value={a.name}
              onChange={(e) =>
                set(
                  "attributes",
                  form.attributes.map((x, j) =>
                    i === j ? { ...x, name: e.target.value } : x,
                  ),
                )
              }
            />
            <input
              className="field"
              placeholder="Value"
              aria-label="Attribute value"
              value={a.value}
              onChange={(e) =>
                set(
                  "attributes",
                  form.attributes.map((x, j) =>
                    i === j ? { ...x, value: e.target.value } : x,
                  ),
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              aria-label="Remove attribute"
              onClick={() =>
                set(
                  "attributes",
                  form.attributes.filter((_, j) => i !== j),
                )
              }
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            set("attributes", [...form.attributes, { name: "", value: "" }])
          }
        >
          Add attribute
        </Button>
      </section>
      <details className="panel">
        <summary className="cursor-pointer font-bold">
          Meta targeting & conversion planning
        </summary>
        <p className="my-4 text-sm text-muted-foreground">
          Stores campaign metadata and generates a snippet for your advertising
          team. This website does not load Meta tracking or forward customer
          data.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            "pixelId",
            "datasetId",
            "conversionName",
            "standardEvent",
            "contentType",
            "contentName",
            "contentCategory",
            "conversionValue",
            "ruleType",
            "ruleValue",
            "ageMin",
            "ageMax",
            "genders",
            "countries",
            "interests",
          ].map((key) => (
            <Field label={key.replace(/([A-Z])/g, " $1")} key={key}>
              <input
                className="field"
                value={form.targeting?.[key] || ""}
                onChange={(e) => target(key, e.target.value)}
              />
            </Field>
          ))}
        </div>
        <pre className="my-4 overflow-x-auto rounded-xl bg-muted p-4 text-xs">
          {snippet}
        </pre>
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(snippet);
              notice("Snippet copied");
            } catch {
              notice("Clipboard unavailable. Select and copy the snippet.");
            }
          }}
        >
          <Copy />
          Copy snippet
        </Button>
      </details>
      <ErrorBox error={error} />
      <div className="flex gap-3">
        <Button disabled={busy}>{busy ? "Saving…" : "Save product"}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
