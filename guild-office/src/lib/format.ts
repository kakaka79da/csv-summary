/** 표시용 포맷터와 짧은 유틸. 비즈니스 로직은 넣지 않는다. */
import type { AgentState, Company, Difficulty, MissionStatus } from '@/types';

let counter = 0;
/** 결정적이면서 충돌하지 않는 ID. 테스트에서 재현 가능하도록 순번을 쓴다. */
export function nid(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** 표시 전용 환산율. 실제 청구는 항상 USD 기준이며 이 값은 참고용이다. */
export const DISPLAY_FX: Record<Company['currency'], { rate: number; symbol: string }> = {
  USD: { rate: 1, symbol: '$' },
  KRW: { rate: 1380, symbol: '₩' },
  JPY: { rate: 157, symbol: '¥' },
  EUR: { rate: 0.92, symbol: '€' },
};

export function usd(v: number): string {
  return `$${v < 1 ? v.toFixed(3) : v.toFixed(2)}`;
}

/** USD 금액을 회사 기본 통화로 함께 보여준다. */
export function money(v: number, currency: Company['currency']): string {
  if (currency === 'USD') return usd(v);
  const { rate, symbol } = DISPLAY_FX[currency];
  const converted = Math.round(v * rate);
  return `${usd(v)} (≈ ${symbol}${converted.toLocaleString('ko-KR')})`;
}

export function duration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}초`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

export function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour12: false });
}

/**
 * 캐릭터 상태의 한국어 라벨.
 * 게임 연출을 쓰더라도 실제 업무 상태를 오해하지 않도록 항상 함께 표기한다.
 */
export const AGENT_STATE_LABEL: Record<AgentState, { game: string; real: string }> = {
  idle: { game: '대기', real: '대기 중 (작업 없음)' },
  walking: { game: '이동', real: '이동 중' },
  thinking: { game: '사색', real: '분석 준비 중' },
  working: { game: '작업', real: '작업 중' },
  writing: { game: '기록', real: '문서 작성 중' },
  mailing: { game: '전령', real: '보고/발송 중' },
  collaborating: { game: '협공', real: '협업 중' },
  fighting: { game: '전투', real: '업무 수행 중 (분석/처리)' },
  fishing: { game: '낚시', real: '장기 유휴 (비용 발생 없음)' },
  resting: { game: '휴식', real: '휴식 중 (비용 발생 없음)' },
  playing: { game: '유희', real: '자유 행동 (비용 발생 없음)' },
  awaiting_approval: { game: '봉인 대기', real: '대표 승인 대기 중' },
  on_leave: { game: '원정 부재', real: '휴직 중 (업무 배정 차단)' },
  completed: { game: '개선', real: '업무 완료' },
  error: { game: '장비 이상', real: '오류 발생 — 확인 필요' },
};

export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  draft: '작성 중',
  awaiting_approval: '대표 승인 대기',
  queued: '대기열',
  in_progress: '진행 중',
  blocked: '중단됨 (승인/예산 필요)',
  reporting: '최종 보고 중',
  review: '대표 검토 대기',
  completed: '완료',
  failed: '실패',
  cancelled: '취소됨',
};

export const DIFFICULTY_LABEL: Record<Difficulty, { game: string; real: string }> = {
  normal: { game: '일반 몬스터', real: '일반 업무' },
  elite: { game: '정예 몬스터', real: '복잡한 업무' },
  boss: { game: '보스 몬스터', real: '대규모 프로젝트' },
  raid: { game: '레이드', real: '다중 협업 대형 프로젝트' },
};

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
