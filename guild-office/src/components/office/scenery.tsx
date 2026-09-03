/**
 * 오피스 배경 소품 (SVG).
 *
 * 컨셉: 실내 사무실이 아니라 '농장형 오픈에어 캠퍼스'.
 *  - 복도  → 자갈길
 *  - 방     → 목재 데크
 *  - 벽     → 통과할 수 없는 높은 텃밭 화단 (왜 못 지나가는지 그림으로 설명된다)
 *  - 바깥   → 과수원·밭·언덕이 있는 시골 풍경
 *
 * 좌표는 모두 타일 단위이며, 배치는 시드 기반이라 다시 그려도 흔들리지 않는다.
 */
import type { RoomId } from '@/types';

/* ───────────────────────── 시드 기반 난수 ───────────────────────── */

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ─────────────────────────── 팔레트 ─────────────────────────────── */

export const PALETTE = {
  meadow: '#3f6b34',
  meadowDark: '#2f5227',
  field: '#5f8a3c',
  gravel: '#8d8478',
  gravelDark: '#726a5f',
  deck: '#9a6f43',
  deckDark: '#7c5733',
  deckLight: '#b98a56',
  soil: '#5a4230',
  soilDark: '#43301f',
  leaf: '#57a03f',
  leafDark: '#3c7a2c',
  water: '#3f7f9c',
  waterLight: '#5fa5c4',
  wood: '#7b5a36',
  woodDark: '#4f3a22',
  roof: '#8d95a0',
  glass: '#cfe6ef',
  stone: '#8b8579',
};

/* ────────────────────── 바깥 시골 풍경 ─────────────────────────── */

/** 캠퍼스 바깥 여백에 그리는 배경. viewBox 여백(-3 ~ w+3) 안에 들어간다. */
export function Countryside({
  w,
  h,
  margin,
  rightMargin = margin,
  roadEndY,
}: {
  w: number;
  h: number;
  margin: number;
  /** 출근길을 두기 위해 오른쪽만 더 넓게 쓸 때. 기본값은 margin 과 같다. */
  rightMargin?: number;
  /** 출근길이 끝나는 높이. 그 아래는 자택 공간이라 길을 그리지 않는다. */
  roadEndY: number;
}) {
  const r = rng(20260901);
  const orchard: Array<{ x: number; y: number; s: number }> = [];
  // 위/아래 여백에 과수원 나무를 줄지어 심는다
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 26; i++) {
      orchard.push({
        x: -margin + 0.6 + i * 1.5 + r() * 0.3,
        y: -margin + 0.7 + row * 1.25,
        s: 0.8 + r() * 0.35,
      });
    }
  }
  for (let i = 0; i < 26; i++) {
    orchard.push({ x: -margin + 0.6 + i * 1.5 + r() * 0.3, y: h + 1.5 + r() * 0.6, s: 0.8 + r() * 0.3 });
  }
  // 좌/우 여백
  for (let i = 0; i < 12; i++) {
    orchard.push({ x: -margin + 0.9 + r() * 1.4, y: 1 + i * 1.6, s: 0.75 + r() * 0.3 });
    orchard.push({ x: w + 3.1 + r() * 1.3, y: 1 + i * 1.6, s: 0.75 + r() * 0.3 });
  }

  return (
    <g>
      {/* 초지 */}
      <rect x={-margin} y={-margin} width={w + margin + rightMargin} height={h + margin * 2} fill={PALETTE.meadow} />
      {/* 밭이랑 (위쪽 먼 배경) */}
      <g opacity={0.55}>
        {Array.from({ length: 14 }, (_, i) => (
          <rect
            key={`f${i}`}
            x={-margin}
            y={-margin + i * 0.16}
            width={w + margin + rightMargin}
            height={0.08}
            fill={i % 2 ? PALETTE.field : PALETTE.meadowDark}
          />
        ))}
      </g>
      {/* 흙길 — 캠퍼스 오른쪽 위로 빠지는 진입로 */}
      <path
        d={`M ${w + margin} ${-margin + 0.4} C ${w - 2} ${-margin + 1.6}, ${w + 1} ${2}, ${w + margin} ${5}`}
        stroke="#a9906a"
        strokeWidth={0.9}
        fill="none"
        opacity={0.85}
      />
      {/* 출근길 — 캠퍼스 오른쪽을 따라 세로로 난 길. 아직 출근하지 않은 사원이 여기 서 있는다.
          길 아래쪽(roadEndY 아래)은 자택 공간이라 길을 거기서 끊는다. */}
      <g>
        <rect x={w + 0.9} y={-0.5} width={1.5} height={roadEndY + 0.5} rx={0.4} fill="#a9906a" opacity={0.9} />
        <rect x={w + 1.55} y={-0.5} width={0.16} height={roadEndY + 0.5} fill="#e8d9b5" opacity={0.35} />
        {Array.from({ length: Math.max(0, Math.floor(roadEndY / 3)) }).map((_, i) => (
          <rect
            key={`kerb${i}`}
            x={w + 0.72}
            y={i * 3 + 0.6}
            width={0.16}
            height={1.1}
            rx={0.07}
            fill="#8a7350"
            opacity={0.7}
          />
        ))}
      </g>
      {/* 과수원 */}
      {orchard.map((t, i) => (
        <Tree key={`o${i}`} x={t.x} y={t.y} s={t.s} />
      ))}
    </g>
  );
}

