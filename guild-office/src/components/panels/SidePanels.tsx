/**
 * 조직 관리(인간 직원 초대 / AI 직원 추가 요청 / 지사·서버 선택)와 설정·보안 화면.
 * 2단계 이후 기능은 UI만 준비하고, 실제 동작은 백엔드 도입 시 연결한다.
 */
import { useState } from 'react';
import { useWorld } from '@/state/store';
import { money } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { EMPLOYEE_APPEARANCES, PLATFORM_MAKER } from '@/data/seed';
import { Badge, Button, Field, Notice, SectionTitle, Select, TextInput } from '@/components/ui/primitives';
import type { HumanStaffRecord, WorkMode } from '@/types';

const WORK_MODE_LABEL: Record<WorkMode, string> = { office: '출근', remote: '재택', not_started: '미출근' };

/** 데모용 지급일 관례 — 매월 25일. 실제 지급일 설정은 백엔드 항목으로 분리한다. */
const PAYDAY_DOM = 25;

const BRANCHES = [
  { id: 'kr', label: '한국 본사', region: 'ap-northeast-2 (서울)', status: '운영 중' },
  { id: 'jp', label: '일본 지사', region: 'ap-northeast-1 (도쿄)', status: '3단계에서 개설' },
  { id: 'us', label: '미국 지사', region: 'us-west-2 (오레곤)', status: '3단계에서 개설' },
  { id: 'eu', label: '유럽 지사', region: 'eu-central-1 (프랑크푸르트)', status: '3단계에서 개설' },
];

