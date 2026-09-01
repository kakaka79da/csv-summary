/**
 * 캐릭터 상태 머신.
 *
 * 이 파일의 목적은 단 하나 — "애니메이션만 바뀌고 실제 업무 상태는 그대로"인
 * 상황을 구조적으로 불가능하게 만드는 것이다.
 * 화면은 employee.state 를 그리기만 하고, employee.state 는 오직 이 전이표를
 * 통과한 이벤트로만 바뀐다. 불법 전이는 null 을 돌려주므로 조용히 무시되지 않는다.
 */
import type { AgentState } from '@/types';

export type AgentEvent =
  | { type: 'ASSIGN' } //            업무 배정 → 목적지로 이동 시작
  | { type: 'GO' } //                업무와 무관한 이동(휴게실·낚시터 등) 시작
  | { type: 'ARRIVE' } //            목적지 도착
  | { type: 'START_WORK'; work: WorkState } // 실제 작업 시작
  | { type: 'NEED_APPROVAL' } //     대표 승인 필요 → 대기
  | { type: 'APPROVED' } //          승인 완료 → 작업 재개 준비
  | { type: 'HANDOFF' } //           산출물을 다른 직원에게 전달
  | { type: 'REPORT' } //            대표에게 보고
  | { type: 'COMPLETE' } //          업무 완료
  | { type: 'STOP' } //              대표가 업무 중단
  | { type: 'FAIL'; reason: string } // 오류
  | { type: 'RECOVER' } //           오류 해소
  | { type: 'REST' }
  | { type: 'PLAY' }
  | { type: 'FISH' }
  | { type: 'RESUME' } //            자유 행동 종료 → 대기
  | { type: 'LEAVE' } //             휴직 승인
  | { type: 'RETURN' }; //           복귀 승인

export type WorkState = Extract<
  AgentState,
  'fighting' | 'writing' | 'collaborating' | 'mailing' | 'thinking' | 'working'
>;

/** 자유 행동(비용이 발생하지 않는 상태) */
export const FREE_STATES: AgentState[] = ['idle', 'resting', 'playing', 'fishing'];

/** 실제로 API 비용이 발생할 수 있는 상태 */
export const BILLABLE_STATES: AgentState[] = [
  'thinking',
  'working',
  'writing',
  'mailing',
  'collaborating',
  'fighting',
];

export function isBillable(state: AgentState): boolean {
  return BILLABLE_STATES.includes(state);
}

/**
 * 전이 함수. 허용되지 않는 전이는 null.
 * 호출부는 null 을 받으면 감사 로그에 경고를 남기고 상태를 바꾸지 않는다.
 */
export function nextAgentState(current: AgentState, event: AgentEvent): AgentState | null {
  // 휴직 중에는 복귀 외 어떤 이벤트도 받지 않는다.
  if (current === 'on_leave') {
    return event.type === 'RETURN' ? 'idle' : null;
  }

  switch (event.type) {
    case 'LEAVE':
      // 작업 중에는 바로 휴직시키지 않는다. 먼저 중단해야 한다.
      return FREE_STATES.includes(current) || current === 'completed' || current === 'error'
        ? 'on_leave'
        : null;

    case 'RETURN':
      return null; // on_leave 가 아니면 복귀할 것이 없다

    case 'ASSIGN':
      // 대기/자유행동/완료 상태에서만 새 업무를 받는다.
      return FREE_STATES.includes(current) || current === 'completed' ? 'walking' : null;

    case 'GO':
      // 업무가 아닌 이동. 자유 행동 중이거나 방금 업무를 마친 경우에만 허용한다.
      return FREE_STATES.includes(current) || current === 'completed' ? 'walking' : null;

    case 'ARRIVE':
      return current === 'walking' ? 'thinking' : null;

    case 'START_WORK':
      return current === 'thinking' || current === 'walking' ? event.work : null;

    case 'NEED_APPROVAL':
      // 승인이 필요해지는 시점은 이동 중/사색 중/작업 중 모두 가능하다.
      return current === 'awaiting_approval'
        ? null
        : ['walking', 'thinking', ...BILLABLE_STATES].includes(current)
          ? 'awaiting_approval'
          : null;

    case 'APPROVED':
      return current === 'awaiting_approval' ? 'walking' : null;

    case 'HANDOFF':
      return isBillable(current) ? 'collaborating' : null;

    case 'REPORT':
      return isBillable(current) || current === 'walking' ? 'mailing' : null;

    case 'COMPLETE':
      return isBillable(current) ? 'completed' : null;

    case 'STOP':
      // 언제든 중단 가능. 중단하면 대기로 돌아간다.
      return current === 'idle' ? null : 'idle';

    case 'FAIL':
      return current === 'error' ? null : 'error';

    case 'RECOVER':
      return current === 'error' ? 'idle' : null;

    // 휴식/놀이/낚시는 목적지까지 걸어간 뒤에 확정되므로 walking/thinking 에서도 진입한다.
    case 'REST':
      return ['idle', 'completed', 'walking', 'thinking'].includes(current) ? 'resting' : null;

    case 'PLAY':
      return ['idle', 'resting', 'walking', 'thinking'].includes(current) ? 'playing' : null;

    case 'FISH':
      return ['idle', 'resting', 'playing', 'walking', 'thinking'].includes(current)
        ? 'fishing'
        : null;

    case 'RESUME':
      return FREE_STATES.includes(current) && current !== 'idle' ? 'idle' : null;

    default:
      return null;
  }
}

/** 업무 배정이 가능한 상태인지 (휴직·오류·승인대기·작업중 제외) */
export function canAcceptWork(state: AgentState): boolean {
  return FREE_STATES.includes(state) || state === 'completed';
}
