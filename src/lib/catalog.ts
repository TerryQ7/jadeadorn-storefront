import { getDb, type Db } from "@/lib/db/client";

// Catalog queries. Functions are async even though SQLite answers
// synchronously, so swapping in a networked database (Postgres) later
// changes this file and not its callers.

export type Category = {
  id: number;
  slug: string;
  name: string;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  brand: string;
  categorySlug: string;
  categoryName: string;
  priceCents: number;
  description: string;
  badge: string | null;
  artShape: string;
  artTone: string;
};

const PRODUCT_COLUMNS = `
  p.id,
  p.slug,
  p.name,
  p.brand,
  c.slug AS categorySlug,
  c.name AS categoryName,
  p.price_cents AS priceCents,
  p.description,
  p.badge,
  p.art_shape AS artShape,
  p.art_tone AS artTone
`;

export async function listCategories(db: Db = getDb()): Promise<Category[]> {
  return db
    .prepare("SELECT id, slug, name FROM categories ORDER BY sort_order")
    .all() as Category[];
}

export async function getCategoryBySlug(
  slug: string,
  db: Db = getDb(),
): Promise<Category | null> {
  const row = db
    .prepare("SELECT id, slug, name FROM categories WHERE slug = ?")
    .get(slug) as Category | undefined;
  return row ?? null;
}

export async function listProducts(
  filter: { categorySlug?: string } = {},
  db: Db = getDb(),
): Promise<Product[]> {
  if (filter.categorySlug) {
    return db
      .prepare(
        `SELECT ${PRODUCT_COLUMNS}
           FROM products p JOIN categories c ON c.id = p.category_id
          WHERE p.active = 1 AND c.slug = ?
          ORDER BY p.sort_order`,
      )
      .all(filter.categorySlug) as Product[];
  }
  return db
    .prepare(
      `SELECT ${PRODUCT_COLUMNS}
         FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.active = 1
        ORDER BY p.sort_order`,
    )
    .all() as Product[];
}

export async function getProductBySlug(
  slug: string,
  db: Db = getDb(),
): Promise<Product | null> {
  const row = db
    .prepare(
      `SELECT ${PRODUCT_COLUMNS}
         FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.active = 1 AND p.slug = ?`,
    )
    .get(slug) as Product | undefined;
  return row ?? null;
}

/** Active products for the given ids. Unknown or inactive ids are simply absent. */
export async function getProductsByIds(
  ids: number[],
  db: Db = getDb(),
): Promise<Product[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  return db
    .prepare(
      `SELECT ${PRODUCT_COLUMNS}
         FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.active = 1 AND p.id IN (${placeholders})`,
    )
    .all(...ids) as Product[];
}
