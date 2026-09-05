/**
 * 관리자 암호 관문.
 *
 * 숨은 코드(mkang428428##)를 맞히면 이 창이 열린다. 코드는 "어느 문인가"를 고를 뿐이고,
 * 실제로 여는 것은 **관리자 암호**다. 코드가 번들 안에 문자열로 들어 있어 그것만으로는
 * 잠금 장치가 될 수 없기 때문이다.
 *
 * 관리자가 아직 자기 암호를 정하지 않았다면 부트스트랩 암호로 열리며,
 * 그동안은 화면에 "임시 암호를 쓰는 중"이라고 계속 알려 준다(`data/adminCredential.ts`).
 */
import { useState } from 'react';
import { useWorld } from '@/state/store';
import { Button, Field, Notice, TextInput } from '@/components/ui/primitives';

export default function AdminGate() {
  const open = useWorld((s) => s.ui.adminGateOpen);
  const setAdminGate = useWorld((s) => s.setAdminGate);
  const loginAsAdmin = useWorld((s) => s.loginAsAdmin);
  const usingBootstrap = useWorld((s) => s.adminUsingBootstrap);

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await loginAsAdmin(password);
      if (!r.ok) {
        setError(r.error ?? '들어갈 수 없습니다.');
        setPassword('');
        return;
      }
      setAdminGate(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] grid place-items-center bg-stone-950/85 p-6">
      <div className="panel w-full max-w-sm p-5">
        <h2 className="rune-title text-lg">플랫폼 관리자</h2>
        <p className="mt-1 text-xs text-stone-400">관리자 암호를 입력하세요.</p>

        <div className="mt-4">
          <Field label="암호">
            <TextInput
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
              placeholder="••••••••"
            />
          </Field>
        </div>

        {error ? (
          <div className="mt-3">
            <Notice tone="warn">{error}</Notice>
          </div>
        ) : null}

        {usingBootstrap() ? (
          <div className="mt-3">
            <Notice>
              아직 <strong>임시(부트스트랩) 암호</strong>를 쓰고 있습니다. 들어간 뒤 관리자 화면에서
              바로 바꿔 주세요.
            </Notice>
          </div>
        ) : null}

        <div className="mt-5 flex justify-between gap-2">
          <Button
            variant="quiet"
            onClick={() => {
              setAdminGate(false);
              setPassword('');
              setError(null);
            }}
          >
            취소
          </Button>
          <Button disabled={busy || !password} onClick={() => void submit()}>
            {busy ? '확인 중…' : '입장 →'}
          </Button>
        </div>
      </div>
    </div>
  );
}
