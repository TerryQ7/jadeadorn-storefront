import Link from "next/link";
import { ProductArt } from "@/components/ProductArt";
import type { Product } from "@/lib/catalog";
import { formatCents } from "@/lib/money";

export function ProductCard({
  product,
  headingLevel: Name = "h3",
}: {
  product: Product;
  /** Chosen by the page so headings never skip a level. */
  headingLevel?: "h2" | "h3";
}) {
  return (
    <li className="card">
      <Link href={`/products/${product.slug}`} className="card__link">
        <div className="art">
          <ProductArt shape={product.artShape} tone={product.artTone} />
        </div>
        <Name className="card__name">{product.name}</Name>
        <p className="card__meta">
          <span className="price">{formatCents(product.priceCents)}</span>
          <span className="card__brand">{product.brand}</span>
        </p>
        {product.badge && <p className="tag">{product.badge}</p>}
      </Link>
    </li>
  );
}
