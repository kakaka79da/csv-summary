import { describe, expect, it } from 'vitest';
import { canAcceptWork, isBillable, nextAgentState } from '@/state/agentMachine';

describe('캐릭터 상태 머신', () => {
  it('정상적인 업무 흐름을 통과한다', () => {
    let s = nextAgentState('idle', { type: 'ASSIGN' });
    expect(s).toBe('walking');
    s = nextAgentState(s!, { type: 'ARRIVE' });
    expect(s).toBe('thinking');
    s = nextAgentState(s!, { type: 'START_WORK', work: 'fighting' });
    expect(s).toBe('fighting');
    s = nextAgentState(s!, { type: 'COMPLETE' });
    expect(s).toBe('completed');
  });

  it('휴직 중에는 복귀 외 어떤 이벤트도 받지 않는다', () => {
    expect(nextAgentState('on_leave', { type: 'ASSIGN' })).toBeNull();
    expect(nextAgentState('on_leave', { type: 'START_WORK', work: 'writing' })).toBeNull();
    expect(nextAgentState('on_leave', { type: 'REST' })).toBeNull();
    expect(nextAgentState('on_leave', { type: 'RETURN' })).toBe('idle');
  });

  it('작업 중에는 바로 휴직시킬 수 없고, 먼저 중단해야 한다', () => {
    expect(nextAgentState('fighting', { type: 'LEAVE' })).toBeNull();
    const stopped = nextAgentState('fighting', { type: 'STOP' });
    expect(stopped).toBe('idle');
    expect(nextAgentState(stopped!, { type: 'LEAVE' })).toBe('on_leave');
  });

  it('도착하지 않은 상태에서 작업을 시작할 수 없다', () => {
    expect(nextAgentState('idle', { type: 'START_WORK', work: 'writing' })).toBeNull();
    expect(nextAgentState('resting', { type: 'START_WORK', work: 'writing' })).toBeNull();
  });

  it('승인 대기 상태는 승인을 받아야만 풀린다', () => {
    const waiting = nextAgentState('fighting', { type: 'NEED_APPROVAL' });
    expect(waiting).toBe('awaiting_approval');
    expect(nextAgentState(waiting!, { type: 'START_WORK', work: 'fighting' })).toBeNull();
    expect(nextAgentState(waiting!, { type: 'APPROVED' })).toBe('walking');
  });

  it('휴식·낚시·놀이는 비용이 발생하는 상태가 아니다', () => {
    for (const s of ['idle', 'resting', 'playing', 'fishing', 'on_leave'] as const) {
      expect(isBillable(s)).toBe(false);
    }
    for (const s of ['fighting', 'writing', 'mailing', 'collaborating', 'thinking', 'working'] as const) {
      expect(isBillable(s)).toBe(true);
    }
  });

  it('업무를 받을 수 있는 상태를 정확히 구분한다', () => {
    expect(canAcceptWork('idle')).toBe(true);
    expect(canAcceptWork('resting')).toBe(true);
    expect(canAcceptWork('completed')).toBe(true);
    expect(canAcceptWork('on_leave')).toBe(false);
    expect(canAcceptWork('awaiting_approval')).toBe(false);
    expect(canAcceptWork('fighting')).toBe(false);
    expect(canAcceptWork('error')).toBe(false);
  });
});
