/**
 * 역할별 데모 로그인.
 *
 * ⚠️ 이 화면에는 암호 입력이 아예 없다. 프로토타입에서 암호를 다루면
 * 프론트엔드에 자격증명이 남게 되므로, 실제 인증은 백엔드 항목으로 분리한다.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWorld } from '@/state/store';
import { Button, Notice } from '@/components/ui/primitives';
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
  const login = useWorld((s) => s.loginDemo);
  const company = useWorld((s) => s.company);
  const makerName = useWorld((s) => s.platformMakerName) || PLATFORM_MAKER;
  const [staffFlow, setStaffFlow] = useState(false);

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
                  onClick={() => (r.role === 'human_staff' ? setStaffFlow(true) : login(r.role))}
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
                    {locked ? '창립 후 개방' : '데모 로그인 →'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <Notice>
              <strong className="text-arcane-soft">이 화면은 데모 로그인입니다.</strong> 암호를 입력받지
              않으며, 어떤 자격증명도 브라우저에 저장하지 않습니다. 실제 인증(Argon2id 해시, 최초 1회용
              부트스트랩 암호, 로그인 실패 제한, 감사 로그)은 백엔드 구현 항목으로 분리되어 있습니다.
              자세한 내용은 <code className="text-stone-300">docs/SECURITY.md</code> 를 참고하세요.
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
