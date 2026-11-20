import type { Db } from "@/lib/db/client";

// The JadeAdorn catalog, carried over from the prototype: same 7 categories,
// same 18 products, same names, prices, badges and illustration settings.
// Descriptions are placeholder copy written for this demo. As the prototype
// itself notes, materials and cultural descriptions must be verified per item
// before anything is sold.

const CATEGORIES = [
  { slug: "beaded-bracelets", name: "Beaded Bracelets" },
  { slug: "natural-stone", name: "Natural Stone" },
  { slug: "wood-beads", name: "Wood Beads" },
  { slug: "buddhist-mala", name: "Buddhist Mala" },
  { slug: "meditation-beads", name: "Meditation Beads" },
  { slug: "mens-bracelets", name: "Men’s Bracelets" },
  { slug: "gift-sets", name: "Gift Sets" },
] as const;

type CategorySlug = (typeof CATEGORIES)[number]["slug"];

type SeedProduct = {
  slug: string;
  name: string;
  brand: string;
  category: CategorySlug;
  price: number; // whole dollars, as listed in the prototype
  badge: string | null;
  shape: string;
  tone: string;
  description: string;
};

const PRODUCTS: SeedProduct[] = [
  {
    slug: "green-jade-style-bead-bracelet",
    name: "Green Jade-Style Bead Bracelet",
    brand: "JadeAdorn Edit",
    category: "natural-stone",
    price: 48,
    badge: "Bestseller",
    shape: "jadebeads",
    tone: "#829b78",
    description:
      "Round beads in three soft greens on a stretch cord. It slips on without a clasp and sits easily next to a watch.",
  },
  {
    slug: "tigers-eye-stretch-bracelet",
    name: "Tiger’s Eye Stretch Bracelet",
    brand: "Earth & Stone",
    category: "beaded-bracelets",
    price: 38,
    badge: "Everyday favorite",
    shape: "beadbracelet",
    tone: "#ad7847",
    description:
      "Banded brown and gold beads on a stretch cord. An easy everyday piece that pairs with wood and stone alike.",
  },
  {
    slug: "black-onyx-bead-bracelet",
    name: "Black Onyx Bead Bracelet",
    brand: "Earth & Stone",
    category: "natural-stone",
    price: 42,
    badge: null,
    shape: "blackbeads",
    tone: "#393a37",
    description:
      "Polished black beads with a quiet shine. Simple enough to wear alone, dark enough to anchor a stack.",
  },
  {
    slug: "sandalwood-prayer-mala",
    name: "Sandalwood Prayer Mala",
    brand: "Still & Stone",
    category: "buddhist-mala",
    price: 58,
    badge: "Mindful favorite",
    shape: "mala",
    tone: "#9a6842",
    description:
      "A strand of smooth wood beads finished with a drop. Made for counting breaths, or simply for wearing.",
  },
  {
    slug: "108-bead-sandalwood-mala",
    name: "108-Bead Sandalwood Mala",
    brand: "Still & Stone",
    category: "buddhist-mala",
    price: 78,
    badge: "Traditional style",
    shape: "mala2",
    tone: "#9b6a45",
    description:
      "A full-length strand in the traditional count of 108, with a larger marker bead. Wear it long or wrapped at the wrist.",
  },
  {
    slug: "smoky-quartz-bead-bracelet",
    name: "Smoky Quartz Bead Bracelet",
    brand: "Earth & Stone",
    category: "natural-stone",
    price: 52,
    badge: "New",
    shape: "beads",
    tone: "#87776c",
    description:
      "Grey-brown beads that shift with the light. A soft neutral for every day.",
  },
  {
    slug: "minimal-wood-bead-bracelet",
    name: "Minimal Wood Bead Bracelet",
    brand: "Wood & Thread",
    category: "wood-beads",
    price: 29,
    badge: null,
    shape: "beadbracelet",
    tone: "#94633f",
    description:
      "Small matte wood beads and nothing extra. Light on the wrist and easy to layer.",
  },
  {
    slug: "gemstone-meditation-beads",
    name: "Gemstone Meditation Beads",
    brand: "Still & Stone",
    category: "meditation-beads",
    price: 68,
    badge: "Natural stone",
    shape: "mala3",
    tone: "#8b7967",
    description:
      "A strand of stone beads sized for the hand, with a drop to mark the start of each round.",
  },
  {
    slug: "ocean-blue-bead-bracelet",
    name: "Ocean Blue Bead Bracelet",
    brand: "JadeAdorn Edit",
    category: "beaded-bracelets",
    price: 36,
    badge: "New",
    shape: "beads",
    tone: "#6f9da5",
    description:
      "Sea-blue beads on a stretch cord. A bright note in an otherwise earthy stack.",
  },
  {
    slug: "matte-obsidian-bracelet",
    name: "Matte Obsidian Bracelet",
    brand: "Earth & Stone",
    category: "mens-bracelets",
    price: 44,
    badge: null,
    shape: "blackbeads",
    tone: "#393a37",
    description:
      "Matte black beads with a soft, stone-like finish, in a roomier fit.",
  },
  {
    slug: "warm-sandalwood-beads",
    name: "Warm Sandalwood Beads",
    brand: "Wood & Thread",
    category: "wood-beads",
    price: 34,
    badge: null,
    shape: "beads",
    tone: "#9b6a45",
    description: "Honey-brown wood beads on a stretch cord, sanded smooth.",
  },
  {
    slug: "jade-tone-bracelet-gift-set",
    name: "Jade-Tone Bracelet Gift Set",
    brand: "JadeAdorn Edit",
    category: "gift-sets",
    price: 89,
    badge: "Gift-ready",
    shape: "jadebeads",
    tone: "#829b78",
    description:
      "Green-tone bead bracelets, boxed and ready to give. No wrapping needed.",
  },
  {
    slug: "rose-quartz-bead-bracelet",
    name: "Rose Quartz Bead Bracelet",
    brand: "Earth & Stone",
    category: "natural-stone",
    price: 46,
    badge: null,
    shape: "beadbracelet",
    tone: "#c98f9e",
    description:
      "Pale pink beads on a stretch cord. A gentle color that works with gold and silver.",
  },
  {
    slug: "daily-stack-bracelet-set",
    name: "Daily Stack Bracelet Set",
    brand: "JadeAdorn Edit",
    category: "gift-sets",
    price: 62,
    badge: "Set of 3",
    shape: "bracelet",
    tone: "#b99a63",
    description:
      "Three bracelets chosen to be worn together, or split up across the week.",
  },
  {
    slug: "dark-wood-meditation-mala",
    name: "Dark Wood Meditation Mala",
    brand: "Still & Stone",
    category: "meditation-beads",
    price: 72,
    badge: null,
    shape: "mala2",
    tone: "#68452f",
    description:
      "Deep brown wood beads with a contrasting marker bead. A calm, weighty strand for daily practice.",
  },
  {
    slug: "mens-tiger-eye-bracelet",
    name: "Men’s Tiger Eye Bracelet",
    brand: "Earth & Stone",
    category: "mens-bracelets",
    price: 49,
    badge: "Bestseller",
    shape: "beadbracelet",
    tone: "#ad7847",
    description:
      "Banded brown and gold beads in a larger size, on a strong stretch cord.",
  },
  {
    slug: "natural-stone-pocket-beads",
    name: "Natural Stone Pocket Beads",
    brand: "Still & Stone",
    category: "meditation-beads",
    price: 24,
    badge: "Small gift",
    shape: "beads",
    tone: "#8b7967",
    description:
      "A short strand of stone beads that fits in a pocket or a palm. A small gift that gets used.",
  },
  {
    slug: "sandalwood-stone-mala",
    name: "Sandalwood & Stone Mala",
    brand: "Still & Stone",
    category: "buddhist-mala",
    price: 84,
    badge: "Limited edit",
    shape: "mala3",
    tone: "#9a6842",
    description:
      "Wood beads broken up by stone accents and finished with a drop.",
  },
];

