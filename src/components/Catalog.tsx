import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ProductCard } from "@/components/ProductCard";
import { listCategories, listProducts } from "@/lib/catalog";

/**
 * Category chips plus the product grid. Rendered inside <Suspense>: the page
 * frame is sent immediately and this part follows once the database has
 * answered.
 */
export async function Catalog({
  categorySlug,
}: {
  /** A promise because Next.js hands route params over asynchronously. */
  categorySlug?: Promise<string>;
}) {
  // SQLite is read synchronously, which Next.js cannot see as "data that
  // changes". connection() says so explicitly: run this per request, do not
  // bake the result into the build.
  await connection();

  const slug = await categorySlug;
  const [categories, products] = await Promise.all([
    listCategories(),
    listProducts({ categorySlug: slug }),
  ]);

  const current = slug ? categories.find((c) => c.slug === slug) : undefined;
  if (slug && !current) notFound();

  // The home page already has an <h1> in its hero; a category page does not.
  const Title = current ? "h1" : "h2";

  return (
    <section id="shop" className="catalog" aria-labelledby="catalog-title">
      <div className="catalog__head">
        <Title id="catalog-title" className="catalog__title">
          {current ? current.name : "All pieces"}
        </Title>
        <p className="catalog__count">
          {products.length} {products.length === 1 ? "piece" : "pieces"}
        </p>
      </div>

      <nav className="chips" aria-label="Categories">
        <Link
          href="/#shop"
          className="chip"
          aria-current={current ? undefined : "page"}
        >
          All
        </Link>
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/category/${category.slug}`}
            className="chip"
            aria-current={category.slug === slug ? "page" : undefined}
          >
            {category.name}
          </Link>
        ))}
      </nav>

      <ul className="grid">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            headingLevel={current ? "h2" : "h3"}
          />
        ))}
      </ul>
    </section>
  );
}

/** Shown in the page frame while the catalog loads. Same footprint as the real grid. */
export function CatalogFallback() {
  return (
    <section className="catalog" aria-busy="true" aria-label="Loading products">
      <div className="catalog__head">
        <p className="catalog__title">&nbsp;</p>
      </div>
      <div className="chips">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="chip chip--placeholder" />
        ))}
      </div>
      <ul className="grid">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="card">
            <div className="art art--placeholder" />
          </li>
        ))}
      </ul>
    </section>
  );
}
