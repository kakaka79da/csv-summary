/**
 * 대표 승인 센터.
 * 승인 전에는 API 호출과 비용 발생 작업이 시작되지 않는다는 규칙의 사용자 접점.
 */
import { useState } from 'react';
import { useWorld } from '@/state/store';
import { clock, duration, money } from '@/lib/format';
import { Badge, Button, Notice, TextInput } from '@/components/ui/primitives';
import type { Approval, ApprovalKind } from '@/types';

const KIND_LABEL: Record<ApprovalKind, string> = {
  hire_ai: '신규 AI 직원 추가',
  paid_model: '유료 모델 연결',
  raise_limit: '비용 한도 인상',
  external_api: '외부 유료 API 연결',
  large_project: '대규모 프로젝트 시작',
  boss_raid: '보스/레이드 미션 시작',
  external_email: '외부 고객 메일 발송',
  human_permission: '인간 직원 권한 변경',
  leave: 'AI 직원 휴직',
  return: 'AI 직원 복귀',
  budget_overrun_resume: '예산 초과 업무 재개',
};

const RISK_TONE = { low: 'vital', medium: 'gold', high: 'ember' } as const;

export default function ApprovalCenter() {
  const approvals = useWorld((s) => s.approvals);
  const pending = approvals.filter((a) => a.status === 'pending');
  const decided = approvals.filter((a) => a.status !== 'pending').slice(0, 20);

  return (
    <div className="space-y-4">
      {pending.length === 0 ? (
        <Notice>대기 중인 승인 요청이 없습니다.</Notice>
      ) : (
        <div className="space-y-3">
          {pending.map((a) => (
            <ApprovalCard key={a.id} approval={a} />
          ))}
        </div>
      )}

      {decided.length > 0 ? (
        <div>
          <h3 className="mb-2 text-xs uppercase tracking-widest text-stone-500">처리 완료</h3>
          <div className="space-y-1.5">
            {decided.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-stone-800 px-3 py-2 text-[11px]"
              >
                <span className="min-w-0 truncate text-stone-300">
                  {KIND_LABEL[a.kind]} · {a.title}
                </span>
                <span className="shrink-0 text-stone-500">
                  {
                    {
                      approved: '승인',
                      conditional: '조건부 승인',
                      changes_requested: '수정 요청',
                      rejected: '거절',
                      pending: '',
                    }[a.status]
                  }
                  {a.decidedAt ? ` · ${clock(a.decidedAt)}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ApprovalCard({ approval }: { approval: Approval }) {
  const decide = useWorld((s) => s.decideApproval);
  const employees = useWorld((s) => s.employees);
  const company = useWorld((s) => s.company);
  const [note, setNote] = useState('');
  if (!company) return null;

  const requester = employees[approval.requesterId];

  return (
    <div className="rounded-xl border border-gold/40 bg-stone-900/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone="gold">{KIND_LABEL[approval.kind]}</Badge>
            <Badge tone={RISK_TONE[approval.risk]}>위험도 {approval.risk}</Badge>
          </div>
          <h3 className="mt-1.5 text-sm text-stone-100">{approval.title}</h3>
          <p className="text-[11px] text-stone-400">{approval.reason}</p>
        </div>
        <span className="shrink-0 text-[10px] text-stone-600">{clock(approval.createdAt)}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
        <Row k="요청자" v={requester ? `${requester.name} · ${requester.title}` : approval.requesterId} />
        <Row k="참여 AI 직원" v={approval.participants.map((p) => employees[p]?.name ?? p).join(', ') || '-'} />
        <Row k="예상 비용" v={money(approval.estCostUsd, company.currency)} />
        <Row k="예상 기간" v={approval.estSeconds ? duration(approval.estSeconds) : '-'} />
        <Row k="사용할 모델" v={approval.model ?? '-'} />
        <Row k="사용할 도구" v={approval.tools.length ? approval.tools.join(', ') : '없음'} />
        <Row k="데이터 접근 범위" v={approval.dataScope.length ? approval.dataScope.join(', ') : '없음'} />
      </div>

      <div className="mt-3">
        <TextInput
          placeholder="조건 또는 수정 요청 사유 (선택)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="sm" onClick={() => decide(approval.id, 'approved', note || undefined)}>
          승인 · 봉인 해제
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!note.trim()}
          title={!note.trim() ? '조건을 입력하세요' : undefined}
          onClick={() => decide(approval.id, 'conditional', note)}
        >
          조건부 승인
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!note.trim()}
          title={!note.trim() ? '요청 사항을 입력하세요' : undefined}
          onClick={() => decide(approval.id, 'changes_requested', note)}
        >
          수정 요청
        </Button>
        <Button size="sm" variant="danger" onClick={() => decide(approval.id, 'rejected', note || undefined)}>
          거절
        </Button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0 text-stone-500">{k}</span>
      <span className="truncate text-right text-stone-300">{v}</span>
    </div>
  );
}
