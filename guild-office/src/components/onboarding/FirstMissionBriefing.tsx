/**
 * 창립 튜토리얼 6단계: 첫 공동 프로젝트 브리핑.
 * 발주 전에 담당·순서·예상 시간·예상 비용·승인 필요 여부를 먼저 보여준다.
 */
import { motion } from 'framer-motion';
import { useWorld } from '@/state/store';
import { buildFirstMission } from '@/state/missionMachine';
import { Button, Notice, SectionTitle } from '@/components/ui/primitives';
import { DIFFICULTY_LABEL, duration, money } from '@/lib/format';

export default function FirstMissionBriefing() {
  const employees = useWorld((s) => s.employees);
  const company = useWorld((s) => s.company);
  const createFirstMission = useWorld((s) => s.createFirstMission);

  if (!company) return null;
  // 미리보기 전용 미션 객체. 발주 버튼을 누르기 전까지 상태에 저장되지 않는다.
  const preview = buildFirstMission(employees, company.name, company.ceoName, Date.now());
  const diff = DIFFICULTY_LABEL[preview.difficulty];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-full border border-gold/50 px-2 py-0.5 text-[11px] text-gold">
          창립 튜토리얼 6/6
        </span>
        <div className="h-px flex-1 bg-stone-800" />
      </div>
      <h1 className="rune-title text-2xl">첫 공동 프로젝트</h1>
      <p className="mb-5 text-xs text-stone-500">세 직원이 순서대로 협업합니다</p>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="panel p-5">
        <h2 className="text-lg text-stone-100">{preview.name}</h2>
        <p className="mt-1 text-sm text-stone-400">{preview.objective}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Stat label="난이도" value={diff.game} sub={diff.real} />
          <Stat label="참여 직원" value={`${preview.participants.length}명`} sub="총무 · 엔지니어 · 교수" />
          <Stat label="예상 시간" value={duration(preview.estSeconds)} sub="이동 시간 별도" />
          <Stat
            label="예상 비용"
            value={money(preview.estCostUsd, company.currency)}
            sub={`회사 예산 ${money(company.monthlyBudgetUsd, company.currency)} 중`}
          />
        </div>

        <div className="mt-5">
          <SectionTitle>진행 순서</SectionTitle>
          <ol className="space-y-2">
            {preview.steps.map((s, i) => {
              const emp = employees[s.assigneeId];
              return (
                <li key={s.id} className="flex gap-3 rounded-lg border border-stone-800 px-3 py-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-stone-600 text-[11px] text-stone-400">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-stone-100">{s.title}</span>
                    <span className="block text-[11px] text-stone-500">{s.description}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px]">
                    <span className="block text-stone-300">{emp?.name ?? s.assigneeId}</span>
                    <span className="block text-stone-500">{money(s.estCostUsd, company.currency)}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-5 space-y-2">
          <Notice>
            이 프로젝트는 예상 비용이 각 직원의 작업당 한도 안에 있어 즉시 시작됩니다. 진행 중 예산을 넘으면
            자동으로 중단되고 승인 대기로 전환됩니다.
          </Notice>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={createFirstMission}>출정 승인 · 프로젝트 시작</Button>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-stone-800 px-3 py-2">
      <div className="text-[11px] text-stone-500">{label}</div>
      <div className="text-sm text-stone-100">{value}</div>
      <div className="text-[10px] text-stone-500">{sub}</div>
    </div>
  );
}
