import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  eventsForBranch,
  groupByBranch,
  isWeekend,
  layoutBars,
  missionsToEvents,
  parseDay,
  shortDay,
  toDay,
  todayDay,
  validateEvent,
} from '@/lib/schedule';
import type { Branch, Mission, ScheduleEvent } from '@/types';

function ev(id: string, startDay: string, endDay: string, branchId: string | null = null): ScheduleEvent {
  return {
    id,
    title: id,
    kind: 'project',
    branchId,
    startDay,
    endDay,
    note: '',
    ownerName: '강민호',
    createdBy: '강민호',
    createdAt: 0,
  };
}

describe('날짜 도우미', () => {
  it('오늘을 로컬 기준으로 만든다', () => {
    const d = new Date(2026, 8, 3, 23, 30); // 9월 3일 밤 11시 반
    // UTC 로 바꿨다면 9월 4일이 됐을 시각인데, 로컬 기준이라 3일이어야 한다
    expect(todayDay(d)).toBe('2026-09-03');
  });

  it('날짜를 더한다 — 달을 넘어가도 맞다', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('윤년 2월도 맞다', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('두 날짜 사이의 일수를 센다', () => {
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0);
    expect(daysBetween('2026-09-01', '2026-09-10')).toBe(9);
    expect(daysBetween('2026-09-10', '2026-09-01')).toBe(-9);
  });

  it('정오로 파싱해 서머타임에도 날짜가 밀리지 않는다', () => {
    expect(parseDay('2026-09-03').getHours()).toBe(12);
    expect(toDay(parseDay('2026-09-03'))).toBe('2026-09-03');
  });

  it('요일을 붙여 짧게 쓴다', () => {
    expect(shortDay('2026-09-03')).toBe('9/3 (목)');
  });

  it('주말을 가려낸다', () => {
    expect(isWeekend('2026-09-05')).toBe(true); // 토
    expect(isWeekend('2026-09-06')).toBe(true); // 일
    expect(isWeekend('2026-09-03')).toBe(false);
  });
});

describe('layoutBars', () => {
  const start = '2026-09-01';

  it('창 안에 들어오는 일정만 자리를 잡는다', () => {
    const bars = layoutBars([ev('a', '2026-09-03', '2026-09-05')], start, 14);
    expect(bars).toHaveLength(1);
    expect(bars[0].offset).toBe(2);
    expect(bars[0].span).toBe(3);
    expect(bars[0].clippedStart).toBe(false);
    expect(bars[0].clippedEnd).toBe(false);
  });

  it('창 왼쪽에서 시작한 일정은 잘라서 표시한다', () => {
    const bars = layoutBars([ev('a', '2026-08-25', '2026-09-03')], start, 14);
    expect(bars[0].offset).toBe(0);
    expect(bars[0].clippedStart).toBe(true);
    expect(bars[0].span).toBe(3);
  });

  it('창 오른쪽으로 이어지는 일정도 잘라서 표시한다', () => {
    const bars = layoutBars([ev('a', '2026-09-12', '2026-09-30')], start, 14);
    expect(bars[0].clippedEnd).toBe(true);
    expect(bars[0].offset + bars[0].span).toBe(14);
  });

  it('창 밖의 일정은 아예 빼놓는다', () => {
    expect(layoutBars([ev('a', '2026-07-01', '2026-07-05')], start, 14)).toHaveLength(0);
    expect(layoutBars([ev('a', '2026-12-01', '2026-12-05')], start, 14)).toHaveLength(0);
  });

  it('하루짜리 일정도 한 칸을 차지한다', () => {
    const bars = layoutBars([ev('a', '2026-09-04', '2026-09-04')], start, 14);
    expect(bars[0].span).toBe(1);
  });

  it('시작이 빠른 순, 같으면 긴 것 먼저 늘어놓는다', () => {
    const bars = layoutBars(
      [ev('짧은', '2026-09-03', '2026-09-03'), ev('긴', '2026-09-03', '2026-09-08'), ev('앞', '2026-09-01', '2026-09-02')],
      start,
      14,
    );
    expect(bars.map((b) => b.event.id)).toEqual(['앞', '긴', '짧은']);
  });
});

describe('지사별 나누기', () => {
  const events = [
    ev('전사공지', '2026-09-01', '2026-09-02', null),
    ev('본사일정', '2026-09-01', '2026-09-02', 'branch_hq'),
    ev('부산일정', '2026-09-01', '2026-09-02', 'branch_busan'),
  ];

  it('본사를 보면 전사 공용과 본사 내부가 나뉜다', () => {
    const r = eventsForBranch(events, 'branch_hq');
    expect(r.company.map((e) => e.id)).toEqual(['전사공지']);
    expect(r.own.map((e) => e.id)).toEqual(['본사일정']);
  });

  it('전사 공용 일정은 어느 지사를 봐도 함께 보인다', () => {
    const busan = eventsForBranch(events, 'branch_busan');
    expect(busan.company.map((e) => e.id)).toEqual(['전사공지']);
    expect(busan.own.map((e) => e.id)).toEqual(['부산일정']);
  });

  it('회사 전체 화면은 전사 공용 + 지사별로 묶고, 빈 지사는 빼놓는다', () => {
    const branches = [
      { id: 'branch_hq', name: '한국 본사' },
      { id: 'branch_busan', name: '부산 지사' },
      { id: 'branch_empty', name: '일정 없는 지사' },
    ] as Branch[];
    const groups = groupByBranch(events, branches);
    expect(groups.map((g) => g.label)).toEqual(['전사 공용', '한국 본사', '부산 지사']);
  });
});

describe('missionsToEvents', () => {
  const base: Mission = {
    id: 'm1',
    name: '탱크 휠 설계',
    objective: '설계안 정리',
    requester: '강민호',
    ownerId: 'e1',
    participants: [],
    difficulty: 'normal',
    priority: 'normal',
    status: 'in_progress',
    steps: [],
    currentStepIndex: 0,
    estCostUsd: 1,
    actualCostUsd: 0,
    estSeconds: 86400 * 2,
    requiresApproval: false,
    approvalId: null,
    loot: [],
    failureReason: null,
    createdAt: new Date(2026, 8, 1).getTime(),
    startedAt: new Date(2026, 8, 2, 9).getTime(),
    finishedAt: null,
    isTutorial: false,
  };

  it('시작한 미션만 막대로 만든다', () => {
    const notStarted = { ...base, startedAt: null, status: 'draft' as const };
    expect(missionsToEvents([notStarted])).toHaveLength(0);
    expect(missionsToEvents([base])).toHaveLength(1);
  });

  it('마감일이 없으므로 예상 소요로 끝을 잡고 제목에 밝힌다', () => {
    const [e] = missionsToEvents([base]);
    expect(e.startDay).toBe('2026-09-02');
    expect(e.endDay).toBe('2026-09-04');
    expect(e.title).toContain('예상');
    expect(e.derived).toBe(true);
  });

  it('끝난 미션은 실제 완료일을 쓰고 "예상"을 붙이지 않는다', () => {
    const done = { ...base, finishedAt: new Date(2026, 8, 3, 18).getTime(), status: 'completed' as const };
    const [e] = missionsToEvents([done]);
    expect(e.endDay).toBe('2026-09-03');
    expect(e.title).not.toContain('예상');
  });

  it('지사를 지정하면 그 지사 소속으로 붙는다', () => {
    const [e] = missionsToEvents([base], 'branch_hq');
    expect(e.branchId).toBe('branch_hq');
  });
});

describe('validateEvent', () => {
  it('이름이 비면 거절한다', () => {
    expect(validateEvent({ title: '  ', startDay: '2026-09-01', endDay: '2026-09-02' }).ok).toBe(false);
  });

  it('끝이 시작보다 앞서면 거절한다', () => {
    const r = validateEvent({ title: '회의', startDay: '2026-09-05', endDay: '2026-09-01' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('앞설 수 없습니다');
  });

  it('같은 날 하루짜리는 허용한다', () => {
    expect(validateEvent({ title: '회의', startDay: '2026-09-05', endDay: '2026-09-05' }).ok).toBe(true);
  });

  it('날짜 형식이 어긋나면 거절한다', () => {
    expect(validateEvent({ title: '회의', startDay: '2026/09/05', endDay: '2026-09-05' }).ok).toBe(false);
  });
});