export function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={0.5} rx={0.62} ry={0.2} fill="#000" opacity={0.2} />
      <rect x={-0.08} y={-0.1} width={0.16} height={0.62} fill={PALETTE.woodDark} />
      <circle cx={0} cy={-0.42} r={0.62} fill={PALETTE.leafDark} />
      <circle cx={-0.2} cy={-0.55} r={0.42} fill={PALETTE.leaf} />
      <circle cx={0.24} cy={-0.34} r={0.36} fill={PALETTE.leaf} opacity={0.85} />
    </g>
  );
}

/* ───────────────────────── 바닥 재질 ───────────────────────────── */

/** 자갈길 무늬와 데크 나뭇결을 pattern 으로 정의한다. */
export function SceneryDefs() {
  const r = rng(77);
  return (
    <defs>
      <pattern id="gravel" width={1} height={1} patternUnits="userSpaceOnUse">
        <rect width={1} height={1} fill={PALETTE.gravel} />
        {Array.from({ length: 9 }, (_, i) => (
          <circle
            key={i}
            cx={r()}
            cy={r()}
            r={0.035 + r() * 0.03}
            fill={i % 2 ? PALETTE.gravelDark : '#a29888'}
            opacity={0.8}
          />
        ))}
      </pattern>

      <pattern id="deck" width={1} height={0.5} patternUnits="userSpaceOnUse">
        <rect width={1} height={0.5} fill={PALETTE.deck} />
        <rect y={0.46} width={1} height={0.04} fill={PALETTE.deckDark} opacity={0.7} />
        <rect x={0.48} width={0.02} height={0.5} fill={PALETTE.deckDark} opacity={0.35} />
      </pattern>

      <pattern id="water" width={1.6} height={0.8} patternUnits="userSpaceOnUse">
        <rect width={1.6} height={0.8} fill={PALETTE.water} />
        <path d="M0 0.3 q0.4 -0.14 0.8 0 t0.8 0" stroke={PALETTE.waterLight} strokeWidth={0.06} fill="none" opacity={0.7} />
        <path d="M0 0.62 q0.4 -0.14 0.8 0 t0.8 0" stroke={PALETTE.waterLight} strokeWidth={0.05} fill="none" opacity={0.45} />
      </pattern>

      <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#eaf6fb" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#a9cfdd" stopOpacity="0.55" />
      </linearGradient>

      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0.06" />
      </filter>
    </defs>
  );
}

