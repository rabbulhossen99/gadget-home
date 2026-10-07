import { z } from "zod";
import { normalizePhone } from "../shared/phone.mjs";
export const phoneSchema = z
  .string()
  .max(40)
  .transform(normalizePhone)
  .refine(
    (value) => value !== null,
    "Enter 11 digits starting with 01, optionally prefixed with +88.",
  );
const short = z.string().trim().max(200);
const text = z.string().trim().max(20000);
const key = z.string().min(1).max(100);
const money = z.number().int().min(0).max(100000000);
// SEO meta data; empty values fall back to the record's name and description.
const metaTitle = z.string().trim().max(200).default("");
const metaDescription = z.string().trim().max(500).default("");
const url = z
  .string()
  .max(2000)
  .refine(
    (v) =>
      !v ||
      /^\/assets\/[a-zA-Z0-9_.-]+$/.test(v) ||
      /^\/uploads\/[a-zA-Z0-9_.-]+$/.test(v) ||
      /^https:\/\/[^\s]+$/.test(v),
    "Use a local image or an HTTPS image URL",
  );
const href = z
  .string()
  .max(300)
  .refine(
    (v) => /^\/(?!\/)[a-zA-Z0-9/?=&%#_.-]*$/.test(v),
    "Use a local website path",
  );
export const variantSchema = z
  .object({
    id: key,
    name: short.min(1),
    sku: short,
    price: money,
    compareAt: money.nullable().default(null),
    stock: z.number().int().min(0).max(1000000),
    units: z.number().int().min(1).max(1000).default(1),
    active: z.boolean().default(true),
  })
  .strict()
  .refine(
    (v) => v.compareAt === null || v.compareAt >= v.price,
    "Original price must be at least the sale price",
  );
export const schemas = {
  products: z
    .object({
      name: short.min(1),
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(150),
      categoryId: key,
      description: text,
      detail: short.default(""),
      usage: text.default(""),
      attributes: z
        .array(z.object({ name: short, value: short }))
        .max(30)
        .default([]),
      images: z
        .array(
          url.refine((v) => v.length > 0, "Product images cannot be empty"),
        )
        .min(1)
        .max(12),
      status: z.enum(["active", "draft", "archived"]),
      featured: z.boolean(),
      freeDelivery: z.boolean().default(false),
      variants: z.array(variantSchema).min(1).max(50),
      targeting: z.record(z.string().max(2000)).default({}),
      metaTitle,
      metaDescription,
    })
    .strict()
    .refine(
      (p) => new Set(p.variants.map((v) => v.id)).size === p.variants.length,
      "Variant IDs must be unique",
    )
    .refine(
      (p) => p.status !== "active" || p.variants.some((v) => v.active),
      "Active products need an active package",
    ),
  categories: z
    .object({
      name: short.min(1),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      parentId: key.nullable(),
      image: url.default(""),
      homepage: z.boolean(),
      active: z.boolean(),
      position: z.number().int().min(0).max(1000),
      metaTitle,
      metaDescription,
    })
    .strict(),
  sections: z
    .object({
      type: z.enum([
        "hero",
        "products",
        "categories",
        "packages",
        "combo",
        "promotion",
      ]),
      title: short.min(1),
      subtitle: text,
      image: url,
      link: href,
      buttonText: short,
      productIds: z.array(key).max(100),
      categoryIds: z.array(key).max(100),
      active: z.boolean(),
      position: z.number().int().min(0).max(1000),
    })
    .strict(),
  combos: z
    .object({
      name: short.min(1),
      description: text,
      productIds: z.array(key).min(1).max(30),
      tiers: z
        .array(
          z.object({ count: z.number().int().min(1).max(30), price: money }),
        )
        .min(1)
        .max(30),
      active: z.boolean(),
    })
    .strict()
    .refine(
      (c) =>
        new Set(c.productIds).size === c.productIds.length &&
        new Set(c.tiers.map((t) => t.count)).size === c.tiers.length &&
        c.tiers.every((t) => t.count <= c.productIds.length),
      "Combo counts and products must be valid and unique",
    ),
  coupons: z
    .object({
      code: z.string().regex(/^[A-Z0-9_-]{2,30}$/),
      type: z.enum(["percent", "fixed", "shipping"]),
      value: money,
      minSubtotal: money,
      limit: z.number().int().min(1).max(10000000),
      startsAt: z.string().datetime().nullable(),
      endsAt: z.string().datetime().nullable(),
      active: z.boolean(),
    })
    .strict()
    .refine(
      (c) => c.type !== "percent" || c.value <= 100,
      "Percentage must not exceed 100",
    )
    .refine(
      (c) => !c.startsAt || !c.endsAt || c.startsAt < c.endsAt,
      "End must follow start",
    ),
  campaigns: z
    .object({
      name: short.min(1),
      channel: short,
      description: text,
      active: z.boolean(),
      startsAt: z.string().datetime().nullable(),
      endsAt: z.string().datetime().nullable(),
    })
    .strict(),
  settings: z
    .object({
      name: short.min(1),
      supportEmail: z.string().email(),
      phone: short,
      address: text,
      announcement: short,
      footer: text,
      currency: z.literal("BDT"),
      shippingInside: money,
      shippingOutside: money,
      freeShippingThreshold: money.nullable(),
      codEnabled: z.boolean(),
      manualEnabled: z.boolean(),
      manualInstructions: text,
      privacyPolicy: text,
      returnPolicy: text,
      deliveryPolicy: text,
      checkoutConsent: text,
      lowStockThreshold: z.number().int().min(0).max(10000),
      abandonedRetentionDays: z.number().int().min(1).max(365),
      cookieBanner: z.boolean(),
    })
    .strict()
    .refine(
      (s) => s.codEnabled || s.manualEnabled,
      "Enable at least one payment method",
    ),
};
export const cartSchema = z
  .array(
    z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("product"),
          productId: key,
          variantId: key,
          quantity: z.number().int().min(1).max(99),
        })
        .strict(),
      z
        .object({
          type: z.literal("combo"),
          comboId: key,
          productIds: z.array(key).min(1).max(30),
          quantity: z.number().int().min(1).max(99),
        })
        .strict(),
    ]),
  )
  .max(50);
