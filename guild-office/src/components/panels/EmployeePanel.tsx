/**
 * 캐릭터 상세 + 1:1 대화 + 업무 지시.
 * 대표와 AI 직원의 1:1 상호작용이 초기 버전의 핵심이다.
 */
import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useWorld } from '@/state/store';
import { AGENT_STATE_LABEL, DIFFICULTY_LABEL, clock, duration, money } from '@/lib/format';
import { AI_EMPLOYEE_SEEDS, roomById } from '@/data/seed';
import ApiWizard from '@/components/onboarding/ApiWizard';
import CharacterPortrait from '@/components/office/CharacterPortrait';
import {
  Badge,
  Button,
  Field,
  Notice,
  SectionTitle,
  Select,
  StatBar,
  TextArea,
  TextInput,
} from '@/components/ui/primitives';
import type { Difficulty, MessageKind } from '@/types';

const KIND_STYLE: Record<MessageKind, { label: string; cls: string }> = {
  chat: { label: '대화', cls: 'border-stone-700 text-stone-300' },
  task_order: { label: '업무 지시', cls: 'border-gold/60 text-gold' },
  question: { label: '추가 질문', cls: 'border-arcane/60 text-arcane-soft' },
  report: { label: '결과 보고', cls: 'border-vital/60 text-vital' },
  approval_request: { label: '승인 요청', cls: 'border-gold/60 text-gold' },
  warning: { label: '경고', cls: 'border-ember/60 text-ember' },
  system: { label: '시스템 알림', cls: 'border-stone-700 text-stone-500' },
};

