/**
 * 창립 튜토리얼 2~4단계: 회사 창립 → 첫 사무실 생성 → AI 직원 3명 영입.
 * 빈 대시보드를 먼저 보여주지 않고, 단계별로 진행한다.
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorld } from '@/state/store';
import { AI_EMPLOYEE_SEEDS, COMPANY_DEFAULTS, DUTIES, ROOMS } from '@/data/seed';
import { Button, Field, Notice, SectionTitle, Select, TextArea, TextInput } from '@/components/ui/primitives';
import CharacterSprite from '@/components/office/CharacterSprite';
import CharacterPortrait from '@/components/office/CharacterPortrait';
import type { AppearanceId, CeoGender, Company } from '@/types';

const APPEARANCES: Array<{ id: AppearanceId; label: string; desc: string; palette: { robe: string; trim: string; aura: string } }> = [
  { id: 'sovereign', label: '군주', desc: '네이비 예장 · 금장 자수', palette: { robe: '#252a4d', trim: '#c9a24a', aura: '#f0cd85' } },
  { id: 'warden', label: '수호자', desc: '강청 예장 · 은장 자수', palette: { robe: '#1f3348', trim: '#c2ccd8', aura: '#8fc4f0' } },
  { id: 'seer', label: '예언자', desc: '자주 예장 · 자수정 장식', palette: { robe: '#3a2a52', trim: '#cbb2ea', aura: '#a99cf0' } },
  { id: 'artificer', label: '장인', desc: '심록 예장 · 황동 장식', palette: { robe: '#24402f', trim: '#cbb27a', aura: '#8fe0bb' } },
];

export default function FoundingFlow() {
  const phase = useWorld((s) => s.phase);
  if (phase === 'founding') return <CompanyForm />;
  if (phase === 'office_build') return <OfficeBuild />;
  return <SummonScene />;
}

/* ─────────────────────────── 2단계: 회사 창립 ─────────────────────────── */

