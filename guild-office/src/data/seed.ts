/**
 * 초기 데이터: 오피스 도면, 격자 생성, AI 직원 3명, 제공자 카탈로그.
 *
 * 격자는 문자열 맵 대신 코드로 생성한다. 방 사각형과 문 좌표만 선언하면
 * 벽이 자동으로 그려지므로, 도면을 바꿔도 통행 가능 여부가 어긋나지 않는다.
 */
import type {
  Employee,
  Grid,
  ProviderBinding,
  ProviderId,
  Room,
  RoomId,
  Vec2,
} from '@/types';

export const OFFICE_W = 32;
export const OFFICE_H = 20;
/** 캐릭터 이동 속도 (타일/초) */
export const WALK_SPEED = 3.6;

export const ROOMS: Room[] = [
  {
    id: 'ceo_office',
    name: '대표 집무실',
    flavor: '길드 마스터의 방',
    rect: { x: 1, y: 1, w: 9, h: 6 },
    anchor: { x: 5, y: 3 },
    door: { x: 5, y: 6 },
  },
  {
    id: 'lab',
    name: '연구실',
    flavor: '룬 공방',
    rect: { x: 12, y: 1, w: 9, h: 6 },
    anchor: { x: 16, y: 3 },
    door: { x: 16, y: 6 },
  },
  {
    id: 'sales_room',
    name: '영업·문서 작성실',
    flavor: '현자의 서재',
    rect: { x: 22, y: 1, w: 9, h: 6 },
    anchor: { x: 26, y: 3 },
    door: { x: 26, y: 6 },
  },
  {
    id: 'dungeon_gate',
    name: '프로젝트 던전 입구',
    flavor: '봉인된 문',
    rect: { x: 1, y: 8, w: 5, h: 4 },
    anchor: { x: 3, y: 10 },
    door: { x: 5, y: 10 },
  },
  {
    id: 'meeting',
    name: '회의 테이블',
    flavor: '원탁',
    rect: { x: 11, y: 8, w: 11, h: 4 },
    anchor: { x: 13, y: 10 },
    door: { x: 16, y: 8 },
  },
  {
    id: 'training',
    name: '훈련장',
    flavor: '연무장',
    rect: { x: 26, y: 8, w: 5, h: 4 },
    anchor: { x: 28, y: 10 },
    door: { x: 26, y: 10 },
  },
  {
    id: 'admin_desk',
    name: '총무 데스크',
    flavor: '서기관의 자리',
    rect: { x: 1, y: 13, w: 8, h: 6 },
    anchor: { x: 4, y: 16 },
    door: { x: 4, y: 13 },
  },
  {
    id: 'api_room',
    name: 'API 연결실',
    flavor: '마력 코어실',
    rect: { x: 11, y: 13, w: 5, h: 6 },
    anchor: { x: 13, y: 16 },
    door: { x: 13, y: 13 },
  },
  {
    id: 'lounge',
    name: '휴게실',
    flavor: '난롯가',
    rect: { x: 18, y: 13, w: 6, h: 6 },
    anchor: { x: 20, y: 16 },
    door: { x: 20, y: 13 },
  },
  {
    id: 'fishing',
    name: '낚시터',
    flavor: '고요한 수면',
    rect: { x: 26, y: 13, w: 5, h: 6 },
    anchor: { x: 28, y: 16 },
    door: { x: 26, y: 15 },
  },
];

/** 방 안에 놓인 가구. 통행 불가 타일이며 문 앞 동선은 피해서 배치한다. */
export const FURNITURE: Array<{ room: RoomId; tiles: Vec2[]; label: string }> = [
  { room: 'ceo_office', label: '집무 책상', tiles: [{ x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 }] },
  { room: 'lab', label: '실험 장치', tiles: [{ x: 14, y: 2 }, { x: 15, y: 2 }] },
  { room: 'sales_room', label: '자료 선반', tiles: [{ x: 28, y: 2 }, { x: 29, y: 2 }] },
  { room: 'meeting', label: '원탁', tiles: [{ x: 16, y: 10 }, { x: 17, y: 10 }, { x: 18, y: 10 }] },
  { room: 'admin_desk', label: '문서 캐비닛', tiles: [{ x: 2, y: 14 }, { x: 3, y: 14 }] },
  { room: 'lounge', label: '소파', tiles: [{ x: 22, y: 16 }, { x: 22, y: 17 }] },
  { room: 'fishing', label: '수면', tiles: [{ x: 29, y: 15 }, { x: 29, y: 16 }, { x: 29, y: 17 }] },
];

/**
 * 격자를 만든다. 0 = 통행 가능, 1 = 벽/가구.
 * 방 외곽에 벽을 그리고 문 좌표 한 칸만 뚫는다.
 */
