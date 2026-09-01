/**
 * 2D 탑다운 오피스 뷰 (SVG).
 *
 * 렌더링은 상태를 읽기만 한다. 캐릭터 위치·상태는 스토어의 tick 이 계산하며,
 * 여기서는 그 값을 그리기만 하므로 "보이는 것"과 "실제"가 어긋날 수 없다.
 *
 * 그리는 순서가 중요하다: 바닥 → 방 바닥 → 벽 → 가구 → 문 → 방 이름 → 캐릭터.
 * (방 이름을 벽보다 먼저 그리면 벽에 가려 읽을 수 없다)
 */
import { motion } from 'framer-motion';
import { FURNITURE, OFFICE_H, OFFICE_W, ROOMS } from '@/data/seed';
import { GRID } from '@/data/world';
import { useWorld } from '@/state/store';
import CharacterSprite from '@/components/office/CharacterSprite';
import { AGENT_STATE_LABEL } from '@/lib/format';
import type { Company } from '@/types';

const SPRITE_W = 1.5;
const SPRITE_H = 1.8;
const SX = SPRITE_W / 24;
const SY = SPRITE_H / 28;

/** 대표 캐릭터가 서는 자리 (집무실 안, 책상 오른쪽) */
const CEO_SPOT = { x: 7.4, y: 4.2 };

const CEO_PALETTE: Record<Company['ceoAppearance'], { robe: string; trim: string; aura: string }> = {
  sovereign: { robe: '#8a2f3f', trim: '#d9a441', aura: '#f0cd85' },
  warden: { robe: '#2f4a6b', trim: '#c9d3e0', aura: '#8fc4f0' },
  seer: { robe: '#4a3a6b', trim: '#c7b3f0', aura: '#a99cf0' },
  artificer: { robe: '#3f5a3a', trim: '#d9c184', aura: '#8fe0bb' },
};

/** 글자가 어두운 배경에 묻히지 않도록 외곽선을 깔아 준다. */
const OUTLINED = {
  stroke: '#0d0b0f',
  strokeWidth: 0.16,
  paintOrder: 'stroke' as const,
  strokeLinejoin: 'round' as const,
};