export function PeoplePanel() {
  const company = useWorld((s) => s.company);
  const employees = useWorld((s) => s.employees);
  const order = useWorld((s) => s.employeeOrder);
  const setToast = useWorld((s) => s.setToast);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [invites, setInvites] = useState<Array<{ email: string; role: string }>>([]);
  if (!company) return null;

  return (
    <div className="space-y-4">
      {/* AI 직원 */}
      <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
        <SectionTitle>AI 직원 ({order.length}명)</SectionTitle>
        <div className="space-y-1.5">
          {order.map((id) => {
            const e = employees[id];
            if (!e) return null;
            return (
              <div key={id} className="flex items-center justify-between rounded-lg border border-stone-800 px-3 py-2 text-[11px]">
                <span className="min-w-0">
                  <span className="block text-stone-100">
                    {e.name} <span className="text-stone-500">· {e.title}</span>
                  </span>
                  <span className="text-stone-500">{e.scope}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {e.onLeave ? <Badge>휴직</Badge> : <Badge tone="vital">근무</Badge>}
                  <Badge tone={e.binding.status === 'connected' ? 'gold' : 'ember'}>
                    {e.binding.status === 'connected' ? e.binding.model : '미연결'}
                  </Badge>
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setToast('AI 직원 추가는 대표 승인 사항입니다. 2단계에서 활성화됩니다.')}
          >
            AI 직원 추가 요청 (승인 필요)
          </Button>
        </div>
      </div>

      {/* 인간 사원 (자체 가입 · 회사 코드) */}
      <HumanStaffSection />

      {/* 인간 직원 초대 (이메일 초대, 향후 백엔드 연결 예정 — 자체 가입과는 별도 흐름) */}
      <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
        <SectionTitle>인간 직원 초대 (이메일, 준비 중)</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="초대할 이메일">
              <TextInput
                type="email"
                value={inviteEmail}
                placeholder="teammate@example.com"
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </Field>
          </div>
          <Field label="권한">
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="viewer">열람만</option>
              <option value="operator">업무 지시 가능</option>
              <option value="reviewer">문서 검토 가능</option>
            </Select>
          </Field>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">권한 변경은 대표 승인 사항입니다</span>
          <Button
            size="sm"
            disabled={!inviteEmail.includes('@')}
            onClick={() => {
              setInvites((v) => [...v, { email: inviteEmail, role: inviteRole }]);
              setInviteEmail('');
              setToast('초대 대기 목록에 추가했습니다. 실제 발송은 백엔드 연결 후 동작합니다.');
            }}
          >
            초대 (대기)
          </Button>
        </div>
        {invites.length > 0 ? (
          <ul className="mt-3 space-y-1 text-[11px] text-stone-400">
            {invites.map((i) => (
              <li key={i.email} className="flex justify-between border-b border-stone-800 py-1">
                <span>{i.email}</span>
                <span className="text-stone-600">{i.role} · 발송 대기</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* 지사 / 서버 */}
      <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
        <SectionTitle>지사 및 서버</SectionTitle>
        <div className="space-y-1.5 text-[11px]">
          {BRANCHES.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-stone-800 px-3 py-2">
              <span>
                <span className="block text-stone-100">{b.label}</span>
                <span className="text-stone-500">{b.region}</span>
              </span>
              <Badge tone={b.label === company.branch ? 'gold' : 'neutral'}>
                {b.label === company.branch ? '현재 지사' : b.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 사원이 회사 코드를 입력해 직접 신청하면 대표가 승인/거절하는 명부.
 * 위의 "인간 직원 초대"(이메일 발송, 준비 중)와는 별도의 흐름이다.
 */
function HumanStaffSection() {
  const company = useWorld((s) => s.company);
  const humanStaff = useWorld((s) => s.humanStaff);
  const session = useWorld((s) => s.session);
  const decide = useWorld((s) => s.decideHumanStaffApplication);
  const remove = useWorld((s) => s.removeHumanStaff);
  const reinstate = useWorld((s) => s.reinstateHumanStaff);
  const update = useWorld((s) => s.updateHumanStaff);
  if (!company) return null;
  const isCeo = session?.role === 'ceo';

  const records = Object.values(humanStaff).sort((a, b) => b.requestedAt - a.requestedAt);
  const pending = records.filter((r) => r.status === 'pending');
  const roster = records.filter((r) => r.status === 'approved' || r.status === 'removed');
  const payroll = roster.filter((r) => r.status === 'approved' && r.monthlySalaryUsd);

  const today = new Date();
  const daysUntilPayday = PAYDAY_DOM - today.getDate();
  const paydaySoon = isCeo && payroll.length > 0 && daysUntilPayday >= 0 && daysUntilPayday <= 3;

  const exportPayrollCsv = () => {
    downloadCsv(`payroll-${company.name}.csv`, [
      ['이름', '이메일', '직무', '근무형태', '월급(USD)', '복지'],
      ...payroll.map((r) => [r.name, r.email, r.role, WORK_MODE_LABEL[r.workMode], (r.monthlySalaryUsd ?? 0).toFixed(2), r.benefits.join('; ')]),
    ]);
  };

  return (
    <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
      <SectionTitle>인간 사원 명부 ({roster.filter((r) => r.status === 'approved').length}명)</SectionTitle>
      <p className="mb-2 text-[11px] text-stone-500">
        회사 코드 <span className="text-gold">{company.code}</span> 를 공유하면 사원이 직접 가입 신청을 합니다.
      </p>

      {paydaySoon ? (
        <div className="mb-3">
          <Notice tone="warn">
            매월 {PAYDAY_DOM}일은 급여 지급일입니다 ({daysUntilPayday === 0 ? '오늘' : `${daysUntilPayday}일 후`}). 급여가
            등록된 사원 {payroll.length}명, 합계{' '}
            {money(payroll.reduce((s, r) => s + (r.monthlySalaryUsd ?? 0), 0), company.currency)}.
          </Notice>
        </div>
      ) : null}

      {isCeo && payroll.length > 0 ? (
        <div className="mb-3">
          <Button size="sm" variant="ghost" onClick={exportPayrollCsv}>
            급여·복지 CSV 내보내기
          </Button>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="mb-3 space-y-1.5">
          <div className="text-[11px] font-semibold text-stone-400">승인 대기 ({pending.length})</div>
          {pending.map((r) => (
            <div key={r.id} className="rounded-lg border border-gold/30 bg-stone-950/40 px-3 py-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-stone-100">
                  {r.name} <span className="text-stone-500">· {r.email}</span>
                </span>
                <Badge tone="gold">처리중</Badge>
              </div>
              <div className="mt-0.5 text-stone-500">
                {r.role} · {EMPLOYEE_APPEARANCES[r.appearanceId].label}
                {r.phone ? ` · ${r.phone}` : ''}
              </div>
              {isCeo ? (
                <div className="mt-2 flex gap-1.5">
                  <Button size="sm" onClick={() => decide(r.id, 'approved')}>
                    승인
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => decide(r.id, 'rejected')}>
                    거절
                  </Button>
                </div>
              ) : (
                <div className="mt-1 text-stone-600">대표만 승인·거절할 수 있습니다.</div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {roster.length > 0 ? (
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-stone-400">명부</div>
          {roster.map((r) => (
            <RosterRow key={r.id} record={r} isCeo={isCeo} remove={remove} reinstate={reinstate} update={update} />
          ))}
        </div>
      ) : null}

      {records.length === 0 ? <p className="text-[11px] text-stone-600">아직 가입 신청이 없습니다.</p> : null}
    </div>
  );
}

function RosterRow({
  record,
  isCeo,
  remove,
  reinstate,
  update,
}: {
  record: HumanStaffRecord;
  isCeo: boolean;
  remove: (id: string) => void;
  reinstate: (id: string) => void;
  update: (id: string, patch: Partial<Pick<HumanStaffRecord, 'role' | 'monthlySalaryUsd' | 'benefits' | 'workMode'>>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [salary, setSalary] = useState(record.monthlySalaryUsd?.toString() ?? '');
  const [benefits, setBenefits] = useState(record.benefits.join(', '));

  return (
    <div className="rounded-lg border border-stone-800 px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="text-stone-100">
          {record.name} <span className="text-stone-500">· {record.email}</span>
        </span>
        <Badge tone={record.status === 'approved' ? 'vital' : 'ember'}>
          {record.status === 'approved' ? WORK_MODE_LABEL[record.workMode] : '내보냄'}
        </Badge>
      </div>
      <div className="mt-0.5 text-stone-500">
        {record.role}
        {record.monthlySalaryUsd ? ` · 월급 ${money(record.monthlySalaryUsd, 'USD')}` : ''}
        {record.benefits.length > 0 ? ` · 복지 ${record.benefits.join(', ')}` : ''}
      </div>

      {isCeo ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {record.status === 'approved' ? (
            <>
              <Select
                value={record.workMode}
                onChange={(e) => update(record.id, { workMode: e.target.value as WorkMode })}
              >
                <option value="office">출근</option>
                <option value="remote">재택</option>
                <option value="not_started">미출근</option>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
                급여·복지 편집
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  if (confirm(`${record.name} 님을 내보낼까요? 언제든 재입장 허가할 수 있습니다.`)) remove(record.id);
                }}
              >
                내보내기
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => reinstate(record.id)}>
              재입장 허가
            </Button>
          )}
        </div>
      ) : null}

      {editing ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Field label="월급 (USD)">
            <TextInput type="number" min={0} value={salary} onChange={(e) => setSalary(e.target.value)} />
          </Field>
          <Field label="복지 (쉼표로 구분)">
            <TextInput value={benefits} onChange={(e) => setBenefits(e.target.value)} placeholder="4대보험, 재택수당" />
          </Field>
          <div className="sm:col-span-2">
            <Button
              size="sm"
              onClick={() => {
                update(record.id, {
                  monthlySalaryUsd: salary.trim() ? Math.max(0, Number(salary) || 0) : null,
                  benefits: benefits
                    .split(',')
                    .map((b) => b.trim())
                    .filter(Boolean),
                });
                setEditing(false);
              }}
            >
              저장
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SettingsPanel() {
  const company = useWorld((s) => s.company);
  const session = useWorld((s) => s.session);
  const resetAll = useWorld((s) => s.resetAll);
  const logout = useWorld((s) => s.logout);
  if (!company) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4 text-[11px]">
        <SectionTitle>현재 세션</SectionTitle>
        <Row k="로그인 계정" v={`${session?.accountName} (${session?.role})`} />
        <Row k="회사" v={company.name} />
        <Row k="회사 대표" v={`${company.ceoName} CEO`} />
        <Row k="사원 가입 코드" v={company.code} />
        <Row k="기본 지사 / 통화" v={`${company.branch} / ${company.currency}`} />
        <Row k="월간 AI 예산" v={money(company.monthlyBudgetUsd, company.currency)} />
      </div>

      {session?.role === 'ceo' ? <CompanyDeletionRequest /> : null}
      {session?.role === 'platform_admin' ? <PlatformMakerSetting /> : null}

      <div className="rounded-xl border border-ember/40 bg-ember/5 p-4">
        <SectionTitle>보안 — 이 프로토타입의 한계</SectionTitle>
        <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-stone-300">
          <li>실제 인증이 없습니다. 데모 로그인은 누구나 어떤 역할로도 진입할 수 있습니다.</li>
          <li>상태가 브라우저 localStorage 에 저장됩니다. 공용 PC에서는 사용을 피하세요.</li>
          <li>
            API 키는 <strong>어떤 형태로도 저장하지 않습니다.</strong> 연결 정보에는 서버 참조 ID와 마스킹
            문자열만 있습니다.
          </li>
          <li>비용 차단은 클라이언트에서만 이루어집니다. 실제 서비스에서는 서버가 최종 게이트여야 합니다.</li>
          <li>감사 로그를 클라이언트가 보관하므로 위·변조가 가능합니다.</li>
        </ul>
        <p className="mt-2 text-[11px] text-stone-500">
          해결 방법은 <code className="text-gold">docs/SECURITY.md</code> 와{' '}
          <code className="text-gold">docs/BACKEND-MIGRATION.md</code> 에 정리되어 있습니다.
        </p>
      </div>

      <Notice>
        데이터 초기화는 되돌릴 수 없습니다. 회사·직원·미션·비용 기록이 모두 삭제됩니다.
      </Notice>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={logout}>
          로그아웃
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (confirm('모든 데이터를 삭제할까요? 되돌릴 수 없습니다.')) resetAll();
          }}
        >
          전체 초기화
        </Button>
      </div>
    </div>
  );
}

/**
 * 플랫폼 제작자 표기 수정 — 플랫폼 관리자에게만 보인다.
 * 오피스 안에서 대표가 세우는 게임 속 "회사"(예: 크림바스켓)와는 다른 개념이다.
 * 이건 이 소프트웨어 자체를 만든 바깥의 실제 주체 표기이며, 로그인 화면과
 * 이스터에그 진입점에 함께 쓰인다.
 */
function PlatformMakerSetting() {
  const current = useWorld((s) => s.platformMakerName) || PLATFORM_MAKER;
  const companyName = useWorld((s) => s.company?.name);
  const setName = useWorld((s) => s.setPlatformMakerName);
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-arcane/40 bg-arcane/5 p-4">
      <SectionTitle>플랫폼 제작자 표기</SectionTitle>
      <p className="mb-2 text-[11px] leading-relaxed text-stone-400">
        이 소프트웨어(플랫폼) 자체를 만든 주체 표기입니다 — 오피스 안에서 대표가 세우는 회사({companyName ?? '예: 크림바스켓'})와는
        다릅니다. 로그인 화면 하단과 숨은 이스터에그 진입점에 그대로 쓰입니다.
      </p>
      <div className="flex gap-2">
        <TextInput
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder={PLATFORM_MAKER}
        />
        <Button
          size="sm"
          onClick={() => {
            const r = setName(value);
            if (!r.ok) setError(r.error ?? '변경할 수 없습니다.');
          }}
        >
          저장
        </Button>
      </div>
      {error ? <p className="mt-1 text-[11px] text-ember">{error}</p> : null}
      <p className="mt-1 text-[11px] text-stone-500">현재: {current}</p>
    </div>
  );
}

/**
 * 회사 삭제 요청 — 대표만 요청할 수 있고, 실제 삭제는 플랫폼 관리자 승인이 필요하다.
 * "개인 회사를 삭제하는 것은 큰일"이므로 대표 단독으로 즉시 삭제되지 않는다.
 */
function CompanyDeletionRequest() {
  const company = useWorld((s) => s.company);
  const approvals = useWorld((s) => s.approvals);
  const requestDeletion = useWorld((s) => s.requestCompanyDeletion);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!company) return null;

  const pendingRequest = approvals.find((a) => a.kind === 'company_deletion' && a.status === 'pending');

  return (
    <div className="rounded-xl border border-ember/40 bg-ember/5 p-4">
      <SectionTitle>회사 삭제 요청</SectionTitle>
      <p className="mb-2 text-[11px] leading-relaxed text-stone-400">
        회사를 삭제하려면 먼저 요청을 보내야 합니다. 개인 회사 삭제는 되돌릴 수 없는 큰 일이므로 대표 단독으로
        즉시 처리되지 않고, <strong className="text-ember-soft">플랫폼 관리자 승인</strong> 후 실제 삭제가
        이루어집니다.
      </p>

      {pendingRequest ? (
        <Notice tone="warn">
          삭제 요청이 이미 접수되어 플랫폼 관리자 승인을 기다리고 있습니다. (승인 센터에서 확인 가능)
        </Notice>
      ) : (
        <>
          <Field label="삭제 사유 (선택)">
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 사업 종료" />
          </Field>
          {error ? <p className="mt-1 text-[11px] text-ember">{error}</p> : null}
          <div className="mt-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (!confirm(`"${company.name}" 회사 삭제를 정말 요청할까요? 승인되면 모든 데이터가 삭제됩니다.`)) return;
                const r = requestDeletion(reason);
                if (!r.ok) setError(r.error ?? '요청할 수 없습니다.');
                else setError(null);
              }}
            >
              회사 삭제 요청
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-stone-800 py-1 last:border-0">
      <span className="shrink-0 text-stone-500">{k}</span>
      <span className="truncate text-right text-stone-200">{v}</span>
    </div>
  );
}
