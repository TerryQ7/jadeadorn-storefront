import { Suspense } from "react";
import { Catalog, CatalogFallback } from "@/components/Catalog";
import { HeroStrand } from "@/components/HeroStrand";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <h1>A little meaning in every bead.</h1>
          <p>
            Stone bracelets, wood beads and malas for everyday wear, a daily
            ritual, or a thoughtful gift.
          </p>
          <a href="#shop" className="button button--outline">
            Shop the collection
          </a>
        </div>
        <div className="hero__picture">
          <HeroStrand />
        </div>
      </section>

      <Suspense fallback={<CatalogFallback />}>
        <Catalog />
      </Suspense>
    </>
  );
}
