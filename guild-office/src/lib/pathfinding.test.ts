import { describe, expect, it } from 'vitest';
import { GRID } from '@/data/world';
import { ROOMS, roomById } from '@/data/seed';
import { advanceAlongPath, findPath, isWalkable } from '@/lib/pathfinding';

describe('경로탐색', () => {
  it('모든 방의 앵커와 문은 통행 가능해야 한다', () => {
    for (const room of ROOMS) {
      expect(isWalkable(GRID, room.anchor.x, room.anchor.y), `${room.id} anchor`).toBe(true);
      expect(isWalkable(GRID, room.door.x, room.door.y), `${room.id} door`).toBe(true);
    }
  });

  it('모든 방 사이에 경로가 존재한다 (고립된 공간이 없다)', () => {
    for (const from of ROOMS) {
      for (const to of ROOMS) {
        if (from.id === to.id) continue;
        const path = findPath(GRID, from.anchor, to.anchor);
        expect(path.length, `${from.id} → ${to.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('경로의 모든 타일이 통행 가능하다 — 벽이나 가구를 통과하지 않는다', () => {
    const path = findPath(GRID, roomById('admin_desk').anchor, roomById('sales_room').anchor);
    for (const p of path) {
      expect(isWalkable(GRID, p.x, p.y), `(${p.x},${p.y})`).toBe(true);
    }
  });

  it('경로는 인접한 타일로만 이어진다 (순간이동 없음)', () => {
    const start = roomById('lab').anchor;
    const path = findPath(GRID, start, roomById('fishing').anchor);
    let prev = start;
    for (const p of path) {
      const d = Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
      expect(d).toBe(1);
      prev = p;
    }
  });

  it('advanceAlongPath 는 경로를 소진하면 도착으로 표시한다', () => {
    const path = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    const step1 = advanceAlongPath({ x: 0, y: 0 }, path, 1, 1);
    expect(step1.arrived).toBe(false);
    expect(step1.pos).toEqual({ x: 1, y: 0 });

    const step2 = advanceAlongPath(step1.pos, step1.path, 1, 5);
    expect(step2.arrived).toBe(true);
    expect(step2.pos).toEqual({ x: 2, y: 0 });
  });
});
