/* The leader is a pure function of three boxes: the slip, the nav chip, and
   the bar. It reads the boxes the CSS already left visible, so it never owns a
   breakpoint or a station of its own. */

export type Box = {
  left: number; top: number; right: number; bottom: number;
  width: number; height: number;
};

export type Leader = { path: string; x: number; y: number };

/* The lane sits in the page margin; the band is the empty strip under the bar.
   Both gaps are optical, so they stay in one place. */
const LANE_GAP = 10;
const BAND = 14;
const CORNER = 8;
const DOT_INSET = 7;
const MIN_BAND = 140;

export function leaderFor(slip: Box, slot: Box, chip: Box, bar: Box, viewport: number): Leader | null {
  if (chip.width === 0) return null;
  /* The lane is the right margin of the slip's home, not of the plate: the
     plate is left aligned, so its own edge sits inside the text column. */
  const lane = Math.min(Math.max(slot.right, slip.right) + LANE_GAP, viewport - 12);
  const x = Math.min(Math.max(chip.left + chip.width / 2, 16), viewport - 16);
  const y = bar.bottom - DOT_INSET;
  const band = bar.bottom + BAND;
  /* A short window would run the horizontal leg through the chapter's own
     heading; a narrow lane would collapse the elbow. */
  if (slip.top - band < MIN_BAND || lane < slip.right + 24) return null;
  /* The thread leaves the middle of the card's right edge: the card is the
     badge, so its own edge is the hand-off point. A start on the top corner
     would read as the box's outline, and a start inside the plate would read
     as the pair's own line. */
  return {
    path: route(slip.right, slip.top + slip.height / 2, lane, x, y, band),
    x,
    y,
  };
}

/* Pinned to the card's right edge, one elbow in the lane, one under the bar,
   then up into the chip. The first leg is the hand-off from the note. */
function route(startX: number, startY: number, lane: number, x: number, y2: number, band: number): string {
  const r = Math.min(CORNER, (lane - startX) / 2, (startY - band) / 2, band - y2 - 3);
  if (r < 1) return `M${n(startX)} ${n(startY)} L${n(lane)} ${n(startY)} L${n(lane)} ${n(band)} L${n(x)} ${n(y2)}`;
  return [
    `M${n(startX)} ${n(startY)}`,
    `L${n(lane - r)} ${n(startY)}`,
    `Q${n(lane)} ${n(startY)} ${n(lane)} ${n(startY - r)}`,
    `L${n(lane)} ${n(band + r)}`,
    `Q${n(lane)} ${n(band)} ${n(lane - r)} ${n(band)}`,
    `L${n(x + r)} ${n(band)}`,
    `Q${n(x)} ${n(band)} ${n(x)} ${n(band - r)}`,
    `L${n(x)} ${n(y2)}`,
  ].join(' ');
}

const n = (value: number): number => Math.round(value * 10) / 10;
