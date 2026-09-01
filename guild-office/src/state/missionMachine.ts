/**
 * 미션(퀘스트) 상태 머신과 미션 생성기.
 *
 * 연출 값(몬스터 체력)은 여기서 진행률로부터 파생시킨다.
 * 반대 방향(체력을 깎아서 진행률을 만든다)은 금지한다.
 */
import { nid } from '@/lib/format';
import { findModel } from '@/data/seed';
import type {
  Difficulty,
  Employee,
  Mission,
  MissionStatus,
  MissionStep,
  MonsterKind,
  ToolId,
} from '@/types';

export type MissionEvent =
  | { type: 'SUBMIT'; requiresApproval: boolean }
  | { type: 'APPROVE' }
  | { type: 'REJECT'; reason: string }
  | { type: 'START' }
  | { type: 'BLOCK'; reason: string }
  | { type: 'UNBLOCK' }
  | { type: 'REPORT' }
  | { type: 'REVIEW' }
  | { type: 'ACCEPT' }
  | { type: 'FAIL'; reason: string }
  | { type: 'CANCEL' };

export function nextMissionStatus(current: MissionStatus, e: MissionEvent): MissionStatus | null {
  switch (e.type) {
    case 'SUBMIT':
      return current === 'draft' ? (e.requiresApproval ? 'awaiting_approval' : 'queued') : null;
    case 'APPROVE':
      return current === 'awaiting_approval' || current === 'blocked' ? 'queued' : null;
    case 'REJECT':
      return current === 'awaiting_approval' || current === 'blocked' ? 'cancelled' : null;
    case 'START':
      return current === 'queued' ? 'in_progress' : null;
    case 'BLOCK':
      return current === 'in_progress' ? 'blocked' : null;
    case 'UNBLOCK':
      return current === 'blocked' ? 'in_progress' : null;
    case 'REPORT':
      return current === 'in_progress' ? 'reporting' : null;
    case 'REVIEW':
      return current === 'reporting' ? 'review' : null;
    case 'ACCEPT':
      return current === 'review' ? 'completed' : null;
    case 'FAIL':
      return current === 'completed' || current === 'cancelled' ? null : 'failed';
    case 'CANCEL':
      return current === 'completed' ? null : 'cancelled';
    default:
      return null;
  }
}

/** 남은 작업량 → 몬스터 체력. 파생 전용. */
export function monsterHpFromProgress(progress: number): number {
  return Math.max(0, Math.min(100, 100 - progress));
}

export const MONSTER_LABEL: Record<MonsterKind, string> = {
  sprite: '작은 정령',
  scroll: '두루마리 수호자',
  bug: '버그 웜',
  golem: '수정 골렘',
  envoy: '협상 정령',
  shade: '그림자 침입자',
  boss: '보스',
};

/* ─────────────────────────── 비용 견적 ─────────────────────────── */

/**
 * 작업 견적. 실제 서비스에서는 토큰 카운팅 API로 대체한다.
 * 여기서는 "설명 길이 × 난이도" 라는 단순 규칙을 쓰되, 계산 근거를 화면에 그대로 보여준다.
 */
export function estimateStepCost(employee: Employee, difficulty: Difficulty, weight: number): number {
  const model = findModel(employee.binding.provider, employee.binding.model);
  if (!model) return 0;
  const diffFactor = { normal: 1, elite: 2.2, boss: 4.5, raid: 7 }[difficulty];
  // 가정: 입력 12k 토큰 × weight, 출력 2.5k 토큰 × weight
  const inTok = 12_000 * weight * diffFactor;
  const outTok = 2_500 * weight * diffFactor;
  const cost = (inTok / 1_000_000) * model.inputPerM + (outTok / 1_000_000) * model.outputPerM;
  return Math.round(cost * 1000) / 1000;
}

export function estimateTokens(weight: number, difficulty: Difficulty): { input: number; output: number } {
  const diffFactor = { normal: 1, elite: 2.2, boss: 4.5, raid: 7 }[difficulty];
  return {
    input: Math.round(12_000 * weight * diffFactor),
    output: Math.round(2_500 * weight * diffFactor),
  };
}

