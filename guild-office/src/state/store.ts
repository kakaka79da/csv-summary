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
  SIMULATION_HUMAN_STAFF,
  WALK_SPEED,
  createEmployee,
  findModel,
  generateCompanyCode,
  roomById,
} from '@/data/seed';
import { advanceAlongPath, findPath } from '@/lib/pathfinding';
import type { WeatherCondition, WeatherReading, WeatherSource } from '@/lib/weather';
import { checkAttachments, usedBytes } from '@/lib/attachments';
import { validateEvent } from '@/lib/schedule';
import {
  afterFailure,
  afterSuccess,
  checkPassword,
  hashPassword,
  lockoutLeft,
  verifyPassword,
  type AttemptState,
  type StoredCredential,
} from '@/lib/password';
import { ADMIN_ACCOUNT_KEY, ADMIN_BOOTSTRAP_CREDENTIAL } from '@/data/adminCredential';
import { clamp, nid } from '@/lib/format';
import { appendRecord, compileSystemPrompt, recordModelSwitch } from '@/lib/memoryCompile';
import { DRIVE_ROOT_FOLDER_URL, seedMemory, type MemoryAgreement } from '@/data/memorySeed';
import {
  ADMIN_UNLOCK_CODE,
  EASTER_EGG_CODE,
  SIMULATION_MODE_CODE,
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
  Attachment,
  ApprovalStatus,
  ArchivedCompany,
  Artifact,
  AuditEntry,
  Branch,
  BranchKind,
  BranchStatus,
  ChatRoom,
  ChatRoomAuthorKind,
  ChatRoomInvite,
  ChatRoomMessage,
  Company,
  CompanyApplication,
  Difficulty,
  Employee,
  EmployeeAppearanceId,
  EmployeeMemory,
  HumanStaffRecord,
  LedgerEntry,
  Message,
  MessageKind,
  MemoryKind,
  Mission,
  Phase,
  PlatformMessage,
  ProviderId,
  Role,
  RoomId,
  ScheduleEvent,
  ScheduleKind,
  Session,
  StaffMessage,
  TaskEstimate,
  ToolId,
  WorkMode,
} from '@/types';

/** 전사 공용 채팅방은 회사마다 하나뿐이므로 고정 id 를 쓴다. */
export const ROOM_ALL_ID = 'room_all';

/* ────────────────────────────── 상태 형태 ────────────────────────────── */

export interface WorldState {
  session: Session | null;
  phase: Phase;
  company: Company | null;

  /**
   * 이 소프트웨어(플랫폼) 자체를 만든 회사/제작자 표기. 오피스 안에서 대표가 세우는
   * "회사"(company.name, 예: 크림바스켓)와는 다른 개념이다 — 저건 게임 속 회사이고,
   * 이건 이 도구를 만든 바깥의 실제 주체다. null 이면 기본값(PLATFORM_MAKER)을 쓴다.
   * 플랫폼 관리자만 설정·보안 화면에서 바꿀 수 있다.
   */
  platformMakerName: string | null;

  employees: Record<string, Employee>;
  employeeOrder: string[];

  /**
   * 인간 사원 명부. AI 직원과 별개의 얕은 레코드로 관리한다 — 미션/상태 머신에는
   * 참여하지 않고, 오피스 화면에는 근태(workMode)에 따라 장식용으로만 표시된다.
   */
  humanStaff: Record<string, HumanStaffRecord>;

  /**
   * 대표 ↔ 인간 사원 1:1 대화. 사원 id 로 묶는다.
   *
   * 단일 브라우저 데모라 대표와 사원이 같은 저장소를 나눠 쓴다 — 대표가 쓰고
   * 로그아웃한 뒤 사원으로 들어오면 그대로 보인다. 실제 서비스에서는 서버가
   * 스레드를 들고 있어야 하고, 그건 백엔드 항목이다.
   */
  staffChats: Record<string, StaffMessage[]>;

  /**
   * 회사 창립 신청. 플랫폼 관리자가 승인해야 실제 Company 가 만들어진다.
   * company 와 달리 회사가 없어도(또는 삭제된 뒤에도) 계속 남아 있는 전역 기록이다.
   */
  companyApplications: Record<string, CompanyApplication>;

  /** 대표 ↔ 플랫폼 관리자 메시지. 회사(또는 신청서) 단위로 스레드가 묶인다. */
  platformMessages: PlatformMessage[];

  /**
   * 지사 목록. 회사 창립 시 본사(headquarters)가 하나 자동으로 생기고,
   * 대표가 국내·해외 지사를 추가로 세울 수 있다.
   */
  branches: Record<string, Branch>;
  branchOrder: string[];

  /**
   * 삭제 승인된 회사의 요약 기록. "회사 생성 시 기존 데이터는 따로 저장" 요청에 따라,
   * 회사를 지우기 전에 여기로 옮겨 관리자 페이지에서 계속 조회할 수 있게 한다.
   */
  archivedCompanies: ArchivedCompany[];

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

  /**
   * 1:1 대화(chats)와 별개인 단체 채팅방(부서·전사 공용). "전사 공용" 방은
   * 회사 창립 시 자동으로 하나 생기며 항상 ROOM_ALL_ID 를 쓴다.
   */
  chatRooms: Record<string, ChatRoom>;
  chatRoomOrder: string[];
  chatRoomMessages: Record<string, ChatRoomMessage[]>;
  chatRoomInvites: ChatRoomInvite[];

  /**
   * 계정별 암호 자격증명. **암호 원문은 절대 여기 들어오지 않는다** — 소금과 해시뿐이다.
   *
   * 키 형식: 'admin' | 'ceo' | 'staff:<사원id>'
   * 관리자 키가 비어 있으면 부트스트랩 자격증명(`data/adminCredential.ts`)으로 대조한다.
   */
  credentials: Record<string, StoredCredential>;

  /** 계정별 로그인 실패 횟수와 잠금. 새로고침해도 유지되어야 우회할 수 없다. */
  loginAttempts: Record<string, AttemptState>;

  /**
   * 누가 어느 대화를 어디까지 읽었는가. `계정키 → 대화키 → 마지막으로 읽은 시각`.
   * 대화키는 채팅방 id 또는 `staff:<사원id>` 다.
   *
   * ⚠️ 이 값은 **이 브라우저에만** 있다. 다른 기기에서 읽은 것은 반영되지 않는다.
   */
  lastReadAt: Record<string, Record<string, number>>;

  /**
   * 일정 · 타임라인. 지사별로 나눠 보되, branchId 가 null 인 것은 전사 공용이라
   * 어느 지사를 봐도 함께 보인다. 미션에서 파생된 막대는 여기 저장하지 않고
   * 화면에서 그때그때 만든다 — 저장하면 미션과 어긋날 수 있기 때문이다.
   */
  schedule: ScheduleEvent[];

  ui: {
    selectedEmployeeId: string | null;
    /** 오피스에서 선택한 인간 사원. AI 직원 선택과 동시에 켜지지 않는다. */
    selectedStaffId: string | null;
    /**
     * 관리자 숨은 코드를 맞혔을 때 켜지는 암호 관문.
     * 코드만으로는 들어갈 수 없다 — 코드는 "어느 문인가"이고 암호가 "열쇠"다.
     */
    adminGateOpen: boolean;
    openPanel:
      | null
      | 'missions'
      | 'approvals'
      | 'cost'
      | 'audit'
      | 'dungeon'
      | 'people'
      | 'settings'
      | 'graph'
      | 'rooms'
      | 'status'
      | 'schedule'
      | 'search';
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

  /**
   * 시뮬레이션(자유 테스트) 모드로 들어왔는지 여부. 관리자 승인 없이 임의의
   * 사업자로 즉시 만든 회사라는 것을 화면에 계속 알려주기 위한 표시용 값이다.
   * easterEgg 와 마찬가지로 새로고침 시 초기화된다(partialize 에 포함하지 않음).
   */
  simulationMode: boolean;

  /**
   * 현위치 날씨. 오피스 화면에 비/눈 같은 효과로 그려진다.
   *
   * 관측값은 브라우저에서 직접 받아오므로(useWeather 훅) 서버에 아무것도 남지
   * 않는다. 좌표는 소수점 2자리로 깎아서 보관한다(개인정보 최소화).
   * easterEgg / simulationMode 와 마찬가지로 새로고침하면 초기화된다 —
   * 날씨는 캐시할 값이 아니라 매번 다시 받아오는 값이다.
   */
  weather: {
    condition: WeatherCondition;
    temperatureC: number | null;
    isDay: boolean;
    coords: { lat: number; lon: number } | null;
    source: WeatherSource;
    /** 수동으로 고정한 날씨. 값이 있으면 자동 갱신이 이 값을 덮어쓰지 않는다. */
    manual: WeatherCondition | null;
    /** 화면 효과 표시 여부 (멀미·저사양 기기를 위해 끌 수 있다) */
    effects: boolean;
    /** 사용자에게 그대로 보여 줄 상태 문구 — "위치 권한 거부됨" 등 */
    note: string | null;
    updatedAt: number | null;
  };
}

export interface WorldActions {
  /**
   * 역할별 데모 로그인 (암호 없음).
   *
   * ⚠️ 이 통로는 **테스트·시뮬레이션 모드 전용**이다. 실제 로그인 화면은 아래의
   * 암호 대조(verifyAccountPassword)를 통과한 뒤에만 이것을 부른다.
   */
  loginDemo: (role: Role) => void;

  /* ── 개인 암호 ───────────────────────────────────────────────── */

  /** 이 계정에 암호가 이미 정해져 있는가. 'ceo' | 'admin' | 'staff:<id>' */
  hasPassword: (accountKey: string) => boolean;

  /** 관리자가 아직 부트스트랩(임시) 암호를 쓰고 있는가. 화면에 경고를 띄우기 위한 값. */
  adminUsingBootstrap: () => boolean;

  /** 암호를 정하거나 바꾼다. 원문은 저장되지 않고 해시만 남는다. */
  setAccountPassword: (accountKey: string, password: string) => Promise<{ ok: boolean; error?: string }>;

  /**
   * 암호를 대조한다. 연달아 틀리면 잠근다.
   * ⚠️ 브라우저 안에서 대조하므로 진짜 보안이 아니다 — `src/lib/password.ts` 머리말 참고.
   */
  verifyAccountPassword: (accountKey: string, password: string) => Promise<{ ok: boolean; error?: string }>;

  /** 대표 로그인 (암호 대조 후 세션 생성). 암호가 아직 없으면 먼저 정하게 한다. */
  loginAsCeo: (password: string) => Promise<{ ok: boolean; error?: string }>;

