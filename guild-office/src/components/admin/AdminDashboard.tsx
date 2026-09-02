/**
 * 플랫폼 관리자 전용 페이지.
 *
 * 로그인 화면에는 관리자 버튼이 없다 — "mkang" 표기를 누르고 숨은 코드를 입력해야만
 * 들어올 수 있다. 이 화면은 회사 운영(OfficeScreen)과 완전히 분리되어 있으며,
 * company 가 없어도(회사가 삭제된 뒤에도) 정상적으로 동작한다.
 *
 * 여기서 하는 일: 회사 창립 신청 승인/거절, 회사 삭제 승인/거절, 아카이브 조회,
 * 대표 ↔ 관리자 메시지 대응, 감사 로그 열람, 플랫폼 제작자 표기 변경.
 */
import { useEffect, useMemo, useState } from 'react';
import { useWorld } from '@/state/store';
import { clock, money } from '@/lib/format';
import { Badge, Button, Notice, SectionTitle, TextArea, TextInput } from '@/components/ui/primitives';
import { PlatformMakerSetting } from '@/components/panels/SidePanels';
import AuditLog from '@/components/audit/AuditLog';
import EasterEggCredit from '@/components/auth/EasterEggCredit';
import { PLATFORM_MAKER } from '@/data/seed';
import type { Approval, CompanyApplication, PlatformMessage } from '@/types';

