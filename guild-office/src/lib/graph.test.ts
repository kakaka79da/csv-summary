import { describe, expect, it } from 'vitest';
import { buildRelationshipGraph, layoutForceGraph } from '@/lib/graph';

describe('buildRelationshipGraph', () => {
  it('CEO 는 모든 AI/인간 사원과 관리(manage) 엣지로 연결된다', () => {
    const { nodes, edges } = buildRelationshipGraph({
      ceoName: '대표',
      aiEmployees: [{ id: 'e1', name: '엔지니어' }, { id: 'e2', name: '전략가' }],
      humanStaff: [{ id: 'h1', name: '사원A' }],
      missions: [],
    });
    expect(nodes.map((n) => n.id)).toEqual(['ceo', 'e1', 'e2', 'h1']);
    expect(edges.filter((e) => e.kind === 'manage')).toHaveLength(3);
  });

  it('미션 소유자는 owns, 다른 참여자는 participates 엣지를 갖는다', () => {
    const { edges } = buildRelationshipGraph({
      ceoName: '대표',
      aiEmployees: [{ id: 'e1', name: 'A' }, { id: 'e2', name: 'B' }],
      humanStaff: [],
      missions: [
        { id: 'm1', name: '미션1', ownerId: 'e1', participants: ['e1', 'e2'], steps: [] },
      ],
    });
    expect(edges).toContainEqual({ source: 'e1', target: 'm1', kind: 'owns' });
    expect(edges).toContainEqual({ source: 'e2', target: 'm1', kind: 'participates' });
  });

  it('단계의 handoffTo 는 중복 없이 handoff 엣지로 반영된다', () => {
    const { edges } = buildRelationshipGraph({
      ceoName: '대표',
      aiEmployees: [{ id: 'e1', name: 'A' }, { id: 'e2', name: 'B' }],
      humanStaff: [],
      missions: [
        {
          id: 'm1',
          name: '미션1',
          ownerId: 'e1',
          participants: ['e1', 'e2'],
          steps: [
            { assigneeId: 'e1', handoffTo: 'e2' },
            { assigneeId: 'e2', handoffTo: 'e1' }, // 역방향 — 같은 쌍이므로 중복 배제
          ],
        },
      ],
    });
    expect(edges.filter((e) => e.kind === 'handoff')).toHaveLength(1);
  });
});

describe('layoutForceGraph', () => {
  it('노드 수가 그대로 유지되고 모든 좌표가 뷰포트 안의 유한한 값이다', () => {
    const nodes = [
      { id: 'a', label: 'A', kind: 'ceo' as const },
      { id: 'b', label: 'B', kind: 'ai' as const },
      { id: 'c', label: 'C', kind: 'mission' as const },
    ];
    const edges = [
      { source: 'a', target: 'b', kind: 'manage' as const },
      { source: 'b', target: 'c', kind: 'owns' as const },
    ];
    const laid = layoutForceGraph(nodes, edges, 400, 300);
    expect(laid).toHaveLength(3);
    for (const n of laid) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(400);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(300);
    }
  });

  it('연결된 두 노드가 연결되지 않은 노드보다 평균적으로 더 가깝게 배치된다', () => {
    const nodes = [
      { id: 'a', label: 'A', kind: 'ceo' as const },
      { id: 'b', label: 'B', kind: 'ai' as const },
      { id: 'c', label: 'C', kind: 'ai' as const },
    ];
    const edges = [{ source: 'a', target: 'b', kind: 'manage' as const }];
    const laid = layoutForceGraph(nodes, edges, 500, 500);
    const byId = new Map(laid.map((n) => [n.id, n]));
    const dist = (x: string, y: string) => {
      const p = byId.get(x)!;
      const q = byId.get(y)!;
      return Math.hypot(p.x - q.x, p.y - q.y);
    };
    expect(dist('a', 'b')).toBeLessThan(dist('a', 'c'));
  });

  it('빈 노드 목록에는 빈 배열을 반환한다', () => {
    expect(layoutForceGraph([], [], 400, 300)).toEqual([]);
  });
});
