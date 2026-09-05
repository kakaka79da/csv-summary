/**
 * 조직 관리(인간 직원 초대 / AI 직원 추가 요청 / 지사·서버 선택)와 설정·보안 화면.
 * 2단계 이후 기능은 UI만 준비하고, 실제 동작은 백엔드 도입 시 연결한다.
 */
import { useRef, useState } from 'react';
import { useWorld } from '@/state/store';
import { clock, money } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import {
  DOMESTIC_BRANCH_PRESETS,
  EMPLOYEE_APPEARANCES,
  EMPLOYEE_APPEARANCE_IDS,
  OVERSEAS_BRANCH_PRESETS,
  PLATFORM_MAKER,
} from '@/data/seed';
import { Badge, Button, CopyButton, Field, MailLink, Notice, SectionTitle, Select, TextArea, TextInput } from '@/components/ui/primitives';
import { MIN_PASSWORD_LENGTH, checkPassword } from '@/lib/password';
import { DISPLAY_FX } from '@/lib/format';
import type { BranchStatus, Company, EmployeeAppearanceId, HumanStaffRecord, WorkMode } from '@/types';

const BRANCH_STATUS_LABEL: Record<BranchStatus, string> = {
  operating: '운영 중',
  preparing: '준비 중',
  closed: '폐쇄',
};

const WORK_MODE_LABEL: Record<WorkMode, string> = {
  office: '출근',
  remote: '재택',
  not_started: '미출근',
  leave: '휴가·연차',
};

/** 데모용 지급일 관례 — 매월 25일. 실제 지급일 설정은 백엔드 항목으로 분리한다. */
const PAYDAY_DOM = 25;

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
      <BranchSection />
    </div>
  );
}

/**
 * 지사 관리 — 국내(같은 나라 다른 지역)와 해외 모두 세울 수 있다.
 *
 * 지사마다 서버 리전을 함께 정하는데, 나라마다 개인정보 국외 이전 규제가 다르기
 * 때문이다. ⚠️ 이 프로토타입은 실제로 리전을 나눠 저장하지는 않는다 — 표시용 값이며,
 * 실제 분리 저장은 백엔드 항목이다(docs/BACKEND-MIGRATION.md).
 */