/* ─────────────────── 벽 = 통과 불가 텃밭 화단 ───────────────────── */

/**
 * 벽 타일 하나를 높은 화단으로 그린다.
 * 씨앗값으로 작물 종류를 정해 같은 자리는 항상 같은 모습이 된다.
 */
export function PlanterTile({ x, y }: { x: number; y: number }) {
  const r = rng(x * 73856093 ^ (y * 19349663));
  const kind = Math.floor(r() * 3); // 0 상추, 1 토마토, 2 허브
  const leaves = Array.from({ length: 4 }, () => ({ cx: 0.18 + r() * 0.64, cy: 0.28 + r() * 0.5, s: 0.1 + r() * 0.08 }));
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* 나무 테두리 */}
      <rect width={1} height={1} fill={PALETTE.wood} />
      <rect x={0.08} y={0.08} width={0.84} height={0.84} fill={PALETTE.soil} />
      <rect x={0.08} y={0.08} width={0.84} height={0.1} fill={PALETTE.soilDark} opacity={0.6} />
      {leaves.map((l, i) => (
        <circle
          key={i}
          cx={l.cx}
          cy={l.cy}
          r={l.s}
          fill={kind === 2 ? '#6fbf55' : kind === 1 ? PALETTE.leafDark : PALETTE.leaf}
        />
      ))}
      {kind === 1
        ? leaves.slice(0, 2).map((l, i) => <circle key={`t${i}`} cx={l.cx + 0.06} cy={l.cy - 0.05} r={0.055} fill="#d9503f" />)
        : null}
      {/* 상단 하이라이트 */}
      <rect width={1} height={0.07} fill="#a37c4c" />
    </g>
  );
}

/** 캠퍼스 바깥 테두리는 나무 울타리로 그린다. */
export function FenceTile({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={1} height={1} fill={PALETTE.meadowDark} />
      <rect x={0.12} y={0.18} width={0.14} height={0.72} fill={PALETTE.wood} />
      <rect x={0.72} y={0.18} width={0.14} height={0.72} fill={PALETTE.wood} />
      <rect x={0} y={0.34} width={1} height={0.11} fill={PALETTE.woodDark} />
      <rect x={0} y={0.62} width={1} height={0.11} fill={PALETTE.woodDark} />
    </g>
  );
}

/* ────────────────────────── 공용 소품 ──────────────────────────── */

export function Desk({ x, y, w = 2.2, monitors = 1 }: { x: number; y: number; w?: number; monitors?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={0} width={w} height={0.75} rx={0.08} fill={PALETTE.deckLight} />
      <rect x={0} y={0.62} width={w} height={0.13} fill={PALETTE.deckDark} />
      {Array.from({ length: monitors }, (_, i) => (
        <g key={i} transform={`translate(${0.28 + i * 0.85} 0.02)`}>
          <rect width={0.62} height={0.4} rx={0.04} fill="#1e2430" />
          <rect x={0.04} y={0.05} width={0.54} height={0.28} fill="#39506b" />
          <rect x={0.07} y={0.09} width={0.3} height={0.03} fill="#7fd0a8" />
          <rect x={0.07} y={0.15} width={0.42} height={0.03} fill="#8fb6e8" opacity={0.8} />
          <rect x={0.07} y={0.21} width={0.22} height={0.03} fill="#e0c07a" opacity={0.8} />
          <rect x={0.26} y={0.4} width={0.1} height={0.08} fill="#2a3140" />
        </g>
      ))}
      <rect x={w - 0.42} y={0.42} width={0.3} height={0.16} rx={0.03} fill="#2a3140" />
    </g>
  );
}

