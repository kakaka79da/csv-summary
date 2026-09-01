/**
 * 도메인 타입 정의 (단일 진실 공급원).
 *
 * 설계 원칙: 게임 연출용 값과 실제 업무/비용 값을 절대 분리해서 다룬다.
 * 몬스터 체력 같은 연출 값은 항상 실제 진행률에서 파생시키고, 그 반대는 없다.
 */

/* ────────────────────────────── 계정 / 세션 ───────────────────────────── */

/** 로그인 역할. 인간 직원은 회사 창립 이후에만 활성화된다. */
export type Role = 'ceo' | 'platform_admin' | 'human_staff';

export interface Session {
  /** 현재 로그인한 계정의 역할 */
  role: Role;
  /** 로그인한 계정 이름. 회사 대표자명과는 별개로 표시한다. */
  accountName: string;
  /** 데모 로그인 여부. 실제 인증은 백엔드 구현 항목이다. */
  demo: true;
  /** role 이 'human_staff' 일 때, humanStaff 명부의 어느 레코드인지. */
  humanStaffId?: string | null;
  /** role 이 'ceo' 이고 아직 회사가 승인되지 않았을 때, 제출한 신청서 id. */
  companyApplicationId?: string | null;
}

/* ──────────────────────────────── 회사 ──────────────────────────────── */

export interface Company {
  name: string;
  ceoName: string;
  ceoCharacterName: string;
  ceoGender: CeoGender;
  ceoAppearance: AppearanceId;
  country: string;
  branch: string;
  currency: 'KRW' | 'USD' | 'JPY' | 'EUR';
  /** 월간 AI 예산 (USD 기준. 표시만 통화 변환한다) */
  monthlyBudgetUsd: number;
  firstGoal: string;
  foundedAt: number;

  /**
   * 사업자 개업 시 필수 항목. 사원이 가입할 때 입력하는 회사 코드도 여기서 나온다.
   * ⚠️ 이 프로토타입은 이 값들을 실제로 검증하거나 외부에 제출하지 않는다 — 화면 표시와
   * 사원 가입 시 코드 대조용으로만 쓰인다.
   */
  code: string;
  ceoPhone: string;
  businessRegNo: string;
  ceoEmail: string;
}

export type CeoGender = 'male' | 'female';
export type AppearanceId = 'sovereign' | 'warden' | 'seer' | 'artificer';

/* ──────────────────────────── 오피스 / 좌표 ──────────────────────────── */

export interface Vec2 {
  x: number;
  y: number;
}

export type RoomId =
  | 'ceo_office'
  | 'admin_desk'
  | 'lab'
  | 'sales_room'
  | 'meeting'
  | 'lounge'
  | 'api_room'
  | 'training'
  | 'fishing'
  | 'dungeon_gate';

export interface Room {
  id: RoomId;
  /** 화면에 보여줄 실제 업무 명칭 */
  name: string;
  /** 판타지 연출 명칭 */
  flavor: string;
  /** 타일 좌표 기준 사각형 */
  rect: { x: number; y: number; w: number; h: number };
  /** 캐릭터가 서는 지점 (타일 좌표) */
  anchor: Vec2;
  /** 출입구 타일 */
  door: Vec2;
}

/** 경로탐색용 격자. 1 = 통과 불가(벽/가구) */
export interface Grid {
  w: number;
  h: number;
  blocked: Uint8Array;
}

/* ────────────────────────── AI 제공자 연결 ─────────────────────────── */

export type ProviderId = 'openai' | 'anthropic' | 'google' | 'local' | 'custom';

export type ConnectionStatus = 'unconnected' | 'testing' | 'connected' | 'error';

/**
 * 제공자 연결 정보.
 *
 * ⚠️ 보안: 이 객체는 API 키 원문을 절대 담지 않는다.
 * 프론트엔드는 서버가 발급한 참조 ID(keyRef)와 마스킹 문자열만 알 수 있다.
 * 프로토타입에서는 실제 키를 입력받지 않고 가상 연결 과정만 제공한다.
 */