export default function AdminDashboard() {
  const logout = useWorld((s) => s.logout);
  const session = useWorld((s) => s.session);
  const makerName = useWorld((s) => s.platformMakerName) || PLATFORM_MAKER;
  const company = useWorld((s) => s.company);
  const applications = useWorld((s) => s.companyApplications);
  const approvals = useWorld((s) => s.approvals);
  const archived = useWorld((s) => s.archivedCompanies);
  const toast = useWorld((s) => s.ui.toast);
  const setToast = useWorld((s) => s.setToast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(id);
  }, [toast, setToast]);

  const pendingApplications = Object.values(applications)
    .filter((a) => a.status === 'pending')
    .sort((a, b) => a.submittedAt - b.submittedAt);
  const pendingDeletions = approvals.filter((a) => a.kind === 'company_deletion' && a.status === 'pending');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-stone-800 bg-stone-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[11px]">
          <h1 className="rune-title text-sm">관리자 모드</h1>
          <span className="text-stone-500">
            로그인: <span className="text-stone-300">{session?.accountName}</span>
          </span>
          {pendingApplications.length + pendingDeletions.length > 0 ? (
            <span title={`회사 창립 신청 ${pendingApplications.length}건 + 회사 삭제 요청 ${pendingDeletions.length}건`}>
              <Badge tone="gold">처리 대기 {pendingApplications.length + pendingDeletions.length}</Badge>
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-3">
            <EasterEggCredit makerName={makerName} />
            <Button size="sm" variant="quiet" onClick={logout}>
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] space-y-5 px-4 py-6">
        <Notice>
          관리자 페이지는 오피스 운영 화면과 완전히 분리되어 있습니다. 회사 창립 승인, 회사 삭제 승인, 대표
          문의 대응처럼 "절대적으로 확인이 필요한" 항목만 다룹니다.
        </Notice>

        <Section
          title={`회사 창립 신청 승인 (${pendingApplications.length}건 대기)`}
          hint="대표가 제출한 회사 창립 신청서입니다. 승인해야 실제 회사가 만들어지고, 거절하면 대표 화면에 사유가 표시됩니다."
        >
          {pendingApplications.length === 0 ? (
            <p className="text-xs text-stone-600">대기 중인 신청이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {pendingApplications.map((a) => (
                <ApplicationCard key={a.id} application={a} />
              ))}
            </div>
          )}
        </Section>

        <Section
          title={`회사 삭제 승인 (${pendingDeletions.length}건 대기)`}
          hint="대표가 요청한 회사 삭제 건입니다. 대표 본인은 승인할 수 없고, 반드시 여기서 관리자가 결정합니다. 승인하면 회사 데이터가 삭제되고 요약만 아카이브에 남습니다."
        >
          <p className="mb-2 text-[11px] text-stone-500">
            개별 회사를 삭제하는 일은 되돌릴 수 없는 큰 결정이라, 대표 본인이 아니라 반드시 여기서만
            승인할 수 있습니다.
          </p>
          {pendingDeletions.length === 0 ? (
            <p className="text-xs text-stone-600">대기 중인 삭제 요청이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {pendingDeletions.map((a) => (
                <DeletionCard key={a.id} approval={a} />
              ))}
            </div>
          )}
        </Section>

        <Section title="현재 운영 중인 회사" hint="이 브라우저에서 지금 승인되어 살아 있는 회사 정보입니다. 이 데모는 한 브라우저에 회사가 하나만 있을 수 있습니다.">
          {company ? (
            <div className="grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
              <Row k="회사명" v={company.name} />
              <Row k="대표" v={company.ceoName} />
              <Row k="가입 코드" v={company.code} />
              <Row k="사업자등록번호" v={company.businessRegNo} />
              <Row k="대표 연락처" v={`${company.ceoPhone} · ${company.ceoEmail}`} />
              <Row k="창립일" v={clock(company.foundedAt)} />
            </div>
          ) : (
            <p className="text-xs text-stone-600">현재 이 브라우저에서 운영 중인 회사가 없습니다.</p>
          )}
        </Section>

        <Section
          title={`아카이브된 회사 (${archived.length})`}
          hint="삭제 승인된 회사의 요약 기록입니다. 전체 데이터는 지워지고, 회사 정보와 통계 요약만 여기 남습니다."
        >
          {archived.length === 0 ? (
            <p className="text-xs text-stone-600">삭제된 회사가 없습니다.</p>
          ) : (
            <div className="space-y-1.5">
              {archived
                .slice()
                .reverse()
                .map((a) => (
                  <div key={a.id} className="rounded-lg border border-stone-800 px-3 py-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-200">{a.company.name}</span>
                      <span className="text-stone-600">{clock(a.archivedAt)}</span>
                    </div>
                    <div className="mt-0.5 text-stone-500">
                      대표 {a.company.ceoName} · AI 직원 {a.employeeCount}명 · 인간 사원 {a.humanStaffCount}명 · 미션{' '}
                      {a.missionCount}건 · 누적 비용 {money(a.totalSpendUsd, 'USD')}
                    </div>
                    <div className="mt-0.5 text-stone-600">사유: {a.reason}</div>
                  </div>
                ))}
            </div>
          )}
        </Section>

        <Section title="대표 ↔ 관리자 메시지" hint="회사별 대표가 보낸 건의·문의 메시지입니다. 왼쪽에서 회사를 고르고 답장하세요.">
          <MessagingInbox />
        </Section>

        <Section title="플랫폼 설정" hint="오피스 안에서 대표가 세우는 회사 이름과는 다릅니다 — 이 소프트웨어 자체를 만든 주체 표기입니다.">
          <PlatformMakerSetting />
        </Section>

        <Section title="감사 로그" hint="누가·무엇을·언제 했는지의 기록입니다. 이 프로토타입에서는 브라우저에만 저장됩니다.">
          <AuditLog />
        </Section>
      </div>

      {toast ? (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-gold/50 bg-stone-900 px-4 py-2 text-xs text-gold shadow-rune">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <SectionTitle className="mb-0">{title}</SectionTitle>
        {hint ? (
          <span
            title={hint}
            className="grid h-3.5 w-3.5 shrink-0 cursor-help place-items-center rounded-full border border-stone-600 text-[9px] leading-none text-stone-500"
          >
            i
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Row({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="flex justify-between gap-2" title={hint}>
      <span className={`shrink-0 text-stone-500 ${hint ? 'cursor-help underline decoration-dotted' : ''}`}>{k}</span>
      <span className="truncate text-right text-stone-300">{v}</span>
    </div>
  );
}

function ApplicationCard({ application }: { application: CompanyApplication }) {
  const decide = useWorld((s) => s.decideCompanyApplication);
  const [note, setNote] = useState('');
  const f = application.founding;

  return (
    <div className="rounded-lg border border-gold/40 bg-stone-950/40 p-3 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-100">{f.name}</span>
        <span className="text-stone-600">{clock(application.submittedAt)}</span>
      </div>
      <div className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-3">
        <Row k="대표" v={f.ceoName} />
        <Row k="가입 아이디" v={application.accountId} hint="실제 비밀번호가 아닙니다 — 데모에서 신청 내역을 다시 찾기 위한 식별자일 뿐입니다." />
        <Row k="대표 연락처" v={`${f.ceoPhone} · ${f.ceoEmail}`} />
        <Row k="사업자등록번호" v={f.businessRegNo} />
        <Row k="지사 / 통화" v={`${f.branch} / ${f.currency}`} />
        <Row k="월간 AI 예산" v={money(f.monthlyBudgetUsd, 'USD')} />
      </div>
      <div className="mt-1.5">
        <span className="text-stone-500">사업자 등록증 사본: </span>
        <span className="text-stone-300">
          {application.documentRef ? `${application.documentRef.fileName} (${application.documentRef.sizeKb}KB)` : '첨부 없음'}
        </span>
      </div>
      <div className="mt-2">
        <TextInput placeholder="메모 (선택, 승인/거절 사유)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button
          size="sm"
          title="실제 Company 를 생성하고, 대표가 다시 로그인하면 사무실 건설 단계부터 이어집니다."
          onClick={() => decide(application.id, 'approved', note || undefined)}
        >
          창립 승인
        </Button>
        <Button
          size="sm"
          variant="danger"
          title="회사가 만들어지지 않습니다. 대표 화면에 거절 사유(메모)가 표시됩니다."
          onClick={() => decide(application.id, 'rejected', note || undefined)}
        >
          거절
        </Button>
      </div>
    </div>
  );
}

function DeletionCard({ approval }: { approval: Approval }) {
  const decide = useWorld((s) => s.decideApproval);
  const [note, setNote] = useState('');

  return (
    <div className="rounded-lg border border-ember/40 bg-stone-950/40 p-3 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-100">{approval.title}</span>
        <span className="text-stone-600">{clock(approval.createdAt)}</span>
      </div>
      <p className="mt-1 text-stone-400">사유: {approval.reason}</p>
      <p className="mt-0.5 text-stone-500">요청자: {approval.requesterId}</p>
      <div className="mt-2">
        <TextInput placeholder="메모 (선택)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button
          size="sm"
          variant="danger"
          title="되돌릴 수 없습니다 — 회사 데이터를 지우고 요약만 아카이브에 남깁니다."
          onClick={() => decide(approval.id, 'approved', note || undefined)}
        >
          삭제 승인
        </Button>
        <Button size="sm" variant="ghost" title="회사는 그대로 유지됩니다." onClick={() => decide(approval.id, 'rejected', note || undefined)}>
          거절
        </Button>
      </div>
    </div>
  );
}

function MessagingInbox() {
  const messages = useWorld((s) => s.platformMessages);
  const send = useWorld((s) => s.sendPlatformMessage);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const threads = useMemo(() => {
    const map = new Map<string, { threadKey: string; companyName: string; messages: PlatformMessage[] }>();
    for (const m of messages) {
      if (!map.has(m.threadKey)) map.set(m.threadKey, { threadKey: m.threadKey, companyName: m.companyName, messages: [] });
      map.get(m.threadKey)!.messages.push(m);
    }
    return [...map.values()].sort(
      (a, b) => (b.messages.at(-1)?.ts ?? 0) - (a.messages.at(-1)?.ts ?? 0),
    );
  }, [messages]);

  if (threads.length === 0) {
    return <p className="text-xs text-stone-600">아직 대표가 보낸 메시지가 없습니다.</p>;
  }

  const active = threads.find((t) => t.threadKey === openThread) ?? threads[0];

  return (
    <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
      <div className="space-y-1">
        {threads.map((t) => (
          <button
            key={t.threadKey}
            type="button"
            onClick={() => setOpenThread(t.threadKey)}
            className={`block w-full rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition-colors ${
              active.threadKey === t.threadKey ? 'border-gold bg-stone-800/70' : 'border-stone-700 hover:border-stone-500'
            }`}
          >
            <div className="truncate text-stone-100">{t.companyName}</div>
            <div className="truncate text-stone-500">{t.messages.at(-1)?.text}</div>
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-stone-800 p-2.5">
        <div className="max-h-56 space-y-1.5 overflow-y-auto scroll-thin text-[11px]">
          {active.messages.map((m) => (
            <div key={m.id} className={`rounded-lg px-2.5 py-1.5 ${m.from === 'admin' ? 'bg-arcane/10' : 'bg-stone-800/60'}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className={m.from === 'admin' ? 'text-arcane-soft' : 'text-gold'}>
                  {m.from === 'admin' ? '관리자' : '대표'} · {m.authorName}
                </span>
                <span className="text-stone-600">{clock(m.ts)}</span>
              </div>
              <p className="mt-0.5 text-stone-200">{m.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <TextArea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="답장 입력…" />
        </div>
        <div className="mt-1.5 flex justify-end">
          <Button
            size="sm"
            disabled={!draft.trim()}
            onClick={() => {
              send({ threadKey: active.threadKey, companyName: active.companyName, text: draft });
              setDraft('');
            }}
          >
            답장 보내기
          </Button>
        </div>
      </div>
    </div>
  );
}