function BranchSection() {
  const company = useWorld((s) => s.company);
  const session = useWorld((s) => s.session);
  const branches = useWorld((s) => s.branches);
  const branchOrder = useWorld((s) => s.branchOrder);
  const humanStaff = useWorld((s) => s.humanStaff);
  const establishBranch = useWorld((s) => s.establishBranch);
  const setBranchStatus = useWorld((s) => s.setBranchStatus);
  const [scope, setScope] = useState<'domestic' | 'overseas'>('domestic');
  const [presetIndex, setPresetIndex] = useState(0);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!company) return null;

  const isCeo = session?.role === 'ceo';
  const presets = scope === 'domestic' ? DOMESTIC_BRANCH_PRESETS : OVERSEAS_BRANCH_PRESETS;
  const preset = presets[presetIndex] ?? presets[0];
  const list = branchOrder.map((id) => branches[id]).filter(Boolean);

  const headcount = (branchId: string, isHq: boolean) =>
    Object.values(humanStaff).filter(
      (r) => r.status === 'approved' && (r.branchId === branchId || (isHq && !r.branchId)),
    ).length;

  return (
    <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
      <SectionTitle>지사 및 서버 ({list.filter((b) => b.status !== 'closed').length}곳)</SectionTitle>

      <div className="space-y-1.5 text-[11px]">
        {list.map((b) => (
          <div key={b.id} className="rounded-lg border border-stone-800 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block text-stone-100">
                  {b.kind === 'headquarters' ? '🏛 ' : b.kind === 'overseas' ? '🌏 ' : '🏢 '}
                  {b.name}
                </span>
                <span className="text-stone-500">
                  {b.country} · {b.region} · {b.serverRegion}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Badge tone="neutral">{b.currency}</Badge>
                <Badge tone={b.status === 'operating' ? 'gold' : b.status === 'preparing' ? 'arcane' : 'neutral'}>
                  {BRANCH_STATUS_LABEL[b.status]}
                </Badge>
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-stone-500">
                소속 사원 {headcount(b.id, b.kind === 'headquarters')}명 · {b.timezone}
              </span>
              {isCeo && b.kind !== 'headquarters' ? (
                <span className="flex gap-1">
                  {b.status !== 'operating' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      hint="준비를 마치고 정식 운영으로 전환합니다."
                      onClick={() => setBranchStatus(b.id, 'operating')}
                    >
                      운영 시작
                    </Button>
                  ) : null}
                  {b.status !== 'closed' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      hint="폐쇄해도 기록은 남습니다. 소속 사원은 다시 배치해야 합니다."
                      onClick={() => setBranchStatus(b.id, 'closed')}
                    >
                      폐쇄
                    </Button>
                  ) : null}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {isCeo ? (
        <div className="mt-3 rounded-lg border border-stone-700 bg-stone-950/50 p-3">
          <SectionTitle className="mb-1.5">새 지사 설립</SectionTitle>
          <div className="mb-2 flex gap-1.5">
            {(['domestic', 'overseas'] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={scope === k ? 'primary' : 'ghost'}
                hint={k === 'domestic' ? '같은 나라(대한민국) 안의 다른 지역에 세웁니다.' : '다른 나라에 세웁니다. 서버 리전과 통화가 함께 바뀝니다.'}
                onClick={() => {
                  setScope(k);
                  setPresetIndex(0);
                  setError(null);
                }}
              >
                {k === 'domestic' ? '국내' : '해외'}
              </Button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="지역">
              <Select value={presetIndex} onChange={(e) => setPresetIndex(Number(e.target.value))}>
                {presets.map((p, i) => (
                  <option key={`${p.country}-${p.region}`} value={i}>
                    {scope === 'domestic' ? p.region : `${p.country} · ${p.region}`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="지사 이름" hint={`비워 두면 "${preset.region} 지사"로 만듭니다`}>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={`${preset.region} 지사`} />
            </Field>
          </div>
          <p className="mt-1.5 text-[11px] text-stone-500">
            서버 리전 <span className="text-stone-300">{preset.serverRegion}</span> · 시간대 {preset.timezone} · 기본 통화{' '}
            {preset.currency}
          </p>
          {error ? <p className="mt-1 text-[11px] text-ember">{error}</p> : null}
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              hint="먼저 '준비 중' 상태로 만들어집니다. 준비가 끝나면 운영 시작을 누르세요."
              onClick={() => {
                const r = establishBranch({
                  name: name.trim() || `${preset.region} 지사`,
                  kind: scope,
                  country: preset.country,
                  region: preset.region,
                  serverRegion: preset.serverRegion,
                  timezone: preset.timezone,
                  currency: preset.currency,
                });
                if (!r.ok) setError(r.error ?? '설립할 수 없습니다.');
                else {
                  setError(null);
                  setName('');
                }
              }}
            >
              지사 설립
            </Button>
          </div>
        </div>
      ) : null}
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
          <Button
            size="sm"
            variant="ghost"
            hint="급여가 등록된 사원의 이름·직무·근무형태·월급·복지를 CSV 파일로 저장합니다."
            onClick={exportPayrollCsv}
          >
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
                  {r.name} <span className="text-stone-500">· <MailLink email={r.email} /></span>
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

/** 명부에서 사원을 지사에 배치하는 드롭다운. 폐쇄된 지사는 고를 수 없다. */
function BranchPicker({ record }: { record: HumanStaffRecord }) {
  const branches = useWorld((s) => s.branches);
  const branchOrder = useWorld((s) => s.branchOrder);
  const assign = useWorld((s) => s.assignStaffToBranch);
  const open = branchOrder.map((id) => branches[id]).filter((b) => b && b.status !== 'closed');
  if (open.length <= 1) return null;

  return (
    <Select
      value={record.branchId ?? ''}
      onChange={(e) => assign(record.id, e.target.value || null)}
    >
      <option value="">본사 소속</option>
      {open
        .filter((b) => b.kind !== 'headquarters')
        .map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
    </Select>
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
  const company = useWorld((s) => s.company);
  const currency = company?.currency ?? 'USD';
  const fx = DISPLAY_FX[currency];
  const [salary, setSalary] = useState(
    record.monthlySalaryUsd === null ? '' : String(Math.round(record.monthlySalaryUsd * fx.rate)),
  );
  const [benefits, setBenefits] = useState(record.benefits.join(', '));

  return (
    <div className="rounded-lg border border-stone-800 px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="text-stone-100">
          {record.name} <span className="text-stone-500">· <MailLink email={record.email} /></span>
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
                <option value="remote">재택 (자택에서 화상 연결)</option>
                <option value="not_started">미출근 (출근길)</option>
                <option value="leave">휴가 · 연가 · 연차 (낚시터)</option>
              </Select>
              <BranchPicker record={record} />
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
          <Field
            label={`월급 (${currency})`}
            hint={
              currency === 'USD'
                ? '달러로 입력합니다.'
                : `회사 통화로 입력하면 USD 로 환산해 저장합니다 (표시용 환율 1 USD = ${fx.rate.toLocaleString('ko-KR')} ${currency}).`
            }
          >
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
                  // 입력은 회사 통화로 받고 저장은 언제나 USD 로 한다 —
                  // 통화가 섞이면 급여 합계가 조용히 틀린다.
                  monthlySalaryUsd: salary.trim()
                    ? Math.max(0, Math.round(((Number(salary) || 0) / fx.rate) * 100) / 100)
                    : null,
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

      <PasswordSetting />
      {session?.role === 'human_staff' ? <MyProfileSetting /> : null}
      {session?.role === 'human_staff' ? <LeaveRequestSetting /> : null}
      {session?.role === 'ceo' ? <CompanyCodeSetting company={company} /> : null}
      {session?.role === 'ceo' ? <BackupSetting /> : null}
      {session?.role === 'ceo' ? <DriveConnectionSetting company={company} /> : null}
      {session?.role === 'ceo' ? <AdminMessageThread company={company} /> : null}
      {session?.role === 'ceo' ? <CompanyDeletionRequest /> : null}
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
export function PlatformMakerSetting() {
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
 * 대표가 채팅·자료 공유에 쓸 구글 드라이브 폴더 링크를 연결하는 곳.
 *
 * ⚠️ 실제 OAuth 로 구글 계정을 연결하지 않는다 — 대표가 자신의 드라이브에 폴더를
 * 만들고 "링크가 있는 모든 사용자" 등으로 공유 설정을 한 뒤 그 링크를 여기에
 * 붙여넣는 방식이다. 자동 업로드·자동 라우팅·미연결 시 서버 임시 저장은 모두
 * 백엔드가 있어야 가능한 항목이라 이 데모에는 없다 (docs/BACKEND-MIGRATION.md).
 */
function DriveConnectionSetting({ company }: { company: Company }) {
  const setLink = useWorld((s) => s.setCompanyDriveLink);
  const [value, setValue] = useState(company.driveFolderUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(!company.driveFolderUrl);

  return (
    <div className="rounded-xl border border-vital/40 bg-vital/5 p-4">
      <div className="flex items-center justify-between">
        <SectionTitle className="mb-0">구글 드라이브 연결</SectionTitle>
        <Badge tone={company.driveFolderUrl ? 'vital' : 'neutral'}>
          {company.driveFolderUrl ? '연결됨' : '연결 안 됨'}
        </Badge>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
        채팅과 자료 공유에서 오가는 대용량 파일은 여기 연결한 드라이브 폴더를 기준으로
        안내됩니다. 연결하지 않으면 사원·AI 직원 모두에게 대표님께 연결을 요청하는
        안내가 표시됩니다.
      </p>

      <button
        type="button"
        onClick={() => setShowGuide((v) => !v)}
        className="mt-2 text-[11px] text-arcane-soft underline decoration-dotted"
      >
        {showGuide ? '연결 방법 가이드 접기 ▲' : '연결 방법 가이드 보기 ▼'}
      </button>
      {showGuide ? (
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-stone-400">
          <li>구글 드라이브에서 회사 자료용 폴더를 새로 만듭니다.</li>
          <li>폴더 우클릭 → 공유 → "링크가 있는 모든 사용자"(또는 필요한 인원)로 권한을 설정합니다.</li>
          <li>"링크 복사"를 눌러 폴더 링크를 복사합니다.</li>
          <li>아래 입력칸에 붙여넣고 저장합니다.</li>
        </ol>
      ) : null}

      <div className="mt-3 flex gap-2">
        <TextInput
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="https://drive.google.com/drive/folders/..."
        />
        <Button
          size="sm"
          hint="붙여넣은 폴더 링크를 회사 공용 자료 위치로 저장합니다. 실제 파일 업로드는 백엔드 연동 항목입니다."
          onClick={() => {
            const r = setLink(value);
            if (!r.ok) setError(r.error ?? '저장할 수 없습니다.');
          }}
        >
          저장
        </Button>
        {company.driveFolderUrl ? (
          <Button
            size="sm"
            variant="ghost"
            hint="연결을 해제하면 사원과 AI 직원에게 다시 연결 요청 안내가 표시됩니다."
            onClick={() => {
              setValue('');
              setLink(null);
            }}
          >
            연결 해제
          </Button>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-[11px] text-ember">{error}</p> : null}
      {company.driveFolderUrl ? (
        <a
          href={company.driveFolderUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-[11px] text-gold hover:underline"
        >
          연결된 폴더 열기 →
        </a>
      ) : null}
    </div>
  );
}

/**
 * 대표가 플랫폼 관리자에게 건의·문의를 보내고 답장을 받는 창.
 * threadKey 는 회사 코드를 쓴다 — 회사가 있어야만 보이는 창이므로 항상 값이 있다.
 */
function AdminMessageThread({ company }: { company: Company }) {
  const messages = useWorld((s) => s.platformMessages);
  const send = useWorld((s) => s.sendPlatformMessage);
  const [draft, setDraft] = useState('');
  const thread = messages.filter((m) => m.threadKey === company.code);

  return (
    <div className="rounded-xl border border-arcane/40 bg-arcane/5 p-4">
      <SectionTitle>플랫폼 관리자에게 문의</SectionTitle>
      <p className="mb-2 text-[11px] leading-relaxed text-stone-400">
        건의사항이나 문의를 보내면 플랫폼 관리자가 확인 후 답장합니다.
      </p>
      {thread.length > 0 ? (
        <div className="mb-2 max-h-48 space-y-1.5 overflow-y-auto scroll-thin text-[11px]">
          {thread.map((m) => (
            <div key={m.id} className={`rounded-lg px-2.5 py-1.5 ${m.from === 'admin' ? 'bg-arcane/10' : 'bg-stone-800/60'}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className={m.from === 'admin' ? 'text-arcane-soft' : 'text-gold'}>
                  {m.from === 'admin' ? '관리자' : '나'}
                </span>
                <span className="text-stone-600">{clock(m.ts)}</span>
              </div>
              <p className="mt-0.5 text-stone-200">{m.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-2 text-[11px] text-stone-600">아직 보낸 메시지가 없습니다.</p>
      )}
      <TextArea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="문의 내용을 입력하세요…" />
      <div className="mt-1.5 flex justify-end">
        <Button
          size="sm"
          disabled={!draft.trim()}
          onClick={() => {
            send({ threadKey: company.code, companyName: company.name, text: draft });
            setDraft('');
          }}
        >
          보내기
        </Button>
      </div>
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
              hint="바로 삭제되지 않습니다. 플랫폼 관리자가 승인해야 실제로 지워집니다."
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

/* ─────────────────────────── 암호 바꾸기 ─────────────────────────── */

function PasswordSetting() {
  const currentAccountKey = useWorld((s) => s.currentAccountKey);
  const hasPassword = useWorld((s) => s.hasPassword);
  const verifyAccountPassword = useWorld((s) => s.verifyAccountPassword);
  const setAccountPassword = useWorld((s) => s.setAccountPassword);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [msg, setMsg] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const key = currentAccountKey();
  if (!key) return null;
  const exists = hasPassword(key);

  const submit = async () => {
    setMsg(null);
    if (next !== next2) {
      setMsg({ tone: 'warn', text: '새 암호를 두 번 다르게 입력하셨습니다.' });
      return;
    }
    const strong = checkPassword(next);
    if (!strong.ok) {
      setMsg({ tone: 'warn', text: strong.error ?? '암호를 다시 정해 주세요.' });
      return;
    }
    setBusy(true);
    try {
      // 이미 암호가 있으면 지금 암호를 먼저 확인한다 — 자리를 비운 사이
      // 남이 바꿔 버리는 일을 막는다.
      if (exists) {
        const v = await verifyAccountPassword(key, current);
        if (!v.ok) {
          setMsg({ tone: 'warn', text: v.error ?? '지금 암호가 맞지 않습니다.' });
          return;
        }
      }
      const r = await setAccountPassword(key, next);
      if (!r.ok) {
        setMsg({ tone: 'warn', text: r.error ?? '바꾸지 못했습니다.' });
        return;
      }
      setCurrent('');
      setNext('');
      setNext2('');
      setMsg({ tone: 'info', text: '암호를 바꿨습니다.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
      <SectionTitle>{exists ? '내 암호 바꾸기' : '내 암호 만들기'}</SectionTitle>
      <p className="mb-3 text-[11px] text-stone-400">
        {MIN_PASSWORD_LENGTH}자 이상. 암호는 해시로만 저장되고 원문은 어디에도 남지 않습니다.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {exists ? (
          <Field label="지금 암호">
            <TextInput type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
        ) : null}
        <Field label="새 암호">
          <TextInput type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="새 암호 확인">
          <TextInput type="password" value={next2} onChange={(e) => setNext2(e.target.value)} />
        </Field>
      </div>
      {msg ? (
        <div className="mt-2">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
      <div className="mt-3">
        <Button size="sm" disabled={busy || !next || !next2} onClick={() => void submit()}>
          {busy ? '바꾸는 중…' : exists ? '암호 바꾸기' : '암호 만들기'}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── 내 정보 ─────────────────────────── */

function MyProfileSetting() {
  const session = useWorld((s) => s.session);
  const humanStaff = useWorld((s) => s.humanStaff);
  const updateOwnProfile = useWorld((s) => s.updateOwnProfile);
  const rec = session?.humanStaffId ? humanStaff[session.humanStaffId] : null;

  const [name, setName] = useState(rec?.name ?? '');
  const [phone, setPhone] = useState(rec?.phone ?? '');
  const [appearanceId, setAppearanceId] = useState<EmployeeAppearanceId>(rec?.appearanceId ?? 'scribe');
  const [msg, setMsg] = useState<string | null>(null);

  if (!rec) return null;

  return (
    <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
      <SectionTitle>내 정보</SectionTitle>
      <p className="mb-3 text-[11px] text-stone-400">
        이름 · 연락처 · 캐릭터는 본인이 고칩니다. 직책 · 급여 · 소속 지사는 대표가 정합니다.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="이름">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="연락처">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="선택 입력" />
        </Field>
      </div>
      <div className="mt-2">
        <div className="text-[11px] text-stone-400">캐릭터</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {EMPLOYEE_APPEARANCE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setAppearanceId(id)}
              className={`rounded-md border px-2 py-1 text-[11px] ${
                appearanceId === id ? 'border-gold text-gold' : 'border-stone-700 text-stone-400 hover:border-stone-500'
              }`}
            >
              {EMPLOYEE_APPEARANCES[id].label}
            </button>
          ))}
        </div>
      </div>
      {msg ? (
        <div className="mt-2">
          <Notice>{msg}</Notice>
        </div>
      ) : null}
      <div className="mt-3">
        <Button
          size="sm"
          onClick={() => {
            const r = updateOwnProfile({ name, phone, appearanceId });
            setMsg(r.ok ? '저장했습니다.' : (r.error ?? '저장하지 못했습니다.'));
          }}
        >
          저장
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── 휴가 신청 ─────────────────────────── */

function LeaveRequestSetting() {
  const requestLeaveDays = useWorld((s) => s.requestLeaveDays);
  const approvals = useWorld((s) => s.approvals);
  const session = useWorld((s) => s.session);

  const today = new Date().toISOString().slice(0, 10);
  const [startDay, setStartDay] = useState(today);
  const [endDay, setEndDay] = useState(today);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);

  const mine = approvals.filter((a) => a.kind === 'leave_request' && a.requesterId === session?.humanStaffId);
  const pending = mine.find((a) => a.status === 'pending');

  return (
    <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
      <SectionTitle>휴가 · 연차 신청</SectionTitle>
      <p className="mb-3 text-[11px] text-stone-400">
        대표가 승인해야 근태가 바뀝니다. 신청과 결재 기록은 승인 센터와 감사 로그에 남습니다.
      </p>

      {pending ? (
        <Notice>
          처리 대기 중인 신청이 있습니다 — {pending.title}. 대표가 결정할 때까지 새로 낼 수 없습니다.
        </Notice>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="시작일">
              <input
                type="date"
                value={startDay}
                onChange={(e) => setStartDay(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-900 px-2 py-1.5 text-xs text-stone-100"
              />
            </Field>
            <Field label="종료일">
              <input
                type="date"
                value={endDay}
                onChange={(e) => setEndDay(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-900 px-2 py-1.5 text-xs text-stone-100"
              />
            </Field>
            <Field label="사유">
              <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 개인 연차" />
            </Field>
          </div>
          {msg ? (
            <div className="mt-2">
              <Notice tone={msg.tone}>{msg.text}</Notice>
            </div>
          ) : null}
          <div className="mt-3">
            <Button
              size="sm"
              onClick={() => {
                const r = requestLeaveDays({ startDay, endDay, reason });
                setMsg(
                  r.ok
                    ? { tone: 'info', text: '신청했습니다. 대표 승인 센터로 넘어갔습니다.' }
                    : { tone: 'warn', text: r.error ?? '신청하지 못했습니다.' },
                );
              }}
            >
              휴가 신청
            </Button>
          </div>
        </>
      )}

      {mine.filter((a) => a.status !== 'pending').length > 0 ? (
        <div className="mt-3 space-y-1 text-[11px]">
          <div className="text-stone-500">지난 신청</div>
          {mine
            .filter((a) => a.status !== 'pending')
            .slice(0, 5)
            .map((a) => (
              <div key={a.id} className="flex justify-between gap-2 border-b border-stone-800 py-1">
                <span className="text-stone-300">{a.title}</span>
                <Badge tone={a.status === 'approved' ? 'vital' : 'ember'}>
                  {a.status === 'approved' ? '승인' : '거절'}
                </Badge>
              </div>
            ))}
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── 회사 코드 재발급 ─────────────────────────── */

function CompanyCodeSetting({ company }: { company: Company }) {
  const regenerate = useWorld((s) => s.regenerateCompanyCode);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
      <SectionTitle>사원 가입 코드</SectionTitle>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-gold/40 bg-gold/10 px-2 py-1 font-mono text-sm text-gold">
          {company.code}
        </span>
        <CopyButton value={company.code} label="코드 복사" />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
        이 코드를 아는 사람은 누구나 가입 신청을 할 수 있습니다. 퇴사자가 알고 있거나 밖으로 샜다면
        새로 발급하세요. <strong className="text-stone-300">이전 코드는 즉시 쓸 수 없게 됩니다.</strong>
      </p>
      {confirming ? (
        <div className="mt-3 rounded-lg border border-ember/40 bg-ember/5 p-3">
          <p className="text-[11px] text-stone-200">
            정말 새로 발급할까요? 이전 코드를 받은 사람은 더 이상 가입 신청을 할 수 없습니다.
            (이미 승인된 사원은 영향을 받지 않습니다.)
          </p>
          <div className="mt-2 flex gap-1.5">
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                regenerate();
                setConfirming(false);
              }}
            >
              새로 발급
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setConfirming(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            코드 새로 발급
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── 백업 ─────────────────────────── */

function BackupSetting() {
  const exportBackup = useWorld((s) => s.exportBackup);
  const importBackup = useWorld((s) => s.importBackup);
  const company = useWorld((s) => s.company);
  const [msg, setMsg] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const json = exportBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `길드오피스-백업-${(company?.name ?? 'company').replace(/\s+/g, '')}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMsg({ tone: 'info', text: '백업 파일을 내려받았습니다. (미리보기 화면에서는 저장이 막힐 수 있습니다)' });
  };

  const load = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const r = importBackup(text);
    setMsg(
      r.ok
        ? { tone: 'info', text: '백업을 되돌렸습니다.' }
        : { tone: 'warn', text: r.error ?? '되돌리지 못했습니다.' },
    );
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
      <SectionTitle>전체 백업 · 복원</SectionTitle>
      <p className="mb-3 text-[11px] leading-relaxed text-stone-400">
        이 앱은 <strong className="text-stone-300">브라우저 안에만</strong> 저장됩니다. 브라우저를
        청소하면 전부 사라지므로, 중요한 시점마다 파일로 내려받아 두세요. 서버가 생기기 전까지의
        유일한 안전장치입니다.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="ghost" onClick={save}>
          백업 내려받기
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void load(e.target.files?.[0])}
        />
        <Button size="sm" variant="ghost" onClick={() => inputRef.current?.click()}>
          백업 되돌리기
        </Button>
      </div>
      {msg ? (
        <div className="mt-2">
          <Notice tone={msg.tone}>{msg.text}</Notice>
        </div>
      ) : null}
    </div>
  );
}
