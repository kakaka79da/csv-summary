/**
 * 이스터에그 — "탱크형 변형 휠" 프로젝트 데모 시나리오.
 *
 * 로그인 화면 하단의 작은 제작자 표기("mkang")를 클릭하고 코드를 입력하면
 * 시작되는 숨겨진 약 20분짜리 자동 진행 시나리오다. 대표가 아무것도 누르지 않아도
 * 세 AI 직원이 회의 → 설계 → 외주 협상 → (버그 발생 시) 낚시터에서 휴식 → 훈련장에서
 * 학습 → 재설계 → 최종 보고까지 스스로 진행한다.
 *
 * ⚠️ 이것은 실제 업무가 아니다. 어떤 API도 호출되지 않고 어떤 비용도 발생하지 않는다.
 * 캐릭터 상태는 모두 agentMachine.ts 의 합법적인 전이만 사용해서 바뀌므로, 이 파일이
 * 지키는 "화면과 실제 상태가 어긋나지 않는다"는 원칙은 이스터에그에도 그대로 적용된다.
 * 다만 "실제"는 어디까지나 이 가상 시나리오 안에서의 실제이며, 그 사실을 배너와 최종
 * 보고 문구로 항상 함께 밝힌다.
 */
import { GRID } from '@/data/world';
import { roomById, type AiEmployeeId } from '@/data/seed';
import { findPath } from '@/lib/pathfinding';
import { nid } from '@/lib/format';
import { nextAgentState, type AgentEvent } from '@/state/agentMachine';
import type { Employee, Message, MessageKind, RoomId } from '@/types';
import type { WorkState } from '@/state/agentMachine';

export const EASTER_EGG_CODE = 'mkang428428';

/**
 * 플랫폼 관리자 로그인 코드. 같은 "mkang" 제작자 표기를 눌러 입력하지만,
 * 이스터에그 코드와는 다른 문자열이라 서로 구분된다 — 대표/사원 화면에 노출되지
 * 않는 숨겨진 진입점으로 관리자 모드에 들어간다.
 */
export const ADMIN_UNLOCK_CODE = 'mkang428428##';

/* ────────────────────────────── 대본 형식 ────────────────────────────── */

type Settle =
  | { type: 'idle' }
  | { type: 'rest' }
  | { type: 'fish' }
  | { type: 'train' }
  | { type: 'work'; work: WorkState };

export type EasterEggBeat =
  | { atMs: number; kind: 'toast'; text: string }
  | { atMs: number; kind: 'say'; to: AiEmployeeId[]; from: Message['from']; msgKind: MessageKind; text: string }
  | { atMs: number; kind: 'move'; employeeId: AiEmployeeId; room: RoomId; settle: Settle }
  | { atMs: number; kind: 'work'; employeeId: AiEmployeeId; work: WorkState }
  | { atMs: number; kind: 'end' };

export interface EasterEggRuntime {
  /** 코드를 한 번이라도 맞춘 적 있는지 (같은 세션 안에서만 유지, 새로고침 시 초기화) */
  unlocked: boolean;
  active: boolean;
  startedAt: number | null;
  /** 다음에 실행할 대본 인덱스 */
  cursor: number;
  /** 걸어가는 중인 직원이 도착하면 무엇을 할지 기억해 둔다 */
  pendingSettle: Partial<Record<AiEmployeeId, Settle>>;
}

export const initialEasterEgg: EasterEggRuntime = {
  unlocked: false,
  active: false,
  startedAt: null,
  cursor: 0,
  pendingSettle: {},
};

const ALL: AiEmployeeId[] = ['emp_admin', 'emp_engineer', 'emp_professor'];
const sec = (m: number, s = 0) => (m * 60 + s) * 1000;

/* ─────────────────────────── 시나리오 대본 ───────────────────────────── */
/**
 * "탱크형 변형 휠" — 평지에서는 일반 바퀴, 험지에서는 무한궤도로 펼쳐지는
 * 험지 자율 탐사 로봇용 휠을 설계하는 가상 프로젝트.
 */
