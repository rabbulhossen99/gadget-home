// Keeps the document head in sync with the current page's SEO meta data. The
// server renders the same tags for product and category URLs (server/seo.mjs).
export type PageMeta = {
  title: string;
  description?: string;
  image?: string;
  type?: "product" | "website";
  price?: number | null;
};
const defaultDescription =
  document
    .querySelector('meta[name="description"]')
    ?.getAttribute("content") || "";
function setTag(attr: "name" | "property", key: string, content?: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!content) return tag?.remove();
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}
export function applySeo(store: string, meta: PageMeta | null) {
  const description = meta?.description?.replace(/\s+/g, " ").trim().slice(0, 300);
  document.title = meta ? `${meta.title} · ${store}` : store;
  setTag("name", "description", description || defaultDescription);
  setTag("name", "title", meta?.title);
  setTag("property", "og:type", meta?.type);
  setTag("property", "og:url", meta ? location.href : undefined);
  setTag("property", "og:title", meta?.title);
  setTag("property", "og:description", description);
  setTag(
    "property",
    "og:image",
    meta?.image ? new URL(meta.image, location.origin).href : undefined,
  );
  setTag("property", "og:site_name", meta ? store : undefined);
  setTag("name", "twitter:card", meta ? "summary" : undefined);
  const price = meta?.price ?? null;
  setTag("property", "product:price:amount", price === null ? undefined : String(price));
  setTag("property", "product:price:currency", price === null ? undefined : "BDT");
}