export interface ProviderBinding {
  provider: ProviderId | null;
  model: string | null;
  status: ConnectionStatus;
  /** 서버 측 키 참조 ID. 키 원문이 아니다. */
  keyRef: string | null;
  /** 화면 표시용 마스킹 문자열. 예: "sk-…••••4821" */
  maskedKey: string | null;
  /** 작업 1건당 비용 상한 (USD) */
  perTaskLimitUsd: number;
  /** 월간 비용 상한 (USD) */
  monthlyLimitUsd: number;
  allowedTools: ToolId[];
  lastTestedAt: number | null;
}

export type ToolId =
  | 'web_search'
  | 'file_read'
  | 'file_write'
  | 'code_exec'
  | 'email_send'
  | 'crm_read';

/* ────────────────────────────── 직원 ────────────────────────────────── */

/**
 * 캐릭터 상태. 이 값은 항상 실제 업무 데이터에서 파생된다.
 * 애니메이션만 바뀌고 실제 상태가 그대로인 상황을 막기 위해,
 * 상태 전이는 반드시 agentMachine.ts 의 전이표를 통과해야 한다.
 */
export type AgentState =
  | 'idle'
  | 'walking'
  | 'thinking'
  | 'working'
  | 'writing'
  | 'mailing'
  | 'collaborating'
  | 'fighting'
  | 'fishing'
  | 'resting'
  | 'playing'
  | 'awaiting_approval'
  | 'on_leave'
  | 'completed'
  | 'error';

export type EmployeeKind = 'ai' | 'human';

export type JobClass = 'strategist' | 'rune_engineer' | 'sage' | 'sovereign';

export interface Employee {
  id: string;
  kind: EmployeeKind;
  name: string;
  /** 실제 직책 */
  title: string;
  /** 판타지 직업 */
  jobClass: JobClass;
  jobLabel: string;
  palette: { robe: string; trim: string; aura: string };
  sigil: string;

  state: AgentState;
  /** 타일 좌표 (소수 허용) */
  pos: Vec2;
  /** 남은 이동 경로 */
  path: Vec2[];
  homeRoom: RoomId;
  destinationRoom: RoomId | null;

  /** 0..100. 연출용이지만 업무량/실패에 연동된다. */
  mood: number;
  focus: number;

  binding: ProviderBinding;
  /** 오늘 사용 비용 (USD) */
  spendTodayUsd: number;
  /** 이번 달 사용 비용 (USD) */
  spendMonthUsd: number;

  currentMissionId: string | null;
  currentStepId: string | null;

  /** 면담에서 설정하는 항목들 */
  scope: string;
  reportStyle: ReportStyle;
  dataAccess: string[];
  interviewed: boolean;

  onLeave: boolean;
  lastIdleAt: number;
}

export type ReportStyle = 'concise' | 'detailed' | 'bullet';

/* ─────────────────────────── 인간 사원 명부 ──────────────────────────── */

/**
 * 인간 사원 캐릭터 외형 프리셋. AI 직원 3명과 겹치지 않는 별도 도형 세트다.
 * 사원 가입 화면에서 5개 중 하나를 고른다.
 */
export type EmployeeAppearanceId = 'scribe' | 'engineer' | 'sage' | 'guardian' | 'ranger';

export type HumanStaffStatus = 'pending' | 'approved' | 'rejected' | 'removed';

/** 오피스 안에서 오늘 어디 있는지. 실제 근태 상태를 그대로 반영한다. */
export type WorkMode = 'office' | 'remote' | 'not_started';

/**
 * 인간 사원 명부. AI 직원(Employee)과는 별개의 얕은 레코드다 —
 * 미션/상태 머신/API 바인딩을 갖지 않으며, 오피스 화면에는 장식용으로만 표시된다.
 *
 * ⚠️ 보안: 급여·복지는 회사 내부 관리용 화면 값일 뿐, 실제 지급·회계 시스템과
 * 연동되지 않는다. 이메일·전화번호도 실제로 검증/발송되지 않는다(백엔드 구현 항목).
 */