export const EASTER_EGG_SCRIPT: EasterEggBeat[] = [
  {
    atMs: sec(0),
    kind: 'toast',
    text: '🥚 이스터에그 발견! "탱크형 변형 휠" 프로젝트 데모가 시작됩니다 (약 20분 · 실제 비용 없음)',
  },
  {
    atMs: sec(0),
    kind: 'say',
    to: ['emp_admin'],
    from: 'ceo',
    msgKind: 'task_order',
    text:
      '새 요청이 들어왔습니다. 험지 자율 탐사 로봇에 쓸 "탱크형 변형 휠"을 검토해 주세요. ' +
      '평지에서는 일반 바퀴로 구르고, 험지에서는 무한궤도로 펼쳐지는 구조가 목표입니다. ' +
      '먼저 세 분이 모여 개념을 잡아 주세요.',
  },
  { atMs: sec(0, 5), kind: 'move', employeeId: 'emp_admin', room: 'meeting', settle: { type: 'idle' } },
  { atMs: sec(0, 5), kind: 'move', employeeId: 'emp_engineer', room: 'meeting', settle: { type: 'idle' } },
  { atMs: sec(0, 5), kind: 'move', employeeId: 'emp_professor', room: 'meeting', settle: { type: 'idle' } },

  /* ── 킥오프 회의 ─────────────────────────────────────────────────── */
  {
    atMs: sec(0, 25),
    kind: 'say',
    to: ALL,
    from: 'agent',
    msgKind: 'chat',
    text: '엘레나: 다들 모이셨네요. 오늘 안건은 "탱크형 변형 휠" — 평지 주행과 험지 주행을 하나의 바퀴로 해결하는 겁니다. 카일, 기술적으로 가능할까요?',
  },
  {
    atMs: sec(0, 40),
    kind: 'say',
    to: ALL,
    from: 'agent',
    msgKind: 'chat',
    text: '카일: 가능은 합니다. 문제는 전개 방식이에요. 유압 실린더는 무겁고 고장이 잦으니, 형상기억합금(SMA) 액추에이터로 트레드 세그먼트를 접었다 펴는 구조를 제안합니다.',
  },
  {
    atMs: sec(0, 55),
    kind: 'say',
    to: ALL,
    from: 'agent',
    msgKind: 'chat',
    text: '올리비아: 그 액추에이터, 저희가 처음부터 설계하려면 시간이 꽤 걸릴 텐데요. 이런 정밀부품은 특화 업체에 시제품 제작을 맡기는 게 일정상 유리하지 않을까요?',
  },
  {
    atMs: sec(1, 10),
    kind: 'say',
    to: ALL,
    from: 'agent',
    msgKind: 'chat',
    text: '카일: 동의합니다. 저는 휠 프레임과 트레드 세그먼트 설계·제어 로직에 집중하고, SMA 액추에이터 시제품은 외주로 돌리는 게 맞겠습니다.',
  },
  {
    atMs: sec(1, 25),
    kind: 'say',
    to: ALL,
    from: 'agent',
    msgKind: 'chat',
    text: '엘레나: 정리하겠습니다 — ① 카일: 휠 프레임·트레드 설계 및 제어 로직, ② 올리비아: 액추에이터 외주 업체 컨택 및 견적, ③ 저는 회의록·일정을 정리해 대표님께 중간 보고를 드리겠습니다. 이견 없으시면 바로 착수하겠습니다.',
  },
  {
    atMs: sec(1, 40),
    kind: 'say',
    to: ['emp_admin'],
    from: 'agent',
    msgKind: 'report',
    text:
      '킥오프 회의 결론을 보고드립니다.\n' +
      '목표: 평지에서는 바퀴, 험지에서는 무한궤도로 전환되는 휠.\n' +
      '담당 — 카일(설계) · 올리비아(외주 협상) · 저(진행 관리).\n' +
      '우선 개념 설계와 외주 견적부터 진행하겠습니다.',
  },

  /* ── 각자 자리로 — 설계 착수 ─────────────────────────────────────── */
  { atMs: sec(1, 45), kind: 'move', employeeId: 'emp_engineer', room: 'lab', settle: { type: 'work', work: 'thinking' } },
  { atMs: sec(1, 45), kind: 'move', employeeId: 'emp_professor', room: 'sales_room', settle: { type: 'work', work: 'mailing' } },
  { atMs: sec(1, 45), kind: 'move', employeeId: 'emp_admin', room: 'admin_desk', settle: { type: 'work', work: 'writing' } },

  {
    atMs: sec(2, 10),
    kind: 'say',
    to: ['emp_engineer'],
    from: 'agent',
    msgKind: 'chat',
    text: '카일: 트레드 세그먼트 힌지 각도부터 계산합니다. 목표는 12개 세그먼트, 최대 절곡각 155도.',
  },
  {
    atMs: sec(2, 10),
    kind: 'say',
    to: ['emp_professor'],
    from: 'agent',
    msgKind: 'chat',
    text: '올리비아: SMA 액추에이터 전문 업체 세 곳에 시제품 제작 문의를 보냈습니다 — 다인정밀, 헬릭스 다이내믹스, 온새미 로보틱스.',
  },
  {
    atMs: sec(2, 10),
    kind: 'say',
    to: ['emp_admin'],
    from: 'agent',
    msgKind: 'chat',
    text: '엘레나: 회의록 정리를 마쳤습니다. 예상 일정 — 설계 1주, 외주 시제품 2주, 통합 테스트 1주로 초안을 잡았습니다.',
  },

  {
    atMs: sec(3, 30),
    kind: 'say',
    to: ['emp_engineer'],
    from: 'agent',
    msgKind: 'chat',
    text: '카일: 1차 설계안 완성 — 12세그먼트 트레드, SMA 힌지 24개 배치안입니다. 하중 시뮬레이션을 돌려보겠습니다.',
  },
  { atMs: sec(3, 30), kind: 'work', employeeId: 'emp_engineer', work: 'fighting' },

  {
    atMs: sec(5, 30),
    kind: 'say',
    to: ['emp_professor'],
    from: 'agent',
    msgKind: 'chat',
    text: '올리비아: 다인정밀에서 회신이 왔습니다 — SMA 액추에이터 24개 시제품, 2주 납기. 조건은 나쁘지 않아 보입니다.',
  },

  /* ── 버그 발생 → 낚시터에서 리셋 ──────────────────────────────────── */
  {
    atMs: sec(6, 30),
    kind: 'say',
    to: ['emp_engineer'],
    from: 'agent',
    msgKind: 'warning',
    text: '카일: …잠깐, 하중 시뮬레이션에서 문제가 보입니다. 힌지 24개 배치는 좌우 축 정렬 오차가 누적돼서, 고속 주행 시 트레드가 미세하게 틀어집니다. 원인을 다시 봐야겠어요.',
  },
  { atMs: sec(6, 35), kind: 'toast', text: '⚠ 카일이 시뮬레이션에서 버그를 발견했습니다 — 잠시 낚시터에서 머리를 식히는 중' },
  { atMs: sec(6, 40), kind: 'move', employeeId: 'emp_engineer', room: 'fishing', settle: { type: 'fish' } },
  {
    atMs: sec(7, 10),
    kind: 'say',
    to: ['emp_engineer'],
    from: 'agent',
    msgKind: 'chat',
    text: '카일: 잠시 머리를 식히겠습니다. …너무 복잡하게 생각했던 것 같네요.',
  },
  {
    atMs: sec(9, 0),
    kind: 'say',
    to: ['emp_engineer'],
    from: 'agent',
    msgKind: 'chat',
    text:
      '카일: 알았습니다! 힌지를 좌우 대칭 24개 배치 대신 3점 지지 구조로 바꾸면 정렬 오차가 자연히 상쇄됩니다. ' +
      '다만 제가 3점 지지 하중 계산을 제대로 써본 적이 없어서, 훈련장에서 시뮬레이션 툴 사용법을 복습하고 오겠습니다.',
  },

  /* ── 훈련장 — 학습 ───────────────────────────────────────────────── */
  { atMs: sec(9, 10), kind: 'move', employeeId: 'emp_engineer', room: 'training', settle: { type: 'train' } },
  {
    atMs: sec(9, 40),
    kind: 'say',
    to: ['emp_engineer'],
    from: 'agent',
    msgKind: 'chat',
    text: '카일: 3점 지지 하중 분산 계산법을 복습 중입니다. …예전에 배웠던 걸 다시 꺼내 쓰는 느낌이네요.',
  },
  {
    atMs: sec(11, 0),
    kind: 'say',
    to: ['emp_engineer'],
    from: 'agent',
    msgKind: 'chat',
    text: '카일: 복습 끝났습니다. 이제 3점 지지 구조로 재설계하겠습니다.',
  },
  { atMs: sec(11, 10), kind: 'move', employeeId: 'emp_engineer', room: 'lab', settle: { type: 'work', work: 'working' } },

  /* ── 재설계 완료 + 외주 계약 ─────────────────────────────────────── */
  {
    atMs: sec(12, 30),
    kind: 'say',
    to: ['emp_engineer'],
    from: 'agent',
    msgKind: 'chat',
    text: '카일: 3점 지지 트레드로 재설계 완료. 시뮬레이션 재검증 결과 정렬 오차가 허용치 이내로 들어왔습니다.',
  },
  {
    atMs: sec(12, 30),
    kind: 'say',
    to: ['emp_professor'],
    from: 'agent',
    msgKind: 'chat',
    text: '올리비아: 다인정밀 최종 견적을 받았습니다 — SMA 액추에이터 24개, 2주 납기, 예산 내 협의 완료. 계약서 초안을 전달했습니다.',
  },
  { atMs: sec(12, 35), kind: 'work', employeeId: 'emp_professor', work: 'collaborating' },

  {
    atMs: sec(13, 30),
    kind: 'say',
    to: ['emp_admin'],
    from: 'agent',
    msgKind: 'chat',
    text: '엘레나: 카일 님의 재설계안과 올리비아 님의 외주 계약 결과를 취합해 중간 보고서 초안을 작성하겠습니다.',
  },
  { atMs: sec(13, 35), kind: 'work', employeeId: 'emp_admin', work: 'writing' },

  /* ── 최종 확인 회의 ──────────────────────────────────────────────── */
  { atMs: sec(15, 0), kind: 'move', employeeId: 'emp_admin', room: 'meeting', settle: { type: 'idle' } },
  { atMs: sec(15, 0), kind: 'move', employeeId: 'emp_engineer', room: 'meeting', settle: { type: 'idle' } },
  { atMs: sec(15, 0), kind: 'move', employeeId: 'emp_professor', room: 'meeting', settle: { type: 'idle' } },
  {
    atMs: sec(15, 30),
    kind: 'say',
    to: ALL,
    from: 'agent',
    msgKind: 'chat',
    text: '엘레나: 마지막으로 정리하겠습니다 — 설계는 3점 지지 트레드 12세그먼트로 확정, 액추에이터는 다인정밀 외주로 2주 납기, 통합 테스트는 다음 주부터 시작합니다. 이견 있으신가요?',
  },
  { atMs: sec(15, 45), kind: 'say', to: ALL, from: 'agent', msgKind: 'chat', text: '카일: 없습니다. 설계는 확정입니다.' },
  { atMs: sec(15, 55), kind: 'say', to: ALL, from: 'agent', msgKind: 'chat', text: '올리비아: 계약 조건도 문제없습니다. 진행하시죠.' },

  /* ── 최종 보고서 작성 및 제출 ─────────────────────────────────────── */
  { atMs: sec(16, 10), kind: 'move', employeeId: 'emp_admin', room: 'admin_desk', settle: { type: 'work', work: 'writing' } },
  { atMs: sec(16, 10), kind: 'move', employeeId: 'emp_engineer', room: 'lab', settle: { type: 'idle' } },
  { atMs: sec(16, 10), kind: 'move', employeeId: 'emp_professor', room: 'sales_room', settle: { type: 'idle' } },

  {
    atMs: sec(18, 30),
    kind: 'say',
    to: ['emp_admin'],
    from: 'agent',
    msgKind: 'report',
    text:
      '「탱크형 변형 휠」 프로젝트 최종 보고서\n\n' +
      '배경: 험지 자율 탐사 로봇용, 평지-바퀴 / 험지-무한궤도 전환형 휠 개발 검토 요청.\n' +
      '설계: 3점 지지 방식 12세그먼트 트레드 + SMA 힌지. (초안이던 24개 좌우대칭 배치는 정렬 오차 문제로 폐기)\n' +
      '외주: SMA 액추에이터 시제품 24개, 다인정밀 계약, 2주 납기, 예산 내 협의 완료.\n' +
      '진행 중 이슈: 1차 시뮬레이션에서 정렬 오차 발견 → 담당자 재정비 후 3점 지지 구조로 해결.\n' +
      '다음 단계: 시제품 입고 후 통합 테스트 (예상 1주), 이후 실차 장착 테스트.\n\n' +
      '※ 이 보고서는 이스터에그 데모 시나리오입니다. 실제 설계·외주·비용은 발생하지 않았습니다.',
  },
  { atMs: sec(18, 35), kind: 'toast', text: '📄 엘레나가 "탱크형 변형 휠" 프로젝트 최종 보고서를 제출했습니다.' },

  { atMs: sec(19, 0), kind: 'move', employeeId: 'emp_admin', room: 'admin_desk', settle: { type: 'idle' } },
  { atMs: sec(19, 0), kind: 'move', employeeId: 'emp_engineer', room: 'lab', settle: { type: 'idle' } },
  { atMs: sec(19, 0), kind: 'move', employeeId: 'emp_professor', room: 'sales_room', settle: { type: 'idle' } },

  {
    atMs: sec(19, 40),
    kind: 'toast',
    text: '🎉 이스터에그 시나리오 종료 — "탱크형 변형 휠" 데모를 마칩니다. 실제 API 호출과 비용은 발생하지 않았습니다.',
  },
  { atMs: sec(19, 45), kind: 'end' },
];

