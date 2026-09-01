/**
 * 전역 상태 저장소 (Zustand + localStorage 영속화).
 *
 * 보안 관련 규칙 (이 파일에서 강제한다):
 *  1) API 키 원문은 어떤 경로로도 이 상태에 들어오지 않는다. keyRef / maskedKey 만 다룬다.
 *  2) 따라서 localStorage 에 저장되는 값에도 비밀값이 없다.
 *  3) 비용이 발생하는 작업은 승인 게이트를 통과하기 전에는 절대 시작되지 않는다.
 *     (tick 은 awaiting_approval / blocked 상태의 미션을 진행시키지 않는다)
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import { GRID } from '@/data/world';
import {
  AI_EMPLOYEE_SEEDS,
  COMPANY_DEFAULTS,
  GREETINGS,
  PLATFORM_MAKER,
  WALK_SPEED,
  createEmployee,
  findModel,
  roomById,
} from '@/data/seed';
import { advanceAlongPath, findPath } from '@/lib/pathfinding';
import { clamp, nid } from '@/lib/format';
import { appendRecord, compileSystemPrompt, recordModelSwitch } from '@/lib/memoryCompile';
import { seedMemory, type MemoryAgreement } from '@/data/memorySeed';
import {
  EASTER_EGG_CODE,
  advanceEasterEgg,
  initialEasterEgg,
  resetEasterEggEmployees,
  type EasterEggRuntime,
} from '@/data/easterEgg';
import { canAcceptWork, nextAgentState, type AgentEvent } from '@/state/agentMachine';
import {
  buildDirectMission,
  buildFirstMission,
  estimateTokens,
  monsterHpFromProgress,
  nextMissionStatus,
  round3,
  type MissionEvent,
} from '@/state/missionMachine';
import type {
  Approval,
  ApprovalStatus,
  Artifact,
  AuditEntry,
  Company,
  Difficulty,
  Employee,
  EmployeeMemory,
  LedgerEntry,
  Message,
  MessageKind,
  MemoryKind,
  Mission,
  Phase,
  ProviderId,
  Role,
  Session,
  TaskEstimate,
  ToolId,
} from '@/types';

/* ────────────────────────────── 상태 형태 ────────────────────────────── */

export interface WorldState {
  session: Session | null;
  phase: Phase;
  company: Company | null;

  employees: Record<string, Employee>;
  employeeOrder: string[];

  /**
   * 직원별 개인 기억. 성품·업무 원칙·합의사항·교훈을 담으며, 모델(binding)과는
   * 완전히 독립된 저장소다. 모델을 바꿔도 이 값은 그대로 유지된다.
   * 정본은 대표의 구글 드라이브 폴더에 있고, 이 값은 앱이 들고 있는 사본이다.
   */
  memories: Record<string, EmployeeMemory>;

  missions: Record<string, Mission>;
  missionOrder: string[];
  artifacts: Record<string, Artifact>;

  approvals: Approval[];
  ledger: LedgerEntry[];
  audit: AuditEntry[];
  chats: Record<string, Message[]>;

  ui: {
    selectedEmployeeId: string | null;
    openPanel: null | 'missions' | 'approvals' | 'cost' | 'audit' | 'dungeon' | 'people' | 'settings';
    /** 면담 대기열 (순서대로 1:1 면담) */
    interviewQueue: string[];
    toast: string | null;
  };

  /** 튜토리얼 진행 표시 */
  tutorial: { summoned: boolean; interviewsDone: boolean; firstMissionDone: boolean };

  /**
   * 이스터에그 — "탱크형 변형 휠" 데모 시나리오 진행 상태.
   * 새로고침 시 초기화된다(partialize 에 포함하지 않음). 실제 비용·승인과는
   * 완전히 무관한 가상 시나리오임을 항상 배너·보고 문구로 함께 밝힌다.
   */
  easterEgg: EasterEggRuntime;
}

export interface WorldActions {
  loginDemo: (role: Role) => void;
  logout: () => void;

  foundCompany: (input: Omit<Company, 'foundedAt'>) => void;
  buildOffice: () => void;
  summonEmployees: () => void;
  startInterviews: () => void;
  completeInterview: (
    employeeId: string,
    cfg: { scope: string; reportStyle: Employee['reportStyle']; dataAccess: string[] },
  ) => void;

  connectProvider: (
    employeeId: string,
    cfg: {
      provider: ProviderId;
      model: string;
      perTaskLimitUsd: number;
      monthlyLimitUsd: number;
      allowedTools: ToolId[];
    },
  ) => { ok: boolean; error?: string };

  requestLimitChange: (employeeId: string, nextPerTask: number, nextMonthly: number) => void;

  estimateTask: (employeeId: string, order: string, difficulty: Difficulty) => TaskEstimate;
  orderTask: (
    employeeId: string,
    order: string,
    difficulty: Difficulty,
  ) => { ok: boolean; missionId?: string; error?: string };

  createFirstMission: () => void;
  acceptMissionResult: (missionId: string) => void;
  stopMission: (missionId: string) => void;

  decideApproval: (approvalId: string, decision: ApprovalStatus, note?: string) => void;
  requestLeave: (employeeId: string) => void;
  requestReturn: (employeeId: string) => void;

  /**
   * 회의 테이블 더블클릭 → 우선순위 회의 소집.
   * 지금 자유 상태(대기/휴식/낚시 등)인 직원만 회의 테이블로 모은다.
   * 유료 작업 중인 직원은 억지로 중단시키지 않고 "불참"으로 분류한다 —
   * 승인 없이 진행 중인 유료 작업을 끊는 것 자체가 이 앱의 안전 규칙과 충돌하기 때문이다.
   * 회의 자체는 비용이 발생하지 않으므로 승인 게이트를 거치지 않는다.
   */
  callPriorityMeeting: (instruction: string) => { gathered: string[]; busy: string[] };

  /**
   * 로그인 화면의 숨은 제작자 표기에서 코드를 맞히면 호출된다.
   * 코드가 맞으면 필요한 경우 데모 로그인·회사 창립·직원 소환까지 자동으로 처리하고
   * "탱크형 변형 휠" 이스터에그 시나리오를 시작한다. 맞지 않으면 아무 것도 바꾸지 않는다.
   */
  tryEasterEggCode: (code: string) => boolean;
  /** 이스터에그를 도중에 멈추고 세 직원을 안전하게 대기 상태로 되돌린다. */
  stopEasterEgg: () => void;

  sendChat: (employeeId: string, text: string) => void;

