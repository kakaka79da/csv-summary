/**
 * 앱 셸. 단계(phase)에 따라 튜토리얼 화면과 메인 오피스를 전환한다.
 */
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorld } from '@/state/store';
import { EASTER_EGG_TOTAL_MS } from '@/data/easterEgg';
import LoginScreen from '@/components/auth/LoginScreen';
import FoundingFlow from '@/components/onboarding/FoundingFlow';
import InterviewFlow from '@/components/onboarding/InterviewFlow';
import FirstMissionBriefing from '@/components/onboarding/FirstMissionBriefing';
import OfficeCanvas from '@/components/office/OfficeCanvas';
import EmployeePanel from '@/components/panels/EmployeePanel';
import MissionBoard from '@/components/missions/MissionBoard';
import ApprovalCenter from '@/components/approvals/ApprovalCenter';
import CostDashboard from '@/components/cost/CostDashboard';
import AuditLog from '@/components/audit/AuditLog';
import { PeoplePanel, SettingsPanel } from '@/components/panels/SidePanels';
import { Badge, Button, Modal } from '@/components/ui/primitives';
import { AGENT_STATE_LABEL, money } from '@/lib/format';

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

  // 오피스가 열린 뒤부터 시뮬레이션을 돌린다.
  useEngine(Boolean(session) && (phase === 'live' || phase === 'first_mission' || phase === 'interview'));

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast, setToast]);

  let body: React.ReactNode;
  if (!session) body = <LoginScreen />;
  else if (phase === 'founding' || phase === 'office_build' || phase === 'summon') body = <FoundingFlow />;
  else if (phase === 'interview') body = <InterviewFlow />;
  else if (phase === 'first_mission') body = <FirstMissionBriefing />;
  else body = <OfficeScreen />;

  return (
    <div className="min-h-screen">
      {session ? <AppHeader /> : null}
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

/* ────────────────────────────── 헤더 ────────────────────────────── */

function AppHeader() {
  const company = useWorld((s) => s.company);
  const session = useWorld((s) => s.session);
  const ledger = useWorld((s) => s.ledger);
  const approvals = useWorld((s) => s.approvals);
  const logout = useWorld((s) => s.logout);

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
          {pending > 0 ? <Badge tone="gold">승인 대기 {pending}</Badge> : null}
          <span className="text-stone-500">
            로그인: <span className="text-stone-300">{session?.accountName}</span>
            <span className="ml-1 text-stone-600">
              ({session?.role === 'ceo' ? '대표' : session?.role === 'platform_admin' ? '플랫폼 관리자' : '인간 직원'})
            </span>
          </span>
          <Button size="sm" variant="quiet" onClick={logout}>
            로그아웃
          </Button>
        </div>
      </div>
    </header>
  );
}

/* ──────────────────────────── 메인 오피스 ──────────────────────────── */

const PANELS = [
  ['missions', '미션 · 퀘스트'],
  ['dungeon', '프로젝트 던전'],
  ['approvals', '대표 승인 센터'],
  ['cost', '비용 · API 사용량'],
  ['people', '조직 · 지사'],
  ['audit', '감사 로그'],
  ['settings', '설정 · 보안'],
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
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PANELS.map(([id, label]) => (
          <Button key={id} size="sm" variant={openPanel === id ? 'primary' : 'ghost'} onClick={() => setPanel(id)}>
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
          {openPanel === 'approvals' ? <ApprovalCenter /> : null}
          {openPanel === 'cost' ? <CostDashboard /> : null}
          {openPanel === 'people' ? <PeoplePanel /> : null}
          {openPanel === 'audit' ? <AuditLog /> : null}
          {openPanel === 'settings' ? <SettingsPanel /> : null}
        </Modal>
      ) : null}
    </div>
  );
}