export const EASTER_EGG_TOTAL_MS = EASTER_EGG_SCRIPT[EASTER_EGG_SCRIPT.length - 1].atMs;

/* ────────────────────────────── 실행기 ────────────────────────────────── */

function applyEvt(emp: Employee, event: AgentEvent): boolean {
  const next = nextAgentState(emp.state, event);
  if (next === null) return false;
  emp.state = next;
  return true;
}

/** 지금 상태가 무엇이든, 합법적인 전이만 밟아서 목표 작업 상태에 도달시킨다. */
function forceWork(emp: Employee, work: WorkState) {
  if (emp.state !== 'idle') applyEvt(emp, { type: 'STOP' });
  applyEvt(emp, { type: 'ASSIGN' });
  applyEvt(emp, { type: 'ARRIVE' });
  applyEvt(emp, { type: 'START_WORK', work });
}

function pushMessage(
  chats: Record<string, Message[]>,
  employeeId: string,
  from: Message['from'],
  kind: MessageKind,
  text: string,
): Record<string, Message[]> {
  const msg: Message = { id: nid('msg'), employeeId, from, kind, text, ts: Date.now() };
  return { ...chats, [employeeId]: [...(chats[employeeId] ?? []), msg] };
}

export interface EasterEggTickResult {
  egg: EasterEggRuntime;
  chats: Record<string, Message[]>;
  toast: string | null;
}