export interface HumanStaffRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** 가입 시 입력한 회사 코드. company.code 와 대조해 승인 대상 회사를 정한다. */
  companyCode: string;
  role: string;
  appearanceId: EmployeeAppearanceId;
  status: HumanStaffStatus;
  workMode: WorkMode;

  monthlySalaryUsd: number | null;
  benefits: string[];

  requestedAt: number;
  decidedAt: number | null;
  decidedBy: string | null;
}

/* ─────────────────────── 회사 창립 신청 (관리자 승인) ──────────────────── */

export type CompanyApplicationStatus = 'pending' | 'approved' | 'rejected';

/**
 * 대표는 회사를 바로 만들지 않고 먼저 이 신청서를 제출한다. 플랫폼 관리자가
 * 승인해야 실제 Company 가 만들어진다 — "회사 신청 승인"은 관리자 페이지의
 * 핵심 업무 중 하나다.
 *
 * ⚠️ 보안: accountId 는 데모에서 회사를 구분·조회하기 위한 식별자일 뿐 실제
 * 비밀번호가 아니다. 이 프로토타입은 어떤 비밀번호도 입력받거나 저장하지
 * 않는다 (docs/SECURITY.md). documentRef 도 실제 업로드가 아니라 파일
 * 메타데이터만 기록한다 — 실제 저장(Google Drive 등 연동)은 백엔드 구현 항목이다.
 */
export interface CompanyApplication {
  id: string;
  status: CompanyApplicationStatus;
  /** 승인되면 그대로 foundCompany 에 전달되는 창립 정보 */
  founding: Omit<Company, 'foundedAt' | 'code'>;
  /** 데모용 로그인 식별자. 실제 비밀번호는 절대 다루지 않는다. */
  accountId: string;
  documentRef: { fileName: string; sizeKb: number } | null;
  submittedAt: number;
  decidedAt: number | null;
  decidedBy: string | null;
  note: string | null;
}

/* ─────────────────────── 대표 ↔ 관리자 메시지 ─────────────────────────── */

/**
 * 회사 대표가 플랫폼 관리자에게 보내는 건의·문의와 그 답장.
 * threadKey 로 회사별 대화를 묶는다 — 회사가 아직 없으면(신청 단계) 신청서
 * id, 창립된 뒤에는 회사 코드를 쓴다.
 */
export interface PlatformMessage {
  id: string;
  threadKey: string;
  companyName: string;
  from: 'ceo' | 'admin';
  authorName: string;
  text: string;
  ts: number;
}

/* ─────────────────────────── 아카이브된 회사 ───────────────────────────── */

/**
 * 회사 삭제가 승인되면 데이터를 지우기 전에 요약을 여기로 옮겨 보관한다 —
 * "회사 생성 시 기존 데이터는 따로 저장" 요청에 따른 것이다. 새 회사를
 * 다시 만들어도 이전 기록은 관리자 페이지의 아카이브 목록에 남는다.
 */
export interface ArchivedCompany {
  id: string;
  company: Company;
  archivedAt: number;
  reason: string;
  employeeCount: number;
  humanStaffCount: number;
  missionCount: number;
  totalSpendUsd: number;
}

/* ──────────────────────────── 개인 기억 ─────────────────────────────── */

/**
 * 기억 스키마 버전.
 *
 * 핵심 설계: 기억은 **언어 모델과 독립적**이다.
 * 모델에게 주는 시스템 프롬프트는 기억에서 매번 새로 조립(compile)하며,
 * 반대로 프롬프트가 기억을 바꾸는 경로는 존재하지 않는다.
 * 따라서 제공자/모델을 갈아치워도 성품·원칙·합의·교훈은 그대로 남는다.
 *
 * 이 값이 바뀌면 구버전을 신버전으로 올려주는 변환기를 둔다.
 * 파일이나 상태를 파괴적으로 덮어쓰지 않는다.
 */
