/**
 * 앱 셸. 단계(phase)에 따라 튜토리얼 화면과 메인 오피스를 전환한다.
 */
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorld } from '@/state/store';
import { EASTER_EGG_TOTAL_MS } from '@/data/easterEgg';
import { PLATFORM_MAKER } from '@/data/seed';
import LoginScreen from '@/components/auth/LoginScreen';
import EasterEggCredit from '@/components/auth/EasterEggCredit';
import FoundingFlow from '@/components/onboarding/FoundingFlow';
import InterviewFlow from '@/components/onboarding/InterviewFlow';
import FirstMissionBriefing from '@/components/onboarding/FirstMissionBriefing';
import OfficeCanvas from '@/components/office/OfficeCanvas';
import EmployeePanel from '@/components/panels/EmployeePanel';
import MissionBoard from '@/components/missions/MissionBoard';
import RelationshipGraph from '@/components/graph/RelationshipGraph';
import ChatRoomsPanel from '@/components/chat/ChatRoomsPanel';
import StatusDashboard from '@/components/status/StatusDashboard';
import ApprovalCenter from '@/components/approvals/ApprovalCenter';
import CostDashboard from '@/components/cost/CostDashboard';
import AuditLog from '@/components/audit/AuditLog';
import { PeoplePanel, SettingsPanel } from '@/components/panels/SidePanels';
import AdminDashboard from '@/components/admin/AdminDashboard';
import WeatherWidget from '@/components/weather/WeatherWidget';
import { Badge, Button, Modal, Notice } from '@/components/ui/primitives';
import { AGENT_STATE_LABEL, money } from '@/lib/format';
import type { HumanStaffRecord } from '@/types';

/** 시뮬레이션 루프. requestAnimationFrame 으로 실제 경과 시간을 넘긴다. */
function useEngine(active: boolean) {
  const tick = useWorld((s) => s.tick);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    last.current = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(250, t - last.current); // 탭 전환 후 큰 점프 방지
      last.current = t;
      if (dt > 0) tick(dt);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [active, tick]);
}