  /** 플랫폼 관리자 로그인. 숨은 코드로 문을 연 뒤 이 암호를 통과해야 한다. */
  loginAsAdmin: (password: string) => Promise<{ ok: boolean; error?: string }>;

  /** 사원 로그인 — 이메일로 찾고 그 사람의 암호로 대조한다. */
  loginAsStaff: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;

  /** 사원 계정 키. 자격증명·잠금 상태를 찾을 때 쓴다. */
  staffAccountKey: (staffId: string) => string;

  /** 지금 로그인한 사람의 계정 키. 안 읽음 표시를 계정별로 나누기 위해 쓴다. */
  currentAccountKey: () => string | null;

  /* ── 안 읽음 ─────────────────────────────────────────────────── */

  /** 이 대화를 지금까지 읽은 것으로 표시한다. */
  markRead: (threadKey: string) => void;
  /** 이 대화에 내가 아직 안 읽은 메시지가 몇 개인가. */
  unreadCount: (threadKey: string) => number;
  /** 모든 대화를 통틀어 안 읽은 수 (헤더 배지용). */
  totalUnread: () => number;

  /* ── 회사 코드 ───────────────────────────────────────────────── */

  /** 회사 가입 코드를 새로 발급한다. 대표만. 이전 코드는 바로 죽는다. */
  regenerateCompanyCode: () => { ok: boolean; error?: string; code?: string };

  /* ── 내 정보 ─────────────────────────────────────────────────── */

  /** 사원이 자기 이름·연락처·외형을 고친다. 직책·급여·지사는 대표 소관이라 뺐다. */
  updateOwnProfile: (patch: {
    name?: string;
    phone?: string;
    appearanceId?: EmployeeAppearanceId;
  }) => { ok: boolean; error?: string };

  /* ── 휴가 신청 ───────────────────────────────────────────────── */

  /** 사원이 휴가·연차를 신청한다. 대표가 승인해야 근태가 바뀐다. */
  requestLeaveDays: (input: { startDay: string; endDay: string; reason: string }) => {
    ok: boolean;
    error?: string;
  };

  /* ── 미션 마감일 ─────────────────────────────────────────────── */

  /** 미션 마감일을 정하거나 지운다(null). 대표만. */
  setMissionDue: (missionId: string, dueDay: string | null) => { ok: boolean; error?: string };

  /* ── 백업 ────────────────────────────────────────────────────── */

  /** 지금 상태를 JSON 문자열로 내보낸다. 브라우저를 청소해도 되돌릴 수 있게. */
  exportBackup: () => string;
  /** 내보낸 JSON 을 되돌린다. 형식이 다르면 아무것도 바꾸지 않는다. */
  importBackup: (json: string) => { ok: boolean; error?: string };
  logout: () => void;

  /** 플랫폼 제작자 표기를 바꾼다. 플랫폼 관리자만 호출할 수 있다. */
  setPlatformMakerName: (name: string) => { ok: boolean; error?: string };

  /**
   * 선택한 직원을 다른 방으로 보낸다 (오피스에서 직원을 클릭해 선택한 뒤 방을 더블클릭).
   * AI 직원은 실제로 걸어간다. 대표 집무실로 보내면 도착을 기다리지 않고 바로
   * 1:1 패널이 열린다 — "직원을 데려다 놓고 마주 앉아 대화한다"는 면담 흐름이다.
   * 인간 직원은 캐릭터처럼 옮길 수 없으므로, 대신 메시지를 남긴다(실제 발송은
   * 인간 직원 기능이 연결된 뒤 백엔드가 처리한다).
   */
  sendEmployeeToRoom: (employeeId: string, room: RoomId) => { ok: boolean; error?: string; messaged?: boolean };

  /* ── 인간 사원 가입·근태 ──────────────────────────────────────────── */

  /**
   * 이메일로 사원 로그인 화면에 들어온다. 이미 신청 기록이 있으면 그 상태(대기/승인됨/
   * 거절/퇴사)에 맞는 화면으로 보내고, 없으면 새로 가입할 수 있다고 알려준다.
   */
  lookupHumanStaffByEmail: (email: string) => HumanStaffRecord | null;

  /** 사원 가입 신청. 회사 코드가 맞아야 하고, 이메일은 필수다. 곧바로 대기중 세션이 된다. */
  applyAsHumanStaff: (input: {
    name: string;
    email: string;
    phone: string;
    companyCode: string;
    role: string;
    appearanceId: EmployeeAppearanceId;
  }) => { ok: boolean; error?: string; staffId?: string };

  /** 이미 신청한 이메일로 다시 로그인한다 (암호 없이 — 테스트·시뮬레이션 전용) (대기/승인/거절 상태 그대로 이어서 본다). */
  continueHumanStaffSession: (email: string) => { ok: boolean; error?: string };

  /** 대표가 가입 신청을 승인하거나 거절한다. */
  decideHumanStaffApplication: (id: string, decision: 'approved' | 'rejected') => void;
  /** 대표가 재직 중인 사원을 내보낸다. 즉시 처리되며 승인 절차가 필요 없다. */
  removeHumanStaff: (id: string) => void;
  /** 내보냈던 사원을 대표가 다시 불러들인다. */
  reinstateHumanStaff: (id: string) => void;
  /** 급여·복지·근무 형태를 대표가 갱신한다. */
  updateHumanStaff: (
    id: string,
    patch: Partial<Pick<HumanStaffRecord, 'role' | 'monthlySalaryUsd' | 'benefits' | 'workMode'>>,
  ) => void;

  /**
   * 회사 삭제 요청. 대표만 요청할 수 있고, 반드시 플랫폼 관리자의 승인을 거쳐야
   * 실제로 지워진다 — 개인 회사를 삭제하는 일은 되돌리기 어려운 큰 결정이기 때문이다.
   */
  requestCompanyDeletion: (reason: string) => { ok: boolean; error?: string };

  /**
   * 대표가 채팅·자료 공유에 쓸 구글 드라이브 폴더 링크를 설정하거나 해제한다.
   * 실제 OAuth 연결이 아니라, 대표가 직접 만든 폴더의 공유 링크를 붙여넣는 방식이다.
   */
  setCompanyDriveLink: (url: string | null) => { ok: boolean; error?: string };

  /* ── 지사 (국내·해외) ────────────────────────────────────────────── */

  /**
   * 대표가 지사를 세운다. 국내(같은 나라 다른 지역)와 해외 모두 가능하며,
   * 같은 국가·지역에 이미 있으면 거절한다. 본사는 회사 창립 시 자동으로 생긴다.
   */
  establishBranch: (input: {
    name: string;
    kind: Exclude<BranchKind, 'headquarters'>;
    country: string;
    region: string;
    serverRegion: string;
    timezone: string;
    currency: Company['currency'];
    note?: string;
  }) => { ok: boolean; error?: string; branchId?: string };

  /** 지사 상태를 바꾼다(준비 중 ↔ 운영 중 ↔ 폐쇄). 본사는 폐쇄할 수 없다. */
  setBranchStatus: (branchId: string, status: BranchStatus) => { ok: boolean; error?: string };

  /** 인간 사원을 지사에 배치한다. branchId 가 null 이면 본사 소속으로 되돌린다. */
  assignStaffToBranch: (staffId: string, branchId: string | null) => { ok: boolean; error?: string };

  /* ── 회사 창립 신청 (플랫폼 관리자 승인) ─────────────────────────────── */

  /**
   * 대표가 회사 창립 신청서를 제출한다. 바로 회사가 만들어지지 않고, 플랫폼
   * 관리자가 승인해야 foundCompany 가 호출된다. 같은 accountId 로 대기 중인
   * 신청이 있으면 거절된다.
   */
  submitCompanyApplication: (input: {
    founding: Omit<Company, 'foundedAt' | 'code'>;
    accountId: string;
    documentRef: { fileName: string; sizeKb: number } | null;
  }) => { ok: boolean; error?: string; applicationId?: string };

  /** 데모용 계정 ID로 이미 제출한 신청서를 찾는다 (대기/승인/거절 상태 확인용). */
  lookupCompanyApplicationByAccountId: (accountId: string) => CompanyApplication | null;

  /** 대표가 신청 화면으로 돌아가 새로 제출할 수 있도록 세션의 신청서 연결을 해제한다. */
  clearCompanyApplication: () => void;

  /** 플랫폼 관리자가 회사 창립 신청을 승인·거절한다. 승인 시 실제로 회사를 만든다. */
  decideCompanyApplication: (id: string, decision: 'approved' | 'rejected', note?: string) => void;

  /* ── 대표 ↔ 플랫폼 관리자 메시지 ─────────────────────────────────────── */

  /** 대표 또는 관리자가 스레드에 메시지를 보낸다. */
  sendPlatformMessage: (input: { threadKey: string; companyName: string; text: string }) => { ok: boolean; error?: string };

  /** 회사 코드는 대표가 입력하지 않는다 — 창립 시 자동으로 발급된다. */
  foundCompany: (input: Omit<Company, 'foundedAt' | 'code'>) => void;
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

  /* ── 부서·전사 공용 채팅방 ─────────────────────────────────────────── */

  /** 대표가 부서 채팅방을 만든다. 대표는 모든 방의 암묵적 멤버다(memberIds 에는 넣지 않는다). */
  createTeamRoom: (name: string) => { ok: boolean; error?: string; roomId?: string };

  /**
   * 방에 메시지를 보낸다. 대표는 모든 방에, 사원은 자신이 멤버인 방(또는 전사
   * 공용 방)에만 보낼 수 있다. AI 직원은 이 채팅방 기능에서는 아직 스스로
   * 말하지 않는다 — 기존 1:1 대화(chats)에서만 AI 응답이 오간다.
   */
  sendRoomMessage: (roomId: string, text: string, attachments?: Attachment[]) => { ok: boolean; error?: string };

  /**
   * 방에 누군가를 초대하자고 제안한다. 대표가 직접 부르면 즉시 확정되고,
   * 사원이 제안하면 대표 승인이 필요하다. AI 직원의 "제안"은 이 앱에 자율
   * 행동이 없으므로, 대표가 초대를 만들 때 어떤 AI 의 추천으로 표시할지
   * 직접 고르는 방식으로 흉내낸다(proposedByKind:'ai').
   */
  proposeRoomInvite: (input: {
    roomId: string;
    inviteeId: string;
    inviteeKind: 'ai' | 'human';
    proposedByKind?: ChatRoomAuthorKind;
    proposedByName?: string;
  }) => { ok: boolean; error?: string };

