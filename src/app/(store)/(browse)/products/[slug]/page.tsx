import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AddToBag } from "@/components/AddToBag";
import { ProductArt } from "@/components/ProductArt";
import { ProductCard } from "@/components/ProductCard";
import { getProductBySlug, listProducts } from "@/lib/catalog";
import { formatCents } from "@/lib/money";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return { title: product.name, description: product.description };
}

export default function ProductPage({ params }: Props) {
  return (
    <Suspense fallback={<ProductFallback />}>
      <ProductDetail params={params} />
    </Suspense>
  );
}

async function ProductDetail({ params }: Props) {
  await connection();
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = (await listProducts({ categorySlug: product.categorySlug }))
    .filter((other) => other.id !== product.id)
    .slice(0, 4);

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/#shop">All pieces</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/category/${product.categorySlug}`}>
          {product.categoryName}
        </Link>
      </nav>

      <article className="product">
        <div className="art art--large">
          <ProductArt
            shape={product.artShape}
            tone={product.artTone}
            label={`Illustration of ${product.name}`}
          />
        </div>

        <div className="product__info">
          <p className="product__brand">
            {product.brand}
            {product.badge && <span className="tag">{product.badge}</span>}
          </p>
          <h1>{product.name}</h1>
          <p className="product__price price">
            {formatCents(product.priceCents)}
          </p>
          <p className="product__description">{product.description}</p>

          <AddToBag productId={product.id} productName={product.name} />

          <ul className="product__notes">
            <li>Free U.S. shipping on orders of $100 or more.</li>
            <li>Shown as an illustration. Product photos are on the way.</li>
          </ul>
        </div>
      </article>

      {related.length > 0 && (
        <section className="related" aria-labelledby="related-title">
          <h2 id="related-title">More in {product.categoryName}</h2>
          <ul className="grid">
            {related.map((other) => (
              <ProductCard key={other.id} product={other} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function ProductFallback() {
  return (
    <div className="product" aria-busy="true" aria-label="Loading product">
      <div className="art art--large art--placeholder" />
      <div className="product__info" />
    </div>
  );
}
