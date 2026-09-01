/**
 * 격자 기반 A* 경로탐색.
 *
 * 캐릭터가 벽이나 가구를 통과하지 않도록, 이동은 반드시 이 모듈이 낸 경로만 따른다.
 * 4방향 이동만 허용한다(대각선 허용 시 벽 모서리를 스쳐 지나가는 문제가 생김).
 */
import type { Grid, Vec2 } from '@/types';

export function idx(grid: Grid, x: number, y: number): number {
  return y * grid.w + x;
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.w && y < grid.h;
}

export function isWalkable(grid: Grid, x: number, y: number): boolean {
  return inBounds(grid, x, y) && grid.blocked[idx(grid, x, y)] === 0;
}

/** 목표가 막혀 있을 때 가장 가까운 통행 가능 타일을 찾는다(BFS). */
export function nearestWalkable(grid: Grid, target: Vec2): Vec2 | null {
  if (isWalkable(grid, target.x, target.y)) return target;
  const seen = new Set<number>([idx(grid, target.x, target.y)]);
  const queue: Vec2[] = [target];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of neighbors(cur)) {
      if (!inBounds(grid, n.x, n.y)) continue;
      const k = idx(grid, n.x, n.y);
      if (seen.has(k)) continue;
      seen.add(k);
      if (isWalkable(grid, n.x, n.y)) return n;
      queue.push(n);
    }
  }
  return null;
}

function neighbors(p: Vec2): Vec2[] {
  return [
    { x: p.x + 1, y: p.y },
    { x: p.x - 1, y: p.y },
    { x: p.x, y: p.y + 1 },
    { x: p.x, y: p.y - 1 },
  ];
}

function manhattan(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * from → to 경로를 계산한다. 반환 배열은 출발점을 제외한 통과 타일 목록이다.
 * 경로가 없으면 빈 배열을 돌려준다(캐릭터는 제자리에 머문다).
 */
export function findPath(grid: Grid, from: Vec2, to: Vec2): Vec2[] {
  const start = { x: Math.round(from.x), y: Math.round(from.y) };
  const goalRaw = { x: Math.round(to.x), y: Math.round(to.y) };
  const goal = nearestWalkable(grid, goalRaw);
  if (!goal) return [];
  if (!isWalkable(grid, start.x, start.y)) {
    const fixed = nearestWalkable(grid, start);
    if (!fixed) return [];
    start.x = fixed.x;
    start.y = fixed.y;
  }
  if (start.x === goal.x && start.y === goal.y) return [];

  const startKey = idx(grid, start.x, start.y);
  const goalKey = idx(grid, goal.x, goal.y);

  const gScore = new Map<number, number>([[startKey, 0]]);
  const cameFrom = new Map<number, number>();
  // 소규모 격자(≈ 32x20)이므로 단순 배열 기반 우선순위 큐로 충분하다.
  const open: Array<{ key: number; p: Vec2; f: number }> = [
    { key: startKey, p: start, f: manhattan(start, goal) },
  ];
  const closed = new Set<number>();

  while (open.length > 0) {
    let bestAt = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestAt].f) bestAt = i;
    }
    const current = open.splice(bestAt, 1)[0];
    if (current.key === goalKey) {
      return reconstruct(grid, cameFrom, goalKey);
    }
    closed.add(current.key);

    for (const n of neighbors(current.p)) {
      if (!isWalkable(grid, n.x, n.y)) continue;
      const nk = idx(grid, n.x, n.y);
      if (closed.has(nk)) continue;
      const tentative = (gScore.get(current.key) ?? Infinity) + 1;
      if (tentative >= (gScore.get(nk) ?? Infinity)) continue;
      cameFrom.set(nk, current.key);
      gScore.set(nk, tentative);
      const f = tentative + manhattan(n, goal);
      const existing = open.find((o) => o.key === nk);
      if (existing) existing.f = f;
      else open.push({ key: nk, p: n, f });
    }
  }
  return [];
}

function reconstruct(grid: Grid, cameFrom: Map<number, number>, goalKey: number): Vec2[] {
  const out: Vec2[] = [];
  let cur: number | undefined = goalKey;
  while (cur !== undefined) {
    out.push({ x: cur % grid.w, y: Math.floor(cur / grid.w) });
    cur = cameFrom.get(cur);
  }
  out.reverse();
  // 첫 원소는 출발 타일이므로 제거한다.
  return out.slice(1);
}

/**
 * 경로를 따라 dt(초)만큼 이동시킨다.
 * 반환값의 `arrived` 가 true 이면 목적지에 도달한 것이다.
 */
export function advanceAlongPath(
  pos: Vec2,
  path: Vec2[],
  tilesPerSecond: number,
  dt: number,
): { pos: Vec2; path: Vec2[]; arrived: boolean } {
  let remaining = tilesPerSecond * dt;
  let cur = { ...pos };
  const rest = [...path];

  while (remaining > 0 && rest.length > 0) {
    const next = rest[0];
    const dx = next.x - cur.x;
    const dy = next.y - cur.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= remaining) {
      cur = { x: next.x, y: next.y };
      rest.shift();
      remaining -= dist;
    } else {
      cur = { x: cur.x + (dx / dist) * remaining, y: cur.y + (dy / dist) * remaining };
      remaining = 0;
    }
  }
  return { pos: cur, path: rest, arrived: rest.length === 0 };
}