/* ───────────────────────── 미션 생성기 ───────────────────────── */

interface StepSpec {
  title: string;
  description: string;
  assigneeId: string;
  room: MissionStep['room'];
  workState: MissionStep['workState'];
  monsterKind: MonsterKind;
  monsterName: string;
  weight: number;
  seconds: number;
  handoffTo: string | null;
}

function buildStep(spec: StepSpec, employee: Employee, difficulty: Difficulty): MissionStep {
  return {
    id: nid('step'),
    title: spec.title,
    description: spec.description,
    assigneeId: spec.assigneeId,
    room: spec.room,
    workState: spec.workState,
    monster: { kind: spec.monsterKind, name: spec.monsterName, hpPercent: 100 },
    status: 'pending',
    progress: 0,
    estCostUsd: estimateStepCost(employee, difficulty, spec.weight),
    actualCostUsd: 0,
    estSeconds: spec.seconds,
    handoffTo: spec.handoffTo,
    artifactId: null,
  };
}

/**
 * 첫 공동 프로젝트(튜토리얼 미션).
 * 엔지니어 분석 → 교수 문서 작성 → 총무 취합 → 대표 최종 보고.
 */
export function buildFirstMission(
  employees: Record<string, Employee>,
  companyName: string,
  ceoName: string,
  now: number,
): Mission {
  const admin = employees.emp_admin;
  const engineer = employees.emp_engineer;
  const professor = employees.emp_professor;
  const difficulty: Difficulty = 'elite';

  const steps: MissionStep[] = [
    buildStep(
      {
        title: '업무 접수 및 분해',
        description: '대표 지시를 받아 실행 단위로 쪼개고 담당자를 배정한다.',
        assigneeId: admin.id,
        room: 'ceo_office',
        workState: 'thinking',
        monsterKind: 'sprite',
        monsterName: '흩어진 요구사항',
        weight: 0.4,
        seconds: 8,
        handoffTo: engineer.id,
      },
      admin,
      difficulty,
    ),
    buildStep(
      {
        title: '자료 분석',
        description: '제안서에 쓸 근거 데이터를 수집하고 검증한다.',
        assigneeId: engineer.id,
        room: 'lab',
        workState: 'fighting',
        monsterKind: 'golem',
        monsterName: '수정 골렘',
        weight: 1.2,
        seconds: 16,
        handoffTo: professor.id,
      },
      engineer,
      difficulty,
    ),
    buildStep(
      {
        title: '공식 제안서 작성',
        description: `분석 결과를 바탕으로 「${companyName} 공식 제안서」를 작성한다.`,
        assigneeId: professor.id,
        room: 'sales_room',
        workState: 'writing',
        monsterKind: 'envoy',
        monsterName: '협상 정령',
        weight: 1.0,
        seconds: 16,
        handoffTo: admin.id,
      },
      professor,
      difficulty,
    ),
    buildStep(
      {
        title: '검수 및 취합',
        description: '문서를 검수하고 최종본으로 취합한다.',
        assigneeId: admin.id,
        room: 'meeting',
        workState: 'collaborating',
        monsterKind: 'scroll',
        monsterName: '두루마리 수호자',
        weight: 0.5,
        seconds: 10,
        handoffTo: null,
      },
      admin,
      difficulty,
    ),
    buildStep(
      {
        title: '대표 최종 보고',
        description: `${ceoName} 대표 집무실로 이동해 결과를 보고한다.`,
        assigneeId: admin.id,
        room: 'ceo_office',
        workState: 'mailing',
        monsterKind: 'sprite',
        monsterName: '보고 준비',
        weight: 0.2,
        seconds: 8,
        handoffTo: null,
      },
      admin,
      difficulty,
    ),
  ];

  return assembleMission({
    name: '회사의 첫 번째 공식 제안서를 제작하라',
    objective: `${companyName}의 첫 대외 제안서를 완성해 대표 승인을 받는다.`,
    requester: ceoName,
    ownerId: admin.id,
    participants: [admin.id, engineer.id, professor.id],
    difficulty,
    priority: 'high',
    steps,
    now,
    isTutorial: true,
  });
}