export function Planter({ x, y, w = 1, h = 0.6 }: { x: number; y: number; w?: number; h?: number }) {
  const r = rng(Math.round(x * 31 + y * 17));
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={0.06} fill={PALETTE.wood} />
      <rect x={0.06} y={0.06} width={w - 0.12} height={h - 0.12} fill={PALETTE.soil} />
      {Array.from({ length: Math.max(3, Math.round(w * 3)) }, (_, i) => (
        <circle key={i} cx={0.15 + r() * (w - 0.3)} cy={0.14 + r() * (h - 0.24)} r={0.09} fill={PALETTE.leaf} />
      ))}
    </g>
  );
}

export function PottedPlant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-0.16 0 L0.16 0 L0.12 0.28 L-0.12 0.28 Z" fill="#b4623c" />
      <circle cx={0} cy={-0.12} r={0.2} fill={PALETTE.leafDark} />
      <circle cx={-0.1} cy={-0.2} r={0.13} fill={PALETTE.leaf} />
      <circle cx={0.11} cy={-0.16} r={0.11} fill={PALETTE.leaf} />
    </g>
  );
}

export function Pergola({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const beams = Math.max(2, Math.round(w / 1.1));
  return (
    <g transform={`translate(${x} ${y})`} opacity={0.9}>
      {Array.from({ length: beams }, (_, i) => (
        <rect key={i} x={(i * w) / beams + 0.15} y={0} width={0.16} height={h} fill={PALETTE.wood} opacity={0.55} />
      ))}
      <rect x={0} y={0} width={w} height={0.18} fill={PALETTE.woodDark} opacity={0.75} />
      <rect x={0} y={h - 0.18} width={w} height={0.18} fill={PALETTE.woodDark} opacity={0.75} />
    </g>
  );
}

export function Greenhouse({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const ribs = Math.max(3, Math.round(w / 1.2));
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={0.5} fill="url(#glass)" />
      {Array.from({ length: ribs }, (_, i) => (
        <rect key={i} x={((i + 1) * w) / (ribs + 1)} y={0.08} width={0.07} height={h - 0.16} fill="#8fb2bf" opacity={0.8} />
      ))}
      <rect y={0.08} width={w} height={0.07} fill="#8fb2bf" opacity={0.9} />
      <rect y={h - 0.15} width={w} height={0.07} fill="#8fb2bf" opacity={0.9} />
    </g>
  );
}

export function Pond({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={PALETTE.stone} />
      <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 0.16} ry={h / 2 - 0.16} fill="url(#water)" />
      <ellipse cx={w / 2 - 0.3} cy={h / 2 - 0.25} rx={0.28} ry={0.14} fill="#8fe0f0" opacity={0.35} />
    </g>
  );
}

export function Bench({ x, y, w = 1.2 }: { x: number; y: number; w?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={0.26} rx={0.06} fill={PALETTE.deckLight} />
      <rect y={0.26} width={0.12} height={0.2} fill={PALETTE.woodDark} />
      <rect x={w - 0.12} y={0.26} width={0.12} height={0.2} fill={PALETTE.woodDark} />
    </g>
  );
}

export function FirePit({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={0.42} fill={PALETTE.stone} />
      <circle r={0.28} fill="#3a2a20" />
      <path d="M-0.12 0.1 Q0 -0.22 0.12 0.1 Q0 0.02 -0.12 0.1 Z" fill="#e08a3c" />
      <path d="M-0.06 0.1 Q0 -0.1 0.06 0.1 Z" fill="#f5d06a" />
    </g>
  );
}

export function Shed({ x, y, w = 1.6, h = 1.2, tone = PALETTE.wood }: { x: number; y: number; w?: number; h?: number; tone?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect y={0.28} width={w} height={h - 0.28} fill={tone} />
      <path d={`M-0.12 0.32 L${w / 2} -0.05 L${w + 0.12} 0.32 Z`} fill={PALETTE.roof} />
      <rect x={w / 2 - 0.22} y={h - 0.62} width={0.44} height={0.62} fill={PALETTE.woodDark} />
    </g>
  );
}