/**
 * 한 틱만큼 이스터에그 대본을 진행한다. 순수 함수는 아니지만(employees 를 직접
 * 변경한다), advanceWorld 의 나머지 코드와 같은 스타일을 따른다 — employees 는
 * 호출부에서 이미 이번 틱용으로 복사해 둔 draft 객체이므로 여기서 고쳐도 안전하다.
 */
export function advanceEasterEgg(
  egg: EasterEggRuntime,
  employees: Record<string, Employee>,
  chats: Record<string, Message[]>,
  now: number,
): EasterEggTickResult {
  if (!egg.active || egg.startedAt === null) {
    return { egg, chats, toast: null };
  }

  let cursor = egg.cursor;
  let pendingSettle = egg.pendingSettle;
  let toast: string | null = null;
  let ended = false;
  const elapsed = now - egg.startedAt;

  while (cursor < EASTER_EGG_SCRIPT.length && EASTER_EGG_SCRIPT[cursor].atMs <= elapsed) {
    const beat = EASTER_EGG_SCRIPT[cursor];
    switch (beat.kind) {
      case 'toast':
        toast = beat.text;
        break;

      case 'say':
        for (const id of beat.to) {
          chats = pushMessage(chats, id, beat.from, beat.msgKind, beat.text);
        }
        break;

      case 'move': {
        const emp = employees[beat.employeeId];
        if (emp) {
          if (emp.state !== 'idle') applyEvt(emp, { type: 'STOP' });
          applyEvt(emp, { type: 'GO' });
          emp.destinationRoom = beat.room;
          emp.path = findPath(GRID, emp.pos, roomById(beat.room).anchor);
          pendingSettle = { ...pendingSettle, [beat.employeeId]: beat.settle };
        }
        break;
      }

      case 'work': {
        const emp = employees[beat.employeeId];
        if (emp) forceWork(emp, beat.work);
        break;
      }

      case 'end':
        ended = true;
        break;
    }
    cursor += 1;
  }

  // 걸어서 도착한 직원을 매 틱 확인해 원래 하려던 행동으로 정착시킨다.
  // (이스터에그가 진행되는 동안은 store.ts 의 일반 유휴 로직이 이 세 명을 건드리지 않는다)
  for (const id of Object.keys(pendingSettle) as AiEmployeeId[]) {
    const emp = employees[id];
    const settle = pendingSettle[id];
    if (!emp || !settle) continue;
    if (emp.state !== 'walking' || emp.path.length > 0) continue;

    switch (settle.type) {
      case 'idle':
        applyEvt(emp, { type: 'STOP' });
        break;
      case 'rest':
        applyEvt(emp, { type: 'REST' });
        break;
      case 'fish':
        applyEvt(emp, { type: 'FISH' });
        break;
      case 'train':
        applyEvt(emp, { type: 'PLAY' });
        break;
      case 'work':
        forceWork(emp, settle.work);
        break;
    }
    emp.lastIdleAt = now;
    const { [id]: _done, ...rest } = pendingSettle;
    pendingSettle = rest;
  }

  return {
    egg: { ...egg, cursor, pendingSettle, active: !ended },
    chats,
    toast,
  };
}

/** 진행 중인 이스터에그를 중단하고 모든 참가자를 안전하게 대기 상태로 되돌린다. */
export function resetEasterEggEmployees(employees: Record<string, Employee>): Record<string, Employee> {
  const next: Record<string, Employee> = {};
  for (const [id, emp] of Object.entries(employees)) {
    if (!ALL.includes(id as AiEmployeeId)) {
      next[id] = emp;
      continue;
    }
    const draft: Employee = { ...emp, pos: { ...emp.pos }, path: [] };
    if (draft.state !== 'idle') applyEvt(draft, { type: 'STOP' });
    draft.destinationRoom = draft.homeRoom;
    draft.path = findPath(GRID, draft.pos, roomById(draft.homeRoom).anchor);
    draft.lastIdleAt = Date.now();
    next[id] = draft;
  }
  return next;
}
