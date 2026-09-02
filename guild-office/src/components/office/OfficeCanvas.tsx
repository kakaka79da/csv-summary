/**
 * 오피스 뷰 (SVG, 2D 탑다운).
 *
 * 컨셉은 '농장형 오픈에어 캠퍼스'다. 실내 칸막이 대신 목재 데크와 텃밭 화단으로
 * 공간을 나누고, 캠퍼스 바깥에는 과수원과 밭이 이어진다.
 *
 * 렌더링은 상태를 읽기만 한다. 캐릭터 위치·상태는 스토어의 tick 이 계산하며,
 * 여기서는 그 값을 그리기만 하므로 "보이는 것"과 "실제"가 어긋날 수 없다.
 *
 * 그리는 순서: 시골 배경 → 자갈길 → 방 데크 → 방 소품 → 화단/울타리(벽) →
 *              가구 → 출입구 → 방 이름 → 캐릭터.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { EMPLOYEE_APPEARANCES, FURNITURE, OFFICE_H, OFFICE_W, ROOMS } from '@/data/seed';
import { GRID } from '@/data/world';
import { useWorld } from '@/state/store';
import CharacterSprite from '@/components/office/CharacterSprite';
import PriorityMeetingModal from '@/components/office/PriorityMeetingModal';
import {
  Countryside,
  FenceTile,
  PALETTE,
  PlanterTile,
  RoomScenery,
  SceneryDefs,
} from '@/components/office/scenery';
import { AGENT_STATE_LABEL } from '@/lib/format';
import type { Company, Message, RoomId } from '@/types';

const SPRITE_W = 1.5;
const SPRITE_H = 1.8;
const SX = SPRITE_W / 24;
const SY = SPRITE_H / 28;
/** 캠퍼스 바깥으로 보여 줄 시골 풍경의 여백 (타일) */
const MARGIN = 3;
/** 오른쪽은 출근길과 이름표가 들어가야 해서 더 넓게 잡는다. */
const RIGHT_MARGIN = 6;

/** 말풍선이 떠 있는 시간(ms). 이 시간이 지난 대사는 더 이상 보여주지 않는다. */
export const BUBBLE_MS = 7000;

