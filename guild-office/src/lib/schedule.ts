/**
 * 일정 · 타임라인 — 순수 계산.
 *
 * 날짜는 `YYYY-MM-DD` 문자열로만 다룬다. Date 객체를 상태에 넣으면 시간대에 따라
 * "하루 밀리는" 버그가 생긴다 — 지사가 여러 나라에 있는 이 앱에서는 특히 그렇다.
 * 일정은 "그 날짜"이지 "그 순간"이 아니므로, 날짜 문자열이 맞는 표현이다.
 */
import type { Branch, Mission, ScheduleEvent, ScheduleKind } from '@/types';

export const SCHEDULE_KIND_LABEL: Record<ScheduleKind, { ko: string; icon: string }> = {
  project: { ko: '프로젝트', icon: '📐' },
  meeting: { ko: '회의', icon: '🗣' },
  deadline: { ko: '마감', icon: '⏳' },
  holiday: { ko: '휴무', icon: '🏖' },
  trip: { ko: '출장', icon: '✈️' },
  other: { ko: '기타', icon: '•' },
};

export const SCHEDULE_KINDS: ScheduleKind[] = ['project', 'meeting', 'deadline', 'holiday', 'trip', 'other'];

/* ─────────────────────────── 날짜 도우미 ─────────────────────────── */

/** 로컬 기준 오늘 (YYYY-MM-DD). UTC 로 바꾸면 새벽에 날짜가 어긋난다. */
export function todayDay(now = new Date()): string {
  return toDay(now);
}

export function toDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 'YYYY-MM-DD' → 로컬 정오의 Date. 정오를 쓰면 서머타임이 있어도 날짜가 밀리지 않는다. */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

/** from 부터 to 까지 며칠인가 (같은 날이면 0) */
export function daysBetween(from: string, to: string): number {
  const ms = parseDay(to).getTime() - parseDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** "9/3 (목)" */
export function shortDay(day: string): string {
  const d = parseDay(day);
  const w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${w})`;
}

export function isWeekend(day: string): boolean {
  const w = parseDay(day).getDay();
  return w === 0 || w === 6;
}

/* ─────────────────────────── 막대 배치 ─────────────────────────── */

export interface Bar {
  event: ScheduleEvent;
  /** 창 안에서 몇 번째 칸부터 (0-based) */
  offset: number;
  /** 몇 칸을 차지하는가 (최소 1) */
  span: number;
  /** 시작이 창 왼쪽 밖에서 잘렸는가 */
  clippedStart: boolean;
  /** 끝이 창 오른쪽 밖으로 이어지는가 */
  clippedEnd: boolean;
}

/**
 * 일정을 [windowStart, windowStart+days) 창에 맞춰 자른다.
 * 창에 걸치지 않는 일정은 아예 돌려주지 않는다.
 */
export function layoutBars(events: ScheduleEvent[], windowStart: string, days: number): Bar[] {
  const out: Bar[] = [];
  for (const e of events) {
    const from = daysBetween(windowStart, e.startDay);
    const to = daysBetween(windowStart, e.endDay);
    // 창 밖(왼쪽으로 완전히 지났거나, 오른쪽으로 아직 안 왔거나)
    if (to < 0 || from > days - 1) continue;
    const offset = Math.max(0, from);
    const end = Math.min(days - 1, to);
    out.push({
      event: e,
      offset,
      span: Math.max(1, end - offset + 1),
      clippedStart: from < 0,
      clippedEnd: to > days - 1,
    });
  }
  // 시작이 빠른 순, 같으면 긴 것 먼저 — 위에서 아래로 읽을 때 자연스럽다.
  return out.sort((a, b) => a.offset - b.offset || b.span - a.span);
}

/* ─────────────────────────── 지사별 묶기 ─────────────────────────── */

/** 화면에서 고른 범위. 'all' 은 회사 전체를 지사별로 나눠 본다. */
export type ScheduleScope = { kind: 'all' } | { kind: 'branch'; branchId: string };

/**
 * 지사 하나를 볼 때 그 화면에 들어갈 일정.
 *
 * **전사 공용 일정(branchId === null)은 어느 지사를 보든 함께 보인다.**
 * 본사를 봐도 마찬가지다 — 그래서 본사 화면은 "전사 공용"과 "본사 내부"가 나뉜다.
 */
export function eventsForBranch(events: ScheduleEvent[], branchId: string): {
  company: ScheduleEvent[];
  own: ScheduleEvent[];
} {
  return {
    company: events.filter((e) => e.branchId === null),
    own: events.filter((e) => e.branchId === branchId),
  };
}

/** 회사 전체 화면용 — 전사 공용 + 지사별 묶음 */
export function groupByBranch(
  events: ScheduleEvent[],
  branches: Branch[],
): Array<{ key: string; label: string; events: ScheduleEvent[] }> {
  const groups: Array<{ key: string; label: string; events: ScheduleEvent[] }> = [
    { key: 'company', label: '전사 공용', events: events.filter((e) => e.branchId === null) },
  ];
  for (const b of branches) {
    groups.push({ key: b.id, label: b.name, events: events.filter((e) => e.branchId === b.id) });
  }
  // 일정이 하나도 없는 지사는 빈 줄로 남기지 않는다 — 화면이 빈칸으로 길어질 뿐이다.
  return groups.filter((g) => g.events.length > 0);
}

/* ─────────────────── 미션 → 타임라인 막대 ─────────────────── */

/**
 * 진행 중인 미션을 일정 막대로 바꾼다(읽기 전용).
 *
 * 미션에는 마감일이 없고 예상 소요 시간(estSeconds)만 있다. 없는 마감일을 지어내지
 * 않으려고, **시작일 + 예상 소요**를 그대로 끝일로 쓰고 제목에 "예상"이라고 밝힌다.
 */
export function missionsToEvents(missions: Mission[], branchId: string | null = null): ScheduleEvent[] {
  return missions
    .filter((m) => m.status !== 'draft' && m.startedAt !== null)
    .map((m) => {
      const start = toDay(new Date(m.startedAt as number));
      // 마감일이 정해져 있으면 그것을 쓴다. 없을 때만 예상 소요로 끝을 잡고
      // 제목에 "예상"이라고 밝힌다 — 없는 마감일을 지어내지 않기 위해서다.
      const endTs = (m.finishedAt ?? (m.startedAt as number) + m.estSeconds * 1000) as number;
      const fallbackEnd = toDay(new Date(Math.max(endTs, m.startedAt as number)));
      const end = m.dueDay ?? fallbackEnd;
      const guessed = !m.finishedAt && !m.dueDay;
      return {
        id: `mission:${m.id}`,
        title: guessed ? `${m.name} (예상)` : m.name,
        kind: 'project' as ScheduleKind,
        branchId,
        startDay: start,
        endDay: end,
        note: m.objective,
        ownerName: m.requester,
        createdBy: m.requester,
        createdAt: m.createdAt,
        derived: true,
      };
    });
}

/** 일정이 유효한가. 끝이 시작보다 앞서면 안 된다. */
export function validateEvent(input: { title: string; startDay: string; endDay: string }): {
  ok: boolean;
  error?: string;
} {
  if (!input.title.trim()) return { ok: false, error: '일정 이름을 입력하세요.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDay) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDay)) {
    return { ok: false, error: '날짜 형식이 올바르지 않습니다.' };
  }
  if (daysBetween(input.startDay, input.endDay) < 0) {
    return { ok: false, error: '끝나는 날이 시작하는 날보다 앞설 수 없습니다.' };
  }
  return { ok: true };
}
