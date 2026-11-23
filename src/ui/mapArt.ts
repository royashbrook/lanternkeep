// the map is drawn on a 1000 by 700 board. in portrait the whole board turns a quarter turn, so
// the walk to the keep always runs up the screen. pictures stay upright: only their spots move.
import { roll } from "../engine/rng.ts";
import type { Pack } from "../engine/types.ts";

export interface Spot { x: number; y: number }
export const boardSize = (land: boolean) => (land ? { w: 1000, h: 700 } : { w: 700, h: 1000 });
export const project = (x: number, y: number, land: boolean): Spot => (land ? { x, y } : { x: 700 - y, y: 1000 - x });

/** a road bends a little, always the same way, so it reads as a path and not a ruler line */
export function roadPath(a: Spot, b: Spot) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const bend = 0.11;
  const cx = mx - dy * bend, cy = my + dx * bend;
  return { d: `M${a.x} ${a.y}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x} ${b.y}`, cx, cy };
}

/** an arrow from a to b along the road's bend, stopping short of both ends */
export function arrowPath(a: Spot, b: Spot, gap = 54) {
  const { cx, cy } = roadPath(a, b);
  const at = (t: number) => ({
    x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t ** 2 * b.x,
    y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t ** 2 * b.y,
  });
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const t0 = Math.min(0.4, gap / length), t1 = 1 - t0;
  const start = at(t0), end = at(t1), mid = at(0.5), before = at(t1 - 0.05);
  const angle = (Math.atan2(end.y - before.y, end.x - before.x) * 180) / Math.PI;
  const qx = 2 * mid.x - (start.x + end.x) / 2, qy = 2 * mid.y - (start.y + end.y) / 2;
  return { d: `M${start.x.toFixed(1)} ${start.y.toFixed(1)}Q${qx.toFixed(1)} ${qy.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`, end, angle };
}

const segmentDistance = (p: Spot, a: Spot, b: Spot) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

export interface Tree { x: number; y: number; s: number; kind: number }

/** trees scattered with a fixed seed, kept clear of towns, labels and roads */
export function scatter(pack: Pack, land: boolean): Tree[] {
  const { w, h } = boardSize(land);
  const spots = pack.places.map((p) => project(p.x, p.y, land));
  const roads = pack.roads.map(([a, b]) => {
    const pa = pack.places.find((p) => p.id === a)!, pb = pack.places.find((p) => p.id === b)!;
    return [project(pa.x, pa.y, land), project(pb.x, pb.y, land)] as const;
  });
  const trees: Tree[] = [];
  let dice = 20261;
  const next = () => {
    const [v, n] = roll(dice);
    dice = n;
    return v;
  };
  for (let i = 0; i < 420 && trees.length < 62; i++) {
    const x = 16 + next() * (w - 32), y = 26 + next() * (h - 40);
    const s = 0.7 + next() * 0.7, kind = Math.floor(next() * 3);
    if (spots.some((p) => Math.hypot(p.x - x, p.y - y) < 104)) continue;
    if (roads.some(([a, b]) => segmentDistance({ x, y }, a, b) < 40)) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < 34)) continue;
    trees.push({ x: Math.round(x), y: Math.round(y), s: +s.toFixed(2), kind });
  }
  return trees.sort((a, b) => a.y - b.y);
}

/** the river, as a smooth line through the board */
export function riverPath(land: boolean) {
  const p = [[-20, 250], [130, 300], [190, 470], [420, 440], [560, 330], [760, 300], [800, 120], [1020, 60]].map(([x, y]) => project(x, y, land));
  let d = `M${p[0].x} ${p[0].y}`;
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    d += `Q${a.x + (b.x - a.x) * 0.5 + (b.y - a.y) * 0.12} ${a.y + (b.y - a.y) * 0.5 - (b.x - a.x) * 0.12} ${b.x} ${b.y}`;
  }
  return d;
}