/** 말풍선용으로 한 줄, 짧게 자른다. */
export function bubbleText(text: string, max = 34): string {
  const oneLine = text.replace(/\s*\n+\s*/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/** 이 직원 스레드에서 가장 최근에 "직원 자신"이 남긴 대사(최근 것만). */
export function ownBubble(msgs: Message[] | undefined, now: number): { text: string; warn: boolean } | null {
  if (!msgs || msgs.length === 0) return null;
  const last = msgs[msgs.length - 1];
  if (last.from === 'ceo' || now - last.ts > BUBBLE_MS) return null;
  return { text: bubbleText(last.text), warn: last.kind === 'warning' };
}

/** 모든 직원 스레드를 통틀어 대표가 가장 최근에 남긴 대사. */
export function ceoBubble(chats: Record<string, Message[]>, ids: string[], now: number): string | null {
  let best: Message | null = null;
  for (const id of ids) {
    const arr = chats[id];
    if (!arr || arr.length === 0) continue;
    const last = arr[arr.length - 1];
    if (last.from !== 'ceo') continue;
    if (!best || last.ts > best.ts) best = last;
  }
  if (!best || now - best.ts > BUBBLE_MS) return null;
  return bubbleText(best.text);
}

/** 대표 캐릭터가 서는 자리 (집무실 안, 책상 오른쪽) */
const CEO_SPOT = { x: 7.4, y: 4.2 };

const CEO_PALETTE: Record<Company['ceoAppearance'], { robe: string; trim: string; aura: string }> = {
  sovereign: { robe: '#252a4d', trim: '#c9a24a', aura: '#f0cd85' },
  warden: { robe: '#1f3348', trim: '#c2ccd8', aura: '#8fc4f0' },
  seer: { robe: '#3a2a52', trim: '#cbb2ea', aura: '#a99cf0' },
  artificer: { robe: '#24402f', trim: '#cbb27a', aura: '#8fe0bb' },
};

/** 방마다 데크 위에 얹는 옅은 색조 */
const DECK_TINT: Record<RoomId, string> = {
  ceo_office: '#c08a3f',
  lab: '#5fa88f',
  sales_room: '#a9793f',
  meeting: '#9c7b4a',
  admin_desk: '#8f7bb5',
  api_room: '#5f7a86',
  lounge: '#6ea84f',
  fishing: '#4f8fa8',
  training: '#a08a5c',
  dungeon_gate: '#7a3d52',
};

/** 통과 불가 가구를 종류에 맞게 그린다. */
function FurnitureTile({ x, y, room }: { x: number; y: number; room: RoomId }) {
  const body: Record<string, string> = {
    ceo_office: '#7a5a36',
    lab: '#6f8790',
    sales_room: '#7a5a36',
    meeting: '#8a6a44',
    admin_desk: '#6a5f7a',
    lounge: '#8a5340',
    fishing: PALETTE.water,
  };
  const fill = body[room] ?? '#7a5a36';
  if (room === 'fishing') {
    return <rect x={x} y={y} width={1} height={1} fill="url(#water)" />;
  }
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={1} height={1} rx={0.1} fill={fill} />
      <rect y={0.72} width={1} height={0.28} rx={0.08} fill="#000" opacity={0.18} />
      <rect x={0.12} y={0.16} width={0.76} height={0.34} rx={0.06} fill="#fff" opacity={0.12} />
    </g>
  );
}

/** 휴게실(라운지) 안에서 출근한 인간 사원이 서 있는 자리들 — 실제 이동/경로탐색과 무관한 장식용 고정 좌표 */
const HUMAN_LOUNGE_SPOTS = [
  { x: 19.2, y: 14.6 },
  { x: 21, y: 14.6 },
  { x: 22.8, y: 14.6 },
  { x: 19.2, y: 17.4 },
  { x: 21, y: 17.4 },
  { x: 22.8, y: 17.4 },
];

/**
 * 아직 출근하지 않은(not_started) 인간 사원은 캠퍼스 오른쪽 "출근길" 위에 세워 둔다 —
 * 아직 사무실 안으로 들어오지 않았다는 뜻이다. GRID/경로탐색과는 무관한 장식용 좌표다.
 */
const HUMAN_WAITING_SPOTS = [
  { x: OFFICE_W + 1.65, y: 4 },
  { x: OFFICE_W + 1.65, y: 7.2 },
  { x: OFFICE_W + 1.65, y: 10.4 },
  { x: OFFICE_W + 1.65, y: 13.6 },
  { x: OFFICE_W + 1.65, y: 16.8 },
];

export default function OfficeCanvas() {
  const employees = useWorld((s) => s.employees);
  const order = useWorld((s) => s.employeeOrder);
  const company = useWorld((s) => s.company);
  const chats = useWorld((s) => s.chats);
  const humanStaff = useWorld((s) => s.humanStaff);
  const selectedId = useWorld((s) => s.ui.selectedEmployeeId);
  const select = useWorld((s) => s.selectEmployee);
  const sendToRoom = useWorld((s) => s.sendEmployeeToRoom);
  const setToast = useWorld((s) => s.setToast);
  const [meetingOpen, setMeetingOpen] = useState(false);

  // 대사 말풍선은 실제 벽시계 시각 기준으로 사라지므로 렌더링 때마다 다시 계산한다.
  // 시뮬레이션이 도는 동안은 매 프레임 다시 그려지므로 자연스럽게 옅어지듯 사라진다.
  const now = Date.now();
  const ceoLine = company ? ceoBubble(chats, order, now) : null;

  const handleRoomDoubleClick = (roomId: RoomId) => {
    if (roomId === 'meeting') {
      setMeetingOpen(true);
      return;
    }
    if (!selectedId) {
      setToast('먼저 오피스에서 직원을 클릭해 선택한 뒤, 보낼 방을 더블클릭하세요.');
      return;
    }
    sendToRoom(selectedId, roomId);
  };

  // 인간 사원 — 승인된 인원만, 재택 근무는 지도에 그리지 않고 조직 패널에만 표시한다.
  const approvedStaff = Object.values(humanStaff).filter((r) => r.status === 'approved');
  const officeStaff = approvedStaff.filter((r) => r.workMode === 'office');
  const waitingStaff = approvedStaff.filter((r) => r.workMode === 'not_started');

  // 가구 타일은 벽과 구분해서 칠하기 위해 따로 모아 둔다.
  const furnitureByKey = new Map<string, RoomId>();
  for (const f of FURNITURE) for (const t of f.tiles) furnitureByKey.set(`${t.x},${t.y}`, f.room);

  const fences: Array<{ x: number; y: number }> = [];
  const planters: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < OFFICE_H; y++) {
    for (let x = 0; x < OFFICE_W; x++) {
      if (GRID.blocked[y * OFFICE_W + x] !== 1) continue;
      if (furnitureByKey.has(`${x},${y}`)) continue;
      const onBorder = x === 0 || y === 0 || x === OFFICE_W - 1 || y === OFFICE_H - 1;
      (onBorder ? fences : planters).push({ x, y });
    }
  }

  return (
    <div className="panel overflow-hidden">
      <svg
        viewBox={`${-MARGIN} ${-MARGIN} ${OFFICE_W + MARGIN + RIGHT_MARGIN} ${OFFICE_H + MARGIN * 2}`}
        className="block w-full"
        role="img"
        aria-label="오피스 평면도"
      >
        <SceneryDefs />

        {/* 바깥 시골 풍경 */}
        <Countryside w={OFFICE_W} h={OFFICE_H} margin={MARGIN} rightMargin={RIGHT_MARGIN} />

        {/* 캠퍼스 바닥 = 자갈길 */}
        <rect x={0} y={0} width={OFFICE_W} height={OFFICE_H} fill="url(#gravel)" />

        {/* 방 = 목재 데크 */}
        {ROOMS.map((room) => (
          <g key={`deck-${room.id}`}>
            <rect
              x={room.rect.x}
              y={room.rect.y}
              width={room.rect.w}
              height={room.rect.h}
              fill="url(#deck)"
            />
            <rect
              x={room.rect.x}
              y={room.rect.y}
              width={room.rect.w}
              height={room.rect.h}
              fill={DECK_TINT[room.id]}
              opacity={room.id === 'dungeon_gate' ? 0.42 : 0.2}
            />
          </g>
        ))}

        {/* 방별 소품 */}
        {ROOMS.map((room) => (
          <RoomScenery key={`prop-${room.id}`} id={room.id} rect={room.rect} />
        ))}

        {/* 벽 — 안쪽은 통과 불가 텃밭 화단, 바깥 테두리는 나무 울타리 */}
        {planters.map((p) => (
          <PlanterTile key={`p-${p.x}-${p.y}`} x={p.x} y={p.y} />
        ))}
        {fences.map((p) => (
          <FenceTile key={`fc-${p.x}-${p.y}`} x={p.x} y={p.y} />
        ))}

        {/* 가구 (통과 불가) */}
        {[...furnitureByKey.entries()].map(([key, room]) => {
          const [fx, fy] = key.split(',').map(Number);
          return <FurnitureTile key={`fu-${key}`} x={fx} y={fy} room={room} />;
        })}

        {/* 출입구 — 화단 사이의 문기둥 */}
        {ROOMS.map((room) => (
          <g key={`door-${room.id}`}>
            <rect x={room.door.x} y={room.door.y} width={1} height={1} fill="url(#deck)" opacity={0.55} />
            <rect x={room.door.x} y={room.door.y - 0.06} width={1} height={0.16} rx={0.06} fill={PALETTE.woodDark} />
            <rect x={room.door.x} y={room.door.y + 0.9} width={1} height={0.16} rx={0.06} fill={PALETTE.woodDark} />
          </g>
        ))}

        {/* 던전 입구의 붉은 기운 */}
        <motion.ellipse
          cx={3}
          cy={10.4}
          rx={1.4}
          ry={0.9}
          fill="#d8604f"
          animate={{ opacity: [0.12, 0.34, 0.12] }}
          transition={{ duration: 2.6, repeat: Infinity }}
        />

        {/* 방 이름 표지판 */}
        {ROOMS.map((room) => {
          const cx = room.rect.x + room.rect.w / 2;
          const cy = room.rect.y + 0.9;
          const label = room.name;
          const wSign = Math.max(2.6, label.length * 0.42 + 0.9);
          return (
            <g key={`label-${room.id}`}>
              <rect
                x={cx - wSign / 2}
                y={cy - 0.52}
                width={wSign}
                height={1.02}
                rx={0.14}
                fill="#241a12"
                opacity={0.82}
              />
              <rect
                x={cx - wSign / 2}
                y={cy - 0.52}
                width={wSign}
                height={1.02}
                rx={0.14}
                fill="none"
                stroke={PALETTE.deckLight}
                strokeWidth={0.05}
                opacity={0.8}
              />
              <text x={cx} y={cy - 0.06} textAnchor="middle" fontSize={0.46} fill="#f4e9d8">
                {label}
              </text>
              <text x={cx} y={cy + 0.38} textAnchor="middle" fontSize={0.32} fill="#b9a98f">
                {room.flavor}
              </text>
            </g>
          );
        })}

        {/* 방 더블클릭 — 벽·가구·표지판보다 위, 캐릭터보다는 아래에 그려서
            방 어디를 눌러도 걸리고, 캐릭터 클릭은 그대로 우선한다.
            회의 테이블: 언제나 더블클릭하면 우선순위 회의 소집.
            다른 방: 먼저 직원을 선택한 뒤 더블클릭하면 그 방으로 보낸다.
            대표 집무실로 보내면 도착을 기다리지 않고 바로 1:1 면담 패널이 열린다. */}
        {ROOMS.map((room) => {
          const isMeeting = room.id === 'meeting';
          const hint = isMeeting
            ? '더블클릭 — 우선순위 회의 소집 (지금 자유 상태인 직원을 모읍니다)'
            : room.id === 'ceo_office'
              ? '더블클릭 — 선택한 직원을 대표 집무실로 불러 1:1 면담을 시작합니다'
              : `더블클릭 — 선택한 직원을 ${room.name}(으)로 보냅니다`;
          const showHint = isMeeting || selectedId;
          return (
            <g
              key={`send-${room.id}`}
              onDoubleClick={() => handleRoomDoubleClick(room.id)}
              style={{ cursor: 'pointer' }}
              role="button"
              aria-label={hint}
            >
              <title>{hint}</title>
              <rect x={room.rect.x} y={room.rect.y} width={room.rect.w} height={room.rect.h} fill="transparent" />
              {showHint ? (
                <motion.rect
                  x={room.rect.x + 0.15}
                  y={room.rect.y + 0.15}
                  width={room.rect.w - 0.3}
                  height={room.rect.h - 0.3}
                  rx={0.3}
                  fill="none"
                  stroke={isMeeting ? '#ffd980' : '#8fe0bb'}
                  strokeWidth={0.06}
                  strokeDasharray="0.3 0.22"
                  pointerEvents="none"
                  animate={{ opacity: [0.14, 0.42, 0.14] }}
                  transition={{ duration: 2.4, repeat: Infinity }}
                />
              ) : null}
            </g>
          );
        })}

        {/* 대표 캐릭터 (고정 위치) */}
        {company ? (
          <g transform={`translate(${CEO_SPOT.x - SPRITE_W / 2}, ${CEO_SPOT.y - SPRITE_H + 0.5})`}>
            <g transform={`scale(${SX} ${SY})`}>
              <CharacterSprite
                palette={CEO_PALETTE[company.ceoAppearance]}
                sigil="♛"
                state="idle"
                jobClass="sovereign"
              />
            </g>
            <NameTag x={SPRITE_W / 2} y={SPRITE_H + 0.34} text={`${company.ceoCharacterName} · 대표`} tone="#f0cd85" />
            {ceoLine ? <SpeechBubble x={SPRITE_W / 2} y={-0.16} text={ceoLine} /> : null}
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
          const nudge = (slot - 1) * 0.8;
          // 같은 칸에 모여 있어도 이름표가 겹치지 않도록 직원마다 다른 높이에 둔다
          const labelDy = slot * 0.62;
          const line = ownBubble(chats[id], now);
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
                <ellipse
                  cx={SPRITE_W / 2}
                  cy={SPRITE_H - 0.05}
                  rx={1.05}
                  ry={0.5}
                  fill="none"
                  stroke="#ffd980"
                  strokeWidth={0.1}
                />
              ) : null}
              <g transform={`scale(${SX} ${SY})`}>
                <CharacterSprite
                  palette={emp.palette}
                  sigil={emp.sigil}
                  state={emp.state}
                  jobClass={emp.jobClass}
                />
              </g>
              <NameTag x={SPRITE_W / 2} y={SPRITE_H + 0.34 + labelDy} text={`${emp.name} · ${label.game}`} />
              {line ? <SpeechBubble x={SPRITE_W / 2} y={-0.16} text={line.text} warn={line.warn} /> : null}
            </g>
          );
        })}

        {/* 인간 사원 — 출근: 휴게실 안 고정 자리. 장식용이며 AI 상태머신·경로탐색과 무관하다. */}
        {officeStaff.map((r, i) => {
          const a = EMPLOYEE_APPEARANCES[r.appearanceId];
          const spot = HUMAN_LOUNGE_SPOTS[i % HUMAN_LOUNGE_SPOTS.length];
          return (
            <g key={r.id} transform={`translate(${spot.x - SPRITE_W / 2} ${spot.y - SPRITE_H + 0.5})`}>
              <g transform={`scale(${SX} ${SY})`}>
                <CharacterSprite palette={a.palette} sigil={a.sigil} state="idle" jobClass={a.jobClass} gender={a.gender} />
              </g>
              <NameTag x={SPRITE_W / 2} y={SPRITE_H + 0.34} text={`${r.name} · 출근`} tone="#8fe0bb" />
            </g>
          );
        })}

        {/* 출근길 표지 — 오른쪽 세로 길의 정체를 밝혀 준다. */}
        {waitingStaff.length > 0 ? (
          <text
            x={OFFICE_W + 1.65}
            y={1.4}
            textAnchor="middle"
            fontSize={0.5}
            fill="#d8c9a8"
            opacity={0.9}
          >
            출근길
          </text>
        ) : null}

        {/* 인간 사원 — 미출근: 아직 사무실에 들어오지 않았으므로 오른쪽 출근길 위에 세워 둔다. */}
        {waitingStaff.map((r, i) => {
          const a = EMPLOYEE_APPEARANCES[r.appearanceId];
          const spot = HUMAN_WAITING_SPOTS[i % HUMAN_WAITING_SPOTS.length];
          return (
            <g key={r.id} transform={`translate(${spot.x - SPRITE_W / 2} ${spot.y - SPRITE_H + 0.5})`} opacity={0.7}>
              <g transform={`scale(${SX} ${SY})`}>
                <CharacterSprite palette={a.palette} sigil={a.sigil} state="idle" jobClass={a.jobClass} gender={a.gender} />
              </g>
              <NameTag x={SPRITE_W / 2} y={SPRITE_H + 0.34} text={`${r.name} · 미출근`} tone="#8a8477" />
            </g>
          );
        })}
      </svg>

      {/* 범례 — 게임 표현과 실제 의미를 연결한다 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-stone-800 px-3 py-2 text-[10px] text-stone-500">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: PALETTE.deck }} />
          목재 데크 = 업무 공간
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: PALETTE.soil }} />
          텃밭 화단 = 통과 불가
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: PALETTE.gravel }} />
          자갈길 = 이동 경로
        </span>
        <span>캐릭터 이름표의 뒷부분은 현재 상태이며, 정확한 의미는 직원 패널에서 확인할 수 있습니다.</span>
        <span>회의 테이블을 더블클릭하면 우선순위 회의를 소집할 수 있습니다.</span>
        <span>직원을 클릭해 선택한 뒤 다른 방을 더블클릭하면 그곳으로 보냅니다 — 대표 집무실로 보내면 1:1 면담이 시작됩니다.</span>
      </div>

      {meetingOpen ? <PriorityMeetingModal onClose={() => setMeetingOpen(false)} /> : null}
    </div>
  );
}

/**
 * 대사 말풍선. 캐릭터 머리 위에 뜬다. 실제 상태와는 무관한 연출용 텍스트이며,
 * 정확한 대화 내용은 항상 직원 패널의 "1:1 대화" 탭에 그대로 남아 있다.
 */
function SpeechBubble({ x, y, text, warn = false }: { x: number; y: number; text: string; warn?: boolean }) {
  const w = Math.max(1.5, Math.min(5.6, text.length * 0.155 + 0.55));
  const h = 0.56;
  const top = y - h;
  const stroke = warn ? '#d8604f' : '#241a12';
  return (
    <g pointerEvents="none">
      <rect x={x - w / 2} y={top} width={w} height={h} rx={0.16} fill="#f4ecd8" stroke={stroke} strokeWidth={0.045} />
      <path d={`M ${x - 0.13} ${y - 0.01} L ${x + 0.13} ${y - 0.01} L ${x} ${y + 0.2} Z`} fill="#f4ecd8" stroke={stroke} strokeWidth={0.045} />
      <rect x={x - 0.13} y={y - 0.03} width={0.26} height={0.05} fill="#f4ecd8" />
      <text x={x} y={top + h / 2 + 0.1} textAnchor="middle" fontSize={0.24} fill="#241a12">
        {text}
      </text>
    </g>
  );
}

/** 캐릭터 이름표 — 배경 위에서도 항상 읽히도록 판을 깔아 준다. */
function NameTag({ x, y, text, tone = '#f2ecf8' }: { x: number; y: number; text: string; tone?: string }) {
  const w = Math.max(1.8, text.length * 0.34 + 0.5);
  return (
    <g>
      <rect x={x - w / 2} y={y - 0.38} width={w} height={0.56} rx={0.14} fill="#12100c" opacity={0.72} />
      <text x={x} y={y} textAnchor="middle" fontSize={0.38} fill={tone}>
        {text}
      </text>
    </g>
  );
}
