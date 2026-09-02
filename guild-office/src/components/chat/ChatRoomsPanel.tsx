/**
 * 부서 단체 채팅방 + 전사 공용 채팅방.
 *
 * 1:1 대화(EmployeePanel 의 chats)와는 완전히 별개다. 대표가 부서 방을 만들고,
 * 초대는 대표가 직접 부르면 즉시 확정되고 사원이 제안하면 대표 승인이 필요하다.
 * "AI 가 초대한다"는 이 앱에 AI 의 자율 행동이 없으므로, 대표가 초대를 만들 때
 * 어떤 AI 직원의 추천으로 표시할지 직접 고르는 방식으로 흉내낸다.
 *
 * AI 직원은 아직 이 단체방에서 스스로 말하지 않는다 — 멤버로만 표시된다.
 */
import { useMemo, useState } from 'react';
import { useWorld, ROOM_ALL_ID } from '@/state/store';
import { clock } from '@/lib/format';
import { Badge, Button, Notice, Select, TextInput } from '@/components/ui/primitives';
import type { ChatRoom, ChatRoomAuthorKind, Employee, HumanStaffRecord } from '@/types';

function resolveMember(
  id: string,
  employees: Record<string, Employee>,
  humanStaff: Record<string, HumanStaffRecord>,
): { id: string; name: string; kind: 'ai' | 'human' } | null {
  if (employees[id]) return { id, name: employees[id].name, kind: 'ai' };
  if (humanStaff[id]) return { id, name: humanStaff[id].name, kind: 'human' };
  return null;
}

export default function ChatRoomsPanel() {
  const session = useWorld((s) => s.session);
  const company = useWorld((s) => s.company);
  const chatRooms = useWorld((s) => s.chatRooms);
  const chatRoomOrder = useWorld((s) => s.chatRoomOrder);
  const [selected, setSelected] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const createTeamRoom = useWorld((s) => s.createTeamRoom);

  if (!company) return null;
  const isCeo = session?.role === 'ceo';
  const activeRoomId = selected ?? ROOM_ALL_ID;
  const activeRoom = chatRooms[activeRoomId];

  return (
    <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
      <div className="space-y-1.5">
        {chatRoomOrder.map((id) => {
          const room = chatRooms[id];
          if (!room) return null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelected(id)}
              className={`block w-full rounded-lg border px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                activeRoomId === id ? 'border-gold bg-stone-800/70' : 'border-stone-700 hover:border-stone-500'
              }`}
            >
              <span className="text-stone-100">{room.kind === 'company_wide' ? '🏢 ' : '💬 '}{room.name}</span>
            </button>
          );
        })}

        {isCeo ? (
          <div className="mt-2 flex gap-1">
            <TextInput
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="새 부서 방 이름"
            />
            <Button
              size="sm"
              hint="입력한 이름으로 부서 채팅방을 만듭니다. 대표만 만들 수 있고, 만든 뒤 멤버를 초대하세요."
              onClick={() => {
                const r = createTeamRoom(newRoomName);
                if (r.ok) {
                  setNewRoomName('');
                  setSelected(r.roomId ?? null);
                }
              }}
            >
              +
            </Button>
          </div>
        ) : null}
      </div>

      {activeRoom ? <RoomThread room={activeRoom} /> : <Notice>방을 선택하세요.</Notice>}
    </div>
  );
}

