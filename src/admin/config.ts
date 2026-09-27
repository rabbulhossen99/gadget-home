export type FieldConfig = {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "money"
    | "checkbox"
    | "select"
    | "datetime-local"
    | "image"
    | "productIds"
    | "categoryIds"
    | "category"
    | "parent";
  options?: string[];
  hint?: string;
  nullable?: boolean;
};
const name: FieldConfig = { key: "name", label: "Name" },
  active: FieldConfig = { key: "active", label: "Active", type: "checkbox" },
  description: FieldConfig = {
    key: "description",
    label: "Description",
    type: "textarea",
  };
export const configs: Record<
  string,
  { title: string; fields: FieldConfig[]; defaults: Record<string, any> }
> = {
  categories: {
    title: "Categories & subcategories",
    fields: [
      name,
      {
        key: "slug",
        label: "URL slug",
        hint: "Lowercase words separated by hyphens",
      },
      { key: "parentId", label: "Parent category", type: "parent" },
      { key: "image", label: "Category image", type: "image" },
      { key: "homepage", label: "Show on homepage", type: "checkbox" },
      active,
      { key: "position", label: "Display order", type: "number" },
    ],
    defaults: {
      name: "",
      slug: "",
      parentId: null,
      image: "",
      homepage: true,
      active: true,
      position: 0,
    },
  },
  sections: {
    title: "Homepage & banners",
    fields: [
      {
        key: "type",
        label: "Section type",
        type: "select",
        options: [
          "hero",
          "products",
          "categories",
          "packages",
          "combo",
          "promotion",
        ],
      },
      { key: "title", label: "Title" },
      { key: "subtitle", label: "Subtitle", type: "textarea" },
      { key: "image", label: "Banner image", type: "image" },
      {
        key: "link",
        label: "Button destination",
        hint: "Local path, such as /shop or /category/herbal",
      },
      { key: "buttonText", label: "Button text" },
      {
        key: "productIds",
        label: "Products",
        type: "productIds",
        hint: "Empty product sections use featured products.",
      },
      {
        key: "categoryIds",
        label: "Categories",
        type: "categoryIds",
        hint: "Empty category sections use homepage categories.",
      },
      active,
      { key: "position", label: "Display order", type: "number" },
    ],
    defaults: {
      type: "hero",
      title: "",
      subtitle: "",
      image: "",
      link: "/shop",
      buttonText: "Shop now",
      productIds: [],
      categoryIds: [],
      active: true,
      position: 0,
    },
  },
  coupons: {
    title: "Coupon codes",
    fields: [
      {
        key: "code",
        label: "Code",
        hint: "Uppercase letters, numbers, hyphens or underscores",
      },
      {
        key: "type",
        label: "Discount type",
        type: "select",
        options: ["percent", "fixed", "shipping"],
      },
      {
        key: "value",
        label: "Value",
        type: "number",
        hint: "Percentage 0–100; fixed discount is in poisha (100 = ৳1); shipping uses 0.",
      },
      { key: "minSubtotal", label: "Minimum subtotal (৳)", type: "money" },
      { key: "limit", label: "Maximum redemptions", type: "number" },
      {
        key: "startsAt",
        label: "Starts at",
        type: "datetime-local",
        nullable: true,
      },
      {
        key: "endsAt",
        label: "Ends at",
        type: "datetime-local",
        nullable: true,
      },
      active,
    ],
    defaults: {
      code: "",
      type: "percent",
      value: 10,
      minSubtotal: 0,
      limit: 100,
      startsAt: null,
      endsAt: null,
      active: true,
    },
  },
  campaigns: {
    title: "Campaign planning",
    fields: [
      name,
      { key: "channel", label: "Channel" },
      description,
      {
        key: "startsAt",
        label: "Starts at",
        type: "datetime-local",
        nullable: true,
      },
      {
        key: "endsAt",
        label: "Ends at",
        type: "datetime-local",
        nullable: true,
      },
      active,
    ],
    defaults: {
      name: "",
      channel: "",
      description: "",
      startsAt: null,
      endsAt: null,
      active: false,
    },
  },
  combos: {
    title: "Combo offers",
    fields: [
      name,
      description,
      { key: "productIds", label: "Eligible products", type: "productIds" },
      active,
    ],
    defaults: {
      name: "",
      description: "",
      productIds: [],
      tiers: [{ count: 2, price: 80000 }],
      active: true,
    },
  },
  settings: {
    title: "Website settings",
    fields: [
      name,
      { key: "supportEmail", label: "Support email" },
      { key: "phone", label: "Support phone" },
      { key: "address", label: "Store address", type: "textarea" },
      { key: "announcement", label: "Announcement bar" },
      { key: "footer", label: "Footer description", type: "textarea" },
      { key: "shippingInside", label: "Dhaka shipping (৳)", type: "money" },
      {
        key: "shippingOutside",
        label: "Outside Dhaka shipping (৳)",
        type: "money",
      },
      {
        key: "freeShippingThreshold",
        label: "Free shipping minimum (৳)",
        type: "money",
        nullable: true,
        hint: "Leave blank to disable free shipping.",
      },
      { key: "codEnabled", label: "Enable cash on delivery", type: "checkbox" },
      {
        key: "manualEnabled",
        label: "Enable manual mobile payments",
        type: "checkbox",
      },
      {
        key: "manualInstructions",
        label: "Manual payment instructions",
        type: "textarea",
        hint: "Include payment service, merchant number and verification instructions.",
      },
      { key: "privacyPolicy", label: "Privacy policy", type: "textarea" },
      { key: "returnPolicy", label: "Return policy", type: "textarea" },
      { key: "deliveryPolicy", label: "Delivery policy", type: "textarea" },
      {
        key: "lowStockThreshold",
        label: "Low stock threshold",
        type: "number",
      },
      {
        key: "abandonedRetentionDays",
        label: "Incomplete checkout retention (days)",
        type: "number",
      },
      {
        key: "cookieBanner",
        label: "Show essential-cookie notice",
        type: "checkbox",
      },
    ],
    defaults: {},
  },
};
