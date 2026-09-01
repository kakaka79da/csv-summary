/**
 * 대사 말풍선 로직만 순수 함수로 뽑아서 검증한다. 실제 렌더링(SVG)은 다루지 않는다.
 */
import { describe, expect, it } from 'vitest';
import { BUBBLE_MS, bubbleText, ceoBubble, ownBubble } from '@/components/office/OfficeCanvas';
import type { Message } from '@/types';

function msg(over: Partial<Message>): Message {
  return {
    id: 'msg_1',
    employeeId: 'emp_admin',
    from: 'agent',
    kind: 'chat',
    text: '안녕하세요',
    ts: Date.now(),
    ...over,
  };
}

describe('bubbleText', () => {
  it('짧은 문장은 그대로 둔다', () => {
    expect(bubbleText('안녕하세요')).toBe('안녕하세요');
  });

  it('긴 문장은 잘라내고 말줄임표를 붙인다', () => {
    const long = 'ㄱ'.repeat(50);
    const out = bubbleText(long, 34);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(34);
  });

  it('줄바꿈은 공백으로 합쳐 한 줄로 만든다', () => {
    expect(bubbleText('첫 줄\n\n둘째 줄')).toBe('첫 줄 둘째 줄');
  });
});

describe('ownBubble', () => {
  it('직원 자신의 최근 대사만 보여준다 (대표 발화는 제외)', () => {
    const now = Date.now();
    const msgs = [msg({ from: 'agent', text: '옛날 인사', ts: now - 60_000 }), msg({ from: 'ceo', text: '요청', ts: now - 100 })];
    expect(ownBubble(msgs, now)).toBeNull(); // 마지막이 대표 발화이므로 없음
  });

  it('직원의 최근 발화가 시간 안이면 보여준다', () => {
    const now = Date.now();
    const msgs = [msg({ from: 'ceo', ts: now - 5000 }), msg({ from: 'agent', text: '확인했습니다', ts: now - 100 })];
    const b = ownBubble(msgs, now);
    expect(b?.text).toBe('확인했습니다');
    expect(b?.warn).toBe(false);
  });

  it('경고 메시지는 warn 플래그가 켜진다', () => {
    const now = Date.now();
    const msgs = [msg({ from: 'agent', kind: 'warning', text: '버그를 발견했습니다', ts: now - 100 })];
    expect(ownBubble(msgs, now)?.warn).toBe(true);
  });

  it('오래된 대사는 시간이 지나면 사라진다', () => {
    const now = Date.now();
    const msgs = [msg({ from: 'agent', ts: now - (BUBBLE_MS + 1) })];
    expect(ownBubble(msgs, now)).toBeNull();
  });

  it('빈 스레드는 null', () => {
    expect(ownBubble([], Date.now())).toBeNull();
    expect(ownBubble(undefined, Date.now())).toBeNull();
  });
});

describe('ceoBubble', () => {
  it('여러 직원 스레드 중 대표가 가장 최근에 남긴 말을 고른다', () => {
    const now = Date.now();
    const chats: Record<string, Message[]> = {
      emp_admin: [msg({ from: 'ceo', text: '오래된 지시', ts: now - 5000 })],
      emp_engineer: [msg({ from: 'ceo', text: '최근 지시', ts: now - 200 })],
      emp_professor: [msg({ from: 'agent', text: '무관한 답장', ts: now - 50 })],
    };
    expect(ceoBubble(chats, ['emp_admin', 'emp_engineer', 'emp_professor'], now)).toBe('최근 지시');
  });

  it('대표가 아무 말도 안 했으면 null', () => {
    const now = Date.now();
    const chats: Record<string, Message[]> = { emp_admin: [msg({ from: 'agent', ts: now - 100 })] };
    expect(ceoBubble(chats, ['emp_admin'], now)).toBeNull();
  });
});
