/**
 * 사원 로그인/가입 흐름.
 *
 * 백엔드가 없는 데모이므로 "다른 기기에서 대표가 승인"은 시뮬레이션할 수 없다.
 * 대신 같은 브라우저 안에서 사원 계정과 대표 계정을 번갈아 로그인하는 방식으로
 * 신청 → 승인 → 재로그인 흐름을 그대로 체험할 수 있게 구성했다.
 */
import { useState } from 'react';
import { useWorld } from '@/state/store';
import { Button, Field, Notice, SectionTitle, TextInput } from '@/components/ui/primitives';
import { EMPLOYEE_APPEARANCES, EMPLOYEE_APPEARANCE_IDS } from '@/data/seed';
import type { EmployeeAppearanceId, HumanStaffRecord } from '@/types';
import CharacterSprite from '@/components/office/CharacterSprite';

const STATUS_LABEL: Record<HumanStaffRecord['status'], string> = {
  pending: '처리중 · 대표 승인 대기',
  approved: '승인됨',
  rejected: '거절됨',
  removed: '퇴사 처리됨',
};

export default function StaffSignIn({ onBack }: { onBack: () => void }) {
  const lookup = useWorld((s) => s.lookupHumanStaffByEmail);
  const continueSession = useWorld((s) => s.continueHumanStaffSession);
  const applyAsHumanStaff = useWorld((s) => s.applyAsHumanStaff);

  const [email, setEmail] = useState('');
  const [checked, setChecked] = useState(false);
  const [found, setFound] = useState<HumanStaffRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      setError('올바른 이메일 주소를 입력하세요.');
      return;
    }
    setFound(lookup(trimmed));
    setChecked(true);
  };

  const enterExisting = () => {
    const res = continueSession(email);
    if (!res.ok) setError(res.error ?? '로그인할 수 없습니다.');
  };

  if (checked && found) {
    return (
      <div className="panel p-5">
        <SectionTitle>기존 신청 기록</SectionTitle>
        <p className="text-sm text-stone-200">
          {found.name} <span className="text-stone-500">· {found.email}</span>
        </p>
        <p className="mt-1 text-xs text-stone-400">현재 상태: {STATUS_LABEL[found.status]}</p>
        {found.status === 'rejected' ? (
          <Notice tone="warn">가입 신청이 거절되었습니다. 회사 대표에게 문의하세요.</Notice>
        ) : found.status === 'removed' ? (
          <Notice tone="warn">회사에서 내보내졌습니다. 재입장은 대표만 처리할 수 있습니다.</Notice>
        ) : found.status === 'pending' ? (
          <Notice>대표가 승인하면 오피스에 입장할 수 있습니다. 지금 들어가면 대기 화면이 표시됩니다.</Notice>
        ) : (
          <Notice>승인되었습니다. 바로 오피스에 입장할 수 있습니다.</Notice>
        )}
        {error ? <Notice tone="warn">{error}</Notice> : null}
        <div className="mt-4 flex justify-between gap-2">
          <Button
            variant="quiet"
            onClick={() => {
              setChecked(false);
              setFound(null);
            }}
          >
            ← 다시 확인
          </Button>
          <Button onClick={enterExisting}>이메일로 계속하기 →</Button>
        </div>
      </div>
    );
  }

  if (checked && !found) {
    return <ApplyForm email={email} onBack={() => setChecked(false)} applyAsHumanStaff={applyAsHumanStaff} />;
  }

  return (
    <div className="panel p-5">
      <SectionTitle>사원 로그인 · 가입</SectionTitle>
      <p className="mb-3 text-xs text-stone-400">
        이메일을 입력하면 기존 신청 기록을 확인하거나, 처음이면 회사 코드로 새로 가입할 수 있습니다.
      </p>
      <Field label="이메일">
        <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </Field>
      {error ? (
        <div className="mt-2">
          <Notice tone="warn">{error}</Notice>
        </div>
      ) : null}
      <div className="mt-4 flex justify-between gap-2">
        <Button variant="quiet" onClick={onBack}>
          ← 뒤로
        </Button>
        <Button onClick={check}>확인 →</Button>
      </div>
    </div>
  );
}

function ApplyForm({
  email,
  onBack,
  applyAsHumanStaff,
}: {
  email: string;
  onBack: () => void;
  applyAsHumanStaff: (input: {
    name: string;
    email: string;
    phone: string;
    companyCode: string;
    role: string;
    appearanceId: EmployeeAppearanceId;
  }) => { ok: boolean; error?: string };
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [role, setRole] = useState('');
  const [appearanceId, setAppearanceId] = useState<EmployeeAppearanceId>('scribe');
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim() && email.trim().includes('@') && companyCode.trim();

  const submit = () => {
    const res = applyAsHumanStaff({ name, email, phone, companyCode, role, appearanceId });
    if (!res.ok) setError(res.error ?? '신청할 수 없습니다.');
  };

  return (
    <div className="panel p-5">
      <SectionTitle>신규 사원 가입 신청</SectionTitle>
      <p className="mb-3 text-xs text-stone-400">
        이메일은 필수이며, 전화번호는 선택 입력입니다. 대표에게서 받은 회사 코드를 입력하세요.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="이름">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="이메일 (필수)">
          <TextInput type="email" value={email} readOnly className="opacity-70" />
        </Field>
        <Field label="전화번호 (선택)">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="회사 코드" hint="대표에게서 받은 가입 코드">
          <TextInput
            value={companyCode}
            onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
            placeholder="예: CRM-0001"
          />
        </Field>
        <Field label="희망 직무 (선택)">
          <TextInput value={role} onChange={(e) => setRole(e.target.value)} placeholder="예: 마케팅" />
        </Field>
      </div>

      <div className="mt-5">
        <SectionTitle>캐릭터 외형 선택</SectionTitle>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {EMPLOYEE_APPEARANCE_IDS.map((id) => {
            const a = EMPLOYEE_APPEARANCES[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => setAppearanceId(id)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors ${
                  appearanceId === id ? 'border-gold bg-stone-800/70' : 'border-stone-700 hover:border-stone-500'
                }`}
              >
                <svg viewBox="0 0 24 28" className="h-14 w-12">
                  <CharacterSprite palette={a.palette} sigil={a.sigil} state="idle" jobClass={a.jobClass} gender={a.gender} />
                </svg>
                <span className="text-[11px] text-stone-200">{a.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="mt-3">
          <Notice tone="warn">{error}</Notice>
        </div>
      ) : null}

      <div className="mt-5 flex justify-between gap-2">
        <Button variant="quiet" onClick={onBack}>
          ← 뒤로
        </Button>
        <Button disabled={!valid} onClick={submit}>
          가입 신청 제출 →
        </Button>
      </div>
    </div>
  );
}
