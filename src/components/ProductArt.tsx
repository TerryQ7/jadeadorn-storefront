// Placeholder product imagery. Real photography is out of scope, so each
// product is drawn as a small SVG from two catalog fields: a shape and a
// colour. The store shows these the way it would show studio photos, on
// black, so every bead is shaded as a lit sphere rather than a flat disc.

import { shade } from "@/lib/color";

// A square window onto the drawing area, which is centred on x = 105.
const VIEW_BOX = "25 5 160 160";
const CORD = "#6f4c35";

// Rounded so the server and the browser print identical coordinates.
const round = (n: number) => Math.round(n * 10) / 10;

type Bead = { cx: number; cy: number; r: number; color: string };

// The id is derived from the colour, so two drawings on one page that share
// a colour also share an identical gradient, and neither can pick up the
// wrong one.
const sphereId = (color: string) => `sphere-${color.slice(1)}`;

/** One gradient per bead colour: light from the upper left, falling to shadow. */
function SphereGradients({ colors }: { colors: string[] }) {
  return (
    <defs>
      {[...new Set(colors)].map((color) => (
        <radialGradient key={color} id={sphereId(color)} cx="0.36" cy="0.3" r="0.8">
          <stop offset="0" stopColor={shade(color, 0.6)} />
          <stop offset="0.34" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -0.8)} />
        </radialGradient>
      ))}
    </defs>
  );
}

function Sphere({ cx, cy, r, color }: Bead) {
  return (
    <>
      {/* The faint rim keeps dark stones readable against the black backdrop. */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={`url(#${sphereId(color)})`}
        stroke="#fff"
        strokeOpacity="0.12"
        strokeWidth="0.5"
      />
      <circle
        cx={round(cx - r * 0.34)}
        cy={round(cy - r * 0.38)}
        r={round(r * 0.16)}
        fill="#fff"
        opacity="0.5"
      />
    </>
  );
}

function Spheres({ beads }: { beads: Bead[] }) {
  return (
    <>
      <SphereGradients colors={beads.map((bead) => bead.color)} />
      {beads.map((bead, i) => (
        <Sphere key={i} {...bead} />
      ))}
    </>
  );
}

/**
 * A ring of beads seen at an angle. `count` beads of radius `r` on an ellipse
 * centred on (cx, cy). Beads on the near side are drawn slightly larger and
 * last, so they overlap the far side the way a real bracelet does.
 */
function ring(
  palette: string[],
  ellipse: { count: number; cx: number; cy: number; rx: number; ry: number; r: number },
): Bead[] {
  const { count, cx, cy, rx, ry, r } = ellipse;
  const beads = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return {
      cx: round(cx + rx * Math.cos(angle)),
      cy: round(cy + ry * Math.sin(angle)),
      r: round(r * (1 + 0.14 * Math.sin(angle))),
      color: palette[i % palette.length],
    };
  });
  return beads.sort((a, b) => a.cy - b.cy);
}

function BeadBracelet({ shape, tone }: { shape: string; tone: string }) {
  const palette =
    shape === "jadebeads"
      ? ["#b4c8a3", "#829b78", "#d8dfc7"]
      : shape === "blackbeads"
        ? ["#292b29", "#50514d", "#171817"]
        : [shade(tone, 0.35), tone, shade(tone, -0.22)];
  return (
    <Spheres
      beads={ring(palette, { count: 15, cx: 105, cy: 85, rx: 54, ry: 40, r: 9.4 })}
    />
  );
}

/** "bracelet": a set of three, laid down so each overlaps the one before. */
function BraceletSet({ tone }: { tone: string }) {
  const set = [
    { cx: 80, cy: 57, color: shade(tone, -0.3) },
    { cx: 131, cy: 79, color: tone },
    { cx: 87, cy: 114, color: shade(tone, 0.32) },
  ];
  return (
    <Spheres
      beads={set.flatMap(({ cx, cy, color }) =>
        ring([color], { count: 14, cx, cy, rx: 30, ry: 23, r: 5.4 }),
      )}
    />
  );
}

/**
 * A mala: a loop of small beads closed by one larger bead, with a tassel
 * hanging from it. "mala2" is the full-length strand, so its beads are finer
 * and its closing bead is a contrasting marker. "mala3" lightens every ninth
 * bead.
 */
function Mala({ shape, tone }: { shape: string; tone: string }) {
  const count = shape === "mala2" ? 41 : 27;
  const r = shape === "mala2" ? 3.5 : 5.3;
  const accent = shade(tone, 0.55);

  const loop = Array.from({ length: count }, (_, i) => {
    // An arc that starts and ends either side of the closing bead.
    const angle = (i / (count - 1)) * Math.PI * 1.86 + Math.PI * 0.57;
    return {
      cx: round(105 + 58 * Math.cos(angle)),
      cy: round(72 + 50 * Math.sin(angle)),
      r,
      color: shape === "mala3" && i % 9 === 4 ? accent : tone,
    };
  });
  const closing = {
    cx: 105,
    cy: 123.5,
    r: shape === "mala2" ? 8 : 7.4,
    color: shape === "mala2" ? "#d2b58d" : shape === "mala3" ? accent : tone,
  };

  return (
    <>
      <path
        d="M105 131v12"
        fill="none"
        stroke={tone}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M99.5 142.5l5.5 13 5.5-13z"
        fill={tone}
        stroke={CORD}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <Spheres beads={[...loop, closing]} />
    </>
  );
}

export function ProductArt({
  shape,
  tone,
  label,
}: {
  shape: string;
  tone: string;
  /** Accessible name. Omit when the product name is already next to the art. */
  label?: string;
}) {
  let art;
  if (shape.startsWith("mala")) art = <Mala shape={shape} tone={tone} />;
  else if (shape === "bracelet") art = <BraceletSet tone={tone} />;
  else art = <BeadBracelet shape={shape} tone={tone} />;

  return (
    <svg
      viewBox={VIEW_BOX}
      className="art__svg"
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
    >
      {art}
    </svg>
  );
}
