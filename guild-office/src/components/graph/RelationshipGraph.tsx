/**
 * 슬랙/옵시디언 그래프 뷰처럼 대표·AI 직원·인간 사원·미션의 연결을 보여주는 관계도.
 *
 * 실제 3D 라이브러리를 새로 추가하지 않고, 순수 함수(@/lib/graph)로 계산한
 * 2D 강제 배치(force-directed) 좌표를 SVG 로 그린다 — "3D 구성"의 요청을
 * 이 프로젝트 의존성 안에서 구현 가능한 형태로 축소한 것이다.
 */
import { useMemo, useState } from 'react';
import { useWorld } from '@/state/store';
import { buildRelationshipGraph, layoutForceGraph, type RelNodeKind } from '@/lib/graph';
import { downloadCsv } from '@/lib/csv';
import { Button, Notice } from '@/components/ui/primitives';

const WIDTH = 760;
const HEIGHT = 520;

const NODE_COLOR: Record<RelNodeKind, string> = {
  ceo: '#f0cd85',
  ai: '#8fe0bb',
  human: '#8fc4f0',
  mission: '#d8a0e0',
};
const NODE_RADIUS: Record<RelNodeKind, number> = { ceo: 16, ai: 12, human: 12, mission: 9 };
const KIND_LABEL: Record<RelNodeKind, string> = { ceo: '대표', ai: 'AI 직원', human: '인간 사원', mission: '미션' };
const EDGE_STYLE: Record<string, { stroke: string; dash?: string }> = {
  manage: { stroke: '#6a6355' },
  owns: { stroke: '#c9a24a' },
  participates: { stroke: '#5a7a8a', dash: '0.4 0.3' },
  handoff: { stroke: '#d8604f', dash: '0.15 0.2' },
};

export default function RelationshipGraph() {
  const company = useWorld((s) => s.company);
  const employeeOrder = useWorld((s) => s.employeeOrder);
  const employees = useWorld((s) => s.employees);
  const humanStaff = useWorld((s) => s.humanStaff);
  const missionOrder = useWorld((s) => s.missionOrder);
  const missions = useWorld((s) => s.missions);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const approvedStaff = useMemo(
    () => Object.values(humanStaff).filter((r) => r.status === 'approved'),
    [humanStaff],
  );
  const missionList = useMemo(() => missionOrder.map((id) => missions[id]).filter(Boolean), [missionOrder, missions]);

  const { nodes, edges } = useMemo(
    () =>
      buildRelationshipGraph({
        ceoName: company ? company.ceoCharacterName || company.ceoName : '대표',
        aiEmployees: employeeOrder.map((id) => ({ id, name: employees[id]?.name ?? id })),
        humanStaff: approvedStaff.map((r) => ({ id: r.id, name: r.name })),
        missions: missionList.map((m) => ({
          id: m.id,
          name: m.name,
          ownerId: m.ownerId,
          participants: m.participants,
          steps: m.steps.map((s) => ({ assigneeId: s.assigneeId, handoffTo: s.handoffTo })),
        })),
      }),
    [company, employeeOrder, employees, approvedStaff, missionList],
  );

  const laid = useMemo(() => layoutForceGraph(nodes, edges, WIDTH, HEIGHT), [nodes, edges]);
  const byId = useMemo(() => new Map(laid.map((n) => [n.id, n])), [laid]);

  const neighborIds = useMemo(() => {
    if (!hoverId) return null;
    const set = new Set<string>([hoverId]);
    for (const e of edges) {
      if (e.source === hoverId) set.add(e.target);
      if (e.target === hoverId) set.add(e.source);
    }
    return set;
  }, [hoverId, edges]);

  if (!company) return null;

  const exportEdgesCsv = () => {
    downloadCsv(`relationship-graph-${company.name}.csv`, [
      ['출발', '도착', '관계'],
      ...edges.map((e) => [
        byId.get(e.source)?.label ?? e.source,
        byId.get(e.target)?.label ?? e.target,
        { manage: '관리', owns: '소유', participates: '참여', handoff: '인계' }[e.kind] ?? e.kind,
      ]),
    ]);
  };

  return (
    <div className="space-y-3">
      <Notice>
        대표 · AI 직원 · 인간 사원 · 미션을 노드로, 관리·소유·참여·업무 인계 관계를 선으로 표시합니다. 슬랙/옵시디언의
        그래프 뷰와 비슷한 개념이며, 별도 3D 라이브러리 없이 이 화면 안에서 배치를 계산합니다.
      </Notice>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-[11px]">
          {(Object.keys(KIND_LABEL) as RelNodeKind[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: NODE_COLOR[k] }} />
              {KIND_LABEL[k]}
            </span>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          hint="그래프에 그려진 모든 관계(관리·소유·참여·인계)를 CSV 파일로 저장합니다."
          disabled={edges.length === 0}
          onClick={exportEdgesCsv}
        >
          연결 목록 CSV 내보내기
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-700 bg-stone-950/60">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block w-full" role="img" aria-label="관계도">
          {edges.map((e, i) => {
            const a = byId.get(e.source);
            const b = byId.get(e.target);
            if (!a || !b) return null;
            const dim = neighborIds && (!neighborIds.has(e.source) || !neighborIds.has(e.target));
            const style = EDGE_STYLE[e.kind] ?? { stroke: '#6a6355' };
            return (
              <line
                key={`e-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={style.stroke}
                strokeWidth={1.4}
                strokeDasharray={style.dash}
                opacity={dim ? 0.08 : 0.6}
              />
            );
          })}
          {laid.map((n) => {
            const dim = neighborIds && !neighborIds.has(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                opacity={dim ? 0.25 : 1}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId(null)}
                style={{ cursor: 'pointer' }}
              >
                <circle r={NODE_RADIUS[n.kind]} fill={NODE_COLOR[n.kind]} stroke="#12100c" strokeWidth={1.5} />
                <text y={NODE_RADIUS[n.kind] + 12} textAnchor="middle" fontSize={11} fill="#e8e1d3">
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="text-[11px] text-stone-500">
        노드에 마우스를 올리면 직접 연결된 관계만 강조됩니다. 실선 = 관리, 굵은 금색 = 소유, 점선(청록) = 참여,
        점선(적색) = 업무 인계.
      </div>

      {nodes.length <= 1 ? (
        <Notice tone="warn">아직 표시할 연결이 거의 없습니다. AI 직원이 늘어나고 미션이 생기면 그래프가 채워집니다.</Notice>
      ) : null}
    </div>
  );
}
