/**
 * 회의 테이블 더블클릭 → 우선순위 회의 소집.
 *
 * 지금 자유 상태인 직원만 회의 테이블로 모인다. 유료 작업 중인 직원을 억지로
 * 끊지 않는 이유는 이 앱의 핵심 규칙 때문이다 — 승인된 유료 작업은 대표가 명시적으로
 * 중단(업무 중단)하지 않는 한 계속된다. 회의 자체는 비용이 발생하지 않으므로
 * 승인 게이트를 거치지 않고 즉시 진행된다.
 */
import { useState } from 'react';
import { useWorld } from '@/state/store';
import { Button, Field, Modal, Notice, TextArea } from '@/components/ui/primitives';

export default function PriorityMeetingModal({ onClose }: { onClose: () => void }) {
  const employees = useWorld((s) => s.employees);
  const employeeOrder = useWorld((s) => s.employeeOrder);
  const callPriorityMeeting = useWorld((s) => s.callPriorityMeeting);

  const [instruction, setInstruction] = useState('');
  const [result, setResult] = useState<{ gathered: string[]; busy: string[] } | null>(null);

  const nameOf = (id: string) => employees[id]?.name ?? id;

  return (
    <Modal title="우선순위 회의 소집" subtitle="회의 테이블 · 원탁" onClose={onClose}>
      <div className="space-y-4 p-4 text-sm">
        {!result ? (
          <>
            <Notice>
              지금 자유 상태(대기·휴식·낚시 등)인 직원만 즉시 모입니다. 승인된 유료 작업을 진행
              중인 직원은 강제로 중단시키지 않습니다 — 업무를 끊으려면 해당 직원 패널에서
              직접 &ldquo;업무 중단&rdquo;을 눌러야 합니다. 회의 자체는 비용이 들지 않아 승인
              없이 바로 진행됩니다.
            </Notice>
            <Field label="전달할 지시 (선택)" hint="비워두면 집합 안내만 전달됩니다">
              <TextArea
                rows={4}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="예: 이번 주는 A 프로젝트를 최우선으로 진행합니다. 다른 업무는 보류하세요."
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                취소
              </Button>
              <Button onClick={() => setResult(callPriorityMeeting(instruction))}>
                지금 소집하기
              </Button>
            </div>
          </>
        ) : (
          <>
            <Notice>
              {result.gathered.length > 0
                ? `${result.gathered.length}명이 회의 테이블로 이동합니다. 도착하면 지시를 확인할 수 있습니다.`
                : '지금 모일 수 있는 직원이 없습니다 — 전원 업무 중이거나 휴직 중입니다.'}
            </Notice>
            {result.gathered.length > 0 ? (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-stone-500">
                  집합
                </div>
                <ul className="space-y-0.5 text-stone-300">
                  {result.gathered.map((id) => (
                    <li key={id}>· {nameOf(id)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.busy.length > 0 ? (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-stone-500">
                  불참 (업무 중 · 휴직 중)
                </div>
                <ul className="space-y-0.5 text-stone-500">
                  {result.busy.map((id) => (
                    <li key={id}>· {nameOf(id)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex justify-end">
              <Button onClick={onClose}>닫기</Button>
            </div>
          </>
        )}
        {employeeOrder.length === 0 ? <Notice tone="warn">아직 소환된 AI 직원이 없습니다.</Notice> : null}
      </div>
    </Modal>
  );
}