  /** 대표가 대기 중인 초대를 승인·거절한다. */
  decideRoomInvite: (inviteId: string, decision: 'approved' | 'rejected') => void;

  /** 사원이 "지금 뭐 하고 있는지" 한 줄을 스스로 남긴다(본인 기록만). */
  updateOwnTaskNote: (text: string) => { ok: boolean; error?: string };

  /**
   * 사원이 자기 근태를 스스로 바꾼다.
   *
   * 원래는 대표만 바꿀 수 있었는데, 그러면 재택하는 날마다 대표에게 부탁해야 한다.
   * 출근·재택·미출근은 본인이 아는 사실이므로 본인이 바꾸는 것이 맞다.
   * 다만 **휴가·연차는 뺐다** — 그건 승인이 필요한 일이고, 스스로 누르는 순간
   * 승인 절차가 무의미해진다. 휴가 신청 흐름은 별도 항목이다.
   */
  updateOwnWorkMode: (mode: Exclude<WorkMode, 'leave'>) => { ok: boolean; error?: string };

  /**
   * 대표 ↔ 인간 사원 1:1 대화에 한 줄 보낸다.
   * 대표는 승인된 사원 누구에게나, 사원은 자기 스레드에만 쓸 수 있다.
   */
  sendStaffMessage: (staffId: string, text: string, attachments?: Attachment[]) => { ok: boolean; error?: string };

  /** 회사 전체에서 지금까지 쓴 첨부 용량(원본 바이트). 화면에 남은 용량을 보여주기 위한 값. */
  attachmentBytesUsed: () => number;

  /** 일정을 추가한다. 대표만 할 수 있다. branchId 가 null 이면 전사 공용 일정이다. */
  addScheduleEvent: (input: {
    title: string;
    kind: ScheduleKind;
    branchId: string | null;
    startDay: string;
    endDay: string;
    note?: string;
  }) => { ok: boolean; error?: string };

  /** 일정을 지운다. 대표만 할 수 있고, 미션에서 파생된 막대는 애초에 여기 없다. */
  removeScheduleEvent: (id: string) => { ok: boolean; error?: string };

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
  /** 오피스에서 인간 사원을 고른다. AI 직원 선택은 자동으로 풀린다(패널은 하나뿐). */
  selectStaff: (id: string | null) => void;
  openPanel: (p: WorldState['ui']['openPanel']) => void;
  setToast: (t: string | null) => void;
  /** 관리자 암호 관문을 연다/닫는다. */
  setAdminGate: (open: boolean) => void;

  /**
   * 전체(전사 공용) 채팅방이 없으면 만들어 목록 맨 앞에 둔다.
   * 회사가 있는 한 이 방은 언제나 존재해야 하므로, 로그인·저장값 복원 시 호출한다.
   */
  ensureCompanyWideRoom: () => void;

  /** 관측값을 반영한다. 수동 고정 중이면 상태는 그대로 두고 온도·좌표만 갱신한다. */
  applyWeather: (reading: WeatherReading) => void;
  /** 날씨를 수동으로 고정하거나(테스트용) null 로 자동 관측에 되돌린다. */
  setWeatherManual: (condition: WeatherCondition | null) => void;
  /** 화면 효과를 켜고 끈다. */
  setWeatherEffects: (on: boolean) => void;
  /** 위치 권한 거부·네트워크 차단 등 사용자에게 보여 줄 문구를 남긴다. */
  setWeatherNote: (note: string | null) => void;

  tick: (dtMs: number) => void;
  resetAll: () => void;
}

export type Store = WorldState & WorldActions;

/* ────────────────────────────── 초기 상태 ────────────────────────────── */

const initialState: WorldState = {
  session: null,
  phase: 'login',
  company: null,
  platformMakerName: null,
  employees: {},
  employeeOrder: [],
  humanStaff: {},
  staffChats: {},
  companyApplications: {},
  platformMessages: [],
  branches: {},
  branchOrder: [],
  archivedCompanies: [],
  memories: {},
  missions: {},
  missionOrder: [],
  artifacts: {},
  approvals: [],
  ledger: [],
  audit: [],
  chats: {},
  chatRooms: {},
  chatRoomOrder: [],
  chatRoomMessages: {},
  chatRoomInvites: [],
  credentials: {},
  loginAttempts: {},
  lastReadAt: {},
  schedule: [],
  ui: { selectedEmployeeId: null, selectedStaffId: null, adminGateOpen: false, openPanel: null, interviewQueue: [], toast: null },
  tutorial: { summoned: false, interviewsDone: false, firstMissionDone: false },
  easterEgg: initialEasterEgg,
  simulationMode: false,
  weather: {
    condition: 'clear',
    temperatureC: null,
    isDay: true,
    coords: null,
    source: 'none',
    manual: null,
    effects: true,
    note: null,
    updatedAt: null,
  },
};

/* ────────────────────────────── 보조 함수 ────────────────────────────── */

function audit(list: AuditEntry[], actor: string, action: string, target: string, detail: string): AuditEntry[] {
  const entry: AuditEntry = { id: nid('aud'), ts: Date.now(), actor, action, target, detail };
  // 최신 300건만 보관한다.
  return [entry, ...list].slice(0, 300);
}

/** 회사 창립 시 자동으로 만드는 본사 지사. 폐쇄할 수 없고, 지사 목록의 첫 항목이 된다. */
function makeHeadquarters(company: Company): Branch {
  return {
    id: 'branch_hq',
    name: company.branch || '본사',
    kind: 'headquarters',
    country: company.country,
    region: company.branch || '본사',
    serverRegion: 'ap-northeast-2 (서울)',
    timezone: 'Asia/Seoul',
    currency: company.currency,
    status: 'operating',
    openedAt: Date.now(),
    note: null,
  };
}

/** 회사 창립 시 자동으로 만드는 전사 공용 채팅방. */
function makeCompanyWideRoom(ceoName: string): ChatRoom {
  return { id: ROOM_ALL_ID, kind: 'company_wide', name: '전체', memberIds: [], createdAt: Date.now(), createdBy: ceoName };
}

/**
 * 전체(전사 공용) 채팅방은 **회사가 있는 한 언제나 있어야 한다**.
 *
 * 창립할 때 만들기는 하지만, 그것만으로는 부족하다 — 이 기능이 생기기 전에
 * 저장된 localStorage 에는 회사만 있고 전체방이 없어서 채팅방 화면이 텅 비어
 * 보인다. 그래서 로그인할 때와 저장값을 불러올 때 여기서 한 번 더 보장한다.
 * 목록 맨 앞자리도 함께 지킨다(전체방이 언제나 첫 번째로 열리도록).
 *
 * 바꿀 것이 없으면 null 을 돌려준다 — 불필요한 set 으로 화면을 다시 그리지 않는다.
 */
function withCompanyWideRoom(
  s: Pick<WorldState, 'company' | 'chatRooms' | 'chatRoomOrder'>,
): { chatRooms: Record<string, ChatRoom>; chatRoomOrder: string[] } | null {
  if (!s.company) return null;
  const existing = s.chatRooms[ROOM_ALL_ID];
  if (existing && s.chatRoomOrder[0] === ROOM_ALL_ID) return null;
  return {
    chatRooms: { ...s.chatRooms, [ROOM_ALL_ID]: existing ?? makeCompanyWideRoom(s.company.ceoName) },
    chatRoomOrder: [ROOM_ALL_ID, ...s.chatRoomOrder.filter((id) => id !== ROOM_ALL_ID)],
  };
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
              ? (s.platformMakerName || PLATFORM_MAKER)
              : '인간 직원 (데모)';
        // 회사는 있지만 아직 사무실/AI 직원이 없는 경우(관리자 승인을 막 받은 대표가
        // 다시 로그인하는 경우)는 처음부터가 아니라 사무실 건설 단계부터 이어서 보여준다.
        const phase: Phase = !s.company ? 'founding' : Object.keys(s.employees).length < 3 ? 'office_build' : 'live';
        set({
          session: { role, accountName, demo: true },
          phase,
          audit: audit(s.audit, accountName, '데모 로그인', role, '실제 인증 아님 (백엔드 구현 항목)'),
          // 전체 채팅방은 언제나 있어야 한다 (예전 저장 데이터 보정 포함).
          ...(withCompanyWideRoom(s) ?? {}),
        });
      },

      hasPassword: (accountKey) => Boolean(get().credentials[accountKey]),

      adminUsingBootstrap: () => !get().credentials[ADMIN_ACCOUNT_KEY],

      setAccountPassword: async (accountKey, password) => {
        const check = checkPassword(password);
        if (!check.ok) return check;
        const cred = await hashPassword(password);
        const s = get();
        set({
          credentials: { ...s.credentials, [accountKey]: cred },
          // 암호를 바꾸면 잠금도 푼다 — 본인이 바꾼 것이므로 계속 잠가 둘 이유가 없다.
          loginAttempts: { ...s.loginAttempts, [accountKey]: afterSuccess() },
          audit: audit(s.audit, s.session?.accountName ?? accountKey, '암호 설정', accountKey, '해시만 저장됨'),
        });
        return { ok: true };
      },

      verifyAccountPassword: async (accountKey, password) => {
        const s = get();
        const attempt = s.loginAttempts[accountKey];
        const left = lockoutLeft(attempt);
        if (left > 0) {
          return { ok: false, error: `너무 여러 번 틀렸습니다. ${left}초 뒤에 다시 시도하세요.` };
        }

        // 관리자는 자기 암호를 정하기 전까지 부트스트랩 자격증명으로 연다.
        const cred =
          s.credentials[accountKey] ??
          (accountKey === ADMIN_ACCOUNT_KEY ? ADMIN_BOOTSTRAP_CREDENTIAL : undefined);

        const ok = await verifyPassword(password, cred);
        const now = Date.now();
        if (!ok) {
          const next = afterFailure(get().loginAttempts[accountKey], now);
          set({
            loginAttempts: { ...get().loginAttempts, [accountKey]: next },
            audit: audit(get().audit, accountKey, '로그인 실패', accountKey, `연속 ${next.failed}회`),
          });
          const nowLeft = lockoutLeft(next, now);
          return {
            ok: false,
            error:
              nowLeft > 0
                ? `암호가 맞지 않습니다. 너무 여러 번 틀려 ${nowLeft}초 동안 잠깁니다.`
                : '암호가 맞지 않습니다.',
          };
        }
        set({ loginAttempts: { ...get().loginAttempts, [accountKey]: afterSuccess() } });
        return { ok: true };
      },

      staffAccountKey: (staffId) => `staff:${staffId}`,