export default function EmployeePanel({ employeeId }: { employeeId: string }) {
  const employee = useWorld((s) => s.employees[employeeId]);
  const company = useWorld((s) => s.company);
  const chats = useWorld((s) => s.chats[employeeId]);
  const missions = useWorld((s) => s.missions);
  const sendChat = useWorld((s) => s.sendChat);
  const select = useWorld((s) => s.selectEmployee);
  const requestLeave = useWorld((s) => s.requestLeave);
  const requestReturn = useWorld((s) => s.requestReturn);
  const requestLimitChange = useWorld((s) => s.requestLimitChange);
  const stopMission = useWorld((s) => s.stopMission);

  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState<'chat' | 'order' | 'api' | 'memory' | 'log'>('chat');
  const [wizardOpen, setWizardOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeMission = useMemo(() => {
    if (!employee?.currentMissionId) return null;
    return missions[employee.currentMissionId] ?? null;
  }, [employee?.currentMissionId, missions]);

  if (!employee || !company) return null;
  const label = AGENT_STATE_LABEL[employee.state];
  const room = employee.destinationRoom ? roomById(employee.destinationRoom) : roomById(employee.homeRoom);
  const currentStep = activeMission?.steps.find((s) => s.id === employee.currentStepId) ?? null;
  const manaLeft = Math.max(0, employee.binding.monthlyLimitUsd - employee.spendMonthUsd);

  return (
    <div className="panel flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-start gap-3 border-b border-stone-700/70 p-4">
        <CharacterPortrait employee={employee} state={employee.state} className="h-20 w-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="rune-title text-lg">{employee.name}</h2>
            <span className="text-xs text-stone-400">{employee.title}</span>
          </div>
          <div className="text-[11px] text-stone-500">{employee.jobLabel}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone={employee.state === 'error' ? 'ember' : employee.state === 'on_leave' ? 'neutral' : 'gold'}>
              {label.game}
            </Badge>
            <span className="text-[11px] text-stone-400">{label.real}</span>
          </div>
        </div>
        <Button variant="quiet" size="sm" onClick={() => select(null)}>
          ✕
        </Button>
      </div>

      {/* 요약 지표 */}
      <div className="grid grid-cols-2 gap-3 border-b border-stone-700/70 p-4 text-xs">
        <Info label="현재 위치" value={room.name} sub={room.flavor} />
        <Info
          label="감정 / 집중"
          value={`${Math.round(employee.mood)} / ${Math.round(employee.focus)}`}
          sub="0-100"
        />
        <Info
          label="연결된 제공자"
          value={employee.binding.provider ?? '미연결'}
          sub={employee.binding.maskedKey ?? '키는 서버 보관'}
        />
        <Info label="연결된 모델" value={employee.binding.model ?? '-'} sub={employee.binding.status} />
        <div className="col-span-2 space-y-2">
          <StatBar
            label="마나 (남은 월간 예산)"
            realText={`${money(manaLeft, company.currency)} / ${money(employee.binding.monthlyLimitUsd, company.currency)}`}
            value={manaLeft}
            max={employee.binding.monthlyLimitUsd}
            tone="arcane"
          />
          <StatBar
            label="오늘 사용한 비용"
            realText={money(employee.spendTodayUsd, company.currency)}
            value={employee.spendTodayUsd}
            max={Math.max(employee.binding.monthlyLimitUsd, 0.01)}
            tone="ember"
          />
        </div>
      </div>

      {/* 현재 작업 */}
      {currentStep && activeMission ? (
        <div className="border-b border-stone-700/70 p-4">
          <SectionTitle>현재 작업</SectionTitle>
          <div className="text-sm text-stone-100">{currentStep.title}</div>
          <div className="mb-2 text-[11px] text-stone-500">{activeMission.name}</div>
          <StatBar
            label={`${currentStep.monster.name} 체력`}
            realText={`남은 작업량 ${Math.round(currentStep.monster.hpPercent)}%`}
            value={currentStep.monster.hpPercent}
            max={100}
            tone="ember"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-stone-400">
            <span>
              진행률 {Math.round(currentStep.progress)}% · 실제 비용{' '}
              {money(currentStep.actualCostUsd, company.currency)}
            </span>
            <Button size="sm" variant="danger" onClick={() => stopMission(activeMission.id)}>
              업무 중단
            </Button>
          </div>
        </div>
      ) : null}

      {/* 탭 */}
      <div className="flex gap-1 border-b border-stone-700/70 px-3 pt-3 text-xs">
        {(
          [
            ['chat', '1:1 대화'],
            ['order', '업무 지시'],
            ['api', 'API 설정'],
            ['memory', '기억'],
            ['log', '활동 기록'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-t-lg px-3 py-2 ${
              tab === k ? 'bg-stone-800 text-gold' : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
        {tab === 'chat' ? (
          <div ref={scrollRef} className="space-y-2">
            {!company.driveFolderUrl ? (
              <div className="rounded-lg border border-arcane/40 bg-arcane/5 px-3 py-2 text-xs text-arcane-soft">
                💬 {AI_EMPLOYEE_SEEDS.find((s) => s.id === employeeId)?.driveRequestLine}
              </div>
            ) : null}
            {(chats ?? []).map((m) => {
              const k = KIND_STYLE[m.kind];
              const mine = m.from === 'ceo';
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`max-w-[92%] rounded-lg border px-3 py-2 text-xs ${
                    mine ? 'ml-auto border-gold/40 bg-gold/5' : 'border-stone-700 bg-stone-950/50'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded border px-1 py-0.5 text-[9px] ${k.cls}`}>{k.label}</span>
                    <span className="text-[10px] text-stone-600">
                      {mine ? company.ceoName : m.from === 'agent' ? employee.name : '시스템'} · {clock(m.ts)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed text-stone-200">{m.text}</p>
                </motion.div>
              );
            })}
            {(chats ?? []).length === 0 ? (
              <p className="text-xs text-stone-600">아직 대화가 없습니다.</p>
            ) : null}
          </div>
        ) : null}

        {tab === 'order' ? <TaskComposer employeeId={employeeId} /> : null}

        {tab === 'api' ? (
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-stone-700 bg-stone-950/50 p-3">
              <Row label="제공자" value={employee.binding.provider ?? '미연결'} />
              <Row label="모델" value={employee.binding.model ?? '-'} />
              <Row label="상태" value={employee.binding.status} />
              <Row label="키" value={`${employee.binding.maskedKey ?? '-'} (서버 보관, 브라우저 미저장)`} />
              <Row label="참조 ID" value={employee.binding.keyRef ?? '-'} />
              <Row
                label="허용 도구"
                value={employee.binding.allowedTools.length ? employee.binding.allowedTools.join(', ') : '없음'}
              />
            </div>
            <LimitEditor
              employeeId={employeeId}
              perTask={employee.binding.perTaskLimitUsd}
              monthly={employee.binding.monthlyLimitUsd}
              onSubmit={requestLimitChange}
            />
            <Button variant="ghost" full onClick={() => setWizardOpen(true)}>
              연결 마법사 다시 열기
            </Button>
          </div>
        ) : null}

        {tab === 'memory' ? <MemoryTab employeeId={employeeId} /> : null}

        {tab === 'log' ? <ActivityLog employeeId={employeeId} /> : null}
      </div>

      {/* 하단 액션 */}
      <div className="border-t border-stone-700/70 p-3">
        {tab === 'chat' ? (
          <div className="mb-2 flex gap-2">
            <TextInput
              value={draft}
              placeholder="일반 대화를 입력하세요 (업무 지시는 '업무 지시' 탭)"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  sendChat(employeeId, draft);
                  setDraft('');
                }
              }}
            />
            <Button
              onClick={() => {
                sendChat(employeeId, draft);
                setDraft('');
              }}
            >
              전송
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => sendChat(employeeId, '현재 상황을 보고해 주세요.')}>
            보고 요청
          </Button>
          {employee.onLeave ? (
            <Button size="sm" variant="ghost" onClick={() => requestReturn(employeeId)}>
              복귀 요청 (승인 필요)
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => requestLeave(employeeId)}>
              휴직 요청 (승인 필요)
            </Button>
          )}
          {activeMission ? (
            <Button size="sm" variant="danger" onClick={() => stopMission(activeMission.id)}>
              업무 중단
            </Button>
          ) : null}
        </div>
      </div>

      {wizardOpen ? <ApiWizard employeeId={employeeId} onClose={() => setWizardOpen(false)} /> : null}
    </div>
  );
}

/* ───────────────────────── 업무 지시 (견적 미리보기) ──────────────────── */

function TaskComposer({ employeeId }: { employeeId: string }) {
  const estimate = useWorld((s) => s.estimateTask);
  const orderTask = useWorld((s) => s.orderTask);
  const company = useWorld((s) => s.company);
  const employees = useWorld((s) => s.employees);
  const [order, setOrder] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [result, setResult] = useState<string | null>(null);

  const emp = employees[employeeId];
  const est = estimate(employeeId, order, difficulty);
  if (!company || !emp) return null;
  const diff = DIFFICULTY_LABEL[difficulty];

  return (
    <div className="space-y-3">
      <Field label="업무 내용">
        <TextArea rows={3} value={order} onChange={(e) => setOrder(e.target.value)} placeholder="무엇을 해야 하는지 구체적으로 적을수록 결과가 좋아집니다." />
      </Field>
      <Field label="업무 규모">
        <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
          <option value="normal">일반 업무 (일반 몬스터)</option>
          <option value="elite">복잡한 업무 (정예 몬스터)</option>
          <option value="boss">대규모 프로젝트 (보스) — 승인 필요</option>
          <option value="raid">다중 협업 대형 프로젝트 (레이드) — 승인 필요</option>
        </Select>
      </Field>

      {/* 지시 확정 전 미리보기 */}
      <div className="rounded-lg border border-stone-700 bg-stone-950/50 p-3 text-xs">
        <SectionTitle>지시 전 확인</SectionTitle>
        <Row label="담당 AI 직원" value={`${emp.name} · ${emp.title}`} />
        <Row label="업무 규모" value={`${diff.game} · ${diff.real}`} />
        <Row label="예상 처리 시간" value={duration(est.estSeconds)} />
        <Row label="예상 비용" value={money(est.estCostUsd, company.currency)} />
        <Row label="사용할 도구" value={est.tools.length ? est.tools.join(', ') : '없음'} />
        <Row label="접근할 데이터" value={est.dataScope.length ? est.dataScope.join(', ') : '없음'} />
        <Row label="대표 승인 필요" value={est.requiresApproval ? '예' : '아니오'} />
      </div>

      {est.approvalReasons.length > 0 ? (
        <Notice tone="warn">
          <strong>승인이 필요한 이유</strong>
          <ul className="mt-1 list-disc pl-4">
            {est.approvalReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          승인 전에는 어떤 API 호출도 시작되지 않고 비용도 발생하지 않습니다.
        </Notice>
      ) : null}

      {est.blockers.length > 0 ? (
        <Notice tone="warn">
          <strong>지금 지시할 수 없습니다</strong>
          <ul className="mt-1 list-disc pl-4">
            {est.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {result ? <Notice>{result}</Notice> : null}

      <Button
        full
        disabled={est.blockers.length > 0}
        onClick={() => {
          const r = orderTask(employeeId, order, difficulty);
          setResult(
            r.ok
              ? est.requiresApproval
                ? '승인 대기로 등록되었습니다. 승인 센터에서 결재해 주세요.'
                : '업무를 시작했습니다. 캐릭터가 담당 장소로 이동합니다.'
              : (r.error ?? '실패'),
          );
          if (r.ok) setOrder('');
        }}
      >
        {est.requiresApproval ? '승인 요청과 함께 지시' : '업무 지시'}
      </Button>
    </div>
  );
}

/* ─────────────────────────── 비용 한도 편집 ──────────────────────────── */

function LimitEditor({
  employeeId,
  perTask,
  monthly,
  onSubmit,
}: {
  employeeId: string;
  perTask: number;
  monthly: number;
  onSubmit: (id: string, perTask: number, monthly: number) => void;
}) {
  const [p, setP] = useState(perTask);
  const [m, setM] = useState(monthly);
  const raising = p > perTask || m > monthly;
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-950/50 p-3">
      <SectionTitle>비용 한도</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Field label="작업당 (USD)">
          <TextInput type="number" step="0.1" value={p} onChange={(e) => setP(Number(e.target.value) || 0)} />
        </Field>
        <Field label="월간 (USD)">
          <TextInput type="number" step="1" value={m} onChange={(e) => setM(Number(e.target.value) || 0)} />
        </Field>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-stone-500">
          {raising ? '한도 인상은 대표 승인이 필요합니다' : '한도 인하는 즉시 반영됩니다'}
        </span>
        <Button size="sm" onClick={() => onSubmit(employeeId, p, m)}>
          {raising ? '인상 요청' : '적용'}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── 활동 기록 ──────────────────────────────── */

function ActivityLog({ employeeId }: { employeeId: string }) {
  // 셀렉터 안에서 filter 하면 안 된다 — 호출할 때마다 새 배열이 나오고, zustand 는
  // 참조로 같은지 보기 때문에 "바뀌었다"고 판단한다. tick 이 매 프레임 도는 이 앱에서는
  // 그대로 무한 렌더 루프가 되어 React 가 오류를 던진다.
  // 원본 배열을 그대로 받아 오고, 걸러내는 일은 useMemo 로 화면 쪽에서 한다.
  const allLedger = useWorld((s) => s.ledger);
  const company = useWorld((s) => s.company);
  const ledger = useMemo(() => allLedger.filter((e) => e.employeeId === employeeId), [allLedger, employeeId]);
  if (!company) return null;
  if (ledger.length === 0) return <p className="text-xs text-stone-600">아직 기록이 없습니다.</p>;
  return (
    <div className="space-y-1.5 text-xs">
      {ledger.map((e) => (
        <div key={e.id} className="rounded-lg border border-stone-800 px-3 py-2">
          <div className="flex justify-between">
            <span className="text-stone-200">{e.note}</span>
            <span className="text-stone-400">{money(e.costUsd, company.currency)}</span>
          </div>
          <div className="text-[10px] text-stone-500">
            {clock(e.ts)} · {e.model} · 입력 {e.inputTokens.toLocaleString()} / 출력{' '}
            {e.outputTokens.toLocaleString()} 토큰
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────── 기억 ────────────────────────────────── */

const MEMORY_KIND_LABEL: Record<string, string> = {
  lesson: '교훈',
  episode: '사건',
  preference: '선호',
  correction: '정정',
};

function MemoryTab({ employeeId }: { employeeId: string }) {
  const memory = useWorld((s) => s.memories[employeeId]);
  const addAgreement = useWorld((s) => s.addAgreement);
  const [agreementDraft, setAgreementDraft] = useState('');

  if (!memory) {
    return <p className="text-xs text-stone-600">아직 소환되지 않아 기억이 없습니다.</p>;
  }

  const activeAgreements = memory.agreements.filter((a) => a.status === 'active');
  const recentRecords = [...memory.records].sort((a, b) => b.at - a.at).slice(0, 10);

  return (
    <div className="space-y-4 text-xs">
      <Notice>
        이 기억은 {memory.identity.displayName}의 성품이자 정신세계입니다. 언어 모델을 바꿔도
        이 구조(정체성·원칙·합의·교훈)는 그대로 유지됩니다 — 매 요청마다 여기서 시스템 프롬프트를
        새로 조립할 뿐, 프롬프트가 기억을 바꾸지는 않습니다.
      </Notice>

      <div className="rounded-lg border border-stone-700 bg-stone-950/50 p-3">
        <SectionTitle>정체성 · 성품</SectionTitle>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-stone-300">
          {memory.identity.coreTraits.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <SectionTitle className="mt-3">절대 가치</SectionTitle>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-stone-300">
          {memory.identity.values.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-950/50 p-3">
        <div className="mb-1 flex items-center justify-between">
          <SectionTitle>대표와의 합의사항</SectionTitle>
          <span className="text-[10px] text-stone-500">{activeAgreements.length}건 유효</span>
        </div>
        <ul className="space-y-1">
          {activeAgreements.map((a) => (
            <li key={a.id} className="rounded border border-stone-800 px-2 py-1.5 text-stone-300">
              {a.statement}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <TextInput
            value={agreementDraft}
            placeholder="새 합의사항을 적으세요"
            onChange={(e) => setAgreementDraft(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => {
              if (!agreementDraft.trim()) return;
              addAgreement(employeeId, agreementDraft);
              setAgreementDraft('');
            }}
          >
            추가
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-stone-700 bg-stone-950/50 p-3">
        <SectionTitle>최근 기억</SectionTitle>
        <ul className="mt-1 space-y-1.5">
          {recentRecords.map((r) => (
            <li key={r.id} className="rounded border border-stone-800 px-2 py-1.5">
              <div className="flex items-center gap-2">
                <span className="rounded border border-stone-700 px-1 py-0.5 text-[9px] text-stone-400">
                  {MEMORY_KIND_LABEL[r.kind] ?? r.kind}
                </span>
                <span className="text-stone-200">{r.title}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-stone-500">{r.body}</p>
            </li>
          ))}
          {recentRecords.length === 0 ? <p className="text-stone-600">아직 쌓인 기억이 없습니다.</p> : null}
        </ul>
      </div>

      {memory.modelHistory.length > 0 ? (
        <div className="rounded-lg border border-stone-700 bg-stone-950/50 p-3">
          <SectionTitle>모델 교체 이력</SectionTitle>
          <p className="mb-1 text-[10px] text-stone-500">
            모델을 바꿔도 위 기억은 그대로 유지됩니다. 여기는 어떤 모델을 썼는지의 기록일 뿐입니다.
          </p>
          <ul className="space-y-1">
            {memory.modelHistory.map((h, i) => (
              <li key={i} className="text-[11px] text-stone-400">
                {clock(h.at)} · {h.provider ?? '-'}/{h.model ?? '-'} {h.note ? `· ${h.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {memory.drive.folderUrl ? (
        <a
          href={memory.drive.folderUrl}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg border border-gold/40 px-3 py-2 text-center text-gold hover:bg-gold/5"
        >
          구글 드라이브에서 원본 기억 파일 보기 →
        </a>
      ) : null}
    </div>
  );
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] text-stone-500">{label}</div>
      <div className="truncate text-stone-100">{value}</div>
      {sub ? <div className="truncate text-[10px] text-stone-600">{sub}</div> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-stone-800 py-1 last:border-0">
      <span className="shrink-0 text-stone-500">{label}</span>
      <span className="truncate text-right text-stone-200">{value}</span>
    </div>
  );
}