export const MEMORY_SCHEMA = 'guild-office.memory/v1';

/** 정체성 — 그 직원의 성품이자 정신세계의 뼈대. 드물게, 대표 승인으로만 바꾼다. */
export interface MemoryIdentity {
  employeeId: string;
  displayName: string;
  title: string;
  jobClass: JobClass;
  jobLabel: string;
  /** 성품 */
  coreTraits: string[];
  /** 절대 가치 — 모델이 바뀌어도 유지되어야 하는 판단 기준 */
  values: string[];
  /** 말투. 모델 전용 문법이 아니라 사람이 읽는 지시문으로 적는다. */
  voice: {
    register: string;
    length: string;
    prefers: string[];
    avoid: string[];
  };
  /** 하지 않는 일 */
  taboos: string[];
  /** 동료·대표와의 관계 정의 */
  relationships: Record<string, string>;
  revision: number;
}

export type MemoryKind = 'lesson' | 'episode' | 'preference' | 'correction';

/** 기억 한 줄. append-only 로 쌓고, 철회는 supersedes 로 표현한다. */
export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  at: number;
  title: string;
  body: string;
  /** 어디서 비롯된 기억인지 (mission:… / interview:… / founding) */
  source: string;
  confidence: 'high' | 'medium' | 'low';
  tags: string[];
  /** 이 기억이 대체하는 이전 기억 id */
  supersedes: string | null;
}

/** 대표와의 합의사항. 지워지지 않고 상태만 바뀐다. */
export interface MemoryAgreement {
  id: string;
  at: number;
  with: string;
  statement: string;
  status: 'active' | 'superseded' | 'revoked';
  source: string;
  supersedes: string | null;
}

/**
 * 어떤 모델로 운영했는지의 이력.
 * ⚠️ 키·토큰은 여기에 들어오지 않는다. 이름(provider/model)만 남긴다.
 */
export interface ModelBindingRecord {
  at: number;
  provider: ProviderId | null;
  model: string | null;
  note: string;
}

/** 구글 드라이브 상의 기억 폴더 연결 정보. 파일 ID만 담는다. */
export interface DriveMemoryLink {
  rootFolderId: string | null;
  folderId: string | null;
  folderTitle: string;
  folderUrl: string | null;
  files: {
    identity: string | null;
    principles: string | null;
    agreements: string | null;
    log: string | null;
    manifest: string | null;
  };
  lastSyncedAt: number | null;
}

export interface EmployeeMemory {
  schema: typeof MEMORY_SCHEMA;
  employeeId: string;
  identity: MemoryIdentity;
  /** 업무 원칙 정본 (마크다운). 사람이 읽고 고치는 문서다. */
  principles: string;
  agreements: MemoryAgreement[];
  records: MemoryRecord[];
  modelHistory: ModelBindingRecord[];
  drive: DriveMemoryLink;
  updatedAt: number;
}

/* ───────────────────────── 미션 / 퀘스트 ───────────────────────────── */

export type Difficulty = 'normal' | 'elite' | 'boss' | 'raid';

export type MissionStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'queued'
  | 'in_progress'
  | 'blocked'
  | 'reporting'
  | 'review'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type StepStatus = 'pending' | 'active' | 'done' | 'failed' | 'blocked';

export type MonsterKind =
  | 'sprite' // 간단한 질문
  | 'scroll' // 문서 작성
  | 'bug' // 코드 오류
  | 'golem' // 데이터 분석
  | 'envoy' // 고객 설득
  | 'shade' // 보안 문제
  | 'boss'; // 대규모 프로젝트

export interface Monster {
  kind: MonsterKind;
  name: string;
  /** 남은 작업량(%)에서 파생된다. 직접 쓰지 말 것. */
  hpPercent: number;
}