      loginAsCeo: async (password) => {
        const s = get();
        if (!s.credentials['ceo']) {
          return { ok: false, error: '아직 대표 암호가 없습니다. "암호 만들기"로 먼저 정해 주세요.' };
        }
        const v = await get().verifyAccountPassword('ceo', password);
        if (!v.ok) return v;
        get().loginDemo('ceo');
        return { ok: true };
      },

      loginAsAdmin: async (password) => {
        const v = await get().verifyAccountPassword(ADMIN_ACCOUNT_KEY, password);
        if (!v.ok) return v;
        get().loginDemo('platform_admin');
        return { ok: true };
      },

      loginAsStaff: async (email, password) => {
        const s = get();
        const trimmed = email.trim().toLowerCase();
        const record = Object.values(s.humanStaff).find((r) => r.email.toLowerCase() === trimmed);
        // 없는 계정과 틀린 암호를 같은 문구로 돌려준다 —
        // 다르게 답하면 어떤 이메일이 이 회사에 있는지 알려 주는 셈이 된다.
        const generic = '이메일 또는 암호가 맞지 않습니다.';
        if (!record) return { ok: false, error: generic };

        const key = get().staffAccountKey(record.id);
        if (!s.credentials[key]) {
          return {
            ok: false,
            error: '이 계정에는 아직 암호가 없습니다. 대표에게 암호 재설정을 요청하세요.',
          };
        }
        const v = await get().verifyAccountPassword(key, password);
        if (!v.ok) return { ok: false, error: v.error === '암호가 맞지 않습니다.' ? generic : v.error };

        set({
          session: { role: 'human_staff', accountName: record.name, demo: true, humanStaffId: record.id },
          phase: 'live',
          audit: audit(get().audit, record.name, '사원 로그인', get().company?.name ?? '-', record.status),
        });
        return { ok: true };
      },

      currentAccountKey: () => {
        const s = get();
        if (!s.session) return null;
        if (s.session.role === 'ceo') return 'ceo';
        if (s.session.role === 'platform_admin') return ADMIN_ACCOUNT_KEY;
        return s.session.humanStaffId ? `staff:${s.session.humanStaffId}` : null;
      },

      /* ── 안 읽음 ─────────────────────────────────────────────────── */

      markRead: (threadKey) => {
        const s = get();
        const key = get().currentAccountKey();
        if (!key) return;
        const mine = s.lastReadAt[key] ?? {};
        set({ lastReadAt: { ...s.lastReadAt, [key]: { ...mine, [threadKey]: Date.now() } } });
      },

      unreadCount: (threadKey) => {
        const s = get();
        const key = get().currentAccountKey();
        if (!key) return 0;
        const since = s.lastReadAt[key]?.[threadKey] ?? 0;

        if (threadKey.startsWith('staff:')) {
          const staffId = threadKey.slice('staff:'.length);
          const list = s.staffChats[staffId] ?? [];
          // 내가 보낸 것은 안 읽음이 아니다.
          const mineIsCeo = s.session?.role === 'ceo';
          return list.filter((m) => m.ts > since && (mineIsCeo ? m.from === 'staff' : m.from === 'ceo')).length;
        }

        const list = s.chatRoomMessages[threadKey] ?? [];
        const myAuthorId = s.session?.role === 'ceo' ? 'ceo' : (s.session?.humanStaffId ?? '');
        return list.filter((m) => m.ts > since && m.authorId !== myAuthorId).length;
      },

      totalUnread: () => {
        const s = get();
        if (!get().currentAccountKey()) return 0;
        let n = 0;
        for (const roomId of s.chatRoomOrder) n += get().unreadCount(roomId);
        if (s.session?.role === 'ceo') {
          for (const staffId of Object.keys(s.staffChats)) n += get().unreadCount(`staff:${staffId}`);
        } else if (s.session?.humanStaffId) {
          n += get().unreadCount(`staff:${s.session.humanStaffId}`);
        }
        return n;
      },

      /* ── 회사 코드 ───────────────────────────────────────────────── */

      regenerateCompanyCode: () => {
        const s = get();
        if (s.session?.role !== 'ceo') return { ok: false, error: '대표만 재발급할 수 있습니다.' };
        if (!s.company) return { ok: false, error: '회사가 없습니다.' };
        const code = generateCompanyCode(s.company.name);
        set({
          company: { ...s.company, code },
          audit: audit(s.audit, s.session.accountName, '회사 코드 재발급', s.company.name, '이전 코드는 더 이상 쓸 수 없습니다'),
          ui: { ...s.ui, toast: `새 회사 코드: ${code} — 이전 코드로는 가입할 수 없습니다.` },
        });
        return { ok: true, code };
      },

      /* ── 내 정보 ─────────────────────────────────────────────────── */

      updateOwnProfile: (patch) => {
        const s = get();
        if (s.session?.role !== 'human_staff' || !s.session.humanStaffId) {
          return { ok: false, error: '사원 계정만 고칠 수 있습니다.' };
        }
        const rec = s.humanStaff[s.session.humanStaffId];
        if (!rec) return { ok: false, error: '기록을 찾을 수 없습니다.' };

        const name = patch.name?.trim();
        if (patch.name !== undefined && !name) return { ok: false, error: '이름은 비울 수 없습니다.' };

        const updated: HumanStaffRecord = {
          ...rec,
          name: name ?? rec.name,
          phone: patch.phone !== undefined ? patch.phone.trim() || null : rec.phone,
          appearanceId: patch.appearanceId ?? rec.appearanceId,
        };
        set({
          humanStaff: { ...s.humanStaff, [rec.id]: updated },
          // 이름을 바꾸면 화면 곳곳의 "로그인: ○○" 도 함께 바뀌어야 한다.
          session: { ...s.session, accountName: updated.name },
          audit: audit(s.audit, updated.name, '내 정보 수정', updated.name, ''),
        });
        return { ok: true };
      },

      /* ── 휴가 신청 ───────────────────────────────────────────────── */

      requestLeaveDays: (input) => {
        const s = get();
        if (s.session?.role !== 'human_staff' || !s.session.humanStaffId) {
          return { ok: false, error: '사원 계정만 신청할 수 있습니다.' };
        }
        const rec = s.humanStaff[s.session.humanStaffId];
        if (!rec || rec.status !== 'approved') return { ok: false, error: '승인된 사원만 신청할 수 있습니다.' };

        const check = validateEvent({ title: input.reason || '휴가', ...input });
        if (!check.ok) return check;

        const already = s.approvals.some(
          (a) => a.kind === 'leave_request' && a.status === 'pending' && a.requesterId === rec.id,
        );
        if (already) return { ok: false, error: '이미 처리 대기 중인 휴가 신청이 있습니다.' };

        const approval: Approval = {
          id: nid('apv'),
          kind: 'leave_request',
          title: `${rec.name} 휴가 신청 (${input.startDay} ~ ${input.endDay})`,
          reason: input.reason.trim() || '사유 없음',
          requesterId: rec.id,
          participants: [],
          estCostUsd: 0,
          estSeconds: 0,
          risk: 'low',
          model: null,
          tools: [],
          dataScope: [],
          status: 'pending',
          note: null,
          missionId: null,
          createdAt: Date.now(),
          decidedAt: null,
          leaveDays: { startDay: input.startDay, endDay: input.endDay },
        };
        set({
          approvals: [approval, ...s.approvals],
          audit: audit(s.audit, rec.name, '휴가 신청', rec.name, `${input.startDay} ~ ${input.endDay}`),
        });
        return { ok: true };
      },

      /* ── 미션 마감일 ─────────────────────────────────────────────── */