export function buildGrid(): Grid {
  const blocked = new Uint8Array(OFFICE_W * OFFICE_H);
  const set = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= OFFICE_W || y >= OFFICE_H) return;
    blocked[y * OFFICE_W + x] = v;
  };

  // 바깥 테두리
  for (let x = 0; x < OFFICE_W; x++) {
    set(x, 0, 1);
    set(x, OFFICE_H - 1, 1);
  }
  for (let y = 0; y < OFFICE_H; y++) {
    set(0, y, 1);
    set(OFFICE_W - 1, y, 1);
  }

  // 방 외벽
  for (const room of ROOMS) {
    const { x, y, w, h } = room.rect;
    for (let i = x; i < x + w; i++) {
      set(i, y, 1);
      set(i, y + h - 1, 1);
    }
    for (let j = y; j < y + h; j++) {
      set(x, j, 1);
      set(x + w - 1, j, 1);
    }
  }
  // 문 뚫기 (외벽을 다 그린 뒤에 해야 덮어쓰이지 않는다)
  for (const room of ROOMS) set(room.door.x, room.door.y, 0);

  // 가구
  for (const f of FURNITURE) for (const t of f.tiles) set(t.x, t.y, 1);

  return { w: OFFICE_W, h: OFFICE_H, blocked };
}

export function roomById(id: RoomId): Room {
  const r = ROOMS.find((x) => x.id === id);
  if (!r) throw new Error(`알 수 없는 방 id: ${id}`);
  return r;
}

/* ───────────────────────── 제공자 카탈로그 ───────────────────────── */

export interface ModelOption {
  id: string;
  label: string;
  /** 100만 토큰당 USD. 견적 계산에만 쓰인다. */
  inputPerM: number;
  outputPerM: number;
  note: string;
}

/**
 * 프로토타입용 목록.
 * 실제 서비스에서는 서버가 각 제공자 API로 모델 목록을 조회해 채운다.
 */
export const PROVIDER_CATALOG: Record<
  ProviderId,
  { label: string; hint: string; models: ModelOption[] }
> = {
  anthropic: {
    label: 'Anthropic',
    hint: '판단·검수·코드에 강함',
    models: [
      { id: 'claude-opus-5', label: 'Claude Opus 5', inputPerM: 5, outputPerM: 25, note: '최고 품질 / 고비용' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', inputPerM: 3, outputPerM: 15, note: '균형' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', inputPerM: 1, outputPerM: 5, note: '분류·라우팅' },
    ],
  },
  openai: {
    label: 'OpenAI',
    hint: '범용',
    models: [
      { id: 'gpt-tier-a', label: '상위 티어 모델', inputPerM: 5, outputPerM: 20, note: '연결 시 서버가 실제 목록 조회' },
      { id: 'gpt-tier-b', label: '표준 티어 모델', inputPerM: 1.5, outputPerM: 6, note: '연결 시 서버가 실제 목록 조회' },
    ],
  },
  google: {
    label: 'Google AI',
    hint: '장문 처리',
    models: [
      { id: 'g-tier-a', label: '상위 티어 모델', inputPerM: 4, outputPerM: 16, note: '연결 시 서버가 실제 목록 조회' },
      { id: 'g-tier-b', label: '표준 티어 모델', inputPerM: 1, outputPerM: 4, note: '연결 시 서버가 실제 목록 조회' },
    ],
  },
  local: {
    label: 'Local Model',
    hint: '자체 GPU. API 비용 0',
    models: [
      { id: 'local-worker', label: '사내 로컬 모델', inputPerM: 0, outputPerM: 0, note: '전기료만 발생 (여기서는 0으로 계산)' },
    ],
  },
  custom: {
    label: 'Custom REST API',
    hint: '사내 게이트웨이 등',
    models: [
      { id: 'custom-endpoint', label: '사용자 지정 엔드포인트', inputPerM: 2, outputPerM: 8, note: '단가는 관리자가 입력' },
    ],
  },
};

export function findModel(provider: ProviderId | null, modelId: string | null): ModelOption | null {
  if (!provider || !modelId) return null;
  return PROVIDER_CATALOG[provider].models.find((m) => m.id === modelId) ?? null;
}

export function emptyBinding(): ProviderBinding {
  return {
    provider: null,
    model: null,
    status: 'unconnected',
    keyRef: null,
    maskedKey: null,
    perTaskLimitUsd: 0.5,
    monthlyLimitUsd: 20,
    allowedTools: [],
    lastTestedAt: null,
  };
}

/* ──────────────────────────── AI 직원 3명 ─────────────────────────── */

