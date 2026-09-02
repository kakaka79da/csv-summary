/**
 * 근태·현황판 — 오피스를 돌아다니지 않고도 "누가 지금 뭐 하고 있는지"를
 * 한눈에 보는 요약 뷰. AI 직원은 실제 미션/상태에서, 인간 사원은 본인이
 * 남긴 한 줄(currentTaskNote)에서 가져온다 — 대표가 사원 대신 지어내지 않는다.
 */
import { useState } from 'react';
import { useWorld } from '@/state/store';
import { AGENT_STATE_LABEL, clock } from '@/lib/format';
import { Badge, Button, SectionTitle, TextInput } from '@/components/ui/primitives';
import type { HumanStaffRecord, WorkMode } from '@/types';

const WORK_MODE_LABEL: Record<WorkMode, string> = { office: '출근', remote: '재택', not_started: '미출근' };
const WORK_MODE_TONE: Record<WorkMode, 'vital' | 'arcane' | 'neutral'> = {
  office: 'vital',
  remote: 'arcane',
  not_started: 'neutral',
};

export default function StatusDashboard() {
  const session = useWorld((s) => s.session);
  const employeeOrder = useWorld((s) => s.employeeOrder);
  const employees = useWorld((s) => s.employees);
  const missions = useWorld((s) => s.missions);
  const humanStaff = useWorld((s) => s.humanStaff);
  const company = useWorld((s) => s.company);
  if (!company) return null;

  const approvedStaff = Object.values(humanStaff)
    .filter((r) => r.status === 'approved')
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>AI 직원 ({employeeOrder.length}명)</SectionTitle>
        <div className="space-y-1.5">
          {employeeOrder.map((id) => {
            const e = employees[id];
            if (!e) return null;
            const label = AGENT_STATE_LABEL[e.state];
            const mission = e.currentMissionId ? missions[e.currentMissionId] : null;
            return (
              <div key={id} className="flex items-center justify-between rounded-lg border border-stone-800 px-3 py-2 text-[11px]">
                <span className="min-w-0 truncate text-stone-100">
                  🤖 {e.name} <span className="text-stone-500">· {e.title}</span>
                </span>
                <span className="min-w-0 flex-1 truncate px-2 text-stone-400">
                  {mission ? `진행 중: ${mission.name}` : '진행 중인 업무 없음'}
                </span>
                <span className="shrink-0 text-stone-500">
                  {label.game} <span className="text-stone-600">· {label.real}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <SectionTitle>인간 사원 ({approvedStaff.length}명)</SectionTitle>
        {approvedStaff.length === 0 ? (
          <p className="text-xs text-stone-600">아직 승인된 인간 사원이 없습니다.</p>
        ) : (
          <div className="space-y-1.5">
            {approvedStaff.map((r) => (
              <StaffRow key={r.id} record={r} isSelf={session?.role === 'human_staff' && session.humanStaffId === r.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StaffRow({ record, isSelf }: { record: HumanStaffRecord; isSelf: boolean }) {
  const updateOwnTaskNote = useWorld((s) => s.updateOwnTaskNote);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(record.currentTaskNote ?? '');

  return (
    <div className="rounded-lg border border-stone-800 px-3 py-2 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-stone-100">
          🧑 {record.name} <span className="text-stone-500">· {record.role}</span>
        </span>
        <Badge tone={WORK_MODE_TONE[record.workMode]}>{WORK_MODE_LABEL[record.workMode]}</Badge>
      </div>
      {editing ? (
        <div className="mt-1.5 flex gap-1.5">
          <TextInput value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="지금 하고 있는 일을 한 줄로…" />
          <Button
            size="sm"
            onClick={() => {
              updateOwnTaskNote(draft);
              setEditing(false);
            }}
          >
            저장
          </Button>
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-stone-400">
            {record.currentTaskNote ?? '아직 남긴 업무 노트가 없습니다.'}
            {record.currentTaskUpdatedAt ? <span className="ml-1 text-stone-600">· {clock(record.currentTaskUpdatedAt)}</span> : null}
          </span>
          {isSelf ? (
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              수정
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
