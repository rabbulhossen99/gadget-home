import { useState, type ReactNode } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { api, clean, upload } from "@/lib/api";
import { useResource, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Field, ErrorBox, Empty } from "@/components/shared";
import { configs, type FieldConfig } from "./config";
export function ImageInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="space-y-2">
      {value && (
        <img
          src={value}
          alt="Image preview"
          className="h-28 w-36 rounded-xl border object-cover"
        />
      )}
      <input
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="HTTPS image URL or upload a file"
      />
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
        <Upload size={16} />
        {busy ? "Uploading…" : "Upload image"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              onChange(await upload(file));
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <ErrorBox error={error} />
    </div>
  );
}
export function EditorField({
  field: f,
  value,
  onChange,
  options,
  exclude,
}: {
  field: FieldConfig;
  value: any;
  onChange: (value: any) => void;
  options?: { products: any[]; categories: any[] };
  exclude?: string;
}) {
  const type = f.type || "text";
  if (type === "checkbox")
    return (
      <label className="flex items-center gap-3 rounded-lg border p-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
        {f.label}
      </label>
    );
  let control: ReactNode;
  if (type === "image")
    control = <ImageInput value={value || ""} onChange={onChange} />;
  else if (type === "productIds" || type === "categoryIds")
    control = (
      <div className="max-h-44 space-y-2 overflow-auto rounded-xl border p-3">
        {(type === "productIds" ? options?.products : options?.categories)?.map(
          (item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value?.includes(item.id)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...(value || []), item.id]
                      : value.filter((id: string) => id !== item.id),
                  )
                }
              />
              {item.name}
            </label>
          ),
        )}
      </div>
    );
  else if (type === "category" || type === "parent")
    control = (
      <select
        className="field"
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">
          {type === "parent" ? "No parent (top level)" : "Select category"}
        </option>
        {options?.categories
          .filter((c) => c.id !== exclude)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </select>
    );
  else if (type === "select")
    control = (
      <select
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {f.options?.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    );
  else if (type === "textarea")
    control = (
      <textarea
        rows={4}
        className="field"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  else if (type === "money")
    control = (
      <input
        className="field"
        type="number"
        min={0}
        step="0.01"
        value={value === null ? "" : value / 100}
        onChange={(e) =>
          onChange(
            e.target.value === "" && f.nullable
              ? null
              : Math.round(Number(e.target.value) * 100),
          )
        }
      />
    );
  else if (type === "datetime-local") {
    const local = value
      ? new Date(
          new Date(value).getTime() -
            new Date(value).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
    control = (
      <input
        className="field"
        type={type}
        value={local}
        onChange={(e) =>
          onChange(
            e.target.value ? new Date(e.target.value).toISOString() : null,
          )
        }
      />
    );
  } else
    control = (
      <input
        className="field"
        type={type}
        value={value ?? ""}
        min={type === "number" ? 0 : undefined}
        onChange={(e) =>
          onChange(type === "number" ? Number(e.target.value) : e.target.value)
        }
      />
    );
  return (
    <Field label={f.label} hint={f.hint}>
      {control}
    </Field>
  );
}
export function Content({ kind }: { kind: string }) {
  const { data, error, reload } = useResource<any[]>("/admin/content/" + kind),
    [editing, setEditing] = useState<any | null>(null),
    [remove, setRemove] = useState<string | null>(null),
    { notice, refresh } = useStore();
  const config = configs[kind];
  if (!config) return null;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Changes are shared with the customer website.
          </p>
        </div>
        {kind !== "settings" && (
          <Button
            onClick={() =>
              setEditing({
                id: crypto.randomUUID(),
                ...structuredClone(config.defaults),
              })
            }
          >
            <Plus />
            Add new
          </Button>
        )}
      </div>
      <ErrorBox error={error} />
      {editing ? (
        <ContentEditor
          key={editing.id}
          kind={kind}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async () => {
            await reload();
            await refresh();
            setEditing(null);
            notice("Saved successfully");
          }}
        />
      ) : kind === "settings" ? (
        data?.[0] && (
          <ContentEditor
            key={"settings" + data[0].version}
            kind={kind}
            initial={data[0]}
            onSave={async () => {
              await reload();
              await refresh();
              notice("Settings saved");
            }}
          />
        )
      ) : (
        <div className="space-y-3">
          {data?.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-5"
            >
              <div className="flex-1">
                <h2 className="font-bold">
                  {row.name || row.title || row.code}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {row.type || row.slug || row.channel} ·{" "}
                  {row.active ? "Active" : "Inactive"}
                  {row.position !== undefined ? ` · Order ${row.position}` : ""}
                </p>
              </div>
              <Button variant="outline" onClick={() => setEditing(row)}>
                Edit
              </Button>
              {remove === row.id ? (
                <>
                  <span className="text-xs">Delete this record?</span>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      try {
                        await api(
                          "/admin/content/" + kind + "/" + row.id,
                          "DELETE",
                        );
                        await reload();
                        await refresh();
                      } catch (e) {
                        notice((e as Error).message);
                      } finally {
                        setRemove(null);
                      }
                    }}
                  >
                    Delete
                  </Button>
                  <Button variant="ghost" onClick={() => setRemove(null)}>
                    Keep
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  aria-label="Delete record"
                  onClick={() => setRemove(row.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
          {!data?.length && (
            <Empty>No records yet. Add the first one above.</Empty>
          )}
        </div>
      )}
    </div>
  );
}
function ContentEditor({
  kind,
  initial,
  onClose,
  onSave,
}: {
  kind: string;
  initial: any;
  onClose?: () => void;
  onSave: () => Promise<void>;
}) {
  const [form, setForm] = useState<any>(structuredClone(initial)),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    { data: products } = useResource<any[]>("/admin/content/products", 0),
    { data: categories } = useResource<any[]>("/admin/content/categories", 0);
  const config = configs[kind],
    set = (key: string, value: any) =>
      setForm((f: any) => ({ ...f, [key]: value }));
  return (
    <form
      className="rounded-2xl border bg-card p-5 sm:p-7"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api("/admin/content/" + kind + "/" + form.id, "PUT", {
            data: clean(form),
            version: form.version,
          });
          await onSave();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-5 md:grid-cols-2">
        {config.fields.map((field) => (
          <EditorField
            key={field.key}
            field={
              kind === "coupons" && field.key === "value"
                ? {
                    ...field,
                    type: form.type === "fixed" ? "money" : "number",
                    label:
                      form.type === "fixed"
                        ? "Discount amount (৳)"
                        : form.type === "percent"
                          ? "Discount percentage"
                          : "Shipping discount value",
                    hint:
                      form.type === "shipping"
                        ? "Use 0; this coupon removes shipping charges."
                        : form.type === "percent"
                          ? "Enter a percentage between 0 and 100."
                          : undefined,
                  }
                : field
            }
            value={form[field.key]}
            onChange={(v) => set(field.key, v)}
            options={{ products: products || [], categories: categories || [] }}
            exclude={kind === "categories" ? form.id : undefined}
          />
        ))}
      </div>
      {kind === "combos" && (
        <div className="mt-6">
          <h3 className="mb-3 font-bold">Bundle prices</h3>
          {form.tiers.map((tier: any, i: number) => (
            <div className="mb-3 flex items-end gap-3" key={i}>
              <Field label="Number of products">
                <input
                  type="number"
                  className="field"
                  min={1}
                  value={tier.count}
                  onChange={(e) =>
                    set(
                      "tiers",
                      form.tiers.map((t: any, j: number) =>
                        i === j ? { ...t, count: Number(e.target.value) } : t,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Bundle price (৳)">
                <input
                  type="number"
                  className="field"
                  min={0}
                  step="0.01"
                  value={tier.price / 100}
                  onChange={(e) =>
                    set(
                      "tiers",
                      form.tiers.map((t: any, j: number) =>
                        i === j
                          ? {
                              ...t,
                              price: Math.round(Number(e.target.value) * 100),
                            }
                          : t,
                      ),
                    )
                  }
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  set(
                    "tiers",
                    form.tiers.filter((_: any, j: number) => i !== j),
                  )
                }
                aria-label="Remove bundle price"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              set("tiers", [
                ...form.tiers,
                { count: form.tiers.length + 1, price: 0 },
              ])
            }
          >
            Add bundle price
          </Button>
        </div>
      )}
      <ErrorBox error={error} />
      <div className="mt-6 flex gap-3">
        <Button disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        {onClose && (
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