export interface Artifact {
  id: string;
  stepId: string;
  producedBy: string;
  /** 실제 산출물 종류 */
  kind: 'analysis' | 'document' | 'summary' | 'report';
  title: string;
  body: string;
  createdAt: number;
}

export interface MissionStep {
  id: string;
  title: string;
  /** 실제 업무 설명 */
  description: string;
  assigneeId: string;
  room: RoomId;
  /** 이 단계 수행 중 캐릭터가 취할 상태 */
  workState: Extract<
    AgentState,
    'fighting' | 'writing' | 'collaborating' | 'mailing' | 'thinking' | 'working'
  >;
  monster: Monster;
  status: StepStatus;
  /** 0..100 실제 진행률 */
  progress: number;
  estCostUsd: number;
  actualCostUsd: number;
  estSeconds: number;
  /** 완료 후 산출물을 넘겨줄 대상 */
  handoffTo: string | null;
  artifactId: string | null;
}

export interface Mission {
  id: string;
  name: string;
  objective: string;
  requester: string;
  ownerId: string;
  participants: string[];
  difficulty: Difficulty;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: MissionStatus;
  steps: MissionStep[];
  currentStepIndex: number;
  estCostUsd: number;
  actualCostUsd: number;
  estSeconds: number;
  requiresApproval: boolean;
  approvalId: string | null;
  loot: string[];
  failureReason: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  isTutorial: boolean;
}

/* ───────────────────────────── 승인 ─────────────────────────────────── */

export type ApprovalKind =
  | 'hire_ai'
  | 'paid_model'
  | 'raise_limit'
  | 'external_api'
  | 'large_project'
  | 'boss_raid'
  | 'external_email'
  | 'human_permission'
  | 'leave'
  | 'return'
  | 'budget_overrun_resume'
  /** 회사 삭제. 대표가 요청하지만, 반드시 플랫폼 관리자만 승인할 수 있다. */
  | 'company_deletion';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'conditional'
  | 'changes_requested'
  | 'rejected';

export interface Approval {
  id: string;
  kind: ApprovalKind;
  title: string;
  reason: string;
  requesterId: string;
  participants: string[];
  estCostUsd: number;
  estSeconds: number;
  risk: 'low' | 'medium' | 'high';
  model: string | null;
  tools: ToolId[];
  dataScope: string[];
  status: ApprovalStatus;
  note: string | null;
  missionId: string | null;
  createdAt: number;
  decidedAt: number | null;
}

/* ─────────────────────── 비용 원장 / 감사 로그 ──────────────────────── */

export interface LedgerEntry {
  id: string;
  ts: number;
  employeeId: string;
  missionId: string | null;
  stepId: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  note: string;
}

export interface AuditEntry {
  id: string;
  ts: number;
  actor: string;
  action: string;
  target: string;
  detail: string;
}

/* ───────────────────────────── 대화 ─────────────────────────────────── */

export type MessageKind =
  | 'chat'
  | 'task_order'
  | 'question'
  | 'report'
  | 'approval_request'
  | 'warning'
  | 'system';

export interface Message {
  id: string;
  employeeId: string;
  from: 'ceo' | 'agent' | 'system';
  kind: MessageKind;
  text: string;
  ts: number;
}

/* ─────────────────── 업무 지시 전 미리보기(견적) ───────────────────── */

export interface TaskEstimate {
  assigneeId: string;
  estSeconds: number;
  estCostUsd: number;
  tools: ToolId[];
  dataScope: string[];
  requiresApproval: boolean;
  approvalReasons: string[];
  /** 시작 자체가 불가능한 사유 (휴직, 미연결 등) */
  blockers: string[];
}

/* ─────────────────────────── 튜토리얼 단계 ─────────────────────────── */

export type Phase =
  | 'login'
  | 'founding'
  | 'office_build'
  | 'summon'
  | 'interview'
  | 'first_mission'
  | 'live';
