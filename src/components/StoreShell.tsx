import Link from "next/link";
import { BagLink } from "@/components/BagLink";
import { formatCents } from "@/lib/money";
import {
  FLAT_SHIPPING_CENTS,
  FREE_SHIPPING_THRESHOLD_CENTS,
} from "@/lib/pricing";

const FREE_SHIPPING_FROM = formatCents(FREE_SHIPPING_THRESHOLD_CENTS).replace(
  ".00",
  "",
);

/**
 * The frame around every store page: shipping note, header, footer.
 *
 * The store has two canvases and a page uses exactly one. "night" is the
 * black canvas for browsing; "light" is the cream canvas for buying. The
 * choice is made by the route group's layout, never by a page.
 */
export function StoreShell({
  canvas,
  children,
}: {
  canvas: "night" | "light";
  children: React.ReactNode;
}) {
  return (
    <div className={`store store--${canvas}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <p className="announce">
        Free U.S. shipping on orders of {FREE_SHIPPING_FROM} or more
      </p>
      <header className="site-header">
        <div className="site-header__bar">
          <Link href="/" className="wordmark" aria-label="JadeAdorn home">
            JadeAdorn
          </Link>
          <nav className="site-nav" aria-label="Main">
            <Link href="/#shop" className="site-nav__link">
              Shop
            </Link>
            <BagLink />
          </nav>
        </div>
      </header>
      <main id="main" className="page">
        {children}
      </main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__brand">
            <p className="wordmark">JadeAdorn</p>
            <p>Beaded jewelry and everyday accessories.</p>
          </div>
          <nav className="site-footer__group" aria-label="Footer">
            <h2>Shop</h2>
            <ul>
              <li>
                <Link href="/#shop">All pieces</Link>
              </li>
              <li>
                <Link href="/cart">Your bag</Link>
              </li>
            </ul>
          </nav>
          <div className="site-footer__group">
            <h2>Shipping</h2>
            <ul>
              <li>Free in the U.S. on orders of {FREE_SHIPPING_FROM} or more</li>
              <li>{formatCents(FLAT_SHIPPING_CENTS)} flat rate below that</li>
            </ul>
          </div>
          <p className="site-footer__legal">
            This is a demonstration store. Payments are simulated and no orders
            are shipped.
          </p>
        </div>
      </footer>
    </div>
  );
}