  /** 기억 한 줄을 append 한다 (교훈/사건/선호/정정). 기존 기억은 지우지 않는다. */
  addMemoryRecord: (
    employeeId: string,
    input: { kind: MemoryKind; title: string; body: string; source: string; tags?: string[] },
  ) => void;
  /** 대표와의 합의사항을 추가한다. */
  addAgreement: (employeeId: string, statement: string) => void;
  /** 현재 기억으로부터 시스템 프롬프트를 다시 조립한다 (모델 무관 텍스트). */
  compileEmployeePrompt: (employeeId: string) => string;

  selectEmployee: (id: string | null) => void;
  openPanel: (p: WorldState['ui']['openPanel']) => void;
  setToast: (t: string | null) => void;

  tick: (dtMs: number) => void;
  resetAll: () => void;
}

export type Store = WorldState & WorldActions;

/* ────────────────────────────── 초기 상태 ────────────────────────────── */

const initialState: WorldState = {
  session: null,
  phase: 'login',
  company: null,
  employees: {},
  employeeOrder: [],
  memories: {},
  missions: {},
  missionOrder: [],
  artifacts: {},
  approvals: [],
  ledger: [],
  audit: [],
  chats: {},
  ui: { selectedEmployeeId: null, openPanel: null, interviewQueue: [], toast: null },
  tutorial: { summoned: false, interviewsDone: false, firstMissionDone: false },
  easterEgg: initialEasterEgg,
};

/* ────────────────────────────── 보조 함수 ────────────────────────────── */