export const AI_EMPLOYEE_IDS = ['emp_admin', 'emp_engineer', 'emp_professor'] as const;
export type AiEmployeeId = (typeof AI_EMPLOYEE_IDS)[number];

interface SeedSpec {
  id: AiEmployeeId;
  name: string;
  title: string;
  jobClass: Employee['jobClass'];
  jobLabel: string;
  homeRoom: RoomId;
  palette: Employee['palette'];
  sigil: string;
  scope: string;
  greeting: string;
  duties: string[];
}

export const AI_EMPLOYEE_SEEDS: SeedSpec[] = [
  {
    id: 'emp_admin',
    name: '세라',
    title: '총무 매니저',
    jobClass: 'strategist',
    jobLabel: '전략가 · 서기관',
    homeRoom: 'admin_desk',
    palette: { robe: '#3b6ea5', trim: '#d9a441', aura: '#8fc4f0' },
    sigil: '✦',
    scope: '업무 접수, 일정 조정, 결과 취합, 최종 보고',
    greeting: '접수와 취합, 그리고 최종 보고를 맡겠습니다. 지시는 저를 통해 내려 주시면 됩니다.',
    duties: ['업무 접수 및 분해', '일정 조정', '문서 검수·취합', '대표 최종 보고', '메일 발송'],
  },
  {
    id: 'emp_engineer',
    name: '루온',
    title: '수석 연구 엔지니어',
    jobClass: 'rune_engineer',
    jobLabel: '마법공학자 · 룬 엔지니어',
    homeRoom: 'lab',
    palette: { robe: '#2f6f5e', trim: '#7bd9b0', aura: '#4fbf8b' },
    sigil: '⚙',
    scope: '시스템 설계, 코드 분석, 기술 검증, 복잡한 문제 해결',
    greeting: '분석과 검증을 담당합니다. 위험하거나 비용이 큰 작업은 반드시 승인부터 요청하겠습니다.',
    duties: ['자료·데이터 분석', '코드 및 시스템 검증', '기술 리스크 평가', '분석 결과 전달'],
  },
  {
    id: 'emp_professor',
    name: '미르',
    title: '행동 심리학 교수',
    jobClass: 'sage',
    jobLabel: '현자 · 협상가',
    homeRoom: 'sales_room',
    palette: { robe: '#6a4b8f', trim: '#e0c46a', aura: '#a99cf0' },
    sigil: '❖',
    scope: '설득 문서, 영업 자료, 고객 대응, 대외 협력',
    greeting: '설득이 필요한 문서를 씁니다. 외부로 나가기 전에는 반드시 검토를 요청드립니다.',
    duties: ['제안서·영업자료 작성', '고객 대응 문안', '협상 시나리오', '대외 문서 검토 요청'],
  },
];

export function createEmployee(spec: SeedSpec, now: number): Employee {
  const home = roomById(spec.homeRoom);
  return {
    id: spec.id,
    kind: 'ai',
    name: spec.name,
    title: spec.title,
    jobClass: spec.jobClass,
    jobLabel: spec.jobLabel,
    palette: spec.palette,
    sigil: spec.sigil,
    state: 'idle',
    pos: { ...home.anchor },
    path: [],
    homeRoom: spec.homeRoom,
    destinationRoom: spec.homeRoom,
    mood: 78,
    focus: 82,
    binding: emptyBinding(),
    spendTodayUsd: 0,
    spendMonthUsd: 0,
    currentMissionId: null,
    currentStepId: null,
    scope: spec.scope,
    reportStyle: 'concise',
    dataAccess: ['사내 공개 문서'],
    interviewed: false,
    onLeave: false,
    lastIdleAt: now,
  };
}

export const GREETINGS: Record<AiEmployeeId, string> = {
  emp_admin: AI_EMPLOYEE_SEEDS[0].greeting,
  emp_engineer: AI_EMPLOYEE_SEEDS[1].greeting,
  emp_professor: AI_EMPLOYEE_SEEDS[2].greeting,
};

export const DUTIES: Record<AiEmployeeId, string[]> = {
  emp_admin: AI_EMPLOYEE_SEEDS[0].duties,
  emp_engineer: AI_EMPLOYEE_SEEDS[1].duties,
  emp_professor: AI_EMPLOYEE_SEEDS[2].duties,
};

/** 회사 창립 기본값 */
export const COMPANY_DEFAULTS = {
  name: '크림바스켓',
  ceoName: '강민호',
  ceoCharacterName: '민호',
  ceoAppearance: 'sovereign' as const,
  country: '대한민국',
  branch: '한국 본사',
  currency: 'KRW' as const,
  monthlyBudgetUsd: 60,
  firstGoal: '회사의 첫 번째 공식 제안서를 완성한다',
};

export const PLATFORM_MAKER = 'mkang';