function CompanyForm() {
  const foundCompany = useWorld((s) => s.foundCompany);
  const session = useWorld((s) => s.session);
  const [form, setForm] = useState<Omit<Company, 'foundedAt' | 'code'>>({ ...COMPANY_DEFAULTS });

  const set = <K extends keyof Omit<Company, 'foundedAt' | 'code'>>(k: K, v: Omit<Company, 'foundedAt' | 'code'>[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const valid =
    form.name.trim() &&
    form.ceoName.trim() &&
    form.ceoCharacterName.trim() &&
    form.ceoPhone.trim() &&
    form.businessRegNo.trim() &&
    form.ceoEmail.trim();

  return (
    <Wizard step={2} total={6} title="회사 창립" flavor="길드 창설 문서 작성">
      <div className="mb-4 flex items-center justify-between rounded-lg border border-stone-700 bg-stone-950/50 px-3 py-2 text-xs">
        <span className="text-stone-400">
          로그인 계정 <span className="text-stone-200">{session?.accountName}</span>
          <span className="ml-1 text-stone-600">({session?.role === 'ceo' ? '대표' : '관리자'})</span>
        </span>
        <span className="text-stone-500">지금 입력하는 대표자명은 회사 소속 정보입니다</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="회사명">
          <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="대표자명">
          <TextInput value={form.ceoName} onChange={(e) => set('ceoName', e.target.value)} />
        </Field>
        <Field label="대표 캐릭터명" hint="오피스 안에서 표시되는 이름">
          <TextInput value={form.ceoCharacterName} onChange={(e) => set('ceoCharacterName', e.target.value)} />
        </Field>
        <Field label="기본 국가">
          <TextInput value={form.country} onChange={(e) => set('country', e.target.value)} />
        </Field>
        <Field label="기본 지사">
          <TextInput value={form.branch} onChange={(e) => set('branch', e.target.value)} />
        </Field>
        <Field label="기본 통화" hint="비용은 USD로 청구되며 화면에 환산값을 함께 표시합니다">
          <Select value={form.currency} onChange={(e) => set('currency', e.target.value as Company['currency'])}>
            <option value="KRW">KRW · 대한민국 원</option>
            <option value="USD">USD · 미국 달러</option>
            <option value="JPY">JPY · 일본 엔</option>
            <option value="EUR">EUR · 유로</option>
          </Select>
        </Field>
        <Field label="월간 AI 예산 (USD)" hint="이 금액을 넘는 작업은 자동으로 중단되고 승인 대기로 전환됩니다">
          <TextInput
            type="number"
            min={1}
            step={1}
            value={form.monthlyBudgetUsd}
            onChange={(e) => set('monthlyBudgetUsd', Math.max(1, Number(e.target.value) || 0))}
          />
        </Field>
        <Field label="대표 전화번호" hint="사업자 개업 시 필수 입력">
          <TextInput value={form.ceoPhone} onChange={(e) => set('ceoPhone', e.target.value)} />
        </Field>
        <Field label="사업자등록번호" hint="사업자 개업 시 필수 입력">
          <TextInput value={form.businessRegNo} onChange={(e) => set('businessRegNo', e.target.value)} />
        </Field>
        <Field label="대표 이메일" hint="사업자 개업 시 필수 입력">
          <TextInput type="email" value={form.ceoEmail} onChange={(e) => set('ceoEmail', e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="회사의 첫 번째 목표">
            <TextArea rows={2} value={form.firstGoal} onChange={(e) => set('firstGoal', e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="mt-5">
        <SectionTitle>대표 성별</SectionTitle>
        <div className="flex gap-2">
          {(['male', 'female'] as CeoGender[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => set('ceoGender', g)}
              className={`rounded-lg border px-4 py-1.5 text-sm transition-colors ${
                form.ceoGender === g ? 'border-gold bg-stone-800/70 text-gold' : 'border-stone-700 text-stone-300 hover:border-stone-500'
              }`}
            >
              {g === 'male' ? '남성' : '여성'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <SectionTitle>대표 캐릭터 외형</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {APPEARANCES.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => set('ceoAppearance', a.id)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors ${
                form.ceoAppearance === a.id ? 'border-gold bg-stone-800/70' : 'border-stone-700 hover:border-stone-500'
              }`}
            >
              <svg viewBox="0 0 24 28" className="h-14 w-12">
                <CharacterSprite palette={a.palette} sigil="♛" state="idle" jobClass="sovereign" gender={form.ceoGender} />
              </svg>
              <span className="text-xs text-stone-200">{a.label}</span>
              <span className="text-[10px] text-stone-500">{a.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button disabled={!valid} onClick={() => foundCompany(form)}>
          창립 문서 봉인 · 회사 설립
        </Button>
      </div>
    </Wizard>
  );
}

/* ────────────────────────── 3단계: 첫 사무실 생성 ─────────────────────── */

function OfficeBuild() {
  const buildOffice = useWorld((s) => s.buildOffice);
  const company = useWorld((s) => s.company);
  const [built, setBuilt] = useState<string[]>([]);

  const start = () => {
    ROOMS.forEach((room, i) => {
      setTimeout(() => setBuilt((b) => [...b, room.id]), i * 220);
    });
    setTimeout(() => buildOffice(), ROOMS.length * 220 + 500);
  };

  return (
    <Wizard step={3} total={6} title="첫 사무실 생성" flavor={`${company?.branch} 1층 개설`}>
      <p className="mb-4 text-sm text-stone-400">
        작은 사무공간에서 시작합니다. 회사가 성장하면 공간과 지사를 확장할 수 있습니다.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ROOMS.map((room) => {
          const done = built.includes(room.id);
          return (
            <motion.div
              key={room.id}
              animate={{ opacity: done ? 1 : 0.3, scale: done ? 1 : 0.97 }}
              className={`rounded-lg border px-3 py-2 ${done ? 'border-gold/50 bg-stone-800/60' : 'border-stone-800'}`}
            >
              <div className="text-sm text-stone-100">{room.name}</div>
              <div className="text-[11px] text-stone-500">{room.flavor}</div>
            </motion.div>
          );
        })}
      </div>
      <div className="mt-6 flex justify-end">
        <Button disabled={built.length > 0} onClick={start}>
          {built.length > 0 ? `건설 중… (${built.length}/${ROOMS.length})` : '사무실 건설 시작'}
        </Button>
      </div>
    </Wizard>
  );
}

/* ─────────────────────── 4단계: AI 직원 3명 영입 ─────────────────────── */

function SummonScene() {
  const summon = useWorld((s) => s.summonEmployees);
  const startInterviews = useWorld((s) => s.startInterviews);
  const employees = useWorld((s) => s.employees);
  const company = useWorld((s) => s.company);
  const [revealed, setRevealed] = useState(0);

  const begin = () => {
    summon();
    AI_EMPLOYEE_SEEDS.forEach((_, i) => setTimeout(() => setRevealed(i + 1), i * 900));
  };
  const allIn = revealed >= AI_EMPLOYEE_SEEDS.length && Object.keys(employees).length === 3;

  return (
    <Wizard step={4} total={6} title="AI 직원 영입" flavor="소환진 가동">
      <p className="mb-4 text-sm text-stone-400">
        포털에서 세 명의 동료가 차례로 등장해 {company?.ceoName} 대표에게 인사합니다.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {AI_EMPLOYEE_SEEDS.map((spec, i) => (
          <AnimatePresence key={spec.id}>
            {revealed > i ? (
              <motion.div
                initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="panel p-4 text-center"
              >
                <CharacterPortrait employee={spec} className="mx-auto h-32 w-24" />
                <div className="mt-2 font-display text-lg text-gold">{spec.name}</div>
                <div className="text-xs text-stone-300">{spec.title}</div>
                <div className="text-[11px] text-stone-500">{spec.jobLabel}</div>
                <ul className="mt-3 space-y-0.5 text-left text-[11px] text-stone-400">
                  {DUTIES[spec.id].map((d) => (
                    <li key={d}>· {d}</li>
                  ))}
                </ul>
              </motion.div>
            ) : (
              <div className="grid h-full min-h-[220px] place-items-center rounded-xl border border-dashed border-stone-700 text-stone-600">
                소환 대기
              </div>
            )}
          </AnimatePresence>
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        {revealed === 0 ? (
          <Button onClick={begin}>소환진 가동</Button>
        ) : (
          <Button disabled={!allIn} onClick={startInterviews}>
            {allIn ? '1:1 면담 시작 →' : '등장 중…'}
          </Button>
        )}
      </div>
    </Wizard>
  );
}

/* ───────────────────────────── 공통 껍데기 ───────────────────────────── */

function Wizard({
  step,
  total,
  title,
  flavor,
  children,
}: {
  step: number;
  total: number;
  title: string;
  flavor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-full border border-gold/50 px-2 py-0.5 text-[11px] text-gold">
          창립 튜토리얼 {step}/{total}
        </span>
        <div className="h-px flex-1 bg-stone-800" />
      </div>
      <h1 className="rune-title text-2xl">{title}</h1>
      <p className="mb-5 text-xs text-stone-500">{flavor}</p>
      <div className="panel p-5">{children}</div>
      <div className="mt-4">
        <Notice>
          게임 연출을 쓰더라도 실제 업무 상태·비용·승인 여부는 항상 텍스트로 정확히 함께 표시됩니다.
        </Notice>
      </div>
    </div>
  );
}