export function SolarPanel({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={1.1} height={0.62} rx={0.05} fill="#22364d" />
      {Array.from({ length: 3 }, (_, i) => (
        <rect key={i} x={0.06 + i * 0.34} y={0.06} width={0.28} height={0.5} fill="#3f6ea3" />
      ))}
      <rect x={0.5} y={0.62} width={0.1} height={0.24} fill="#4a4a4a" />
    </g>
  );
}

export function Tractor({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0.28} y={0.1} width={0.9} height={0.42} rx={0.08} fill="#c0392b" />
      <rect x={0.62} y={-0.16} width={0.42} height={0.34} rx={0.06} fill="#a93226" />
      <circle cx={0.42} cy={0.62} r={0.26} fill="#2b2b2b" />
      <circle cx={0.42} cy={0.62} r={0.1} fill="#8d8d8d" />
      <circle cx={1.06} cy={0.66} r={0.2} fill="#2b2b2b" />
      <circle cx={1.06} cy={0.66} r={0.08} fill="#8d8d8d" />
    </g>
  );
}

export function ToolRack({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={1.1} height={0.12} fill={PALETTE.woodDark} />
      {[0.18, 0.48, 0.78].map((cx, i) => (
        <g key={i}>
          <rect x={cx} y={0.12} width={0.06} height={0.62} fill="#8a6a44" />
          <rect x={cx - 0.06} y={0.72} width={0.18} height={0.14} fill={i === 1 ? '#6f7b86' : '#4b5560'} />
        </g>
      ))}
    </g>
  );
}

