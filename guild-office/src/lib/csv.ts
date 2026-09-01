/**
 * 아주 작은 CSV 내보내기 유틸.
 *
 * ⚠️ 이 파일이 만드는 다운로드는 일반 브라우저 배포/로컬 실행 환경에서 동작한다.
 * claude.ai Artifact 미리보기의 iframe 샌드박스는 스크립트가 발생시키는 다운로드를
 * 차단하므로, 그 미리보기 안에서는 버튼을 눌러도 파일이 저장되지 않을 수 있다.
 */

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(rows: Array<Array<string | number>>): string {
  return rows.map((row) => row.map((cell) => csvCell(String(cell))).join(',')).join('\r\n');
}

/** UTF-8 BOM 을 붙여 엑셀에서 한글이 깨지지 않게 한다. */
export function downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
  const csv = toCsv(rows);
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8;'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** ts(ms) → 'YYYY-MM', 로컬 타임존 기준. */
export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
