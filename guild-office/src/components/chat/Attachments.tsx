/**
 * 채팅 첨부 — 고르기 · 보기 · 내려받기.
 *
 * 서버가 없으므로 파일은 브라우저 안에만 있다(data: URL). 그래서 두 가지를
 * 화면에서 분명히 한다.
 *   1) 남은 용량을 항상 보여 준다. 꽉 차기 전에 알 수 있어야 한다.
 *   2) 큰 파일은 거절하고 "구글 드라이브 폴더를 쓰라"고 말한다.
 *
 * ⚠️ 내려받기는 <a download> 로 한다. 실제 브라우저에서는 동작하지만
 * **미리보기 샌드박스(claude.ai 아티팩트)는 저장을 막는다.** 그래서 이미지는
 * 눌러서 크게 보는 길을 따로 두었고, 안내 문구도 함께 적어 둔다.
 */
import { useRef, useState } from 'react';
import {
  ATTACHMENT_BUDGET_BYTES,
  MAX_ATTACHMENT_BYTES,
  checkAttachments,
  fileGlyph,
  formatBytes,
  isImage,
  shortName,
  type Attachment,
} from '@/lib/attachments';
import { Button, Tooltip } from '@/components/ui/primitives';
import { nid } from '@/lib/format';

/** 파일 하나를 data: URL 로 읽는다. */
function readFile(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`"${file.name}" 을(를) 읽지 못했습니다.`));
    reader.onload = () =>
      resolve({
        id: nid('att'),
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: String(reader.result),
        ts: Date.now(),
      });
    reader.readAsDataURL(file);
  });
}

/** data: URL 을 파일로 저장한다. 미리보기 샌드박스에서는 막힐 수 있다. */
export function saveAttachment(att: Attachment) {
  const a = document.createElement('a');
  a.href = att.dataUrl;
  a.download = att.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ─────────────────────── 고르는 쪽 (보내기 전) ─────────────────────── */

export function AttachmentPicker({
  picked,
  onChange,
  usedBytes,
  onError,
}: {
  picked: Attachment[];
  onChange: (next: Attachment[]) => void;
  usedBytes: number;
  onError: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pickedBytes = picked.reduce((s, a) => s + a.size, 0);
  const left = Math.max(0, ATTACHMENT_BUDGET_BYTES - usedBytes - pickedBytes);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    // 읽기 전에 크기부터 본다 — 큰 파일을 메모리에 올렸다가 거절하면 낭비다.
    const check = checkAttachments(usedBytes + pickedBytes, list.map((f) => ({ name: f.name, size: f.size })));
    if (!check.ok) {
      onError(check.error ?? '첨부할 수 없습니다.');
      return;
    }
    setBusy(true);
    try {
      const read = await Promise.all(list.map(readFile));
      onChange([...picked, ...read]);
      onError(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : '파일을 읽지 못했습니다.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <Tooltip
          text={`파일을 붙입니다. 한 개당 ${formatBytes(MAX_ATTACHMENT_BYTES)} 까지, 회사 전체 ${formatBytes(
            ATTACHMENT_BUDGET_BYTES,
          )} 까지 — 서버가 없어 브라우저에 저장되기 때문입니다.`}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-md border border-stone-600 px-2 py-1 text-[11px] text-stone-300 transition-colors hover:border-gold hover:text-gold disabled:opacity-40"
          >
            {busy ? '읽는 중…' : '📎 파일'}
          </button>
        </Tooltip>
        <span className="text-[10px] text-stone-600">남은 용량 {formatBytes(left)}</span>
      </div>

      {picked.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-700 bg-stone-900/70 px-2 py-1 text-[10px] text-stone-300"
            >
              <span>{fileGlyph(a.mime, a.name)}</span>
              <span>{shortName(a.name)}</span>
              <span className="text-stone-600">{formatBytes(a.size)}</span>
              <button
                type="button"
                aria-label={`${a.name} 빼기`}
                onClick={() => onChange(picked.filter((x) => x.id !== a.id))}
                className="text-stone-500 hover:text-ember"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────── 보는 쪽 (보낸 뒤) ─────────────────────── */

export function AttachmentList({ items }: { items: Attachment[] }) {
  const [zoom, setZoom] = useState<Attachment | null>(null);

  return (
    <>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-700 bg-stone-950/60 px-2 py-1 text-[10px]"
          >
            {isImage(a.mime) ? (
              <button
                type="button"
                onClick={() => setZoom(a)}
                title={`${a.name} — 눌러서 크게 보기`}
                className="flex items-center gap-1.5"
              >
                <img src={a.dataUrl} alt={a.name} className="h-8 w-8 rounded object-cover" />
                <span className="text-stone-300">{shortName(a.name, 16)}</span>
              </button>
            ) : (
              <span className="flex items-center gap-1.5">
                <span>{fileGlyph(a.mime, a.name)}</span>
                <span className="text-stone-300">{shortName(a.name, 18)}</span>
              </span>
            )}
            <span className="text-stone-600">{formatBytes(a.size)}</span>
            <Tooltip text="파일로 저장합니다. 미리보기 화면에서는 브라우저가 저장을 막을 수 있습니다 — 그때는 배포본이나 로컬 실행에서 받으세요.">
              <button type="button" onClick={() => saveAttachment(a)} className="text-gold hover:text-gold-soft">
                받기
              </button>
            </Tooltip>
          </span>
        ))}
      </div>

      {zoom ? (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-stone-950/90 p-6"
          role="dialog"
          aria-label={`${zoom.name} 크게 보기`}
          onClick={() => setZoom(null)}
        >
          <div className="max-h-full max-w-3xl overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.dataUrl} alt={zoom.name} className="max-h-[75vh] rounded-lg" />
            <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-stone-400">
              <span>
                {zoom.name} · {formatBytes(zoom.size)}
              </span>
              <span className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => saveAttachment(zoom)}>
                  파일로 저장
                </Button>
                <Button size="sm" variant="quiet" onClick={() => setZoom(null)}>
                  닫기
                </Button>
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
