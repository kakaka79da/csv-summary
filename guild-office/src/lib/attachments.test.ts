import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_BUDGET_BYTES,
  MAX_ATTACHMENT_BYTES,
  checkAttachments,
  fileGlyph,
  formatBytes,
  isImage,
  shortName,
  usedBytes,
} from '@/lib/attachments';

describe('formatBytes', () => {
  it('단위를 크기에 맞게 고른다', () => {
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(2048)).toBe('2KB');
    expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5MB');
  });
});

describe('checkAttachments', () => {
  it('상한 안쪽이면 받아들인다', () => {
    expect(checkAttachments(0, [{ name: 'a.png', size: 1000 }]).ok).toBe(true);
  });

  it('파일 하나가 상한을 넘으면 거절하고 이유를 말한다', () => {
    const r = checkAttachments(0, [{ name: '큰파일.zip', size: MAX_ATTACHMENT_BYTES + 1 }]);
    expect(r.ok).toBe(false);
    // 무엇이 문제인지, 어떻게 하면 되는지가 문장에 들어 있어야 한다
    expect(r.error).toContain('큰파일.zip');
    expect(r.error).toContain('드라이브');
  });

  it('전체 예산을 넘으면 거절한다', () => {
    const r = checkAttachments(ATTACHMENT_BUDGET_BYTES - 100, [{ name: 'a.png', size: 1000 }]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain('남은 용량');
  });

  it('여러 개를 한꺼번에 올릴 때는 합계로 본다', () => {
    const half = Math.floor(ATTACHMENT_BUDGET_BYTES / 2);
    // 각각은 상한 안쪽이지만 합치면 예산을 넘는 경우
    const files = [
      { name: 'a', size: MAX_ATTACHMENT_BYTES },
      { name: 'b', size: MAX_ATTACHMENT_BYTES },
    ];
    expect(checkAttachments(half + MAX_ATTACHMENT_BYTES, files).ok).toBe(false);
  });

  it('빈 목록은 통과시킨다 (첨부 없이 보내는 경우)', () => {
    expect(checkAttachments(0, []).ok).toBe(true);
  });
});

describe('usedBytes', () => {
  it('원본 크기의 합을 센다', () => {
    const a = (size: number) => ({ id: 'x', name: 'n', mime: 'text/plain', size, dataUrl: '', ts: 0 });
    expect(usedBytes([a(100), a(250)])).toBe(350);
    expect(usedBytes([])).toBe(0);
  });
});

describe('isImage / fileGlyph', () => {
  it('이미지를 구분한다', () => {
    expect(isImage('image/png')).toBe(true);
    expect(isImage('application/pdf')).toBe(false);
  });

  it('확장자로도 종류를 알아본다', () => {
    expect(fileGlyph('image/jpeg', 'a.jpg')).toBe('🖼');
    expect(fileGlyph('application/pdf', 'a.pdf')).toBe('📕');
    expect(fileGlyph('application/octet-stream', '보고서.xlsx')).toBe('📊');
    expect(fileGlyph('application/octet-stream', '자료.zip')).toBe('🗜');
    expect(fileGlyph('application/octet-stream', '무엇')).toBe('📎');
  });
});

describe('shortName', () => {
  it('짧은 이름은 그대로 둔다', () => {
    expect(shortName('a.png')).toBe('a.png');
  });

  it('길면 가운데를 줄이되 확장자는 남긴다', () => {
    const s = shortName('아주아주아주아주아주아주긴이름의파일.xlsx', 16);
    expect(s.endsWith('.xlsx')).toBe(true);
    expect(s).toContain('…');
    expect(s.length).toBeLessThanOrEqual(16);
  });
});
