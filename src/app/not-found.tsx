import Link from "next/link";
import { StoreShell } from "@/components/StoreShell";

export default function NotFound() {
  return (
    <StoreShell canvas="night">
      <div className="empty empty--page">
        <h1>We couldn&apos;t find that page.</h1>
        <p>The link may be out of date, or the piece is no longer sold.</p>
        <Link href="/#shop" className="button button--outline">
          Browse the collection
        </Link>
      </div>
    </StoreShell>
  );
}
