/**
 * 로그인 화면.
 *
 * 대표·사원은 각자 정한 **개인 암호**로 들어온다. 암호는 PBKDF2 해시로만 저장되고
 * 원문은 어디에도 남지 않는다(`src/lib/password.ts`).
 *
 * ⚠️ 다만 대조가 브라우저 안에서 일어나므로 **진짜 보안은 아니다.** 어깨너머·실수로
 * 남의 계정에 들어가는 일을 막을 뿐이며, 실제 인증은 서버가 대조해야 한다.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWorld } from '@/state/store';
import { Button, Field, Notice, TextInput } from '@/components/ui/primitives';
import { MIN_PASSWORD_LENGTH, checkPassword } from '@/lib/password';
import { PLATFORM_MAKER } from '@/data/seed';
import EasterEggCredit from '@/components/auth/EasterEggCredit';
import StaffSignIn from '@/components/auth/StaffSignIn';

const ROLES = [
  {
    role: 'ceo' as const,
    title: '회사 대표 (CEO)',
    flavor: '길드 마스터',
    desc: '회사 선택 또는 새 회사 창립, 업무 지시, 모든 비용·승인 결정 권한',
    sigil: '♛',
  },
  {
    role: 'human_staff' as const,
    title: '인간 직원',
    flavor: '길드원',
    desc: '이메일 확인 후 회사 코드로 가입 신청, 대표 승인 후 입장',
    sigil: '☗',
  },
];

export default function LoginScreen() {
  const company = useWorld((s) => s.company);
  const makerName = useWorld((s) => s.platformMakerName) || PLATFORM_MAKER;
  const [staffFlow, setStaffFlow] = useState(false);
  const [ceoFlow, setCeoFlow] = useState(false);

  if (ceoFlow) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mb-3 text-4xl">⚔</div>
            <h1 className="rune-title text-3xl">길드 오피스</h1>
          </div>
          <CeoSignIn onBack={() => setCeoFlow(false)} />
        </motion.div>
      </div>
    );
  }

  if (staffFlow) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl">
          <div className="mb-6 text-center">
            <div className="mb-3 text-4xl">⚔</div>
            <h1 className="rune-title text-3xl">길드 오피스</h1>
          </div>
          <StaffSignIn onBack={() => setStaffFlow(false)} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl">⚔</div>
          <h1 className="rune-title text-3xl">길드 오피스</h1>
          <p className="mt-2 text-sm text-stone-400">
            대표 1명과 AI 직원 3명이 함께 세우는 글로벌 워크스페이스
          </p>
        </div>

        <div className="panel p-5">
          <div className="space-y-3">
            {ROLES.map((r) => {
              const locked = r.role === 'human_staff' && !company;
              return (
                <button
                  key={r.role}
                  type="button"
                  disabled={locked}
                  onClick={() => (r.role === 'human_staff' ? setStaffFlow(true) : setCeoFlow(true))}
                  className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-colors ${
                    locked
                      ? 'cursor-not-allowed border-stone-800 opacity-40'
                      : 'border-stone-700 hover:border-gold hover:bg-stone-800/60'
                  }`}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-stone-600 text-xl text-gold">
                    {r.sigil}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="font-medium text-stone-100">{r.title}</span>
                      <span className="text-[11px] text-stone-500">· {r.flavor}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-400">{r.desc}</span>
                  </span>
                  <span className="shrink-0 text-xs text-stone-500">
                    {locked ? '창립 후 개방' : '로그인 →'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <Notice>
              <strong className="text-arcane-soft">암호는 해시로만 저장됩니다.</strong> 원문은 어디에도
              남지 않고, 연달아 5번 틀리면 5분간 잠깁니다. 다만 대조가 브라우저 안에서 일어나므로
              <strong> 진짜 보안은 아닙니다</strong> — 개발자 도구를 아는 사람은 우회할 수 있습니다.
              서버 인증(Argon2id, 부트스트랩 암호, 감사 로그)은 백엔드 항목입니다.
              <code className="ml-1 text-stone-300">docs/SECURITY.md</code>
            </Notice>
          </div>
        </div>

        {company ? (
          <div className="mt-4 text-center text-xs text-stone-500">
            저장된 회사: <span className="text-stone-300">{company.name}</span> · 대표 {company.ceoName}
            <div className="mt-2">
              <Button
                variant="quiet"
                size="sm"
                onClick={() => {
                  if (confirm('저장된 회사와 모든 진행 상황을 삭제할까요?')) useWorld.getState().resetAll();
                }}
              >
                모두 초기화
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-6 text-center">
          <EasterEggCredit makerName={makerName} />
        </div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────── 대표 로그인 ─────────────────────────── */

function CeoSignIn({ onBack }: { onBack: () => void }) {
  const hasPassword = useWorld((s) => s.hasPassword);
  const setAccountPassword = useWorld((s) => s.setAccountPassword);
  const loginAsCeo = useWorld((s) => s.loginAsCeo);
  const loginDemo = useWorld((s) => s.loginDemo);

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const first = !hasPassword('ceo');

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (first) {
        if (password !== password2) {
          setError('두 번 입력한 암호가 서로 다릅니다.');
          return;
        }
        const strong = checkPassword(password);
        if (!strong.ok) {
          setError(strong.error ?? '암호를 다시 정해 주세요.');
          return;
        }
        const made = await setAccountPassword('ceo', password);
        if (!made.ok) {
          setError(made.error ?? '암호를 정하지 못했습니다.');
          return;
        }
        loginDemo('ceo');
        return;
      }
      const res = await loginAsCeo(password);
      if (!res.ok) setError(res.error ?? '로그인할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel p-5">
      <h2 className="rune-title text-lg">{first ? '대표 암호 만들기' : '대표 로그인'}</h2>
      <p className="mt-1 text-xs text-stone-400">
        {first
          ? `이 브라우저에서 처음 들어오셨습니다. 앞으로 쓸 암호를 ${MIN_PASSWORD_LENGTH}자 이상으로 정해 주세요.`
          : '정해 두신 대표 암호를 입력하세요.'}
      </p>

      <div className="mt-4 space-y-3">
        <Field label="암호">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !first) void submit();
            }}
            placeholder="••••••••"
          />
        </Field>
        {first ? (
          <Field label="암호 다시 입력">
            <TextInput
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
              placeholder="••••••••"
            />
          </Field>
        ) : null}
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
        <Button disabled={busy || !password || (first && !password2)} onClick={() => void submit()}>
          {busy ? '확인 중…' : first ? '암호 정하고 시작 →' : '로그인 →'}
        </Button>
      </div>
    </div>
  );
}