function RoomThread({ room }: { room: ChatRoom }) {
  const session = useWorld((s) => s.session);
  const employees = useWorld((s) => s.employees);
  const employeeOrder = useWorld((s) => s.employeeOrder);
  const humanStaff = useWorld((s) => s.humanStaff);
  const messages = useWorld((s) => s.chatRoomMessages[room.id]) ?? [];
  const invites = useWorld((s) => s.chatRoomInvites);
  const sendRoomMessage = useWorld((s) => s.sendRoomMessage);
  const proposeRoomInvite = useWorld((s) => s.proposeRoomInvite);
  const decideRoomInvite = useWorld((s) => s.decideRoomInvite);
  const [draft, setDraft] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCeo = session?.role === 'ceo';
  const myHumanId = session?.role === 'human_staff' ? session.humanStaffId ?? null : null;

  const members = useMemo(() => {
    if (room.kind === 'company_wide') {
      const ai = employeeOrder.map((id) => resolveMember(id, employees, humanStaff)).filter((m): m is NonNullable<typeof m> => !!m);
      const human = Object.values(humanStaff)
        .filter((r) => r.status === 'approved')
        .map((r) => ({ id: r.id, name: r.name, kind: 'human' as const }));
      return [...ai, ...human];
    }
    return room.memberIds.map((id) => resolveMember(id, employees, humanStaff)).filter((m): m is NonNullable<typeof m> => !!m);
  }, [room, employees, employeeOrder, humanStaff]);

  const isMember = room.kind === 'company_wide' || (myHumanId ? room.memberIds.includes(myHumanId) : isCeo);
  const canSend = isCeo || (myHumanId && isMember);

  const roomInvites = invites.filter((i) => i.roomId === room.id && i.status === 'pending');

  const nonMembers = useMemo(() => {
    if (room.kind !== 'team') return [];
    const aiOptions = employeeOrder
      .filter((id) => !room.memberIds.includes(id))
      .map((id) => ({ id, name: employees[id]?.name ?? id, kind: 'ai' as const }));
    const humanOptions = Object.values(humanStaff)
      .filter((r) => r.status === 'approved' && !room.memberIds.includes(r.id))
      .map((r) => ({ id: r.id, name: r.name, kind: 'human' as const }));
    return [...aiOptions, ...humanOptions];
  }, [room, employees, employeeOrder, humanStaff]);

  return (
    <div className="rounded-lg border border-stone-800 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm text-stone-100">{room.name}</div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-stone-500">멤버 {members.length}명</span>
          {room.kind === 'team' ? (
            <Button
              size="sm"
              variant="ghost"
              hint="이 방에 AI 직원이나 인간 사원을 부릅니다. 대표가 부르면 즉시 확정, 사원이 제안하면 대표 승인이 필요합니다."
              onClick={() => setInviteOpen((v) => !v)}
            >
              + 초대
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {members.map((m) => (
          <Badge key={m.id} tone={m.kind === 'ai' ? 'arcane' : 'vital'}>
            {m.kind === 'ai' ? '🤖' : '🧑'} {m.name}
          </Badge>
        ))}
      </div>

      {inviteOpen ? (
        <InviteComposer
          roomId={room.id}
          options={nonMembers}
          aiEmployees={employeeOrder.map((id) => ({ id, name: employees[id]?.name ?? id }))}
          isCeo={isCeo}
          onSubmit={(input) => {
            const r = proposeRoomInvite(input);
            if (!r.ok) setError(r.error ?? '제안할 수 없습니다.');
            else {
              setError(null);
              setInviteOpen(false);
            }
          }}
        />
      ) : null}
      {error ? <p className="mb-2 text-[11px] text-ember">{error}</p> : null}

      {roomInvites.length > 0 ? (
        <div className="mb-2 space-y-1">
          {roomInvites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border border-gold/30 bg-stone-950/40 px-2 py-1 text-[11px]">
              <span className="text-stone-300">
                {inv.inviteeName} 초대 대기중 · 제안: {inv.proposedByKind === 'ai' ? `🤖 ${inv.proposedByName}` : inv.proposedByName}
              </span>
              {isCeo ? (
                <span className="flex gap-1">
                  <Button size="sm" hint="승인하면 이 방의 멤버가 됩니다." onClick={() => decideRoomInvite(inv.id, 'approved')}>
                    승인
                  </Button>
                  <Button size="sm" variant="ghost" hint="초대를 취소합니다. 멤버가 되지 않습니다." onClick={() => decideRoomInvite(inv.id, 'rejected')}>
                    거절
                  </Button>
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="max-h-56 space-y-1.5 overflow-y-auto scroll-thin text-[11px]">
        {messages.map((m) => (
          <div key={m.id} className={`rounded-lg px-2.5 py-1.5 ${m.authorKind === 'ceo' ? 'bg-gold/10' : 'bg-stone-800/60'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className={m.authorKind === 'ceo' ? 'text-gold' : 'text-stone-300'}>{m.authorName}</span>
              <span className="text-stone-600">{clock(m.ts)}</span>
            </div>
            <p className="mt-0.5 text-stone-200">{m.text}</p>
          </div>
        ))}
        {messages.length === 0 ? <p className="text-stone-600">아직 메시지가 없습니다.</p> : null}
      </div>

      {canSend ? (
        <div className="mt-2 flex gap-2">
          <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="메시지 입력…" />
          <Button
            size="sm"
            disabled={!draft.trim()}
            onClick={() => {
              sendRoomMessage(room.id, draft);
              setDraft('');
            }}
          >
            전송
          </Button>
        </div>
      ) : myHumanId ? (
        <div className="mt-2">
          <Button
            size="sm"
            variant="ghost"
            hint="이 방에 넣어달라고 대표에게 요청합니다. 대표가 승인해야 메시지를 보낼 수 있습니다."
            onClick={() => proposeRoomInvite({ roomId: room.id, inviteeId: myHumanId, inviteeKind: 'human' })}
          >
            이 방에 참여 제안하기
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function InviteComposer({
  roomId,
  options,
  aiEmployees,
  isCeo,
  onSubmit,
}: {
  roomId: string;
  options: Array<{ id: string; name: string; kind: 'ai' | 'human' }>;
  aiEmployees: Array<{ id: string; name: string }>;
  isCeo: boolean;
  onSubmit: (input: {
    roomId: string;
    inviteeId: string;
    inviteeKind: 'ai' | 'human';
    proposedByKind?: ChatRoomAuthorKind;
    proposedByName?: string;
  }) => void;
}) {
  const [inviteeKey, setInviteeKey] = useState(options[0] ? `${options[0].kind}:${options[0].id}` : '');
  const [proposer, setProposer] = useState<'ceo' | string>('ceo');

  if (options.length === 0) {
    return <Notice>초대할 수 있는 대상이 없습니다.</Notice>;
  }

  return (
    <div className="mb-2 rounded-lg border border-stone-700 bg-stone-950/50 p-2 text-[11px]">
      <div className="grid gap-1.5 sm:grid-cols-2">
        <Select value={inviteeKey} onChange={(e) => setInviteeKey(e.target.value)}>
          {options.map((o) => (
            <option key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>
              {o.kind === 'ai' ? '🤖' : '🧑'} {o.name}
            </option>
          ))}
        </Select>
        {isCeo ? (
          <Select value={proposer} onChange={(e) => setProposer(e.target.value)}>
            <option value="ceo">제안자: 대표 본인</option>
            {aiEmployees.map((a) => (
              <option key={a.id} value={a.name}>
                제안자: 🤖 {a.name} 추천
              </option>
            ))}
          </Select>
        ) : null}
      </div>
      <div className="mt-1.5 flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            const [kind, id] = inviteeKey.split(':') as ['ai' | 'human', string];
            onSubmit({
              roomId,
              inviteeId: id,
              inviteeKind: kind,
              proposedByKind: isCeo ? (proposer === 'ceo' ? 'ceo' : 'ai') : 'human',
              proposedByName: isCeo && proposer !== 'ceo' ? proposer : undefined,
            });
          }}
        >
          초대 제안
        </Button>
      </div>
    </div>
  );
}
