/**
 * 채팅 파일 첨부 — 크기 규칙과 표시 도우미.
 *
 * 이 앱에는 서버가 없다. 그래서 첨부 파일은 브라우저 안(localStorage)에만 들어간다.
 * localStorage 는 브라우저당 대략 5~10MB 이고, base64 로 담으면 원본보다 약 1.37배로
 * 부푼다. 한도를 넘기면 저장이 **조용히 실패**하면서 그동안의 채팅까지 날아갈 수 있다.
 *
 * 그래서 여기서 두 겹으로 막는다.
 *   1) 파일 하나당 크기 상한
 *   2) 회사 전체 첨부 용량 예산
 * 넘으면 올리기를 **거절하고 이유를 말한다**. 조용히 실패하게 두지 않는다.
 *
 * 큰 파일은 구글 드라이브 폴더에 두고 링크를 붙이는 것이 맞는 방법이며,
 * 화면에서도 그렇게 안내한다.
 */
import type { Attachment } from '@/types';

export type { Attachment };


/** 파일 하나당 상한 (원본 기준) */
export const MAX_ATTACHMENT_BYTES = 512 * 1024;

/** 회사 전체 첨부 용량 예산 (원본 기준). base64 로 부푸는 몫까지 감안해 보수적으로 잡았다. */
export const ATTACHMENT_BUDGET_BYTES = 2 * 1024 * 1024;

/** base64 로 담을 때 늘어나는 비율 (4/3 + 헤더 여유) */
export const BASE64_OVERHEAD = 1.37;

/** "1.4MB" 처럼 읽기 좋게. 소수점은 1MB 미만에서만 뗀다. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / (1024 * 1024)).toFixed(1)}MB`;
}

/** 지금까지 쓴 첨부 용량 (원본 기준) */
export function usedBytes(all: Attachment[]): number {
  return all.reduce((sum, a) => sum + a.size, 0);
}

export interface SizeCheck {
  ok: boolean;
  error?: string;
}

/**
 * 새 첨부를 받아들일 수 있는지 본다.
 * 거절할 때는 **무엇이 문제이고 어떻게 하면 되는지**까지 문장으로 돌려준다.
 */
export function checkAttachments(alreadyUsed: number, incoming: Array<{ name: string; size: number }>): SizeCheck {
  for (const f of incoming) {
    if (f.size > MAX_ATTACHMENT_BYTES) {
      return {
        ok: false,
        error: `"${f.name}" 은(는) ${formatBytes(f.size)} 로 파일 하나당 상한 ${formatBytes(
          MAX_ATTACHMENT_BYTES,
        )} 를 넘습니다. 큰 파일은 회사 구글 드라이브 폴더에 올리고 링크를 붙여 주세요.`,
      };
    }
  }
  const incomingTotal = incoming.reduce((s, f) => s + f.size, 0);
  if (alreadyUsed + incomingTotal > ATTACHMENT_BUDGET_BYTES) {
    const left = Math.max(0, ATTACHMENT_BUDGET_BYTES - alreadyUsed);
    return {
      ok: false,
      error: `회사 전체 첨부 용량이 부족합니다. 남은 용량 ${formatBytes(left)}, 올리려는 크기 ${formatBytes(
        incomingTotal,
      )}. 오래된 첨부를 지우거나, 큰 파일은 구글 드라이브 폴더를 쓰세요.`,
    };
  }
  return { ok: true };
}

/** 화면에 바로 그려 보여 줄 수 있는 종류인가 (이미지) */
export function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}

/** 파일 종류를 한 글자 기호로. 목록에서 눈으로 구분하기 위한 것이다. */
export function fileGlyph(mime: string, name: string): string {
  if (isImage(mime)) return '🖼';
  if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return '📕';
  if (mime.startsWith('video/')) return '🎞';
  if (mime.startsWith('audio/')) return '🎵';
  if (/\.(zip|7z|tar|gz|rar)$/i.test(name)) return '🗜';
  if (/\.(xlsx?|csv)$/i.test(name)) return '📊';
  if (/\.(docx?|hwpx?|txt|md)$/i.test(name)) return '📄';
  return '📎';
}

/** 너무 긴 파일 이름은 가운데를 줄인다 — 확장자는 남겨야 무슨 파일인지 안다. */
export function shortName(name: string, max = 22): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot) : '';
  const base = dot > 0 ? name.slice(0, dot) : name;
  const keep = Math.max(4, max - ext.length - 1);
  return `${base.slice(0, keep)}…${ext}`;
}