export default function App() {
  const session = useWorld((s) => s.session);
  const phase = useWorld((s) => s.phase);
  const toast = useWorld((s) => s.ui.toast);
  const setToast = useWorld((s) => s.setToast);
  const humanStaff = useWorld((s) => s.humanStaff);

  // 오피스가 열린 뒤부터 시뮬레이션을 돌린다.
  useEngine(Boolean(session) && (phase === 'live' || phase === 'first_mission' || phase === 'interview'));

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast, setToast]);

  const staffRecord = session?.role === 'human_staff' && session.humanStaffId ? humanStaff[session.humanStaffId] : null;
  const pending = Boolean(staffRecord && staffRecord.status !== 'approved');

  // 관리자 모드는 오피스 운영 화면(phase 기반 라우팅)과 완전히 분리된 별도 페이지다 —
  // 회사가 없어도(삭제된 뒤에도) 정상적으로 열려야 하므로 phase 를 전혀 참조하지 않는다.
  if (session?.role === 'platform_admin') {
    return <AdminDashboard />;
  }

  let body: React.ReactNode;
  if (!session) body = <LoginScreen />;
  else if (pending) body = <StaffPendingScreen record={staffRecord!} />;
  else if (phase === 'founding' || phase === 'office_build' || phase === 'summon') body = <FoundingFlow />;
  else if (phase === 'interview') body = <InterviewFlow />;
  else if (phase === 'first_mission') body = <FirstMissionBriefing />;
  else body = <OfficeScreen />;

  return (
    <div className="min-h-screen">
      {session && !pending ? <AppHeader /> : null}
      {body}
      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-gold/50 bg-stone-900 px-4 py-2 text-xs text-gold shadow-rune"
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────── 사원 승인 대기 화면 ──────────────────────── */

function StaffPendingScreen({ record }: { record: HumanStaffRecord }) {
  const logout = useWorld((s) => s.logout);
  const company = useWorld((s) => s.company);

  const tone = record.status === 'rejected' || record.status === 'removed' ? 'warn' : 'info';
  const heading =
    record.status === 'pending'
      ? '처리중 · 대표 승인 대기'
      : record.status === 'rejected'
        ? '가입 신청이 거절되었습니다'
        : '회사에서 내보내졌습니다';
  const detail =
    record.status === 'pending'
      ? `${company?.name ?? '회사'}의 대표가 가입 신청을 검토하고 있습니다. 승인되면 자동으로 오피스에 입장합니다.`
      : record.status === 'rejected'
        ? '회사 대표에게 문의하시거나, 다른 이메일로 다시 신청해 주세요.'
        : '재입장은 대표만 처리할 수 있습니다. 회사 대표에게 문의하세요.';

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md panel p-6 text-center">
        <div className="mb-3 text-4xl">⏳</div>
        <h1 className="rune-title text-xl">{heading}</h1>
        <p className="mt-3 text-sm text-stone-300">
          {record.name} <span className="text-stone-500">· {record.email}</span>
        </p>
        <div className="mt-4">
          <Notice tone={tone}>{detail}</Notice>
        </div>
        <div className="mt-5">
          <Button variant="ghost" onClick={logout}>
            로그아웃
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────── 헤더 ────────────────────────────── */

function AppHeader() {
  const company = useWorld((s) => s.company);
  const session = useWorld((s) => s.session);
  const ledger = useWorld((s) => s.ledger);
  const approvals = useWorld((s) => s.approvals);
  const logout = useWorld((s) => s.logout);
  const makerName = useWorld((s) => s.platformMakerName) || PLATFORM_MAKER;
  const simulationMode = useWorld((s) => s.simulationMode);

  const spent = ledger.reduce((s, e) => s + e.costUsd, 0);
  const pending = approvals.filter((a) => a.status === 'pending').length;

  return (
    <header className="sticky top-0 z-30 border-b border-stone-800 bg-stone-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
        <h1 className="rune-title text-sm">
          {company ? `${company.name} 글로벌 워크스페이스 · 대표: ${company.ceoName} CEO` : '길드 오피스'}
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px]">
          {company ? (
            <>
              <span className="text-stone-500">
                {company.branch} · {company.currency}
              </span>
              <span className="text-stone-400">
                이번 달 사용 <span className="text-gold">{money(spent, company.currency)}</span> /{' '}
                {money(company.monthlyBudgetUsd, company.currency)}
              </span>
            </>
          ) : null}
          {simulationMode ? (
            <span title="관리자 승인 절차 없이 숨은 코드로 즉시 만든 테스트용 회사입니다. 실제 서비스 데이터가 아닙니다.">
              <Badge tone="arcane">🧪 시뮬레이션 모드</Badge>
            </span>
          ) : null}
          {pending > 0 ? <Badge tone="gold">승인 대기 {pending}</Badge> : null}
          <WeatherWidget />
          <span className="text-stone-500">
            로그인: <span className="text-stone-300">{session?.accountName}</span>
            <span className="ml-1 text-stone-600">
              ({session?.role === 'ceo' ? '대표' : session?.role === 'platform_admin' ? '플랫폼 관리자' : '인간 직원'})
            </span>
          </span>
          <EasterEggCredit makerName={makerName} />
          <Button size="sm" variant="quiet" onClick={logout}>
            로그아웃
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ──────────────────────────── 메인 오피스 ──────────────────────────── */

/** [패널 id, 버튼 라벨, 마우스를 올리면 뜨는 설명] */
const PANELS = [
  ['missions', '미션 · 퀘스트', 'AI 직원에게 지시한 업무의 목록과 진행 단계. 여기서 결과를 승인하거나 중단할 수 있습니다.'],
  ['dungeon', '프로젝트 던전', '지금 진행 중인 업무를 전투 연출로 봅니다. 몬스터 체력 = 남은 작업량입니다.'],
  ['rooms', '채팅방', '부서별 단체 채팅방과 전사 공용 채팅방. 초대는 대표가 바로 하거나 사원이 제안한 뒤 대표가 승인합니다.'],
  ['status', '근태 · 현황판', '누가 지금 무엇을 하는지 한눈에. AI 직원은 실제 상태에서, 인간 사원은 본인이 남긴 한 줄에서 가져옵니다.'],
  ['approvals', '대표 승인 센터', '비용이 들거나 위험한 작업은 여기서 대표가 승인해야 시작됩니다.'],
  ['cost', '비용 · API 사용량', '회사 월간 예산, 직원별 사용량, 월별 집계와 CSV 내보내기.'],
  ['people', '조직 · 지사', '인간 사원 명부(승인·급여·복지·근태)와 지사 목록. 사원 가입 코드도 여기 있습니다.'],
  ['graph', '관계도', '대표 · AI 직원 · 인간 사원 · 미션의 연결을 그래프로 봅니다(옵시디언 그래프 뷰와 비슷한 개념).'],
  ['audit', '감사 로그', '누가 · 무엇을 · 언제 했는지의 기록.'],
  ['settings', '설정 · 보안', '회사 정보, 구글 드라이브 연결, 관리자 문의, 회사 삭제 요청.'],
] as const;

function mmss(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * "탱크형 변형 휠" 이스터에그가 진행 중일 때만 보이는 배너.
 * 실제 업무·비용과 완전히 무관한 가상 시나리오라는 사실을 항상 함께 밝힌다.
 */
function EasterEggBanner() {
  const egg = useWorld((s) => s.easterEgg);
  const stop = useWorld((s) => s.stopEasterEgg);
  if (!egg.active || egg.startedAt === null) return null;

  const elapsed = Date.now() - egg.startedAt;
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-gold/40 bg-gold/5 px-3 py-2 text-xs text-gold">
      <span>
        🥚 이스터에그 진행 중 · 「탱크형 변형 휠」 프로젝트 데모 · {mmss(elapsed)} / {mmss(EASTER_EGG_TOTAL_MS)}
        <span className="ml-2 text-stone-400">실제 업무·비용은 발생하지 않는 가상 시나리오입니다.</span>
      </span>
      <Button size="sm" variant="quiet" onClick={stop}>
        종료
      </Button>
    </div>
  );
}

/**
 * 회사에 구글 드라이브가 연결되어 있지 않을 때, 인간 사원에게만 보이는 안내.
 * 대표만 연결할 수 있으므로 사원에게는 "대표에게 요청하라"고 안내한다.
 */
function DriveConnectionNotice() {
  const session = useWorld((s) => s.session);
  const company = useWorld((s) => s.company);
  if (session?.role !== 'human_staff' || company?.driveFolderUrl) return null;

  return (
    <div className="mb-3 rounded-lg border border-arcane/40 bg-arcane/5 px-3 py-2 text-xs text-arcane-soft">
      파일 등을 채팅이나 자료 공유 시에 드라이브에 연결해야 합니다. 대표님께 부탁하세요.
    </div>
  );
}

function OfficeScreen() {
  const order = useWorld((s) => s.employeeOrder);
  const employees = useWorld((s) => s.employees);
  const selectedId = useWorld((s) => s.ui.selectedEmployeeId);
  const openPanel = useWorld((s) => s.ui.openPanel);
  const setPanel = useWorld((s) => s.openPanel);
  const select = useWorld((s) => s.selectEmployee);
  const approvals = useWorld((s) => s.approvals);
  const missions = useWorld((s) => s.missions);
  const missionOrder = useWorld((s) => s.missionOrder);

  const pending = approvals.filter((a) => a.status === 'pending').length;
  const reviewing = missionOrder.filter((id) => missions[id]?.status === 'review').length;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-4">
      <EasterEggBanner />
      <DriveConnectionNotice />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PANELS.map(([id, label, hint]) => (
          <Button
            key={id}
            size="sm"
            variant={openPanel === id ? 'primary' : 'ghost'}
            hint={hint}
            hintPlacement="bottom"
            onClick={() => setPanel(id)}
          >
            {label}
            {id === 'approvals' && pending > 0 ? ` (${pending})` : ''}
            {id === 'missions' && reviewing > 0 ? ` · 검토 ${reviewing}` : ''}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <OfficeCanvas />
          <div className="grid gap-2 sm:grid-cols-3">
            {order.map((id) => {
              const e = employees[id];
              if (!e) return null;
              const label = AGENT_STATE_LABEL[e.state];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => select(id)}
                  className={`rounded-lg border px-3 py-2 text-left text-[11px] transition-colors ${
                    selectedId === id ? 'border-gold bg-stone-800/60' : 'border-stone-700 hover:border-stone-500'
                  }`}
                >
                  <span className="block text-sm text-stone-100">
                    {e.name} <span className="text-[11px] text-stone-500">· {e.title}</span>
                  </span>
                  <span className="mt-0.5 block text-stone-400">
                    {label.game} <span className="text-stone-600">· {label.real}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:sticky lg:top-16 lg:h-[calc(100vh-5rem)]">
          {selectedId ? (
            <EmployeePanel employeeId={selectedId} />
          ) : (
            <div className="panel grid h-full place-items-center p-8 text-center text-xs text-stone-500">
              오피스에서 AI 직원을 클릭하면
              <br />
              1:1 대화와 업무 지시 패널이 열립니다.
            </div>
          )}
        </div>
      </div>

      {openPanel ? (
        <Modal
          wide
          title={PANELS.find(([id]) => id === openPanel)?.[1] ?? ''}
          onClose={() => setPanel(null)}
        >
          {openPanel === 'missions' ? <MissionBoard mode="list" /> : null}
          {openPanel === 'dungeon' ? <MissionBoard mode="dungeon" /> : null}
          {openPanel === 'rooms' ? <ChatRoomsPanel /> : null}
          {openPanel === 'status' ? <StatusDashboard /> : null}
          {openPanel === 'approvals' ? <ApprovalCenter /> : null}
          {openPanel === 'cost' ? <CostDashboard /> : null}
          {openPanel === 'people' ? <PeoplePanel /> : null}
          {openPanel === 'graph' ? <RelationshipGraph /> : null}
          {openPanel === 'audit' ? <AuditLog /> : null}
          {openPanel === 'settings' ? <SettingsPanel /> : null}
        </Modal>
      ) : null}
    </div>
  );
}
