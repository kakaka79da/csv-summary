/** 감사 로그. 누가 · 무엇을 · 언제 했는지 남긴다. 실제 서비스에서는 서버가 append-only 로 보관한다. */
import { useWorld } from '@/state/store';
import { clock } from '@/lib/format';
import { Notice } from '@/components/ui/primitives';

export default function AuditLog() {
  const audit = useWorld((s) => s.audit);
  return (
    <div className="space-y-3">
      <Notice>
        프로토타입의 감사 로그는 브라우저에만 저장됩니다. 실제 서비스에서는 서버에 추가 전용(append-only)으로
        기록하고, 클라이언트에서 수정·삭제할 수 없어야 합니다.
      </Notice>
      {audit.length === 0 ? (
        <p className="text-xs text-stone-600">기록이 없습니다.</p>
      ) : (
        <div className="space-y-1 text-[11px]">
          {audit.map((a) => (
            <div key={a.id} className="flex gap-2 border-b border-stone-800 py-1.5">
              <span className="w-16 shrink-0 text-stone-600">{clock(a.ts)}</span>
              <span className="w-20 shrink-0 truncate text-stone-400">{a.actor}</span>
              <span className="w-32 shrink-0 truncate text-gold">{a.action}</span>
              <span className="w-24 shrink-0 truncate text-stone-300">{a.target}</span>
              <span className="min-w-0 flex-1 truncate text-stone-500">{a.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