function audit(list: AuditEntry[], actor: string, action: string, target: string, detail: string): AuditEntry[] {
  const entry: AuditEntry = { id: nid('aud'), ts: Date.now(), actor, action, target, detail };
  // 최신 300건만 보관한다.
  return [entry, ...list].slice(0, 300);
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

/** 상태 머신을 통과한 전이만 적용한다. 거부되면 false 를 돌려준다. */
function applyAgentEvent(emp: Employee, event: AgentEvent): boolean {
  const next = nextAgentState(emp.state, event);
  if (next === null) return false;
  emp.state = next;
  return true;
}

function applyMissionEvent(mission: Mission, event: MissionEvent): boolean {
  const next = nextMissionStatus(mission.status, event);
  if (next === null) return false;
  mission.status = next;
  return true;
}

function routeTo(emp: Employee, roomId: Employee['homeRoom']): void {
  const room = roomById(roomId);
  emp.destinationRoom = roomId;
  emp.path = findPath(GRID, emp.pos, room.anchor);
}

/** 이 직원이 지금 새 비용을 발생시켜도 되는지 검사한다. */
export function budgetBlockers(
  emp: Employee,
  company: Company | null,
  spentTotalUsd: number,
  cost: number,
): string[] {
  const out: string[] = [];
  if (cost > emp.binding.perTaskLimitUsd) {
    out.push(
      `작업 1건 비용 한도 초과 (예상 $${cost.toFixed(3)} > 한도 $${emp.binding.perTaskLimitUsd.toFixed(2)})`,
    );
  }
  if (emp.spendMonthUsd + cost > emp.binding.monthlyLimitUsd) {
    out.push(
      `직원 월간 한도 초과 (사용 $${emp.spendMonthUsd.toFixed(2)} + 예상 $${cost.toFixed(3)} > 한도 $${emp.binding.monthlyLimitUsd.toFixed(2)})`,
    );
  }
  if (company && spentTotalUsd + cost > company.monthlyBudgetUsd) {
    out.push(`회사 월간 예산 초과 (예산 $${company.monthlyBudgetUsd.toFixed(2)})`);
  }
  return out;
}

function totalSpend(ledger: LedgerEntry[]): number {
  return round3(ledger.reduce((s, e) => s + e.costUsd, 0));
}

/* ────────────────────────────── 스토어 ──────────────────────────────── */

export const useWorld = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState,

      /* ── 인증 (데모) ───────────────────────────────────────────────── */
      loginDemo: (role) => {
        const s = get();
        if (role === 'human_staff' && !s.company) {
          set({ ui: { ...s.ui, toast: '인간 직원 로그인은 회사 창립 이후에 활성화됩니다.' } });
          return;
        }
        const accountName =
          role === 'ceo'
            ? (s.company?.ceoName ?? '대표 (데모)')
            : role === 'platform_admin'
              ? PLATFORM_MAKER
              : '인간 직원 (데모)';
        set({
          session: { role, accountName, demo: true },
          phase: s.company ? 'live' : 'founding',
          audit: audit(s.audit, accountName, '데모 로그인', role, '실제 인증 아님 (백엔드 구현 항목)'),
        });
      },

      logout: () => {
        const s = get();
        set({
          session: null,
          phase: s.company ? 'login' : 'login',
          audit: audit(s.audit, s.session?.accountName ?? '-', '로그아웃', '-', ''),
        });
      },

      /* ── 회사 창립 ─────────────────────────────────────────────────── */
      foundCompany: (input) => {
        const s = get();
        const company: Company = { ...input, foundedAt: Date.now() };
        set({
          company,
          phase: 'office_build',
          session: s.session ? { ...s.session, accountName: input.ceoName } : s.session,
          audit: audit(s.audit, input.ceoName, '회사 창립', company.name, `${company.branch} / ${company.currency}`),
        });
      },

      buildOffice: () => {
        const s = get();
        set({
          phase: 'summon',
          audit: audit(s.audit, s.company?.ceoName ?? '-', '사무실 생성', '본사 1층', '10개 공간 개설'),
        });
      },

      summonEmployees: () => {
        const s = get();
        const now = Date.now();
        const employees: Record<string, Employee> = { ...s.employees };
        const memories: Record<string, EmployeeMemory> = { ...s.memories };
        let chats = { ...s.chats };
        for (const spec of AI_EMPLOYEE_SEEDS) {
          employees[spec.id] = createEmployee(spec, now);
          // 기억은 소환 시점에 드라이브 시드로부터 채워진다. 이후로는 이 앱 안에서만
          // append 되며(교훈/합의), 모델을 연결·교체해도 이 값은 건드리지 않는다.
          memories[spec.id] = seedMemory(spec.id);
          chats = pushMessage(chats, spec.id, 'agent', 'system', GREETINGS[spec.id]);
        }
        set({
          employees,
          employeeOrder: AI_EMPLOYEE_SEEDS.map((x) => x.id),
          memories,
          chats,
          tutorial: { ...s.tutorial, summoned: true },
          audit: audit(
            s.audit,
            s.company?.ceoName ?? '-',
            'AI 직원 영입',
            `AI ${AI_EMPLOYEE_SEEDS.length}명`,
            AI_EMPLOYEE_SEEDS.map((x) => x.name).join(' / '),
          ),
        });
      },

      startInterviews: () => {
        const s = get();
        set({
          phase: 'interview',
          ui: {
            ...s.ui,
            interviewQueue: s.employeeOrder.filter((id) => !s.employees[id]?.interviewed),
            selectedEmployeeId: s.employeeOrder[0] ?? null,
          },
        });
      },

      completeInterview: (employeeId, cfg) => {
        const s = get();
        const emp = s.employees[employeeId];
        if (!emp) return;
        const updated: Employee = {
          ...emp,
          scope: cfg.scope,
          reportStyle: cfg.reportStyle,
          dataAccess: cfg.dataAccess,
          interviewed: true,
        };
        const queue = s.ui.interviewQueue.filter((id) => id !== employeeId);
        const done = queue.length === 0;
        set({
          employees: { ...s.employees, [employeeId]: updated },
          ui: { ...s.ui, interviewQueue: queue, selectedEmployeeId: queue[0] ?? null },
          tutorial: { ...s.tutorial, interviewsDone: done },
          phase: done ? 'first_mission' : 'interview',
          chats: pushMessage(
            s.chats,
            employeeId,
            'agent',
            'system',
            `면담 완료. 업무 범위를 "${cfg.scope}" 로, 보고 방식을 "${
              { concise: '간결', detailed: '상세', bullet: '요점 나열' }[cfg.reportStyle]
            }" 로 설정했습니다.`,
          ),
          audit: audit(s.audit, s.company?.ceoName ?? '-', '1:1 면담 완료', emp.name, cfg.scope),
        });
      },

      /* ── API 연결 ──────────────────────────────────────────────────── */
      connectProvider: (employeeId, cfg) => {
        const s = get();
        const emp = s.employees[employeeId];
        if (!emp) return { ok: false, error: '직원을 찾을 수 없습니다.' };
        // 유료 모델 연결은 대표 권한이 필요하다.
        if (s.session?.role !== 'ceo') {
          return { ok: false, error: '유료 모델 연결은 대표만 승인할 수 있습니다.' };
        }
        const model = findModel(cfg.provider, cfg.model);
        if (!model) return { ok: false, error: '모델을 찾을 수 없습니다.' };

        const paid = model.inputPerM > 0 || model.outputPerM > 0;
        // 승인 기록을 남긴다. (대표가 직접 수행했으므로 즉시 승인 상태로 기록)
        const approval: Approval | null = paid
          ? {
              id: nid('apr'),
              kind: 'paid_model',
              title: `${emp.name}에게 유료 모델 연결`,
              reason: `${model.label} 연결 및 비용 한도 설정`,
              requesterId: employeeId,
              participants: [employeeId],
              estCostUsd: cfg.perTaskLimitUsd,
              estSeconds: 0,
              risk: 'medium',
              model: model.id,
              tools: cfg.allowedTools,
              dataScope: emp.dataAccess,
              status: 'approved',
              note: '대표가 API 연결 마법사에서 직접 승인',
              missionId: null,
              createdAt: Date.now(),
              decidedAt: Date.now(),
            }
          : null;

        const updated: Employee = {
          ...emp,
          binding: {
            provider: cfg.provider,
            model: cfg.model,
            status: 'connected',
            // ⚠️ 실제 키는 서버에만 존재한다. 프론트엔드는 참조 ID와 마스킹 문자열만 갖는다.
            keyRef: `srv-keyref://${cfg.provider}/${employeeId}`,
            maskedKey: `${cfg.provider.slice(0, 2)}-…••••${Math.floor(1000 + Math.random() * 8999)}`,
            perTaskLimitUsd: cfg.perTaskLimitUsd,
            monthlyLimitUsd: cfg.monthlyLimitUsd,
            allowedTools: cfg.allowedTools,
            lastTestedAt: Date.now(),
          },
        };

        // 모델 연결/교체는 기억 이력에만 남긴다. 기억 파일(정체성·원칙·합의·교훈) 자체는
        // 건드리지 않는다 — 이것이 "모델을 바꿔도 기억 구조는 유지된다"의 실제 지점이다.
        const memory = s.memories[employeeId];
        const memories = memory
          ? { ...s.memories, [employeeId]: recordModelSwitch(memory, cfg.provider, cfg.model, '대표가 API 마법사에서 연결') }
          : s.memories;

        set({
          employees: { ...s.employees, [employeeId]: updated },
          memories,
          approvals: approval ? [approval, ...s.approvals] : s.approvals,
          chats: pushMessage(
            s.chats,
            employeeId,
            'agent',
            'system',
            `마력 코어 연결 완료 — ${model.label}. 작업당 $${cfg.perTaskLimitUsd.toFixed(2)}, 월 $${cfg.monthlyLimitUsd.toFixed(2)} 한도로 동작합니다.`,
          ),
          audit: audit(
            s.audit,
            s.company?.ceoName ?? '-',
            'API 연결',
            emp.name,
            `${cfg.provider}/${cfg.model} · 키는 서버 보관(참조 ID만 보유)`,
          ),
        });
        return { ok: true };
      },

      requestLimitChange: (employeeId, nextPerTask, nextMonthly) => {
        const s = get();
        const emp = s.employees[employeeId];
        if (!emp) return;
        const increasing =
          nextPerTask > emp.binding.perTaskLimitUsd || nextMonthly > emp.binding.monthlyLimitUsd;
        if (!increasing) {
          // 한도를 낮추는 것은 승인 없이 즉시 반영한다.
          set({
            employees: {
              ...s.employees,
              [employeeId]: {
                ...emp,
                binding: { ...emp.binding, perTaskLimitUsd: nextPerTask, monthlyLimitUsd: nextMonthly },
              },
            },
            audit: audit(s.audit, s.session?.accountName ?? '-', '비용 한도 인하', emp.name, `${nextPerTask}/${nextMonthly}`),
          });
          return;
        }
        const approval: Approval = {
          id: nid('apr'),
          kind: 'raise_limit',
          title: `${emp.name} 비용 한도 인상`,
          reason: `작업당 $${emp.binding.perTaskLimitUsd} → $${nextPerTask}, 월 $${emp.binding.monthlyLimitUsd} → $${nextMonthly}`,
          requesterId: employeeId,
          participants: [employeeId],
          estCostUsd: nextMonthly - emp.binding.monthlyLimitUsd,
          estSeconds: 0,
          risk: 'high',
          model: emp.binding.model,
          tools: emp.binding.allowedTools,
          dataScope: emp.dataAccess,
          status: 'pending',
          note: null,
          missionId: null,
          createdAt: Date.now(),
          decidedAt: null,
        };
        set({
          approvals: [approval, ...s.approvals],
          ui: { ...s.ui, toast: '비용 한도 인상은 대표 승인이 필요합니다. 승인 센터를 확인하세요.' },
          audit: audit(s.audit, s.session?.accountName ?? '-', '한도 인상 요청', emp.name, approval.reason),
        });
      },

      /* ── 업무 지시 ─────────────────────────────────────────────────── */
      estimateTask: (employeeId, order, difficulty) => {
        const s = get();
        const emp = s.employees[employeeId];
        if (!emp) {
          return {
            assigneeId: employeeId,
            estSeconds: 0,
            estCostUsd: 0,
            tools: [],
            dataScope: [],
            requiresApproval: false,
            approvalReasons: [],
            blockers: ['직원을 찾을 수 없습니다.'],
          };
        }
        const draft = buildDirectMission(emp, order || '(내용 없음)', difficulty, s.company?.ceoName ?? '대표', Date.now());
        const spent = totalSpend(s.ledger);

        const blockers: string[] = [];
        if (emp.onLeave || emp.state === 'on_leave') blockers.push('휴직 중인 직원에게는 업무를 배정할 수 없습니다.');
        if (emp.binding.status !== 'connected') blockers.push('AI 제공자에 연결되어 있지 않습니다.');
        if (!canAcceptWork(emp.state)) blockers.push(`현재 상태(${emp.state})에서는 새 업무를 받을 수 없습니다.`);
        if (!order.trim()) blockers.push('업무 내용을 입력하세요.');

        const approvalReasons = budgetBlockers(emp, s.company, spent, draft.estCostUsd);
        if (difficulty === 'boss' || difficulty === 'raid') {
          approvalReasons.push('대규모 프로젝트(보스/레이드)는 대표 승인이 필요합니다.');
        }
        if (emp.binding.allowedTools.includes('email_send')) {
          approvalReasons.push('외부 메일 발송 도구가 포함되어 승인이 필요합니다.');
        }

        return {
          assigneeId: employeeId,
          estSeconds: draft.estSeconds,
          estCostUsd: draft.estCostUsd,
          tools: emp.binding.allowedTools,
          dataScope: emp.dataAccess,
          requiresApproval: approvalReasons.length > 0,
          approvalReasons,
          blockers,
        };
      },

      orderTask: (employeeId, order, difficulty) => {
        const s = get();
        const emp = s.employees[employeeId];
        if (!emp) return { ok: false, error: '직원을 찾을 수 없습니다.' };
        const est = get().estimateTask(employeeId, order, difficulty);
        if (est.blockers.length > 0) return { ok: false, error: est.blockers[0] };

        const mission = buildDirectMission(emp, order, difficulty, s.company?.ceoName ?? '대표', Date.now());
        mission.requiresApproval = est.requiresApproval;

        let approvals = s.approvals;
        if (est.requiresApproval) {
          const approval: Approval = {
            id: nid('apr'),
            kind: difficulty === 'boss' || difficulty === 'raid' ? 'boss_raid' : 'large_project',
            title: mission.name,
            reason: est.approvalReasons.join(' / '),
            requesterId: employeeId,
            participants: mission.participants,
            estCostUsd: mission.estCostUsd,
            estSeconds: mission.estSeconds,
            risk: difficulty === 'raid' ? 'high' : difficulty === 'boss' ? 'high' : 'medium',
            model: emp.binding.model,
            tools: emp.binding.allowedTools,
            dataScope: emp.dataAccess,
            status: 'pending',
            note: null,
            missionId: mission.id,
            createdAt: Date.now(),
            decidedAt: null,
          };
          mission.approvalId = approval.id;
          approvals = [approval, ...approvals];
        }
        applyMissionEvent(mission, { type: 'SUBMIT', requiresApproval: est.requiresApproval });

        set({
          missions: { ...s.missions, [mission.id]: mission },
          missionOrder: [mission.id, ...s.missionOrder],
          approvals,
          chats: pushMessage(
            s.chats,
            employeeId,
            'ceo',
            'task_order',
            order,
          ),
          audit: audit(
            s.audit,
            s.company?.ceoName ?? '-',
            '업무 지시',
            emp.name,
            `${mission.name} · 예상 $${mission.estCostUsd.toFixed(3)} · 승인필요 ${est.requiresApproval ? 'Y' : 'N'}`,
          ),
          ui: {
            ...s.ui,
            toast: est.requiresApproval
              ? '승인이 필요한 작업입니다. 승인 전에는 어떤 API 호출도 시작되지 않습니다.'
              : null,
          },
        });
        return { ok: true, missionId: mission.id };
      },

      createFirstMission: () => {
        const s = get();
        if (!s.company) return;
        const mission = buildFirstMission(s.employees, s.company.name, s.company.ceoName, Date.now());
        // 튜토리얼 미션은 대표가 직접 발주하므로 승인 게이트를 통과한 것으로 본다.
        applyMissionEvent(mission, { type: 'SUBMIT', requiresApproval: false });
        set({
          missions: { ...s.missions, [mission.id]: mission },
          missionOrder: [mission.id, ...s.missionOrder],
          phase: 'live',
          chats: pushMessage(s.chats, 'emp_admin', 'ceo', 'task_order', mission.objective),
          audit: audit(s.audit, s.company.ceoName, '첫 공동 프로젝트 발주', mission.name, `예상 $${mission.estCostUsd.toFixed(3)}`),
        });
      },

      acceptMissionResult: (missionId) => {
        const s = get();
        const mission = s.missions[missionId];
        if (!mission) return;
        const copy: Mission = { ...mission, steps: mission.steps.map((x) => ({ ...x })) };
        if (!applyMissionEvent(copy, { type: 'ACCEPT' })) return;
        copy.finishedAt = Date.now();
        set({
          missions: { ...s.missions, [missionId]: copy },
          tutorial: copy.isTutorial ? { ...s.tutorial, firstMissionDone: true } : s.tutorial,
          audit: audit(s.audit, s.company?.ceoName ?? '-', '결과 승인', copy.name, `실제 비용 $${copy.actualCostUsd.toFixed(3)}`),
          ui: { ...s.ui, toast: '퀘스트 완료 — 결과물이 보관함에 저장되었습니다.' },
        });
      },

      stopMission: (missionId) => {
        const s = get();
        const mission = s.missions[missionId];
        if (!mission) return;
        const copy: Mission = { ...mission, steps: mission.steps.map((x) => ({ ...x })) };
        if (!applyMissionEvent(copy, { type: 'CANCEL' })) return;
        copy.failureReason = '대표가 업무를 중단했습니다.';
        copy.finishedAt = Date.now();
        const employees = { ...s.employees };
        for (const pid of copy.participants) {
          const e = employees[pid];
          if (!e || e.currentMissionId !== missionId) continue;
          const draft = { ...e, pos: { ...e.pos }, path: [] as typeof e.path };
          applyAgentEvent(draft, { type: 'STOP' });
          draft.currentMissionId = null;
          draft.currentStepId = null;
          draft.destinationRoom = draft.homeRoom;
          routeTo(draft, draft.homeRoom);
          employees[pid] = draft;
        }
        set({
          missions: { ...s.missions, [missionId]: copy },
          employees,
          audit: audit(s.audit, s.company?.ceoName ?? '-', '업무 중단', copy.name, '전투도 함께 중단됨'),
        });
      },

      /* ── 승인 ──────────────────────────────────────────────────────── */
      decideApproval: (approvalId, decision, note) => {
        const s = get();
        const approval = s.approvals.find((a) => a.id === approvalId);
        if (!approval || approval.status !== 'pending') return;

        const approvals = s.approvals.map((a) =>
          a.id === approvalId ? { ...a, status: decision, note: note ?? null, decidedAt: Date.now() } : a,
        );
        let employees = s.employees;
        let missions = s.missions;
        let chats = s.chats;

        const positive = decision === 'approved' || decision === 'conditional';

        if (approval.missionId) {
          const mission = s.missions[approval.missionId];
          if (mission) {
            const copy: Mission = { ...mission, steps: mission.steps.map((x) => ({ ...x })) };
            if (positive) applyMissionEvent(copy, { type: 'APPROVE' });
            else {
              applyMissionEvent(copy, { type: 'REJECT', reason: note ?? '거절' });
              copy.failureReason = note ?? '대표 거절';
            }
            missions = { ...s.missions, [copy.id]: copy };
          }
        }

        // 승인 대기 중이던 담당자를 풀어준다.
        const emp = s.employees[approval.requesterId];
        if (emp && emp.state === 'awaiting_approval') {
          const draft: Employee = { ...emp, pos: { ...emp.pos }, path: [...emp.path] };
          if (positive) {
            applyAgentEvent(draft, { type: 'APPROVED' });
          } else {
            applyAgentEvent(draft, { type: 'STOP' });
            draft.currentMissionId = null;
            draft.currentStepId = null;
            routeTo(draft, draft.homeRoom);
          }
          employees = { ...s.employees, [emp.id]: draft };
        }

        // 한도 인상 승인 반영
        if (approval.kind === 'raise_limit' && positive && emp) {
          const target = employees[emp.id] ?? emp;
          const parsed = /\$([\d.]+) → \$([\d.]+),.*\$([\d.]+) → \$([\d.]+)/.exec(approval.reason);
          if (parsed) {
            employees = {
              ...employees,
              [emp.id]: {
                ...target,
                binding: {
                  ...target.binding,
                  perTaskLimitUsd: Number(parsed[2]),
                  monthlyLimitUsd: Number(parsed[4]),
                },
              },
            };
          }
        }

        // 휴직 / 복귀 승인 반영
        if ((approval.kind === 'leave' || approval.kind === 'return') && positive && emp) {
          const target = employees[emp.id] ?? emp;
          const draft: Employee = { ...target, pos: { ...target.pos }, path: [] };
          if (approval.kind === 'leave') {
            applyAgentEvent(draft, { type: 'STOP' });
            if (applyAgentEvent(draft, { type: 'LEAVE' })) draft.onLeave = true;
          } else {
            if (applyAgentEvent(draft, { type: 'RETURN' })) draft.onLeave = false;
          }
          employees = { ...employees, [emp.id]: draft };
        }

        if (emp) {
          chats = pushMessage(
            chats,
            emp.id,
            'system',
            positive ? 'system' : 'warning',
            positive
              ? `대표 승인 완료 — ${approval.title}${note ? ` (조건: ${note})` : ''}`
              : `대표 ${decision === 'rejected' ? '거절' : '수정 요청'} — ${approval.title}${note ? ` (${note})` : ''}`,
          );
        }

        set({
          approvals,
          employees,
          missions,
          chats,
          audit: audit(
            s.audit,
            s.company?.ceoName ?? '-',
            `승인 처리(${decision})`,
            approval.title,
            note ?? '',
          ),
        });
      },

      requestLeave: (employeeId) => {
        const s = get();
        const emp = s.employees[employeeId];
        if (!emp || emp.onLeave) return;
        const approval: Approval = {
          id: nid('apr'),
          kind: 'leave',
          title: `${emp.name} 휴직 요청`,
          reason: '업무량 조정 및 비용 절감',
          requesterId: employeeId,
          participants: [employeeId],
          estCostUsd: 0,
          estSeconds: 0,
          risk: 'low',
          model: emp.binding.model,
          tools: [],
          dataScope: [],
          status: 'pending',
          note: null,
          missionId: null,
          createdAt: Date.now(),
          decidedAt: null,
        };
        set({
          approvals: [approval, ...s.approvals],
          ui: { ...s.ui, toast: '휴직은 대표 승인 후 적용됩니다.' },
          audit: audit(s.audit, emp.name, '휴직 요청', emp.name, ''),
        });
      },

      requestReturn: (employeeId) => {
        const s = get();
        const emp = s.employees[employeeId];
        if (!emp || !emp.onLeave) return;
        const approval: Approval = {
          id: nid('apr'),
          kind: 'return',
          title: `${emp.name} 복귀 요청`,
          reason: '업무 재개',
          requesterId: employeeId,
          participants: [employeeId],
          estCostUsd: 0,
          estSeconds: 0,
          risk: 'low',
          model: emp.binding.model,
          tools: [],
          dataScope: [],
          status: 'pending',
          note: null,
          missionId: null,
          createdAt: Date.now(),
          decidedAt: null,
        };
        set({ approvals: [approval, ...s.approvals], audit: audit(s.audit, emp.name, '복귀 요청', emp.name, '') });
      },

      /* ── 회의 소집 ────────────────────────────────────────────────── */
      callPriorityMeeting: (instruction) => {
        const s = get();
        if (!s.company) return { gathered: [], busy: [] };
        const text = instruction.trim();

        const gathered: string[] = [];
        const busy: string[] = [];
        const employees = { ...s.employees };
        let chats = s.chats;

        for (const id of s.employeeOrder) {
          const emp = employees[id];
          if (!emp) continue;

          // 이미 걸어가는 중(업무 배정 없이)이면 상태 전이 없이 목적지만 바꾼다.
          // 그 외에는 STOP/이동 전이가 열려 있는 자유 상태에서만 소집에 응한다.
          const alreadyFreelyWalking = emp.state === 'walking' && !emp.currentMissionId;
          if (emp.onLeave || !(alreadyFreelyWalking || canAcceptWork(emp.state))) {
            busy.push(id);
            continue;
          }

          const draft: Employee = { ...emp, pos: { ...emp.pos }, path: [...emp.path] };
          routeTo(draft, 'meeting');
          if (!alreadyFreelyWalking) applyAgentEvent(draft, { type: 'GO' });
          draft.lastIdleAt = Date.now();
          employees[id] = draft;
          gathered.push(id);

          chats = pushMessage(
            chats,
            id,
            'ceo',
            text ? 'task_order' : 'system',
            text ? `[우선순위 회의] ${text}` : '[우선순위 회의] 회의 테이블로 집합해 주세요.',
          );
        }

        set({
          employees,
          chats,
          audit: audit(
            s.audit,
            s.company.ceoName,
            '우선순위 회의 소집',
            '회의 테이블',
            `${gathered.length}명 집합${busy.length ? ` · ${busy.length}명 업무 중이라 불참` : ''}${text ? ` · "${text}"` : ''}`,
          ),
          ui: {
            ...s.ui,
            toast:
              gathered.length > 0
                ? `${gathered.length}명이 회의 테이블로 모입니다.${busy.length ? ` (${busy.length}명은 업무 중이라 나중에 합류)` : ''}`
                : '지금 모일 수 있는 직원이 없습니다 — 전원 업무 중이거나 휴직 중입니다.',
          },
        });

        return { gathered, busy };
      },

      /* ── 이스터에그 ───────────────────────────────────────────────── */
      tryEasterEggCode: (code) => {
        if (code.trim() !== EASTER_EGG_CODE) return false;

        if (!get().session) get().loginDemo('ceo');
        if (!get().company) {
          get().foundCompany({ ...COMPANY_DEFAULTS });
          get().buildOffice();
        }
        if (Object.keys(get().employees).length < 3) get().summonEmployees();

        const s = get();
        set({
          phase: 'live',
          tutorial: { summoned: true, interviewsDone: true, firstMissionDone: true },
          easterEgg: { ...initialEasterEgg, unlocked: true, active: true, startedAt: Date.now() },
          audit: audit(
            s.audit,
            PLATFORM_MAKER,
            '이스터에그 발견',
            '탱크형 변형 휠 프로젝트',
            '데모 시나리오 시작 (약 20분 · 실제 비용 없음)',
          ),
          ui: { ...s.ui, toast: '🥚 이스터에그 발견! "탱크형 변형 휠" 프로젝트 데모가 시작됩니다.' },
        });
        return true;
      },

      stopEasterEgg: () => {
        const s = get();
        if (!s.easterEgg.active) return;
        set({
          employees: resetEasterEggEmployees(s.employees),
          easterEgg: { ...initialEasterEgg, unlocked: true },
          audit: audit(s.audit, s.session?.accountName ?? PLATFORM_MAKER, '이스터에그 중단', '탱크형 변형 휠 프로젝트', '수동 종료'),
          ui: { ...s.ui, toast: '이스터에그 데모를 종료했습니다.' },
        });
      },

      /* ── UI ───────────────────────────────────────────────────────── */
      sendChat: (employeeId, text) => {
        const s = get();
        const emp = s.employees[employeeId];
        if (!emp || !text.trim()) return;
        let chats = pushMessage(s.chats, employeeId, 'ceo', 'chat', text);
        // 목(mock) 응답. 실제 서비스에서는 서버가 제공자 API를 호출한다.
        const reply = emp.onLeave
          ? '휴직 중입니다. 복귀 승인 후 업무를 다시 받을 수 있습니다.'
          : emp.binding.status !== 'connected'
            ? '아직 마력 코어(AI 제공자)에 연결되지 않았습니다. 연결 후 업무 수행이 가능합니다.'
            : `확인했습니다. "${text.trim().slice(0, 30)}" — 정식 업무로 진행하시려면 업무 지시 버튼을 사용해 주세요. 지시 전에 예상 비용과 승인 필요 여부를 보여드립니다.`;
        chats = pushMessage(chats, employeeId, 'agent', 'chat', reply);
        set({ chats });
      },

      /* ── 개인 기억 ─────────────────────────────────────────────────── */
      addMemoryRecord: (employeeId, input) => {
        const s = get();
        const memory = s.memories[employeeId];
        const emp = s.employees[employeeId];
        if (!memory || !emp) return;
        const updated = appendRecord(memory, {
          kind: input.kind,
          title: input.title,
          body: input.body,
          source: input.source,
          confidence: 'medium',
          tags: input.tags ?? [],
        });
        set({
          memories: { ...s.memories, [employeeId]: updated },
          audit: audit(s.audit, s.company?.ceoName ?? '-', '기억 기록', emp.name, input.title),
        });
      },

      addAgreement: (employeeId, statement) => {
        const s = get();
        const memory = s.memories[employeeId];
        const emp = s.employees[employeeId];
        if (!memory || !emp || !statement.trim()) return;
        const entry: MemoryAgreement = {
          id: nid('agr'),
          at: Date.now(),
          with: 'ceo',
          statement: statement.trim(),
          status: 'active',
          source: 'chat',
          supersedes: null,
        };
        set({
          memories: {
            ...s.memories,
            [employeeId]: { ...memory, agreements: [...memory.agreements, entry], updatedAt: Date.now() },
          },
          audit: audit(s.audit, s.company?.ceoName ?? '-', '합의사항 추가', emp.name, statement.trim()),
        });
      },

      compileEmployeePrompt: (employeeId) => {
        const memory = get().memories[employeeId];
        if (!memory) return '';
        return compileSystemPrompt(memory);
      },

      selectEmployee: (id) => set((s) => ({ ui: { ...s.ui, selectedEmployeeId: id } })),
      openPanel: (p) => set((s) => ({ ui: { ...s.ui, openPanel: p } })),
      setToast: (t) => set((s) => ({ ui: { ...s.ui, toast: t } })),

      /* ── 시뮬레이션 루프 ──────────────────────────────────────────── */
      tick: (dtMs) => set((s) => advanceWorld(s, dtMs)),

      resetAll: () => set({ ...initialState }),
    }),
    {
      name: 'guild-office-v1',
      storage: createJSONStorage(() => localStorage),
      /**
       * 영속화 대상. UI 임시 상태는 저장하지 않는다.
       * 비밀값은 애초에 상태에 존재하지 않으므로 여기서 걸러낼 것도 없다.
       */
      partialize: (s) => ({
        session: s.session,
        phase: s.phase,
        company: s.company,
        employees: s.employees,
        employeeOrder: s.employeeOrder,
        memories: s.memories,
        missions: s.missions,
        missionOrder: s.missionOrder,
        artifacts: s.artifacts,
        approvals: s.approvals,
        ledger: s.ledger,
        audit: s.audit,
        chats: s.chats,
        tutorial: s.tutorial,
      }),
    },
  ),
);

