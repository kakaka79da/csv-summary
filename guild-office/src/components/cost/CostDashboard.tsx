/** 비용 및 API 사용량. 게임 표현(마나)과 실제 금액을 항상 함께 보여준다. */
import { useWorld } from '@/state/store';
import { clock, money } from '@/lib/format';
import { Notice, SectionTitle, StatBar } from '@/components/ui/primitives';

export default function CostDashboard() {
  const ledger = useWorld((s) => s.ledger);
  const employees = useWorld((s) => s.employees);
  const order = useWorld((s) => s.employeeOrder);
  const company = useWorld((s) => s.company);
  if (!company) return null;

  const total = ledger.reduce((s, e) => s + e.costUsd, 0);
  const totalIn = ledger.reduce((s, e) => s + e.inputTokens, 0);
  const totalOut = ledger.reduce((s, e) => s + e.outputTokens, 0);
  const remaining = Math.max(0, company.monthlyBudgetUsd - total);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
        <SectionTitle>회사 마나 · 월간 예산</SectionTitle>
        <StatBar
          label="남은 예산"
          realText={`${money(remaining, company.currency)} / ${money(company.monthlyBudgetUsd, company.currency)}`}
          value={remaining}
          max={company.monthlyBudgetUsd}
          tone="arcane"
        />
        <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
          <Stat k="누적 사용" v={money(total, company.currency)} />
          <Stat k="입력 토큰" v={totalIn.toLocaleString('ko-KR')} />
          <Stat k="출력 토큰" v={totalOut.toLocaleString('ko-KR')} />
        </div>
        {remaining <= 0 ? (
          <div className="mt-3">
            <Notice tone="warn">
              월간 예산이 소진되었습니다. 새로운 유료 작업은 자동으로 중단되고 대표 승인 대기로 전환됩니다.
            </Notice>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
        <SectionTitle>직원별 사용량</SectionTitle>
        <div className="space-y-3">
          {order.map((id) => {
            const e = employees[id];
            if (!e) return null;
            const left = Math.max(0, e.binding.monthlyLimitUsd - e.spendMonthUsd);
            return (
              <div key={id}>
                <div className="mb-1 flex items-baseline justify-between text-[11px]">
                  <span className="text-stone-200">
                    {e.name} <span className="text-stone-500">· {e.binding.model ?? '미연결'}</span>
                  </span>
                  <span className="text-stone-400">
                    오늘 {money(e.spendTodayUsd, company.currency)} · 이번 달{' '}
                    {money(e.spendMonthUsd, company.currency)}
                  </span>
                </div>
                <StatBar
                  label="개인 한도 잔여"
                  realText={`${money(left, company.currency)} / ${money(e.binding.monthlyLimitUsd, company.currency)}`}
                  value={left}
                  max={Math.max(e.binding.monthlyLimitUsd, 0.01)}
                  tone="vital"
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
        <SectionTitle>API 호출 원장</SectionTitle>
        {ledger.length === 0 ? (
          <p className="text-xs text-stone-600">아직 호출 기록이 없습니다.</p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto scroll-thin text-[11px]">
            {ledger.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 border-b border-stone-800 py-1.5">
                <span className="min-w-0 flex-1 truncate text-stone-300">
                  {employees[e.employeeId]?.name ?? e.employeeId} · {e.note}
                </span>
                <span className="shrink-0 text-stone-500">
                  {e.inputTokens.toLocaleString()}/{e.outputTokens.toLocaleString()} tok
                </span>
                <span className="w-24 shrink-0 text-right text-stone-200">{money(e.costUsd, company.currency)}</span>
                <span className="w-16 shrink-0 text-right text-stone-600">{clock(e.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-stone-800 px-2 py-1.5">
      <div className="text-stone-500">{k}</div>
      <div className="text-stone-100">{v}</div>
    </div>
  );
}
