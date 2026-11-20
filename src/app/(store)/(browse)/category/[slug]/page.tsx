import type { Metadata } from "next";
import { Suspense } from "react";
import { Catalog, CatalogFallback } from "@/components/Catalog";
import { getCategoryBySlug } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  return { title: category?.name ?? "Category not found" };
}

export default function CategoryPage({ params }: Props) {
  return (
    <Suspense fallback={<CatalogFallback />}>
      <Catalog categorySlug={params.then((p) => p.slug)} />
    </Suspense>
  );
}
