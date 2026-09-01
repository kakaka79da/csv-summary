/**
 * 관계도(2D 강제 배치 그래프) 계산.
 *
 * 슬랙/옵시디언 그래프 뷰처럼 "누가 누구와 연결되어 있는지"를 보여주기 위한 것으로,
 * 실제로는 별도 3D/그래프 라이브러리를 추가하지 않고 순수 함수로 계산한 좌표를
 * SVG 로 그린다. React 상태와 분리되어 있어 유닛 테스트가 가능하다.
 */

export type RelNodeKind = 'ceo' | 'ai' | 'human' | 'mission';
export type RelEdgeKind = 'manage' | 'owns' | 'participates' | 'handoff';

export interface RelNode {
  id: string;
  label: string;
  kind: RelNodeKind;
}

export interface RelEdge {
  source: string;
  target: string;
  kind: RelEdgeKind;
}

export interface LaidOutNode extends RelNode {
  x: number;
  y: number;
}

/** 대표·AI 직원·인간 사원·미션을 노드로, 관리·소유·참여·인계 관계를 엣지로 만든다. */
export function buildRelationshipGraph(input: {
  ceoName: string;
  aiEmployees: Array<{ id: string; name: string }>;
  humanStaff: Array<{ id: string; name: string }>;
  missions: Array<{
    id: string;
    name: string;
    ownerId: string;
    participants: string[];
    steps: Array<{ assigneeId: string; handoffTo: string | null }>;
  }>;
}): { nodes: RelNode[]; edges: RelEdge[] } {
  const nodes: RelNode[] = [{ id: 'ceo', label: input.ceoName, kind: 'ceo' }];
  const edges: RelEdge[] = [];

  for (const e of input.aiEmployees) {
    nodes.push({ id: e.id, label: e.name, kind: 'ai' });
    edges.push({ source: 'ceo', target: e.id, kind: 'manage' });
  }
  for (const h of input.humanStaff) {
    nodes.push({ id: h.id, label: h.name, kind: 'human' });
    edges.push({ source: 'ceo', target: h.id, kind: 'manage' });
  }

  const seenHandoff = new Set<string>();
  for (const m of input.missions) {
    nodes.push({ id: m.id, label: m.name, kind: 'mission' });
    if (m.ownerId) edges.push({ source: m.ownerId, target: m.id, kind: 'owns' });
    for (const p of m.participants) {
      if (p === m.ownerId) continue;
      edges.push({ source: p, target: m.id, kind: 'participates' });
    }
    for (const s of m.steps) {
      if (!s.handoffTo || s.handoffTo === s.assigneeId) continue;
      const key = [s.assigneeId, s.handoffTo].sort().join('→');
      if (seenHandoff.has(key)) continue;
      seenHandoff.add(key);
      edges.push({ source: s.assigneeId, target: s.handoffTo, kind: 'handoff' });
    }
  }

  return { nodes, edges };
}

/**
 * Fruchterman–Reingold 방식의 아주 단순한 강제 배치 레이아웃.
 * 초기 위치를 인덱스 기반 원형으로 잡아 결정적(deterministic)이며, 매 호출마다
 * 같은 입력에는 같은 좌표를 낸다 — 테스트와 "그릴 때마다 흔들리지 않는" UX 모두를 위해서다.
 */
export function layoutForceGraph(
  nodes: RelNode[],
  edges: RelEdge[],
  width: number,
  height: number,
  iterations = 220,
): LaidOutNode[] {
  if (nodes.length === 0) return [];
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.max(10, Math.min(width, height) * 0.32);

  const laid = nodes.map((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    return { ...n, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), vx: 0, vy: 0 };
  });
  const index = new Map(laid.map((n, i) => [n.id, i]));
  const k = Math.sqrt((width * height) / Math.max(1, nodes.length));

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < laid.length; i++) {
      for (let j = i + 1; j < laid.length; j++) {
        const a = laid[i];
        const b = laid[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    for (const e of edges) {
      const ai = index.get(e.source);
      const bi = index.get(e.target);
      if (ai === undefined || bi === undefined || ai === bi) continue;
      const a = laid[ai];
      const b = laid[bi];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
    const cooling = Math.max(0.03, 1 - iter / iterations);
    const maxStep = Math.max(1, k * 0.12) * cooling;
    for (const n of laid) {
      n.vx += (cx - n.x) * 0.008;
      n.vy += (cy - n.y) * 0.008;
      const disp = Math.sqrt(n.vx * n.vx + n.vy * n.vy) || 0.01;
      n.x += (n.vx / disp) * Math.min(disp, maxStep);
      n.y += (n.vy / disp) * Math.min(disp, maxStep);
      n.vx *= 0.82;
      n.vy *= 0.82;
      n.x = Math.max(24, Math.min(width - 24, n.x));
      n.y = Math.max(24, Math.min(height - 24, n.y));
    }
  }

  return laid.map((n) => ({ id: n.id, label: n.label, kind: n.kind, x: n.x, y: n.y }));
}
