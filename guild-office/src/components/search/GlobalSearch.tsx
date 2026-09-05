/**
 * 통합 검색.
 *
 * 채팅·미션·사원·일정·감사 로그가 쌓이면 찾을 방법이 없다는 것이 대표 쪽에서 나온
 * 건의였다. 데이터가 전부 메모리에 있으므로 서버 없이도 지금 만들 수 있다.
 *
 * 규칙 두 가지:
 *  - **볼 수 있는 것만 검색된다.** 사원은 자기 1:1 과 자기가 속한 방만 찾을 수 있다.
 *    검색이 권한의 구멍이 되면 안 된다.
 *  - 종류별로 묶어서 보여 준다. 한 줄로 섞으면 무엇을 찾았는지 알기 어렵다.
 */
import { useMemo, useState } from 'react';
import { useWorld, ROOM_ALL_ID } from '@/state/store';
import { clock } from '@/lib/format';
import { SCHEDULE_KIND_LABEL, shortDay } from '@/lib/schedule';
import { Badge, TextInput } from '@/components/ui/primitives';

type Hit = { kind: string; title: string; sub: string; ts?: number };

const KIND_TONE: Record<string, 'gold' | 'arcane' | 'vital' | 'neutral'> = {
  미션: 'gold',
  채팅: 'arcane',
  '1:1': 'arcane',
  사원: 'vital',
  일정: 'gold',
  '감사 로그': 'neutral',
};

export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const session = useWorld((s) => s.session);
  const missions = useWorld((s) => s.missions);
  const missionOrder = useWorld((s) => s.missionOrder);
  const chatRooms = useWorld((s) => s.chatRooms);
  const chatRoomMessages = useWorld((s) => s.chatRoomMessages);
  const staffChats = useWorld((s) => s.staffChats);
  const humanStaff = useWorld((s) => s.humanStaff);
  const schedule = useWorld((s) => s.schedule);
  const auditLog = useWorld((s) => s.audit);

  const isCeo = session?.role === 'ceo';
  const myStaffId = session?.role === 'human_staff' ? (session.humanStaffId ?? null) : null;

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const has = (...parts: Array<string | null | undefined>) =>
      parts.some((p) => (p ?? '').toLowerCase().includes(needle));
    const out: Hit[] = [];

    for (const id of missionOrder) {
      const m = missions[id];
      if (m && has(m.name, m.objective)) {
        out.push({ kind: '미션', title: m.name, sub: m.objective, ts: m.createdAt });
      }
    }

    for (const roomId of Object.keys(chatRoomMessages)) {
      const room = chatRooms[roomId];
      if (!room) continue;
      // 사원은 자기가 속한 방(과 전사 공용)만 검색할 수 있다.
      const visible =
        isCeo || room.kind === 'company_wide' || roomId === ROOM_ALL_ID || (myStaffId ? room.memberIds.includes(myStaffId) : false);
      if (!visible) continue;
      for (const m of chatRoomMessages[roomId] ?? []) {
        if (has(m.text, m.authorName)) {
          out.push({ kind: '채팅', title: `${room.name} · ${m.authorName}`, sub: m.text, ts: m.ts });
        }
      }
    }

    for (const [staffId, list] of Object.entries(staffChats)) {
      if (!isCeo && staffId !== myStaffId) continue;
      const who = humanStaff[staffId]?.name ?? staffId;
      for (const m of list) {
        if (has(m.text, m.authorName)) {
          out.push({ kind: '1:1', title: `${who} · ${m.authorName}`, sub: m.text, ts: m.ts });
        }
      }
    }

    for (const r of Object.values(humanStaff)) {
      // 이메일은 대표만 검색할 수 있다 — 사원끼리 명부를 훑게 두지 않는다.
      if (has(r.name, r.role, r.currentTaskNote, isCeo ? r.email : null)) {
        out.push({ kind: '사원', title: r.name, sub: `${r.role} · ${r.currentTaskNote ?? '업무 노트 없음'}` });
      }
    }

    for (const e of schedule) {
      if (has(e.title, e.note)) {
        out.push({
          kind: '일정',
          title: `${SCHEDULE_KIND_LABEL[e.kind].icon} ${e.title}`,
          sub: `${shortDay(e.startDay)} ~ ${shortDay(e.endDay)}${e.note ? ` · ${e.note}` : ''}`,
        });
      }
    }

    if (isCeo) {
      for (const a of auditLog) {
        if (has(a.action, a.target, a.detail, a.actor)) {
          out.push({ kind: '감사 로그', title: `${a.actor} — ${a.action}`, sub: `${a.target} ${a.detail}`, ts: a.ts });
        }
      }
    }

    return out.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)).slice(0, 60);
  }, [q, missions, missionOrder, chatRooms, chatRoomMessages, staffChats, humanStaff, schedule, auditLog, isCeo, myStaffId]);

  const groups = useMemo(() => {
    const byKind = new Map<string, Hit[]>();
    for (const h of hits) {
      const list = byKind.get(h.kind) ?? [];
      list.push(h);
      byKind.set(h.kind, list);
    }
    return [...byKind.entries()];
  }, [hits]);

  return (
    <div className="space-y-3">
      <TextInput
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="이름 · 미션 · 채팅 내용 · 일정으로 찾기 (두 글자 이상)"
      />

      {q.trim().length < 2 ? (
        <p className="text-[11px] text-stone-600">
          두 글자 이상 입력하면 찾기 시작합니다. {isCeo ? '대표는 감사 로그까지 함께 찾습니다.' : '본인이 볼 수 있는 것만 찾습니다.'}
        </p>
      ) : hits.length === 0 ? (
        <p className="text-[11px] text-stone-600">찾은 것이 없습니다.</p>
      ) : (
        <>
          <p className="text-[11px] text-stone-500">{hits.length}건 (최근 순, 최대 60건)</p>
          <div className="space-y-3">
            {groups.map(([kind, list]) => (
              <div key={kind}>
                <div className="mb-1 flex items-center gap-2">
                  <Badge tone={KIND_TONE[kind] ?? 'neutral'}>{kind}</Badge>
                  <span className="text-[10px] text-stone-600">{list.length}건</span>
                </div>
                <div className="space-y-1">
                  {list.map((h, i) => (
                    <div key={`${kind}-${i}`} className="rounded-lg border border-stone-800 px-2.5 py-1.5 text-[11px]">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-stone-200">{h.title}</span>
                        {h.ts ? <span className="shrink-0 text-stone-600">{clock(h.ts)}</span> : null}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-stone-500">{h.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
