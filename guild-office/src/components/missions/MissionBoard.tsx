/**
 * 미션·퀘스트 목록과 프로젝트 던전(전투 시각화).
 * 전투 수치는 모두 실제 업무 데이터에서 파생된 값이며, 옆에 실제 의미를 함께 적는다.
 */
import { motion } from 'framer-motion';
import { useWorld } from '@/state/store';
import { DIFFICULTY_LABEL, MISSION_STATUS_LABEL, duration, money } from '@/lib/format';
import { Badge, Button, Notice, SectionTitle, StatBar } from '@/components/ui/primitives';
import type { Mission, MissionStatus } from '@/types';

const STATUS_TONE: Record<MissionStatus, 'neutral' | 'gold' | 'vital' | 'ember' | 'arcane'> = {
  draft: 'neutral',
  awaiting_approval: 'gold',
  queued: 'arcane',
  in_progress: 'arcane',
  blocked: 'ember',
  reporting: 'vital',
  review: 'gold',
  completed: 'vital',
  failed: 'ember',
  cancelled: 'neutral',
};

export default function MissionBoard({ mode }: { mode: 'list' | 'dungeon' }) {
  const missionOrder = useWorld((s) => s.missionOrder);
  const missions = useWorld((s) => s.missions);
  const list = missionOrder.map((id) => missions[id]).filter(Boolean);

  if (mode === 'dungeon') {
    const active = list.filter((m) => m.status === 'in_progress' || m.status === 'blocked');
    return (
      <div className="space-y-3">
        {active.length === 0 ? (
          <Notice>지금 진행 중인 전투가 없습니다. 업무를 지시하면 던전이 열립니다.</Notice>
        ) : null}
        {active.map((m) => (
          <DungeonCard key={m.id} mission={m} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {list.length === 0 ? <Notice>아직 등록된 미션이 없습니다.</Notice> : null}
      {list.map((m) => (
        <MissionCard key={m.id} mission={m} />
      ))}
    </div>
  );
}

function MissionCard({ mission }: { mission: Mission }) {
  const employees = useWorld((s) => s.employees);
  const company = useWorld((s) => s.company);
  const artifacts = useWorld((s) => s.artifacts);
  const accept = useWorld((s) => s.acceptMissionResult);
  const stop = useWorld((s) => s.stopMission);
  if (!company) return null;

  const diff = DIFFICULTY_LABEL[mission.difficulty];
  const doneCount = mission.steps.filter((s) => s.status === 'done').length;
  const overall = (doneCount / mission.steps.length) * 100;

  return (
    <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm text-stone-100">{mission.name}</h3>
          <p className="text-[11px] text-stone-500">{mission.objective}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={STATUS_TONE[mission.status]}>{MISSION_STATUS_LABEL[mission.status]}</Badge>
          <Badge>{diff.game}</Badge>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
        <Cell k="요청자" v={mission.requester} />
        <Cell k="담당" v={employees[mission.ownerId]?.name ?? mission.ownerId} />
        <Cell k="참여" v={mission.participants.map((p) => employees[p]?.name ?? p).join(', ')} />
        <Cell k="우선순위" v={mission.priority} />
        <Cell k="예상 시간" v={duration(mission.estSeconds)} />
        <Cell k="예상 비용" v={money(mission.estCostUsd, company.currency)} />
        <Cell k="실제 비용" v={money(mission.actualCostUsd, company.currency)} />
        <Cell k="승인 필요" v={mission.requiresApproval ? '예' : '아니오'} />
      </div>

      <div className="mt-3">
        <StatBar
          label="전체 진행"
          realText={`${doneCount}/${mission.steps.length} 단계 완료`}
          value={overall}
          tone="gold"
        />
      </div>

      <ol className="mt-3 space-y-1">
        {mission.steps.map((s, i) => {
          const emp = employees[s.assigneeId];
          const tone =
            s.status === 'done'
              ? 'text-vital'
              : s.status === 'active'
                ? 'text-gold'
                : s.status === 'blocked'
                  ? 'text-ember'
                  : 'text-stone-500';
          return (
            <li key={s.id} className="flex items-center gap-2 text-[11px]">
              <span className={`w-4 shrink-0 ${tone}`}>{i + 1}</span>
              <span className={`w-16 shrink-0 ${tone}`}>
                {{ pending: '대기', active: '진행', done: '완료', failed: '실패', blocked: '중단' }[s.status]}
              </span>
              <span className="min-w-0 flex-1 truncate text-stone-300">{s.title}</span>
              <span className="shrink-0 text-stone-500">{emp?.name}</span>
              <span className="w-10 shrink-0 text-right text-stone-500">{Math.round(s.progress)}%</span>
            </li>
          );
        })}
      </ol>

      {mission.failureReason ? (
        <p className="mt-2 text-[11px] text-ember">사유: {mission.failureReason}</p>
      ) : null}

      {mission.loot.length > 0 ? (
        <div className="mt-3">
          <SectionTitle>전리품 · 결과물</SectionTitle>
          <div className="space-y-1">
            {mission.loot.map((id) => {
              const a = artifacts[id];
              if (!a) return null;
              return (
                <details key={id} className="rounded-lg border border-stone-800 px-3 py-1.5">
                  <summary className="cursor-pointer text-[11px] text-stone-300">
                    📦 {a.title}
                    <span className="ml-2 text-stone-600">
                      {{ analysis: '분석 보고서', document: '문서', summary: '요약', report: '최종 보고서' }[a.kind]}
                    </span>
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap text-[11px] text-stone-400">{a.body}</pre>
                </details>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        {mission.status === 'review' ? (
          <Button size="sm" onClick={() => accept(mission.id)}>
            결과 승인 · 퀘스트 완료
          </Button>
        ) : null}
        {['in_progress', 'queued', 'blocked', 'awaiting_approval'].includes(mission.status) ? (
          <Button size="sm" variant="danger" onClick={() => stop(mission.id)}>
            중단
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DungeonCard({ mission }: { mission: Mission }) {
  const employees = useWorld((s) => s.employees);
  const company = useWorld((s) => s.company);
  const step = mission.steps[mission.currentStepIndex];
  if (!company || !step) return null;
  const emp = employees[step.assigneeId];
  const party = mission.participants.map((p) => employees[p]).filter(Boolean);
  const blocked = mission.status === 'blocked';

  return (
    <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm text-stone-100">{mission.name}</h3>
        <Badge tone={blocked ? 'ember' : 'arcane'}>{MISSION_STATUS_LABEL[mission.status]}</Badge>
      </div>

      {blocked ? (
        <Notice tone="warn">
          보스방 앞에서 대기 중입니다 — 대표 승인 전에는 전투(작업)가 시작되지 않습니다.
        </Notice>
      ) : null}

      <div className="mt-3 flex items-center gap-4">
        <motion.div
          animate={blocked ? {} : { scale: [1, 1.06, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-ember/50 bg-ember/10 text-2xl"
        >
          {{ sprite: '✷', scroll: '📜', bug: '🐛', golem: '◈', envoy: '☯', shade: '☾', boss: '☠' }[step.monster.kind]}
        </motion.div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-stone-100">{step.monster.name}</div>
          <div className="mb-1.5 text-[11px] text-stone-500">{step.description}</div>
          <StatBar
            label="몬스터 체력"
            realText={`남은 작업량 ${Math.round(step.monster.hpPercent)}%`}
            value={step.monster.hpPercent}
            tone="ember"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-800 p-2">
          <SectionTitle>파티 · 참여 AI 직원</SectionTitle>
          <ul className="space-y-1 text-[11px]">
            {party.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span className="text-stone-300">
                  {p.name} {p.id === step.assigneeId ? '(교전 중)' : ''}
                </span>
                <span className="text-stone-500">
                  마나 {money(Math.max(0, p.binding.monthlyLimitUsd - p.spendMonthUsd), company.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-stone-800 p-2 text-[11px]">
          <SectionTitle>전투 수치 ↔ 실제 의미</SectionTitle>
          <Cell k="공격력" v={`처리 속도 — 단계 예상 ${duration(step.estSeconds)}`} />
          <Cell k="방어력" v={`검증 수준 — 보고 방식 ${emp?.reportStyle ?? '-'}`} />
          <Cell k="소모 마나" v={`실제 비용 ${money(step.actualCostUsd, company.currency)}`} />
          <Cell k="전리품" v={step.artifactId ? '획득' : '미획득'} />
        </div>
      </div>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="shrink-0 text-stone-500">{k}</span>
      <span className="truncate text-right text-stone-300">{v}</span>
    </div>
  );
}
