import { shade } from "@/lib/color";

// The home page's picture: the top of a 108-bead jade mala, large enough that
// only an arc of it fits on the screen. It stands in for the full-bleed
// photograph the design calls for.
//
// All numbers are SVG units. The ring's centre is far below the drawing, so
// the visible part is a shallow arc. globals.css turns the whole drawing
// slowly around that centre (.strand); it must agree with CENTER and VIEW.

const BEADS_IN_RING = 108;
const BEAD_RADIUS = 30;
const PITCH = 62; // centre to centre: one bead plus a sliver of cord
const RING_RADIUS = (BEADS_IN_RING * PITCH) / (2 * Math.PI);
const VIEW = { width: 1760, height: 480 };
const CENTER = { x: VIEW.width / 2, y: 1100 };
const STEP_DEGREES = 360 / BEADS_IN_RING;

// Three greens in turn. The turn in globals.css moves the ring by exactly one
// repeat of this pattern (three beads, 10 degrees), which is why it loops
// without a visible jump.
const JADE = ["#a9c79a", "#6d9a73", "#d3e0c0"];

// Beads either side of the top one. Enough to pass both edges of the widest
// layout with a full repeat to spare.
const BEADS_EACH_SIDE = 18;

const round = (n: number) => Math.round(n * 10) / 10;

export function HeroStrand() {
  const top = round(CENTER.y - RING_RADIUS);

  return (
    <svg
      className="strand"
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      aria-hidden="true"
    >
      <defs>
        {JADE.map((color, i) => (
          <radialGradient key={color} id={`jade-${i}`} cx="0.4" cy="0.26" r="0.82">
            <stop offset="0" stopColor={shade(color, 0.7)} />
            <stop offset="0.3" stopColor={color} />
            <stop offset="0.72" stopColor={shade(color, -0.5)} />
            <stop offset="1" stopColor={shade(color, -0.86)} />
          </radialGradient>
        ))}
        <radialGradient id="jade-glint">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The cord shows in the gaps between beads. */}
      <circle
        cx={CENTER.x}
        cy={CENTER.y}
        r={round(RING_RADIUS)}
        fill="none"
        stroke="#52525b"
        strokeWidth="3"
      />

      {Array.from({ length: BEADS_EACH_SIDE * 2 + 1 }, (_, n) => {
        const i = n - BEADS_EACH_SIDE;
        // Every bead is drawn at the top of the ring and then turned into
        // place, so its light turns with it and the ring looks the same after
        // each repeat.
        return (
          <g
            key={i}
            transform={`rotate(${round(i * STEP_DEGREES * 100) / 100} ${CENTER.x} ${CENTER.y})`}
          >
            <circle
              cx={CENTER.x}
              cy={top}
              r={BEAD_RADIUS}
              fill={`url(#jade-${((i % 3) + 3) % 3})`}
            />
            <ellipse
              cx={CENTER.x - 9}
              cy={round(top - 13)}
              rx="9"
              ry="5.5"
              fill="url(#jade-glint)"
              transform={`rotate(-24 ${CENTER.x - 9} ${round(top - 13)})`}
            />
          </g>
        );
      })}
    </svg>
  );
}
