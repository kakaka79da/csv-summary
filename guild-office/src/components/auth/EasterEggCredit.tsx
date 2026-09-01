/**
 * 아주 작은 플랫폼 제작자 표기. 이스터에그 진입점이다.
 * 클릭하면 코드 입력칸이 나타나고, 맞는 코드를 넣으면 숨겨진 데모 시나리오가 시작된다.
 *
 * 로그인 화면과 앱 헤더 양쪽에 둔다 — 로그인 화면은 세션이 저장되어 있으면
 * 다시 보이지 않으므로(App.tsx: session 이 있으면 LoginScreen 자체가 렌더링되지
 * 않는다), 로그인한 뒤에도 찾을 수 있는 자리가 하나는 있어야 한다.
 */
import { useState } from 'react';
import { useWorld } from '@/state/store';

export default function EasterEggCredit({ makerName }: { makerName: string }) {
  const tryCode = useWorld((s) => s.tryEasterEggCode);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-stone-500 transition-colors hover:text-stone-300"
      >
        플랫폼 제작: <span className="underline decoration-dotted">{makerName}</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const ok = tryCode(code);
        if (!ok) {
          setError(true);
          setCode('');
        }
      }}
      className="inline-flex items-center gap-1.5 text-[11px]"
    >
      <input
        type="password"
        autoComplete="off"
        autoFocus
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError(false);
        }}
        placeholder="코드 입력"
        className={`w-32 rounded border bg-stone-950 px-2 py-0.5 text-stone-200 outline-none ${
          error ? 'border-ember' : 'border-stone-700 focus:border-gold'
        }`}
      />
      <button type="submit" className="text-gold hover:text-gold-soft">
        확인
      </button>
      {error ? <span className="text-ember">코드가 올바르지 않습니다</span> : null}
    </form>
  );
}
