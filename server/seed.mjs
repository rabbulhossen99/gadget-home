import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { openDatabase, save, record, transaction } from "./db.mjs";
export function seed(db) {
  transaction(db, () => {
    const put = (kind, key, data) => {
      if (!record(db, kind, key)) save(db, kind, key, data);
    };
    const categoryNames = [
      "Medicine",
      "Personal Care",
      "Health Care",
      "Herbal",
      "Baby Care",
    ];
    categoryNames.forEach((name, position) =>
      put("categories", name.toLowerCase().replaceAll(" ", "-"), {
        name,
        slug: name.toLowerCase().replaceAll(" ", "-"),
        parentId: null,
        image: "",
        homepage: true,
        active: true,
        position,
      }),
    );
    const products = [
      {
        id: "vitaboost",
        name: "VitaBoost Vitamin C 1000mg",
        categoryId: "medicine",
        detail: "প্রতিদিনের রোগ প্রতিরোধে",
        description:
          "VitaBoost Vitamin C 1000mg. Read the product label for ingredients, directions and suitability.",
        images: [
          "/assets/vitaboost-main.jpg",
          "/assets/vitaboost-side.jpg",
          "/assets/vitaboost-capsules.jpg",
          "/assets/vitaboost-lifestyle.jpg",
        ],
        variants: [
          {
            id: "single",
            name: "1 Pc",
            sku: "VITA-1",
            price: 35000,
            compareAt: 40000,
            stock: 50,
            units: 1,
            active: true,
          },
          {
            id: "double",
            name: "2 Pcs",
            sku: "VITA-2",
            price: 60000,
            compareAt: 75000,
            stock: 30,
            units: 2,
            active: true,
          },
          {
            id: "triple",
            name: "3 Pcs",
            sku: "VITA-3",
            price: 80000,
            compareAt: 105000,
            stock: 20,
            units: 3,
            active: true,
          },
          {
            id: "family",
            name: "Family Pack",
            sku: "VITA-4",
            price: 100000,
            compareAt: 140000,
            stock: 15,
            units: 4,
            active: true,
          },
        ],
      },
      {
        id: "herbal-tea",
        name: "GreenShield Herbal Tea",
        categoryId: "herbal",
        detail: "প্রাকৃতিক উপাদানে তৈরি",
        description: "A herbal tea blend for your daily routine.",
        images: ["/assets/herbal-tea.jpg"],
        price: 35000,
        compareAt: 41000,
      },
      {
        id: "baby-lotion",
        name: "TinySoft Baby Lotion",
        categoryId: "baby-care",
        detail: "নরম ত্বকের জন্য, ২০০ml",
        description: "Gentle daily care, 200ml. Follow the label directions.",
        images: ["/assets/baby-lotion.jpg"],
        price: 60000,
        compareAt: 67000,
      },
      {
        id: "hand-sanitizer",
        name: "PureLeaf Hand Sanitizer",
        categoryId: "personal-care",
        detail: "Everyday hand care · 250ml",
        description: "Convenient hand sanitizer, 250ml.",
        images: ["/assets/hand-sanitizer.jpg"],
        price: 28000,
        compareAt: 32000,
      },
    ];
    products.forEach(({ id, price, compareAt, ...p }) =>
      put("products", id, {
        ...p,
        slug: id,
        status: "active",
        featured: true,
        usage: "Read and follow the directions printed on the product label.",
        attributes: [],
        targeting: {},
        variants: p.variants || [
          {
            id: "standard",
            name: "Standard",
            sku: id.toUpperCase(),
            price,
            compareAt,
            stock: 50,
            units: 1,
            active: true,
          },
        ],
      }),
    );
    const section = (type, title, subtitle, position, extra = {}) => ({
      type,
      title,
      subtitle,
      position,
      image: "",
      link: "/shop",
      buttonText: "এখনই কিনুন",
      productIds: [],
      categoryIds: [],
      active: true,
      ...extra,
    });
    put(
      "sections",
      "hero",
      section(
        "hero",
        "স্বাস্থ্য যত্ন,\nসাশ্রয়ী দামে।",
        "ওষুধ, পার্সোনাল কেয়ার, হার্বাল ও বেবি কেয়ার — এক জায়গায়, দ্রুত ডেলিভারি। Family Pack নিলে সাশ্রয় সবচেয়ে বেশি।",
        0,
      ),
    );
    put(
      "sections",
      "categories",
      section("categories", "ক্যাটাগরি", "আপনার প্রয়োজন অনুযায়ী বেছে নিন", 1),
    );
    put(
      "sections",
      "packages",
      section(
        "packages",
        "Quantity / Package Options",
        "একই product-এর জন্য আলাদা আলাদা প্যাকেজ — যত বেশি নেবেন, তত সাশ্রয়।",
        2,
        { productIds: ["vitaboost"] },
      ),
    );
    put(
      "sections",
      "deals",
      section(
        "products",
        "আজকের সেরা ডিল",
        "Everyday care, at better prices.",
        3,
      ),
    );
    put(
      "sections",
      "combo",
      section(
        "combo",
        "Build Your Wellness Combo",
        "আপনার পছন্দের পণ্য দিয়ে প্যাকেজ তৈরি করুন",
        4,
      ),
    );
    put("combos", "wellness", {
      name: "Wellness Combo",
      description: "Choose your everyday essentials.",
      productIds: products.map((p) => p.id),
      tiers: [
        { count: 1, price: 50000 },
        { count: 2, price: 80000 },
        { count: 3, price: 110000 },
        { count: 4, price: 140000 },
      ],
      active: true,
    });
    put("coupons", "save10", {
      code: "SAVE10",
      type: "percent",
      value: 10,
      minSubtotal: 0,
      limit: 100,
      startsAt: null,
      endsAt: null,
      active: true,
    });
    put("settings", "store", {
      name: "GadgetHome",
      supportEmail: "support@example.com",
      phone: "",
      address: "Bangladesh",
      announcement: "🚚 সারা বাংলাদেশে ডেলিভারি · ৳৫০০+ অর্ডারে ফ্রি শিপিং",
      footer: "বাংলাদেশের অনলাইন হেলথ ও ওয়েলনেস স্টোর।",
      currency: "BDT",
      shippingInside: 6000,
      shippingOutside: 12000,
      // Shipping is charged by delivery area by default. Stores can enable
      // a free-shipping threshold explicitly from Website settings.
      freeShippingThreshold: null,
      codEnabled: true,
      manualEnabled: false,
      manualInstructions: "",
      privacyPolicy:
        "We use your account, contact and order information to fulfill purchases and provide support. Contact the store to request access or deletion. Order records may need to be retained for accounting.",
      returnPolicy:
        "Contact the store with your order number to discuss returns. Update this policy before launching.",
      deliveryPolicy:
        "Delivery availability and timing are confirmed by the store. Shipping charges are shown before you place your order.",
      checkoutConsent:
        "I agree to the privacy and return policies and consent to saving my delivery details to process this order or help complete this checkout.",
      lowStockThreshold: 5,
      abandonedRetentionDays: 30,
      cookieBanner: true,
    });
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const db = openDatabase();
  seed(db);
  db.close();
  console.log(
    "Seed complete. Existing records were preserved. Review demo inventory and store policies before launch.",
  );
}