/** 대표가 1:1 대화에서 직접 내리는 단발 업무 지시. */
export function buildDirectMission(
  employee: Employee,
  order: string,
  difficulty: Difficulty,
  ceoName: string,
  now: number,
): Mission {
  const monsterByClass: Record<Employee['jobClass'], { kind: MonsterKind; name: string }> = {
    strategist: { kind: 'scroll', name: '두루마리 수호자' },
    rune_engineer: { kind: 'bug', name: '버그 웜' },
    sage: { kind: 'envoy', name: '협상 정령' },
    sovereign: { kind: 'sprite', name: '작은 정령' },
  };
  const workByClass: Record<Employee['jobClass'], MissionStep['workState']> = {
    strategist: 'collaborating',
    rune_engineer: 'fighting',
    sage: 'writing',
    sovereign: 'working',
  };
  const monster = difficulty === 'boss' || difficulty === 'raid'
    ? { kind: 'boss' as MonsterKind, name: '프로젝트 보스' }
    : monsterByClass[employee.jobClass];

  const seconds = { normal: 12, elite: 20, boss: 32, raid: 42 }[difficulty];

  const work = buildStep(
    {
      title: order.slice(0, 40),
      description: order,
      assigneeId: employee.id,
      room: difficulty === 'boss' || difficulty === 'raid' ? 'dungeon_gate' : employee.homeRoom,
      workState: workByClass[employee.jobClass],
      monsterKind: monster.kind,
      monsterName: monster.name,
      weight: { normal: 0.8, elite: 1.4, boss: 2.6, raid: 3.6 }[difficulty],
      seconds,
      handoffTo: null,
    },
    employee,
    difficulty,
  );

  const report = buildStep(
    {
      title: '대표 보고',
      description: '결과물을 대표 집무실로 가져가 보고한다.',
      assigneeId: employee.id,
      room: 'ceo_office',
      workState: 'mailing',
      monsterKind: 'sprite',
      monsterName: '보고 준비',
      weight: 0.15,
      seconds: 7,
      handoffTo: null,
    },
    employee,
    difficulty,
  );

  return assembleMission({
    name: order.length > 26 ? `${order.slice(0, 26)}…` : order,
    objective: order,
    requester: ceoName,
    ownerId: employee.id,
    participants: [employee.id],
    difficulty,
    priority: 'normal',
    steps: [work, report],
    now,
    isTutorial: false,
  });
}

function assembleMission(input: {
  name: string;
  objective: string;
  requester: string;
  ownerId: string;
  participants: string[];
  difficulty: Difficulty;
  priority: Mission['priority'];
  steps: MissionStep[];
  now: number;
  isTutorial: boolean;
}): Mission {
  const estCostUsd = round3(input.steps.reduce((s, x) => s + x.estCostUsd, 0));
  const estSeconds = input.steps.reduce((s, x) => s + x.estSeconds, 0);
  return {
    id: nid('mis'),
    name: input.name,
    objective: input.objective,
    requester: input.requester,
    ownerId: input.ownerId,
    participants: input.participants,
    difficulty: input.difficulty,
    priority: input.priority,
    status: 'draft',
    steps: input.steps,
    currentStepIndex: 0,
    estCostUsd,
    actualCostUsd: 0,
    estSeconds,
    requiresApproval: false,
    approvalId: null,
    loot: [],
    failureReason: null,
    createdAt: input.now,
    startedAt: null,
    finishedAt: null,
    isTutorial: input.isTutorial,
  };
}

export function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** 업무에 필요한 도구를 담당자 역할에서 추론한다. */
export function toolsFor(employee: Employee): ToolId[] {
  const base: Record<Employee['jobClass'], ToolId[]> = {
    strategist: ['file_read', 'file_write', 'email_send'],
    rune_engineer: ['file_read', 'code_exec', 'web_search'],
    sage: ['file_read', 'file_write', 'web_search', 'crm_read'],
    sovereign: ['file_read'],
  };
  return base[employee.jobClass].filter((t) => employee.binding.allowedTools.includes(t));
}