      setMissionDue: (missionId, dueDay) => {
        const s = get();
        if (s.session?.role !== 'ceo') return { ok: false, error: '대표만 마감일을 정할 수 있습니다.' };
        const m = s.missions[missionId];
        if (!m) return { ok: false, error: '그런 미션이 없습니다.' };
        if (dueDay !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dueDay)) {
          return { ok: false, error: '날짜 형식이 올바르지 않습니다.' };
        }
        set({
          missions: { ...s.missions, [missionId]: { ...m, dueDay } },
          audit: audit(s.audit, s.session.accountName, dueDay ? '마감일 설정' : '마감일 해제', m.name, dueDay ?? ''),
        });
        return { ok: true };
      },

      /* ── 백업 ────────────────────────────────────────────────────── */

      exportBackup: () => {
        const s = get();
        // 화면 임시 상태(ui·날씨·이스터에그)는 담지 않는다 — 되돌릴 값이 아니다.
        const { ui: _ui, weather: _w, easterEgg: _e, simulationMode: _sm, ...rest } = s as unknown as Record<
          string,
          unknown
        >;
        const data: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rest)) {
          if (typeof v !== 'function') data[k] = v;
        }
        return JSON.stringify({ __guildOffice: 1, savedAt: Date.now(), state: data }, null, 2);
      },

      importBackup: (json) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(json);
        } catch {
          return { ok: false, error: 'JSON 형식이 아닙니다.' };
        }
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          (parsed as { __guildOffice?: number }).__guildOffice !== 1 ||
          typeof (parsed as { state?: unknown }).state !== 'object'
        ) {
          return { ok: false, error: '이 앱에서 내보낸 백업 파일이 아닙니다.' };
        }
        const incoming = (parsed as { state: Record<string, unknown> }).state;
        // 있는 열쇠만 골라 덮는다 — 모르는 값이 상태에 섞이지 않도록.
        const allowed = new Set(Object.keys(initialState));
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(incoming)) if (allowed.has(k)) patch[k] = v;
        if (Object.keys(patch).length === 0) return { ok: false, error: '되돌릴 내용이 없습니다.' };

        set({ ...(patch as Partial<WorldState>), ui: { ...get().ui, toast: '백업을 되돌렸습니다.' } });
        get().ensureCompanyWideRoom();
        return { ok: true };
      },

      logout: () => {
        const s = get();
        set({
          session: null,
          phase: s.company ? 'login' : 'login',
          audit: audit(s.audit, s.session?.accountName ?? '-', '로그아웃', '-', ''),
        });
      },

      setPlatformMakerName: (name) => {
        const s = get();
        if (s.session?.role !== 'platform_admin') {
          return { ok: false, error: '플랫폼 관리자만 바꿀 수 있습니다.' };
        }
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: '이름을 입력하세요.' };
        set({
          platformMakerName: trimmed,
          audit: audit(s.audit, s.session.accountName, '플랫폼 제작자 표기 변경', PLATFORM_MAKER, `→ "${trimmed}"`),
          ui: { ...s.ui, toast: `플랫폼 제작자 표기를 "${trimmed}"(으)로 바꿨습니다.` },
        });
        return { ok: true };
      },

      /* ── 지사 (국내·해외) ──────────────────────────────────────────── */
      establishBranch: (input) => {
        const s = get();
        if (s.session?.role !== 'ceo' || !s.company) return { ok: false, error: '대표만 지사를 세울 수 있습니다.' };
        const name = input.name.trim();
        if (!name) return { ok: false, error: '지사 이름을 입력하세요.' };
        const duplicate = Object.values(s.branches).some(
          (b) => b.status !== 'closed' && b.country === input.country && b.region === input.region,
        );
        if (duplicate) return { ok: false, error: `${input.country} ${input.region} 에는 이미 지사가 있습니다.` };

        const id = nid('br');
        const branch: Branch = {
          id,
          name,
          kind: input.kind,
          country: input.country,
          region: input.region,
          serverRegion: input.serverRegion,
          timezone: input.timezone,
          currency: input.currency,
          status: 'preparing',
          openedAt: Date.now(),
          note: input.note?.trim() || null,
        };
        set({
          branches: { ...s.branches, [id]: branch },
          branchOrder: [...s.branchOrder, id],
          audit: audit(
            s.audit,
            s.session.accountName,
            input.kind === 'overseas' ? '해외 지사 설립' : '국내 지사 설립',
            name,
            `${input.country} ${input.region} · ${input.serverRegion}`,
          ),
          ui: { ...s.ui, toast: `"${name}" 지사를 준비 중 상태로 만들었습니다.` },
        });
        return { ok: true, branchId: id };
      },

      setBranchStatus: (branchId, status) => {
        const s = get();
        if (s.session?.role !== 'ceo') return { ok: false, error: '대표만 바꿀 수 있습니다.' };
        const branch = s.branches[branchId];
        if (!branch) return { ok: false, error: '지사를 찾을 수 없습니다.' };
        if (branch.kind === 'headquarters' && status === 'closed') {
          return { ok: false, error: '본사는 폐쇄할 수 없습니다.' };
        }
        set({
          branches: { ...s.branches, [branchId]: { ...branch, status } },
          audit: audit(
            s.audit,
            s.session.accountName,
            '지사 상태 변경',
            branch.name,
            { operating: '운영 중', preparing: '준비 중', closed: '폐쇄' }[status],
          ),
        });
        return { ok: true };
      },

      assignStaffToBranch: (staffId, branchId) => {
        const s = get();
        if (s.session?.role !== 'ceo') return { ok: false, error: '대표만 배치할 수 있습니다.' };
        const rec = s.humanStaff[staffId];
        if (!rec) return { ok: false, error: '사원을 찾을 수 없습니다.' };
        if (branchId && !s.branches[branchId]) return { ok: false, error: '지사를 찾을 수 없습니다.' };
        set({
          humanStaff: { ...s.humanStaff, [staffId]: { ...rec, branchId } },
          audit: audit(
            s.audit,
            s.session.accountName,
            '사원 지사 배치',
            rec.name,
            branchId ? (s.branches[branchId]?.name ?? '-') : '본사',
          ),
        });
        return { ok: true };
      },

      /* ── 회사 창립 신청 (플랫폼 관리자 승인) ─────────────────────────── */
      submitCompanyApplication: (input) => {
        const s = get();
        if (s.session?.role !== 'ceo') return { ok: false, error: '대표 계정으로만 신청할 수 있습니다.' };
        const accountId = input.accountId.trim();
        if (!accountId) return { ok: false, error: '가입 아이디를 입력하세요.' };
        if (!input.founding.name.trim()) return { ok: false, error: '회사명을 입력하세요.' };
        const dup = Object.values(s.companyApplications).find(
          (a) => a.accountId.toLowerCase() === accountId.toLowerCase() && a.status === 'pending',
        );
        if (dup) return { ok: false, error: '이미 처리 대기 중인 신청이 있습니다.' };

        const id = nid('capp');
        const application: CompanyApplication = {
          id,
          status: 'pending',
          founding: input.founding,
          accountId,
          documentRef: input.documentRef,
          submittedAt: Date.now(),
          decidedAt: null,
          decidedBy: null,
          note: null,
        };
        set({
          companyApplications: { ...s.companyApplications, [id]: application },
          session: { ...s.session, companyApplicationId: id },
          audit: audit(
            s.audit,
            input.founding.ceoName,
            '회사 창립 신청',
            input.founding.name,
            `계정 ${accountId} · 관리자 승인 대기`,
          ),
          ui: { ...s.ui, toast: '회사 창립 신청을 접수했습니다. 플랫폼 관리자의 승인을 기다려 주세요.' },
        });
        return { ok: true, applicationId: id };
      },

      lookupCompanyApplicationByAccountId: (accountId) => {
        const trimmed = accountId.trim().toLowerCase();
        return Object.values(get().companyApplications).find((a) => a.accountId.toLowerCase() === trimmed) ?? null;
      },

      clearCompanyApplication: () => {
        const s = get();
        if (!s.session) return;
        set({ session: { ...s.session, companyApplicationId: null } });
      },

      decideCompanyApplication: (id, decision, note) => {
        const s = get();
        if (s.session?.role !== 'platform_admin') return;
        const app = s.companyApplications[id];
        if (!app || app.status !== 'pending') return;
        const decidedBy = s.session.accountName;

        if (decision === 'rejected') {
          set({
            companyApplications: {
              ...s.companyApplications,
              [id]: { ...app, status: 'rejected', decidedAt: Date.now(), decidedBy, note: note?.trim() || null },
            },
            audit: audit(s.audit, decidedBy, '회사 창립 신청 거절', app.founding.name, note?.trim() || ''),
            ui: { ...s.ui, toast: `"${app.founding.name}" 신청을 거절했습니다.` },
          });
          return;
        }

        // 승인 — 실제 회사를 만든다. foundCompany 를 그대로 부르면 지금 로그인한
        // 관리자 세션의 이름이 대표 이름으로 덮어써지므로, 여기서는 직접 만들고
        // 세션은 건드리지 않는다. (사무실 건설·AI 소환은 대표가 다시 로그인하면
        // 이어서 진행한다 — loginDemo 의 단계 복원 로직 참고.)
        const code = generateCompanyCode(app.founding.name);
        const company: Company = { ...app.founding, code, foundedAt: Date.now() };
        const allRoom = makeCompanyWideRoom(company.ceoName);
        const hq = makeHeadquarters(company);
        set({
          company,
          chatRooms: { [allRoom.id]: allRoom },
          chatRoomOrder: [allRoom.id],
          branches: { [hq.id]: hq },
          branchOrder: [hq.id],
          companyApplications: {
            ...s.companyApplications,
            [id]: { ...app, status: 'approved', decidedAt: Date.now(), decidedBy, note: note?.trim() || null },
          },
          audit: audit(s.audit, decidedBy, '회사 창립 신청 승인', company.name, `사원 가입 코드 ${code}`),
          ui: { ...s.ui, toast: `"${company.name}" 회사 창립을 승인했습니다.` },
        });
      },

      /* ── 대표 ↔ 플랫폼 관리자 메시지 ─────────────────────────────────── */
      sendPlatformMessage: (input) => {
        const s = get();
        if (!s.session || (s.session.role !== 'ceo' && s.session.role !== 'platform_admin')) {
          return { ok: false, error: '대표 또는 관리자만 메시지를 보낼 수 있습니다.' };
        }
        const text = input.text.trim();
        if (!text) return { ok: false, error: '내용을 입력하세요.' };
        const msg: PlatformMessage = {
          id: nid('pmsg'),
          threadKey: input.threadKey,
          companyName: input.companyName,
          from: s.session.role === 'platform_admin' ? 'admin' : 'ceo',
          authorName: s.session.accountName,
          text,
          ts: Date.now(),
        };
        set({ platformMessages: [...s.platformMessages, msg] });
        return { ok: true };
      },

      /* ── 회사 창립 ─────────────────────────────────────────────────── */
      foundCompany: (input) => {
        const s = get();
        const code = generateCompanyCode(input.name);
        const company: Company = { ...input, code, foundedAt: Date.now() };
        const allRoom = makeCompanyWideRoom(input.ceoName);
        const hq = makeHeadquarters(company);
        set({
          company,
          phase: 'office_build',
          session: s.session ? { ...s.session, accountName: input.ceoName } : s.session,
          chatRooms: { [allRoom.id]: allRoom },
          chatRoomOrder: [allRoom.id],
          branches: { [hq.id]: hq },
          branchOrder: [hq.id],
          audit: audit(
            s.audit,
            input.ceoName,
            '회사 창립',
            company.name,
            `${company.branch} / ${company.currency} · 사원 가입 코드 ${code}`,
          ),
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
        // 회사 삭제는 대표 본인이 결정할 수 없다 — 반드시 플랫폼 관리자만.
        if (approval.kind === 'company_deletion' && s.session?.role !== 'platform_admin') return;

        const approvals = s.approvals.map((a) =>
          a.id === approvalId ? { ...a, status: decision, note: note ?? null, decidedAt: Date.now() } : a,
        );
        let employees = s.employees;
        let missions = s.missions;
        let chats = s.chats;

        const positive = decision === 'approved' || decision === 'conditional';

        // 휴가 신청 — 승인되면 그 사원의 근태를 바로 '휴가'로 바꾼다.
        // 근태가 승인 기록과 따로 놀면 "승인했는데 화면은 출근"인 상태가 생긴다.
        if (approval.kind === 'leave_request') {
          if (s.session?.role !== 'ceo') return;
          const rec = s.humanStaff[approval.requesterId];
          set({
            approvals,
            humanStaff:
              positive && rec ? { ...s.humanStaff, [rec.id]: { ...rec, workMode: 'leave' } } : s.humanStaff,
            audit: audit(
              s.audit,
              s.session.accountName,
              positive ? '휴가 승인' : '휴가 거절',
              rec?.name ?? approval.requesterId,
              approval.leaveDays ? `${approval.leaveDays.startDay} ~ ${approval.leaveDays.endDay}` : '',
            ),
            ui: {
              ...s.ui,
              toast: positive
                ? `${rec?.name ?? '사원'}의 휴가를 승인했습니다. 근태가 '휴가'로 바뀌었습니다.`
                : '휴가 신청을 거절했습니다.',
            },
          });
          return;
        }

        if (approval.kind === 'company_deletion') {
          if (positive) {
            const companyName = s.company?.name ?? '(알 수 없음)';
            // "회사 생성 시 기존 데이터는 따로 저장" — 지우기 전에 요약을 아카이브에 남긴다.
            const archivedCompanies: ArchivedCompany[] = s.company
              ? [
                  ...s.archivedCompanies,
                  {
                    id: nid('arcv'),
                    company: s.company,
                    archivedAt: Date.now(),
                    reason: note?.trim() || approval.reason || '대표 요청 · 플랫폼 관리자 승인',
                    employeeCount: Object.keys(s.employees).length,
                    humanStaffCount: Object.values(s.humanStaff).filter((r) => r.status === 'approved').length,
                    missionCount: s.missionOrder.length,
                    totalSpendUsd: s.ledger.reduce((sum, e) => sum + e.costUsd, 0),
                  },
                ]
              : s.archivedCompanies;
            // 회사 범위 데이터만 초기화한다 — 관리자 세션과 플랫폼 데이터(신청서·메시지·
            // 아카이브)는 그대로 둔다. 예전에는 관리자 세션까지 로그아웃시켰지만, 이제는
            // 관리자 전용 대시보드가 company 유무와 무관하게 동작하므로 그럴 필요가 없다.
            set({
              company: null,
              employees: {},
              employeeOrder: [],
              humanStaff: {},
              staffChats: {},
              memories: {},
              missions: {},
              missionOrder: [],
              artifacts: {},
              approvals: [],
              ledger: [],
              chats: {},
              chatRooms: {},
              chatRoomOrder: [],
              chatRoomMessages: {},
              chatRoomInvites: [],
              // 회사가 사라지면 대표·사원 자격증명도 함께 지운다. 관리자 것은 남긴다 —
              // 관리자는 회사와 무관하게 계속 들어와야 한다.
              credentials: Object.fromEntries(
                Object.entries(s.credentials).filter(([k]) => k === ADMIN_ACCOUNT_KEY),
              ),
              loginAttempts: {},
              lastReadAt: {},
              schedule: [],
              branches: {},
              branchOrder: [],
              tutorial: { summoned: false, interviewsDone: false, firstMissionDone: false },
              easterEgg: initialEasterEgg,
              simulationMode: false,
              archivedCompanies,
              audit: audit(s.audit, s.session?.accountName ?? '-', '회사 삭제 승인', companyName, '데이터 삭제 · 요약은 아카이브에 보관'),
              ui: { ...s.ui, toast: `"${companyName}" 회사를 삭제했습니다. 요약 기록은 아카이브에 남아 있습니다.` },
            });
          } else {
            set({
              approvals,
              audit: audit(s.audit, s.session?.accountName ?? '-', '회사 삭제 거절', s.company?.name ?? '-', note ?? ''),
              ui: { ...s.ui, toast: '회사 삭제 요청을 거절했습니다.' },
            });
          }
          return;
        }

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

      sendEmployeeToRoom: (employeeId, room) => {
        const s = get();
        const emp = s.employees[employeeId];
        if (!emp) return { ok: false, error: '직원을 찾을 수 없습니다.' };

        // 인간 직원은 캐릭터처럼 화면 위에서 옮길 수 없다 — 대신 메시지를 남긴다.
        // (지금은 인간 직원이 실제로 소환되지 않지만, 그 기능이 연결됐을 때를 대비해
        // 규칙을 미리 맞춰 둔다: AI는 걸어가고, 사람은 메시지를 받는다.)
        if (emp.kind === 'human') {
          const roomName = roomById(room).name;
          const chats = pushMessage(
            s.chats,
            employeeId,
            'ceo',
            'system',
            `[메시지] ${roomName}(으)로 와 주실 수 있나요?`,
          );
          set({
            chats,
            audit: audit(s.audit, s.session?.accountName ?? '-', '메시지 남김', emp.name, roomName),
            ui: { ...s.ui, toast: `${emp.name}님에게 메시지를 남겼습니다. (실제 발송은 백엔드 연결 후 동작합니다)` },
          });
          return { ok: true, messaged: true };
        }

        const alreadyFreelyWalking = emp.state === 'walking' && !emp.currentMissionId;
        if (emp.onLeave || !(alreadyFreelyWalking || canAcceptWork(emp.state))) {
          return { ok: false, error: '지금은 이동시킬 수 없습니다 (업무 중이거나 휴직 중입니다).' };
        }

        const draft: Employee = { ...emp, pos: { ...emp.pos }, path: [...emp.path] };
        routeTo(draft, room);
        if (!alreadyFreelyWalking) applyAgentEvent(draft, { type: 'GO' });
        draft.lastIdleAt = Date.now();

        const isInterview = room === 'ceo_office';
        const chats = isInterview
          ? pushMessage(s.chats, employeeId, 'system', 'system', '[면담] 대표 집무실로 불려 왔습니다. 편하게 이야기해 주세요.')
          : s.chats;

        set({
          employees: { ...s.employees, [employeeId]: draft },
          chats,
          audit: audit(s.audit, s.session?.accountName ?? '-', '직원 이동', emp.name, roomById(room).name),
          ui: {
            ...s.ui,
            // 대표 집무실로 보내면 도착을 기다리지 않고 바로 1:1 패널을 연다 —
            // "데려다 놓고 마주 앉아 대화한다"는 면담의 실제 시작점이다.
            selectedEmployeeId: isInterview ? employeeId : s.ui.selectedEmployeeId,
            toast: isInterview ? `${emp.name}님과 1:1 면담을 시작합니다.` : `${emp.name}님이 ${roomById(room).name}(으)로 이동합니다.`,
          },
        });
        return { ok: true };
      },

      /* ── 인간 사원 가입·근태 ──────────────────────────────────────── */
      lookupHumanStaffByEmail: (email) => {
        const s = get();
        const trimmed = email.trim().toLowerCase();
        return Object.values(s.humanStaff).find((r) => r.email.toLowerCase() === trimmed) ?? null;
      },

      applyAsHumanStaff: (input) => {
        const s = get();
        if (!s.company) return { ok: false, error: '아직 창립된 회사가 없습니다.' };
        const name = input.name.trim();
        const email = input.email.trim().toLowerCase();
        if (!name) return { ok: false, error: '이름을 입력하세요.' };
        if (!email.includes('@')) return { ok: false, error: '올바른 이메일 주소를 입력하세요.' };
        if (input.companyCode.trim().toUpperCase() !== s.company.code.toUpperCase()) {
          return { ok: false, error: '회사 코드가 올바르지 않습니다.' };
        }
        if (Object.values(s.humanStaff).some((r) => r.email.toLowerCase() === email)) {
          return { ok: false, error: '이미 이 이메일로 신청한 기록이 있습니다. "이메일로 계속하기"를 이용하세요.' };
        }

        const id = nid('staff');
        const record: HumanStaffRecord = {
          id,
          name,
          email,
          phone: input.phone.trim() || null,
          companyCode: s.company.code,
          role: input.role.trim() || '사원',
          appearanceId: input.appearanceId,
          status: 'pending',
          workMode: 'not_started',
          currentTaskNote: null,
          currentTaskUpdatedAt: null,
          branchId: null,
          monthlySalaryUsd: null,
          benefits: [],
          requestedAt: Date.now(),
          decidedAt: null,
          decidedBy: null,
        };
        set({
          humanStaff: { ...s.humanStaff, [id]: record },
          session: { role: 'human_staff', accountName: name, demo: true, humanStaffId: id },
          phase: 'live',
          audit: audit(s.audit, name, '사원 가입 신청', s.company.name, `이메일 ${email}`),
        });
        return { ok: true, staffId: id };
      },

      continueHumanStaffSession: (email) => {
        const s = get();
        const trimmed = email.trim().toLowerCase();
        const record = Object.values(s.humanStaff).find((r) => r.email.toLowerCase() === trimmed);
        if (!record) return { ok: false, error: '해당 이메일로 신청한 기록이 없습니다. 먼저 가입 신청을 해주세요.' };
        set({
          session: { role: 'human_staff', accountName: record.name, demo: true, humanStaffId: record.id },
          phase: 'live',
          audit: audit(s.audit, record.name, '사원 로그인', s.company?.name ?? '-', record.status),
        });
        return { ok: true };
      },

      decideHumanStaffApplication: (id, decision) => {
        const s = get();
        if (s.session?.role !== 'ceo') return;
        const rec = s.humanStaff[id];
        if (!rec || rec.status !== 'pending') return;
        const updated: HumanStaffRecord = {
          ...rec,
          status: decision,
          decidedAt: Date.now(),
          decidedBy: s.session.accountName,
          workMode: decision === 'approved' ? 'office' : rec.workMode,
        };
        set({
          humanStaff: { ...s.humanStaff, [id]: updated },
          audit: audit(
            s.audit,
            s.session.accountName,
            decision === 'approved' ? '사원 가입 승인' : '사원 가입 거절',
            rec.name,
            rec.email,
          ),
        });
      },

      removeHumanStaff: (id) => {
        const s = get();
        if (s.session?.role !== 'ceo') return;
        const rec = s.humanStaff[id];
        if (!rec) return;
        set({
          humanStaff: { ...s.humanStaff, [id]: { ...rec, status: 'removed', workMode: 'not_started' } },
          audit: audit(s.audit, s.session.accountName, '사원 내보냄', rec.name, rec.email),
        });
      },

      reinstateHumanStaff: (id) => {
        const s = get();
        if (s.session?.role !== 'ceo') return;
        const rec = s.humanStaff[id];
        if (!rec || rec.status !== 'removed') return;
        set({
          humanStaff: { ...s.humanStaff, [id]: { ...rec, status: 'approved', workMode: 'office' } },
          audit: audit(s.audit, s.session.accountName, '사원 재입장', rec.name, rec.email),
        });
      },

      updateHumanStaff: (id, patch) => {
        const s = get();
        if (s.session?.role !== 'ceo') return;
        const rec = s.humanStaff[id];
        if (!rec) return;
        set({ humanStaff: { ...s.humanStaff, [id]: { ...rec, ...patch } } });
      },

      requestCompanyDeletion: (reason) => {
        const s = get();
        if (s.session?.role !== 'ceo' || !s.company) {
          return { ok: false, error: '대표만 요청할 수 있습니다.' };
        }
        if (s.approvals.some((a) => a.kind === 'company_deletion' && a.status === 'pending')) {
          return { ok: false, error: '이미 처리 대기 중인 삭제 요청이 있습니다.' };
        }
        const approval: Approval = {
          id: nid('apr'),
          kind: 'company_deletion',
          title: `"${s.company.name}" 회사 삭제 요청`,
          reason: reason.trim() || '대표가 회사 삭제를 요청했습니다.',
          requesterId: s.company.ceoName,
          participants: [],
          estCostUsd: 0,
          estSeconds: 0,
          risk: 'high',
          model: null,
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
          audit: audit(s.audit, s.session.accountName, '회사 삭제 요청', s.company.name, '플랫폼 관리자 승인 대기'),
          ui: { ...s.ui, toast: '회사 삭제를 요청했습니다. 플랫폼 관리자의 승인이 필요합니다.' },
        });
        return { ok: true };
      },

      setCompanyDriveLink: (url) => {
        const s = get();
        if (s.session?.role !== 'ceo' || !s.company) {
          return { ok: false, error: '대표만 설정할 수 있습니다.' };
        }
        const trimmed = url?.trim() || null;
        if (trimmed && !/^https:\/\//.test(trimmed)) {
          return { ok: false, error: 'https:// 로 시작하는 구글 드라이브 폴더 링크를 입력하세요.' };
        }
        set({
          company: { ...s.company, driveFolderUrl: trimmed },
          audit: audit(
            s.audit,
            s.session.accountName,
            trimmed ? '구글 드라이브 연결' : '구글 드라이브 연결 해제',
            s.company.name,
            trimmed ?? '',
          ),
          ui: { ...s.ui, toast: trimmed ? '구글 드라이브를 연결했습니다.' : '구글 드라이브 연결을 해제했습니다.' },
        });
        return { ok: true };
      },

      /* ── 이스터에그 ───────────────────────────────────────────────── */
      tryEasterEggCode: (code) => {
        const trimmed = code.trim();

        // 같은 "mkang" 표기의 숨겨진 두 번째 코드 — 플랫폼 관리자 로그인 진입점이다.
        // 로그인 화면에는 관리자 버튼을 아예 노출하지 않고, 이 코드로만 들어간다.
        if (trimmed === ADMIN_UNLOCK_CODE) {
          // 예전에는 이 코드만 맞으면 바로 관리자로 들어갔다. 코드가 소스에 있으므로
          // 그것만으로는 잠금 장치가 되지 못한다. 이제는 관문을 열 뿐이고,
          // 실제 진입은 관리자 암호를 통과해야 한다.
          if (!get().session) get().setAdminGate(true);
          return true;
        }

        // 세 번째 숨은 코드 — 관리자 승인·회사 신청 절차를 건너뛰고 임의의 사업자로
        // 즉시 로그인해 기능을 자유롭게 테스트한다. 이스터에그와 달리 자동 대본은
        // 재생되지 않는다 — 직접 눌러보며 테스트하는 용도다.
        if (trimmed === SIMULATION_MODE_CODE) {
          if (!get().session) get().loginDemo('ceo');
          if (!get().company) {
            // 관리자/시뮬레이션 모드의 즉석 회사는 "제작자 소유"의 테스트용 드라이브
            // 폴더로 미리 연결해 둔다 — 실제 창립 신청은 이렇게 자동으로 채워지지 않는다.
            get().foundCompany({ ...COMPANY_DEFAULTS, driveFolderUrl: DRIVE_ROOT_FOLDER_URL });
            get().buildOffice();
          }
          if (Object.keys(get().employees).length < 3) get().summonEmployees();

          // 근태 3종(미출근·출근·재택)이 화면에서 어떻게 보이는지 바로 확인할 수 있도록
          // 가짜 인간 사원을 채워 둔다. 실제 가입 흐름으로 만든 사원이 이미 있으면 건드리지 않는다.
          const s1 = get();
          let humanStaff = s1.humanStaff;
          if (Object.keys(humanStaff).length === 0) {
            const now = Date.now();
            const seeded: Record<string, HumanStaffRecord> = {};
            for (const spec of SIMULATION_HUMAN_STAFF) {
              const staffId = nid('staff');
              seeded[staffId] = {
                id: staffId,
                name: spec.name,
                email: spec.email,
                phone: null,
                companyCode: s1.company?.code ?? '',
                role: spec.role,
                appearanceId: spec.appearanceId,
                status: 'approved',
                workMode: spec.workMode,
                monthlySalaryUsd: 3000,
                benefits: ['4대보험'],
                currentTaskNote: spec.currentTaskNote,
                currentTaskUpdatedAt: spec.currentTaskNote ? now : null,
                branchId: null,
                requestedAt: now,
                decidedAt: now,
                decidedBy: s1.company?.ceoName ?? '대표',
              };
            }
            humanStaff = seeded;
          }

          const s2 = get();
          set({
            phase: 'live',
            humanStaff,
            tutorial: { summoned: true, interviewsDone: true, firstMissionDone: true },
            simulationMode: true,
            audit: audit(
              s2.audit,
              s2.session?.accountName ?? PLATFORM_MAKER,
              '시뮬레이션 모드 진입',
              s2.company?.name ?? '테스트용 회사',
              '관리자 승인 없이 임의의 사업자로 즉시 생성 (실제 서비스 아님)',
            ),
            ui: { ...s2.ui, toast: '🧪 시뮬레이션 모드로 진입했습니다. 임의의 사업자로 자유롭게 기능을 테스트할 수 있습니다.' },
          });
          return true;
        }

        if (trimmed !== EASTER_EGG_CODE) return false;

        if (!get().session) get().loginDemo('ceo');
        if (!get().company) {
          get().foundCompany({ ...COMPANY_DEFAULTS, driveFolderUrl: DRIVE_ROOT_FOLDER_URL });
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
            s.platformMakerName || PLATFORM_MAKER,
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

      /* ── 부서·전사 공용 채팅방 ────────────────────────────────────────── */
      createTeamRoom: (name) => {
        const s = get();
        if (s.session?.role !== 'ceo' || !s.company) return { ok: false, error: '대표만 만들 수 있습니다.' };
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: '방 이름을 입력하세요.' };
        const id = nid('room');
        const room: ChatRoom = {
          id,
          kind: 'team',
          name: trimmed,
          memberIds: [],
          createdAt: Date.now(),
          createdBy: s.session.accountName,
        };
        set({
          chatRooms: { ...s.chatRooms, [id]: room },
          chatRoomOrder: [...s.chatRoomOrder, id],
          audit: audit(s.audit, s.session.accountName, '채팅방 생성', trimmed, ''),
        });
        return { ok: true, roomId: id };
      },

      sendRoomMessage: (roomId, text, attachments) => {
        const s = get();
        const room = s.chatRooms[roomId];
        if (!room || !s.session) return { ok: false, error: '보낼 수 없습니다.' };
        // 첨부만 보내는 것은 허용한다 — 파일 한 장을 던지는 일이 실제로 잦다.
        if (!text.trim() && (!attachments || attachments.length === 0)) {
          return { ok: false, error: '내용이나 파일을 넣어 주세요.' };
        }
        if (attachments && attachments.length > 0) {
          const check = checkAttachments(get().attachmentBytesUsed(), attachments);
          if (!check.ok) return check;
        }

        let authorId: string;
        let authorKind: ChatRoomAuthorKind;
        let authorName: string;
        if (s.session.role === 'ceo') {
          authorId = 'ceo';
          authorKind = 'ceo';
          authorName = s.session.accountName;
        } else if (s.session.role === 'human_staff' && s.session.humanStaffId) {
          const rec = s.humanStaff[s.session.humanStaffId];
          if (!rec || rec.status !== 'approved') return { ok: false, error: '승인된 사원만 보낼 수 있습니다.' };
          const isMember = room.kind === 'company_wide' || room.memberIds.includes(rec.id);
          if (!isMember) return { ok: false, error: '이 방의 멤버가 아닙니다.' };
          authorId = rec.id;
          authorKind = 'human';
          authorName = rec.name;
        } else {
          return { ok: false, error: '대표 또는 사원만 보낼 수 있습니다.' };
        }

        const msg: ChatRoomMessage = {
          id: nid('rmsg'),
          roomId,
          authorId,
          authorKind,
          authorName,
          text: text.trim(),
          ts: Date.now(),
          ...(attachments && attachments.length > 0 ? { attachments } : {}),
        };
        set({ chatRoomMessages: { ...s.chatRoomMessages, [roomId]: [...(s.chatRoomMessages[roomId] ?? []), msg] } });
        return { ok: true };
      },

      proposeRoomInvite: (input) => {
        const s = get();
        const room = s.chatRooms[input.roomId];
        if (!room) return { ok: false, error: '방을 찾을 수 없습니다.' };
        if (room.kind !== 'team') return { ok: false, error: '전사 공용 방은 이미 전원이 멤버입니다.' };
        if (room.memberIds.includes(input.inviteeId)) return { ok: false, error: '이미 멤버입니다.' };

        const inviteeName =
          input.inviteeKind === 'ai' ? s.employees[input.inviteeId]?.name : s.humanStaff[input.inviteeId]?.name;
        if (!inviteeName) return { ok: false, error: '대상을 찾을 수 없습니다.' };

        if (s.session?.role === 'ceo') {
          const proposedByKind = input.proposedByKind ?? 'ceo';
          const proposedByName = proposedByKind === 'ai' ? input.proposedByName?.trim() || '대표' : s.session.accountName;
          const invite: ChatRoomInvite = {
            id: nid('rinv'),
            roomId: input.roomId,
            inviteeId: input.inviteeId,
            inviteeKind: input.inviteeKind,
            inviteeName,
            proposedByKind,
            proposedByName,
            status: 'approved',
            createdAt: Date.now(),
            decidedAt: Date.now(),
          };
          set({
            chatRoomInvites: [invite, ...s.chatRoomInvites],
            chatRooms: { ...s.chatRooms, [room.id]: { ...room, memberIds: [...room.memberIds, input.inviteeId] } },
            audit: audit(s.audit, s.session.accountName, '채팅방 초대', `${room.name} · ${inviteeName}`, ''),
          });
          return { ok: true };
        }

        if (s.session?.role === 'human_staff' && s.session.humanStaffId) {
          const rec = s.humanStaff[s.session.humanStaffId];
          if (!rec || rec.status !== 'approved') return { ok: false, error: '승인된 사원만 제안할 수 있습니다.' };
          const invite: ChatRoomInvite = {
            id: nid('rinv'),
            roomId: input.roomId,
            inviteeId: input.inviteeId,
            inviteeKind: input.inviteeKind,
            inviteeName,
            proposedByKind: 'human',
            proposedByName: rec.name,
            status: 'pending',
            createdAt: Date.now(),
            decidedAt: null,
          };
          set({
            chatRoomInvites: [invite, ...s.chatRoomInvites],
            ui: { ...s.ui, toast: '초대를 제안했습니다. 대표 승인이 필요합니다.' },
          });
          return { ok: true };
        }

        return { ok: false, error: '대표 또는 사원만 제안할 수 있습니다.' };
      },

      decideRoomInvite: (inviteId, decision) => {
        const s = get();
        if (s.session?.role !== 'ceo') return;
        const invite = s.chatRoomInvites.find((i) => i.id === inviteId);
        if (!invite || invite.status !== 'pending') return;
        const chatRoomInvites = s.chatRoomInvites.map((i) =>
          i.id === inviteId ? { ...i, status: decision, decidedAt: Date.now() } : i,
        );
        const room = s.chatRooms[invite.roomId];
        const chatRooms =
          decision === 'approved' && room && !room.memberIds.includes(invite.inviteeId)
            ? { ...s.chatRooms, [room.id]: { ...room, memberIds: [...room.memberIds, invite.inviteeId] } }
            : s.chatRooms;
        set({
          chatRoomInvites,
          chatRooms,
          audit: audit(
            s.audit,
            s.session.accountName,
            decision === 'approved' ? '채팅방 초대 승인' : '채팅방 초대 거절',
            `${room?.name ?? '-'} · ${invite.inviteeName}`,
            '',
          ),
        });
      },

      updateOwnTaskNote: (text) => {
        const s = get();
        if (s.session?.role !== 'human_staff' || !s.session.humanStaffId) {
          return { ok: false, error: '사원 계정만 남길 수 있습니다.' };
        }
        const rec = s.humanStaff[s.session.humanStaffId];
        if (!rec) return { ok: false, error: '기록을 찾을 수 없습니다.' };
        set({
          humanStaff: {
            ...s.humanStaff,
            [rec.id]: { ...rec, currentTaskNote: text.trim() || null, currentTaskUpdatedAt: Date.now() },
          },
        });
        return { ok: true };
      },

      updateOwnWorkMode: (mode) => {
        const s = get();
        if (s.session?.role !== 'human_staff' || !s.session.humanStaffId) {
          return { ok: false, error: '사원 계정만 바꿀 수 있습니다.' };
        }
        const rec = s.humanStaff[s.session.humanStaffId];
        if (!rec) return { ok: false, error: '기록을 찾을 수 없습니다.' };
        if (rec.status !== 'approved') return { ok: false, error: '승인된 사원만 바꿀 수 있습니다.' };
        if (rec.workMode === 'leave') {
          return { ok: false, error: '휴가 중에는 대표가 근태를 되돌려 주어야 합니다.' };
        }
        set({
          humanStaff: { ...s.humanStaff, [rec.id]: { ...rec, workMode: mode } },
          audit: audit(s.audit, rec.name, '근태 변경(본인)', rec.name, mode),
        });
        return { ok: true };
      },

      sendStaffMessage: (staffId, text, attachments) => {
        const s = get();
        const body = text.trim();
        if (!body && (!attachments || attachments.length === 0)) {
          return { ok: false, error: '내용이나 파일을 넣어 주세요.' };
        }
        if (attachments && attachments.length > 0) {
          const check = checkAttachments(get().attachmentBytesUsed(), attachments);
          if (!check.ok) return check;
        }

        const rec = s.humanStaff[staffId];
        if (!rec) return { ok: false, error: '사원을 찾을 수 없습니다.' };
        if (rec.status !== 'approved') return { ok: false, error: '승인된 사원과만 대화할 수 있습니다.' };

        const role = s.session?.role;
        // 대표는 누구에게나, 사원은 자기 스레드에만. 그 밖(플랫폼 관리자 등)은 막는다 —
        // 관리자가 회사 내부 1:1 대화에 끼어들 이유가 없다.
        const isCeo = role === 'ceo';
        const isOwner = role === 'human_staff' && s.session?.humanStaffId === staffId;
        if (!isCeo && !isOwner) return { ok: false, error: '이 대화에 쓸 권한이 없습니다.' };

        const msg: StaffMessage = {
          id: nid('smsg'),
          staffId,
          from: isCeo ? 'ceo' : 'staff',
          authorName: s.session?.accountName ?? (isCeo ? '대표' : rec.name),
          text: body,
          ts: Date.now(),
          ...(attachments && attachments.length > 0 ? { attachments } : {}),
        };
        set({
          staffChats: { ...s.staffChats, [staffId]: [...(s.staffChats[staffId] ?? []), msg] },
        });
        return { ok: true };
      },

      attachmentBytesUsed: () => {
        const s = get();
        const all: Attachment[] = [];
        for (const list of Object.values(s.chatRoomMessages)) {
          for (const m of list) if (m.attachments) all.push(...m.attachments);
        }
        for (const list of Object.values(s.staffChats)) {
          for (const m of list) if (m.attachments) all.push(...m.attachments);
        }
        return usedBytes(all);
      },

      /* ── 일정 · 타임라인 ───────────────────────────────────────────── */

      addScheduleEvent: (input) => {
        const s = get();
        if (s.session?.role !== 'ceo') return { ok: false, error: '대표만 일정을 추가할 수 있습니다.' };
        if (!s.company) return { ok: false, error: '회사가 없습니다.' };

        const check = validateEvent(input);
        if (!check.ok) return check;

        // 없는 지사에 일정을 붙이면 화면 어디에도 안 보이는 유령이 된다.
        if (input.branchId !== null && !s.branches[input.branchId]) {
          return { ok: false, error: '그런 지사가 없습니다.' };
        }

        const event: ScheduleEvent = {
          id: nid('sch'),
          title: input.title.trim(),
          kind: input.kind,
          branchId: input.branchId,
          startDay: input.startDay,
          endDay: input.endDay,
          note: (input.note ?? '').trim(),
          ownerName: s.session.accountName,
          createdBy: s.session.accountName,
          createdAt: Date.now(),
        };
        const where = input.branchId === null ? '전사 공용' : (s.branches[input.branchId]?.name ?? input.branchId);
        set({
          schedule: [...s.schedule, event],
          audit: audit(s.audit, s.session.accountName, '일정 추가', event.title, `${where} · ${input.startDay}~${input.endDay}`),
        });
        return { ok: true };
      },

      removeScheduleEvent: (id) => {
        const s = get();
        if (s.session?.role !== 'ceo') return { ok: false, error: '대표만 일정을 지울 수 있습니다.' };
        const found = s.schedule.find((e) => e.id === id);
        if (!found) return { ok: false, error: '그런 일정이 없습니다.' };
        set({
          schedule: s.schedule.filter((e) => e.id !== id),
          audit: audit(s.audit, s.session.accountName, '일정 삭제', found.title, ''),
        });
        return { ok: true };
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

      // 오른쪽 패널은 하나뿐이므로 둘 중 하나만 선택된 상태로 둔다.
      selectEmployee: (id) => set((s) => ({ ui: { ...s.ui, selectedEmployeeId: id, selectedStaffId: null } })),
      selectStaff: (id) => set((s) => ({ ui: { ...s.ui, selectedStaffId: id, selectedEmployeeId: null } })),
      openPanel: (p) => set((s) => ({ ui: { ...s.ui, openPanel: p } })),
      setToast: (t) => set((s) => ({ ui: { ...s.ui, toast: t } })),
      setAdminGate: (open) => set((s) => ({ ui: { ...s.ui, adminGateOpen: open } })),

      ensureCompanyWideRoom: () => {
        const patch = withCompanyWideRoom(get());
        if (patch) set(patch);
      },

      /* ── 날씨 ────────────────────────────────────────────────────── */

      applyWeather: (reading) =>
        set((s) => ({
          weather: {
            ...s.weather,
            // 수동 고정 중에는 사람이 고른 값을 존중한다 — 자동 갱신이 덮지 않는다.
            condition: s.weather.manual ?? reading.condition,
            temperatureC: reading.temperatureC,
            isDay: reading.isDay,
            coords: reading.coords,
            source: s.weather.manual ? 'manual' : reading.source,
            note: null,
            updatedAt: reading.observedAt,
          },
        })),

      setWeatherManual: (condition) =>
        set((s) => ({
          weather: {
            ...s.weather,
            manual: condition,
            condition: condition ?? s.weather.condition,
            // 자동으로 되돌리면 다음 관측이 올 때까지는 마지막 출처를 알 수 없다.
            source: condition ? 'manual' : 'none',
            note: condition ? '수동으로 고정된 날씨입니다 (실제 관측값 아님).' : null,
            updatedAt: Date.now(),
          },
        })),

      setWeatherEffects: (on) => set((s) => ({ weather: { ...s.weather, effects: on } })),

      setWeatherNote: (note) => set((s) => ({ weather: { ...s.weather, note } })),

      /* ── 시뮬레이션 루프 ──────────────────────────────────────────── */
      tick: (dtMs) => set((s) => advanceWorld(s, dtMs)),

      resetAll: () => set({ ...initialState }),
    }),
    {
      name: 'guild-office-v1',
      storage: createJSONStorage(() => localStorage),
      /**
       * 저장값을 불러온 직후 보정한다. 전체 채팅방이 생기기 전에 저장된 데이터에는
       * 회사만 있고 방이 없어서 채팅방 화면이 비어 보이기 때문이다.
       */
      onRehydrateStorage: () => (state) => {
        state?.ensureCompanyWideRoom();
      },
      /**
       * 영속화 대상. UI 임시 상태는 저장하지 않는다.
       * 비밀값은 애초에 상태에 존재하지 않으므로 여기서 걸러낼 것도 없다.
       */
      partialize: (s) => ({
        session: s.session,
        phase: s.phase,
        company: s.company,
        platformMakerName: s.platformMakerName,
        employees: s.employees,
        employeeOrder: s.employeeOrder,
        humanStaff: s.humanStaff,
        staffChats: s.staffChats,
        companyApplications: s.companyApplications,
        platformMessages: s.platformMessages,
        branches: s.branches,
        branchOrder: s.branchOrder,
        archivedCompanies: s.archivedCompanies,
        memories: s.memories,
        missions: s.missions,
        missionOrder: s.missionOrder,
        artifacts: s.artifacts,
        approvals: s.approvals,
        ledger: s.ledger,
        audit: s.audit,
        chats: s.chats,
        chatRooms: s.chatRooms,
        chatRoomOrder: s.chatRoomOrder,
        chatRoomMessages: s.chatRoomMessages,
        chatRoomInvites: s.chatRoomInvites,
        credentials: s.credentials,
        loginAttempts: s.loginAttempts,
        lastReadAt: s.lastReadAt,
        schedule: s.schedule,
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