/* ─────────────────────── 월드 진행 (tick 본체) ─────────────────────── */

/**
 * 한 프레임 진행. 순수 함수로 유지해 테스트에서 직접 호출할 수 있게 한다.
 *
 * 중요: awaiting_approval / blocked / draft 상태의 미션은 절대 진행하지 않는다.
 * 이것이 "승인 없는 유료 작업 차단" 규칙의 실제 집행 지점이다.
 */
export function advanceWorld(s: WorldState, dtMs: number): Partial<WorldState> {
  const dt = dtMs / 1000;
  const now = Date.now();

  const employees: Record<string, Employee> = {};
  for (const [k, v] of Object.entries(s.employees)) {
    employees[k] = { ...v, pos: { ...v.pos }, path: v.path.map((p) => ({ ...p })) };
  }
  const missions: Record<string, Mission> = {};
  for (const [k, v] of Object.entries(s.missions)) {
    missions[k] = { ...v, steps: v.steps.map((x) => ({ ...x, monster: { ...x.monster } })) };
  }

  let ledger = s.ledger;
  let artifacts = s.artifacts;
  let chats = s.chats;
  let approvals = s.approvals;
  let auditLog = s.audit;
  let memories = s.memories;

  /* 1) 이동 처리 */
  for (const emp of Object.values(employees)) {
    if (emp.path.length === 0) continue;
    const moved = advanceAlongPath(emp.pos, emp.path, WALK_SPEED, dt);
    emp.pos = moved.pos;
    emp.path = moved.path;
  }

  /* 2) 미션 진행 */
  for (const mission of Object.values(missions)) {
    if (mission.status === 'queued') {
      if (!applyMissionEvent(mission, { type: 'START' })) continue;
      mission.startedAt = now;
      mission.currentStepIndex = 0;
    }
    if (mission.status !== 'in_progress') continue;

    const step = mission.steps[mission.currentStepIndex];
    if (!step) continue;
    const emp = employees[step.assigneeId];
    if (!emp) continue;

    /* 2-1) 단계 시작 */
    if (step.status === 'pending') {
      if (emp.onLeave || emp.state === 'on_leave') {
        applyMissionEvent(mission, { type: 'BLOCK', reason: '담당자 휴직' });
        mission.failureReason = `${emp.name} 휴직 중 — 업무 배정 불가`;
        step.status = 'blocked';
        continue;
      }
      const spent = totalSpend(ledger);
      const blockers = budgetBlockers(emp, s.company, spent, step.estCostUsd);
      if (blockers.length > 0) {
        // 예산 초과 → 승인 게이트로 보낸다. API 호출은 시작되지 않는다.
        applyMissionEvent(mission, { type: 'BLOCK', reason: blockers.join(' / ') });
        step.status = 'blocked';
        applyAgentEvent(emp, { type: 'NEED_APPROVAL' });
        const already = approvals.some(
          (a) => a.missionId === mission.id && a.kind === 'budget_overrun_resume' && a.status === 'pending',
        );
        if (!already) {
          approvals = [
            {
              id: nid('apr'),
              kind: 'budget_overrun_resume',
              title: `${mission.name} — 예산 초과로 중단`,
              reason: blockers.join(' / '),
              requesterId: emp.id,
              participants: mission.participants,
              estCostUsd: step.estCostUsd,
              estSeconds: step.estSeconds,
              risk: 'high',
              model: emp.binding.model,
              tools: emp.binding.allowedTools,
              dataScope: emp.dataAccess,
              status: 'pending',
              note: null,
              missionId: mission.id,
              createdAt: now,
              decidedAt: null,
            },
            ...approvals,
          ];
          chats = pushMessage(chats, emp.id, 'agent', 'approval_request', `보스방 앞에서 대기 중입니다. ${blockers.join(' / ')}`);
          auditLog = audit(auditLog, emp.name, '예산 초과 중단', mission.name, blockers.join(' / '));
        }
        continue;
      }

      if (!applyAgentEvent(emp, { type: 'ASSIGN' })) continue;
      step.status = 'active';
      emp.currentMissionId = mission.id;
      emp.currentStepId = step.id;
      routeTo(emp, step.room);
      chats = pushMessage(chats, emp.id, 'system', 'system', `[단계 시작] ${step.title} — ${roomById(step.room).name}(으)로 이동합니다.`);
      continue;
    }

    if (step.status !== 'active') continue;

    /* 2-2) 도착 → 작업 시작 */
    if (emp.state === 'walking' && emp.path.length === 0) {
      applyAgentEvent(emp, { type: 'ARRIVE' });
      applyAgentEvent(emp, { type: 'START_WORK', work: step.workState });
      continue;
    }
    // 'thinking' 자체가 작업 상태인 단계도 있으므로, 다를 때만 전환한다.
    if (emp.state === 'thinking' && step.workState !== 'thinking') {
      applyAgentEvent(emp, { type: 'START_WORK', work: step.workState });
      continue;
    }

    /* 2-3) 진행률 누적 — 실제 업무 진행률이 원본, 몬스터 체력은 파생 */
    if (emp.state === step.workState) {
      const delta = (dt / step.estSeconds) * 100;
      step.progress = clamp(step.progress + delta, 0, 100);
      step.monster.hpPercent = monsterHpFromProgress(step.progress);
      step.actualCostUsd = round3((step.estCostUsd * step.progress) / 100);
      emp.focus = clamp(emp.focus - delta * 0.05, 30, 100);

      if (step.progress >= 100) {
        /* 2-4) 단계 완료 */
        applyAgentEvent(emp, { type: 'COMPLETE' });
        step.status = 'done';
        step.actualCostUsd = step.estCostUsd;

        const tok = estimateTokens(1, mission.difficulty);
        const entry: LedgerEntry = {
          id: nid('led'),
          ts: now,
          employeeId: emp.id,
          missionId: mission.id,
          stepId: step.id,
          model: emp.binding.model ?? 'unknown',
          inputTokens: tok.input,
          outputTokens: tok.output,
          costUsd: step.estCostUsd,
          note: step.title,
        };
        ledger = [entry, ...ledger];
        emp.spendTodayUsd = round3(emp.spendTodayUsd + step.estCostUsd);
        emp.spendMonthUsd = round3(emp.spendMonthUsd + step.estCostUsd);
        emp.mood = clamp(emp.mood + 3, 0, 100);
        mission.actualCostUsd = round3(mission.actualCostUsd + step.estCostUsd);

        const artifact: Artifact = {
          id: nid('art'),
          stepId: step.id,
          producedBy: emp.id,
          kind:
            step.workState === 'fighting'
              ? 'analysis'
              : step.workState === 'writing'
                ? 'document'
                : step.workState === 'mailing'
                  ? 'report'
                  : 'summary',
          title: `${step.title} 결과물`,
          body: `${step.description}\n\n담당: ${emp.name}(${emp.title})\n모델: ${emp.binding.model ?? '-'}\n비용: $${step.estCostUsd.toFixed(3)}`,
          createdAt: now,
        };
        artifacts = { ...artifacts, [artifact.id]: artifact };
        step.artifactId = artifact.id;
        mission.loot = [...mission.loot, artifact.id];

        if (step.handoffTo) {
          const target = employees[step.handoffTo];
          chats = pushMessage(
            chats,
            emp.id,
            'agent',
            'report',
            `[전달] ${step.title} 완료 → ${target ? target.name : step.handoffTo}에게 결과를 넘겼습니다.`,
          );
        }

        // 단계가 끝나면 담당 표시를 해제한다. 다음 단계에서 다시 배정되면 새로 설정된다.
        // (해제하지 않으면 유휴 로직이 이 직원을 영원히 건너뛴다)
        emp.currentStepId = null;
        emp.currentMissionId = null;
        emp.lastIdleAt = now;

        const isLast = mission.currentStepIndex >= mission.steps.length - 1;
        if (isLast) {
          applyMissionEvent(mission, { type: 'REPORT' });
          applyMissionEvent(mission, { type: 'REVIEW' });
          routeTo(emp, emp.homeRoom);
          chats = pushMessage(
            chats,
            emp.id,
            'agent',
            'report',
            `${s.company?.ceoName ?? '대표'} 대표님, 요청하신 결과물입니다. — 「${mission.name}」 (실제 비용 $${mission.actualCostUsd.toFixed(3)})`,
          );
          auditLog = audit(auditLog, emp.name, '최종 보고', mission.name, `$${mission.actualCostUsd.toFixed(3)}`);

          // 미션 완료를 담당자의 개인 기억에 사건으로 남긴다. 성품·원칙 파일은 건드리지 않고,
          // append-only 인 memory-log 에만 한 줄이 늘어난다.
          const memory = memories[emp.id];
          if (memory) {
            memories = {
              ...memories,
              [emp.id]: appendRecord(memory, {
                kind: 'episode',
                title: `미션 완료 — ${mission.name}`,
                body: `실제 비용 $${mission.actualCostUsd.toFixed(3)}. ${mission.objective}`,
                source: `mission:${mission.id}`,
                confidence: 'high',
                tags: ['미션', mission.difficulty],
              }),
            };
          }
        } else {
          mission.currentStepIndex += 1;
        }
      }
    }
  }

  /* 3) 유휴 행동 — 비용이 발생하지 않는 시각적 행동
     이동 중에는 상태가 'walking' 으로 유지되고, 도착한 뒤에야 휴식/낚시로 확정된다.
     (걸어가는 중인데 화면에는 "휴식 중"으로 보이는 불일치를 막기 위함)
     이스터에그가 진행 중일 때는 아래 "4) 이스터에그 디렉터"가 세 직원의 이동·상태를
     전적으로 대신 관리하므로, 여기서 끼어들어 되돌리지 않는다. */
  const eggActive = s.easterEgg.active;
  for (const emp of Object.values(employees)) {
    if (eggActive) continue;
    if (emp.currentMissionId) continue;

    if (emp.state === 'completed') {
      applyAgentEvent(emp, { type: 'STOP' });
      emp.lastIdleAt = now;
      routeTo(emp, emp.homeRoom);
      continue;
    }

    // 목적지 도착 처리
    if (emp.state === 'walking' && emp.path.length === 0) {
      if (emp.destinationRoom === 'lounge') applyAgentEvent(emp, { type: 'REST' });
      else if (emp.destinationRoom === 'fishing') applyAgentEvent(emp, { type: 'FISH' });
      else applyAgentEvent(emp, { type: 'STOP' });
      emp.lastIdleAt = now;
      continue;
    }

    if (emp.state !== 'idle' || emp.path.length > 0) continue;

    const idleFor = now - emp.lastIdleAt;
    if (idleFor > 45_000 && emp.destinationRoom !== 'fishing') {
      routeTo(emp, 'fishing');
      applyAgentEvent(emp, { type: 'GO' });
    } else if (idleFor > 20_000 && emp.destinationRoom !== 'lounge') {
      routeTo(emp, 'lounge');
      applyAgentEvent(emp, { type: 'GO' });
    }
  }

  /* 4) 이스터에그 디렉터 — "탱크형 변형 휠" 데모 대본 진행.
     실제 API 호출도, 실제 비용도 없다. 캐릭터 상태는 전부 agentMachine.ts 의
     합법적인 전이만으로 바뀐다. */
  const eggResult = advanceEasterEgg(s.easterEgg, employees, chats, now);
  chats = eggResult.chats;

  return {
    employees,
    missions,
    ledger,
    artifacts,
    chats,
    approvals,
    audit: auditLog,
    memories,
    easterEgg: eggResult.egg,
    ...(eggResult.toast ? { ui: { ...s.ui, toast: eggResult.toast } } : {}),
  };
}