export default function OfficeCanvas() {
  const employees = useWorld((s) => s.employees);
  const order = useWorld((s) => s.employeeOrder);
  const company = useWorld((s) => s.company);
  const selectedId = useWorld((s) => s.ui.selectedEmployeeId);
  const select = useWorld((s) => s.selectEmployee);

  // 가구 타일은 벽과 구분해서 칠하기 위해 따로 모아 둔다.
  const furnitureKeys = new Set(FURNITURE.flatMap((f) => f.tiles.map((t) => `${t.x},${t.y}`)));
  const walls: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < OFFICE_H; y++) {
    for (let x = 0; x < OFFICE_W; x++) {
      if (GRID.blocked[y * OFFICE_W + x] === 1 && !furnitureKeys.has(`${x},${y}`)) walls.push({ x, y });
    }
  }

  return (
    <div className="panel overflow-hidden">
      <svg viewBox={`0 0 ${OFFICE_W} ${OFFICE_H}`} className="block w-full" role="img" aria-label="오피스 평면도">
        {/* 복도 바닥 */}
        <rect x={0} y={0} width={OFFICE_W} height={OFFICE_H} fill="#241f31" />
        <g opacity={0.2}>
          {Array.from({ length: OFFICE_W + 1 }, (_, i) => (
            <line key={`v${i}`} x1={i} y1={0} x2={i} y2={OFFICE_H} stroke="#4a4258" strokeWidth={0.02} />
          ))}
          {Array.from({ length: OFFICE_H + 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={i} x2={OFFICE_W} y2={i} stroke="#4a4258" strokeWidth={0.02} />
          ))}
        </g>

        {/* 방 바닥 */}
        {ROOMS.map((room) => (
          <rect
            key={`floor-${room.id}`}
            x={room.rect.x}
            y={room.rect.y}
            width={room.rect.w}
            height={room.rect.h}
            fill={room.id === 'dungeon_gate' ? '#4a2839' : '#3a3150'}
          />
        ))}

        {/* 벽 */}
        {walls.map((w) => (
          <rect key={`w-${w.x}-${w.y}`} x={w.x} y={w.y} width={1} height={1} fill="#100d17" />
        ))}

        {/* 가구 (벽과 다른 색으로 구분) */}
        {FURNITURE.flatMap((f) =>
          f.tiles.map((t) => (
            <rect key={`f-${t.x}-${t.y}`} x={t.x} y={t.y} width={1} height={1} rx={0.12} fill="#6b5535" />
          )),
        )}

        {/* 문 */}
        {ROOMS.map((room) => (
          <rect
            key={`door-${room.id}`}
            x={room.door.x + 0.12}
            y={room.door.y + 0.12}
            width={0.76}
            height={0.76}
            rx={0.16}
            fill="none"
            stroke="#d9a441"
            strokeWidth={0.08}
            opacity={0.65}
          />
        ))}

        {/* 던전 입구 표식 */}
        <motion.circle
          cx={3}
          cy={10.4}
          r={0.9}
          fill="#d8604f"
          animate={{ opacity: [0.15, 0.4, 0.15] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />

        {/* 방 이름 (벽 위에 그린다) */}
        {ROOMS.map((room) => (
          <g key={`label-${room.id}`}>
            <text
              x={room.rect.x + room.rect.w / 2}
              y={room.rect.y + 1.75}
              textAnchor="middle"
              fontSize={0.52}
              fill="#cfc6dd"
              {...OUTLINED}
            >
              {room.name}
            </text>
            <text
              x={room.rect.x + room.rect.w / 2}
              y={room.rect.y + 2.35}
              textAnchor="middle"
              fontSize={0.38}
              fill="#8d84a0"
              {...OUTLINED}
            >
              {room.flavor}
            </text>
          </g>
        ))}

        {/* 가구 이름 */}
        {FURNITURE.map((f) => (
          <text
            key={f.label}
            x={f.tiles[0].x + 0.1}
            y={f.tiles[0].y + 1.55}
            fontSize={0.32}
            fill="#b8a47c"
            {...OUTLINED}
          >
            {f.label}
          </text>
        ))}

        {/* 대표 캐릭터 (고정 위치) */}
        {company ? (
          <g transform={`translate(${CEO_SPOT.x - SPRITE_W / 2}, ${CEO_SPOT.y - SPRITE_H + 0.5})`}>
            <g transform={`scale(${SX} ${SY})`}>
              <CharacterSprite palette={CEO_PALETTE[company.ceoAppearance]} sigil="♛" state="idle" />
            </g>
            <text
              x={SPRITE_W / 2}
              y={SPRITE_H + 0.42}
              textAnchor="middle"
              fontSize={0.4}
              fill="#d9a441"
              {...OUTLINED}
            >
              {company.ceoCharacterName} · 대표
            </text>
          </g>
        ) : null}

        {/* AI 직원 */}
        {order.map((id) => {
          const emp = employees[id];
          if (!emp) return null;
          const selected = selectedId === id;
          const label = AGENT_STATE_LABEL[emp.state];
          // 휴게실 등에서 여러 명이 같은 칸에 겹쳐 보이지 않도록 아주 작은 오프셋을 준다
          const slot = order.indexOf(id);
          const nudge = (slot - 1) * 0.55;
          const labelDy = (slot % 2) * 0.44;
          return (
            // 위치는 transform 속성으로 직접 지정한다.
            // framer-motion 의 x/y 는 SVG 에서 CSS 픽셀로 해석되어 viewBox 단위와 어긋난다.
            <g
              key={id}
              transform={`translate(${emp.pos.x - SPRITE_W / 2 + nudge} ${emp.pos.y - SPRITE_H + 0.5})`}
              onClick={() => select(id)}
              style={{ cursor: 'pointer' }}
            >
              {selected ? (
                <circle
                  cx={SPRITE_W / 2}
                  cy={SPRITE_H - 0.15}
                  r={1.05}
                  fill="none"
                  stroke="#d9a441"
                  strokeWidth={0.09}
                />
              ) : null}
              <g transform={`scale(${SX} ${SY})`}>
                <CharacterSprite palette={emp.palette} sigil={emp.sigil} state={emp.state} />
              </g>
              <text
                x={SPRITE_W / 2}
                y={SPRITE_H + 0.4 + labelDy}
                textAnchor="middle"
                fontSize={0.4}
                fill="#efe9f8"
                {...OUTLINED}
              >
                {emp.name}
              </text>
              <text
                x={SPRITE_W / 2}
                y={SPRITE_H + 0.85 + labelDy}
                textAnchor="middle"
                fontSize={0.33}
                fill="#a89fbb"
                {...OUTLINED}
              >
                {label.game}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 범례 — 게임 표현과 실제 의미를 연결한다 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-800 px-3 py-2 text-[10px] text-stone-500">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: '#544869' }} />
          벽
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: '#6b5535' }} />
          가구 (통과 불가)
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm border align-middle" style={{ borderColor: '#d9a441' }} />
          출입구
        </span>
        <span>캐릭터 아래 표시는 현재 상태이며, 상세 의미는 직원 패널에서 확인할 수 있습니다.</span>
      </div>
    </div>
  );
}