/** Inserts the catalog once. Does nothing if any category already exists. */
export function seedCatalog(db: Db): void {
  const seed = db.transaction(() => {
    const existing = db
      .prepare("SELECT COUNT(*) AS n FROM categories")
      .get() as { n: number };
    if (existing.n > 0) return;

    const insertCategory = db.prepare(
      "INSERT INTO categories (slug, name, sort_order) VALUES (?, ?, ?)",
    );
    const categoryIds = new Map<string, number | bigint>();
    CATEGORIES.forEach((category, index) => {
      const { lastInsertRowid } = insertCategory.run(
        category.slug,
        category.name,
        index,
      );
      categoryIds.set(category.slug, lastInsertRowid);
    });

    const insertProduct = db.prepare(
      `INSERT INTO products
         (slug, name, brand, category_id, price_cents, description, badge, art_shape, art_tone, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    PRODUCTS.forEach((product, index) => {
      insertProduct.run(
        product.slug,
        product.name,
        product.brand,
        categoryIds.get(product.category),
        product.price * 100,
        product.description,
        product.badge,
        product.shape,
        product.tone,
        index,
      );
    });
  });

  // IMMEDIATE takes the write lock before the emptiness check, so two
  // processes starting at the same moment cannot both seed.
  seed.immediate();
}
