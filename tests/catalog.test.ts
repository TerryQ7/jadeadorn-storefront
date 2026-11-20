import { beforeEach, describe, expect, it } from "vitest";
import {
  getProductBySlug,
  getProductsByIds,
  listCategories,
  listProducts,
} from "@/lib/catalog";
import type { Db } from "@/lib/db/client";
import { createTestDb, productId } from "./helpers";

let db: Db;
beforeEach(() => {
  db = createTestDb();
});

describe("catalog", () => {
  it("lists the JadeAdorn categories in display order", async () => {
    const categories = await listCategories(db);

    expect(categories.map((c) => c.name)).toEqual([
      "Beaded Bracelets",
      "Natural Stone",
      "Wood Beads",
      "Buddhist Mala",
      "Meditation Beads",
      "Men’s Bracelets",
      "Gift Sets",
    ]);
  });

  it("lists all eighteen products from the prototype catalog", async () => {
    const products = await listProducts({}, db);

    expect(products).toHaveLength(18);
  });

  it("returns only products in the requested category", async () => {
    const products = await listProducts({ categorySlug: "buddhist-mala" }, db);

    expect(products.map((p) => p.name)).toEqual([
      "Sandalwood Prayer Mala",
      "108-Bead Sandalwood Mala",
      "Sandalwood & Stone Mala",
    ]);
  });

  it("stores prices as integer cents", async () => {
    const product = await getProductBySlug("sandalwood-prayer-mala", db);

    expect(product?.priceCents).toBe(5800);
  });

  it("returns null for a product that does not exist", async () => {
    expect(await getProductBySlug("no-such-thing", db)).toBeNull();
  });

  it("hides a product once it is marked inactive", async () => {
    const id = productId(db, "black-onyx-bead-bracelet");
    db.prepare("UPDATE products SET active = 0 WHERE id = ?").run(id);

    expect(await getProductBySlug("black-onyx-bead-bracelet", db)).toBeNull();
    expect(await getProductsByIds([id], db)).toEqual([]);
    expect(await listProducts({}, db)).toHaveLength(17);
  });

  it("does not seed twice when the database is opened again", async () => {
    const { seedCatalog } = await import("@/lib/db/seed");
    seedCatalog(db);

    expect(await listProducts({}, db)).toHaveLength(18);
  });
});