export function Hammock({ x, y, w = 1.6 }: { x: number; y: number; w?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 0 Q ${w / 2} 0.7 ${w} 0`} stroke="#d8c9a8" strokeWidth={0.22} fill="none" strokeLinecap="round" />
      <path d={`M0 0 Q ${w / 2} 0.55 ${w} 0`} stroke="#b9a681" strokeWidth={0.06} fill="none" />
    </g>
  );
}

export function Crate({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect width={0.6} height={0.46} rx={0.05} fill="#8a6a44" />
      <rect y={0.18} width={0.6} height={0.07} fill={PALETTE.woodDark} />
      <rect x={0.26} width={0.07} height={0.46} fill={PALETTE.woodDark} opacity={0.6} />
    </g>
  );
}

/* ─────────────────────── 방별 소품 배치 ────────────────────────── */

export function RoomScenery({ id, rect }: { id: RoomId; rect: { x: number; y: number; w: number; h: number } }) {
  const { x, y, w, h } = rect;
  switch (id) {
    case 'ceo_office':
      return (
        <g>
          <Pergola x={x + 1} y={y + 1} w={w - 2} h={h - 2} />
          <Desk x={x + 3.1} y={y + 1.3} w={2.4} monitors={2} />
          <PottedPlant x={x + 1.6} y={y + 4.4} s={1.15} />
          <PottedPlant x={x + 7.3} y={y + 4.4} s={0.95} />
          <Crate x={x + 6.6} y={y + 3.4} s={0.9} />
        </g>
      );
    case 'lab':
      return (
        <g>
          <Greenhouse x={x + 0.7} y={y + 1.1} w={w - 1.4} h={h - 2.2} />
          <Desk x={x + 3.4} y={y + 3.3} w={2.2} monitors={2} />
          <Planter x={x + 1.2} y={y + 3.6} w={1.6} h={0.8} />
          <PottedPlant x={x + 7.2} y={y + 4.5} s={0.9} />
        </g>
      );
    case 'sales_room':
      return (
        <g>
          <Desk x={x + 1.3} y={y + 3.2} w={2.4} monitors={1} />
          <Desk x={x + 4.6} y={y + 3.2} w={2.4} monitors={2} />
          <Planter x={x + 1.2} y={y + 4.6} w={5.8} h={0.7} />
          <PottedPlant x={x + 7.5} y={y + 3.1} s={1.05} />
        </g>
      );
    case 'meeting':
      return (
        <g>
          <Pergola x={x + 0.6} y={y + 0.7} w={w - 1.2} h={h - 1.4} />
          <PottedPlant x={x + 1.6} y={y + 2.6} s={1} />
          <PottedPlant x={x + 9.3} y={y + 2.6} s={1} />
        </g>
      );
    case 'admin_desk':
      return (
        <g>
          <Desk x={x + 3.1} y={y + 2.6} w={2.2} monitors={1} />
          <Crate x={x + 1.3} y={y + 4.2} s={1} />
          <Crate x={x + 2.1} y={y + 4.2} s={1} />
          <PottedPlant x={x + 6.4} y={y + 2.4} s={0.95} />
          <Planter x={x + 4.6} y={y + 4.1} w={2.2} h={0.7} />
        </g>
      );
    case 'api_room':
      return (
        <g>
          <Shed x={x + 0.6} y={y + 1.2} w={1.6} h={1.4} tone="#5f7a86" />
          <SolarPanel x={x + 2.5} y={y + 1.4} />
          <ToolRack x={x + 1.1} y={y + 3.4} />
          {/* 케이블 = 마력 코어 연결 */}
          <path
            d={`M ${x + 1.4} ${y + 2.7} q 1.2 0.9 2.4 0.2`}
            stroke="#4aa3c8"
            strokeWidth={0.09}
            fill="none"
            opacity={0.8}
          />
        </g>
      );
    case 'lounge':
      return (
        <g>
          <Tree x={x + 1.6} y={y + 2.1} s={1.25} />
          <Hammock x={x + 2.3} y={y + 2.4} w={2.1} />
          <Bench x={x + 1.1} y={y + 3.9} w={1.5} />
          <Bench x={x + 3.4} y={y + 3.9} w={1.5} />
          <FirePit x={x + 2.9} y={y + 3.3} />
          <PottedPlant x={x + 4.6} y={y + 2.2} s={0.95} />
        </g>
      );
    case 'fishing':
      return (
        <g>
          <Pond x={x + 0.7} y={y + 1.2} w={w - 1.4} h={h - 2.2} />
          {/* 부교 */}
          <rect x={x + 1.2} y={y + 2.6} width={1.5} height={0.5} rx={0.06} fill={PALETTE.deckLight} />
          {/* 갈대 */}
          {[0.9, 1.25, 1.6].map((dx, i) => (
            <path
              key={i}
              d={`M ${x + dx} ${y + 4.6} q 0.1 -0.7 0.03 -1.1`}
              stroke="#7fae4a"
              strokeWidth={0.08}
              fill="none"
            />
          ))}
        </g>
      );
    case 'training':
      return (
        <g>
          <ellipse cx={x + w / 2} cy={y + h / 2 + 0.1} rx={w / 2 - 0.8} ry={h / 2 - 0.7} fill="#9c8560" opacity={0.75} />
          <Tractor x={x + 1.1} y={y + 1.5} />
          <Crate x={x + 1.2} y={y + 2.6} s={0.85} />
        </g>
      );
    case 'dungeon_gate':
      return (
        <g>
          {/* 봉인된 돌문 */}
          <path
            d={`M ${x + 1.3} ${y + 3.1} L ${x + 1.3} ${y + 1.7} Q ${x + 2.5} ${y + 0.9} ${x + 3.7} ${y + 1.7} L ${x + 3.7} ${y + 3.1} Z`}
            fill="#2c2130"
            stroke="#6b4a55"
            strokeWidth={0.12}
          />
          <path
            d={`M ${x + 1.7} ${y + 3.1} L ${x + 1.7} ${y + 2} Q ${x + 2.5} ${y + 1.4} ${x + 3.3} ${y + 2} L ${x + 3.3} ${y + 3.1} Z`}
            fill="#1a1220"
          />
          <Tree x={x + 0.8} y={y + 3.3} s={0.95} />
          <Tree x={x + 4.2} y={y + 3.3} s={0.85} />
        </g>
      );
    default:
      return null;
  }
}