export const quoteSchema = z
  .object({
    items: cartSchema,
    area: z.enum(["inside", "outside"]),
    coupon: z.string().trim().max(30).default(""),
  })
  .strict();
export const checkoutSchema = quoteSchema
  .extend({
    name: short.min(2),
    phone: phoneSchema,
    address: z.string().trim().min(8).max(1000),
    email: z.string().email().max(200).or(z.literal("")).default(""),
    note: z.string().max(1000).default(""),
    paymentMethod: z.enum(["cod", "manual"]),
    paymentReference: z.string().trim().max(100).default(""),
    idempotencyKey: z.string().uuid(),
    expectedTotal: money,
  })
  .strict();
export const orderUpdateSchema = z
  .object({
    status: z.enum([
      "pending",
      "processing",
      "on-hold",
      "completed",
      "cancelled",
      "pending-payment",
      "refunded",
      // Legacy values remain accepted for existing orders and API clients.
      "confirmed",
      "shipped",
      "delivered",
      "returned",
    ]),
    paymentStatus: z.enum([
      "unpaid",
      "pending_verification",
      "paid",
      "refunded",
    ]).optional(),
    carrier: short,
    trackingNumber: short,
    shippingNote: z.string().max(2000),
    note: z.string().max(2000).optional(),
    name: short.min(2).optional(),
    phone: z
      .string()
      .regex(/^01\d{9}$/)
      .optional(),
    address: z.string().trim().min(8).max(1000).optional(),
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export const orderEditSchema = z.object({ items: z.array(z.object({ id: z.string().min(1), quantity: z.number().int().min(1).max(999) })).min(1), discount: money.refine((value) => value % 100 === 0, "Discount must be a whole BDT amount."), shipping: money.optional(), finalAmount: money.optional(), total: money.optional(), note: z.string().max(2000).optional(), customerInfo: z.object({ name: short.min(2).optional(), phone: z.string().regex(/^01\d{9}$/).optional(), address: z.string().trim().min(8).max(1000).optional(), note: z.string().max(2000).optional() }).strict().optional(), expectedVersion: z.number().int().min(1) }).strict();
