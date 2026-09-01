/**
 * 창립 튜토리얼 5단계: 각 AI 직원과 1:1 면담.
 * 이름 확인 → 역할 설명 → 업무 범위 → 말투/보고 방식 → 접근 자료 → API 연결 →
 * 비용 제한(마법사 내부) → 첫 임무 부여.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useWorld } from '@/state/store';
import { DUTIES, GREETINGS, type AiEmployeeId } from '@/data/seed';
import ApiWizard from '@/components/onboarding/ApiWizard';
import CharacterSprite from '@/components/office/CharacterSprite';
import { Badge, Button, Field, Notice, SectionTitle, Select, TextArea } from '@/components/ui/primitives';
import { money } from '@/lib/format';
import type { Employee } from '@/types';

const DATA_SOURCES = ['사내 공개 문서', '기술 문서 저장소', '고객 자료', '재무 자료', '외부 웹'];

export default function InterviewFlow() {
  const queue = useWorld((s) => s.ui.interviewQueue);
  const employees = useWorld((s) => s.employees);
  const company = useWorld((s) => s.company);
  const completeInterview = useWorld((s) => s.completeInterview);
  const orderTask = useWorld((s) => s.orderTask);

  const currentId = queue[0];
  const employee = currentId ? employees[currentId] : undefined;

  const [scope, setScope] = useState('');
  const [reportStyle, setReportStyle] = useState<Employee['reportStyle']>('concise');
  const [dataAccess, setDataAccess] = useState<string[]>(['사내 공개 문서']);
  const [firstOrder, setFirstOrder] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (employee) {
      setScope(employee.scope);
      setReportStyle(employee.reportStyle);
      setDataAccess(employee.dataAccess);
      setFirstOrder('');
    }
  }, [currentId, employee]);

  if (!employee || !company) return null;
  const connected = employee.binding.status === 'connected';
  const total = 3;
  const index = total - queue.length + 1;

  const finish = () => {
    completeInterview(employee.id, { scope, reportStyle, dataAccess });
    if (firstOrder.trim()) {
      // 첫 임무는 면담 직후 바로 지시할 수 있다. 승인이 필요하면 자동으로 대기 상태가 된다.
      orderTask(employee.id, firstOrder.trim(), 'normal');
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="rounded-full border border-gold/50 px-2 py-0.5 text-[11px] text-gold">
          창립 튜토리얼 5/6 · 1:1 면담 {index}/{total}
        </span>
        <div className="h-px flex-1 bg-stone-800" />
      </div>

      <motion.div key={employee.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="panel p-5">
        {/* 1. 이름 확인 & 역할 설명 */}
        <div className="flex gap-4">
          <svg viewBox="0 0 24 28" className="h-24 w-20 shrink-0">
            <CharacterSprite
              palette={employee.palette}
              sigil={employee.sigil}
              state="idle"
              jobClass={employee.jobClass}
            />
          </svg>
          <div className="min-w-0 flex-1">
            <h1 className="rune-title text-2xl">{employee.name}</h1>
            <p className="text-sm text-stone-200">{employee.title}</p>
            <p className="text-[11px] text-stone-500">{employee.jobLabel}</p>
            <p className="mt-2 rounded-lg border border-stone-700 bg-stone-950/60 px-3 py-2 text-xs text-stone-300">
              “{GREETINGS[employee.id as AiEmployeeId]}”
            </p>
          </div>
        </div>

        <div className="mt-4">
          <SectionTitle>담당 업무</SectionTitle>
          <ul className="grid gap-1 text-xs text-stone-400 sm:grid-cols-2">
            {DUTIES[employee.id as AiEmployeeId].map((d) => (
              <li key={d}>· {d}</li>
            ))}
          </ul>
        </div>

        <hr className="my-5 border-stone-800" />

        {/* 2. 업무 범위 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="업무 범위 설정" hint="이 직원이 맡을 일과 맡지 않을 일을 명확히 적을수록 결과가 좋아집니다.">
              <TextArea rows={2} value={scope} onChange={(e) => setScope(e.target.value)} />
            </Field>
          </div>

          {/* 3. 말투 및 보고 방식 */}
          <Field label="말투 및 보고 방식">
            <Select value={reportStyle} onChange={(e) => setReportStyle(e.target.value as Employee['reportStyle'])}>
              <option value="concise">간결 — 결론 먼저, 근거는 짧게</option>
              <option value="detailed">상세 — 과정과 근거를 모두 서술</option>
              <option value="bullet">요점 나열 — 항목 위주</option>
            </Select>
          </Field>

          {/* 4. 접근 자료 */}
          <Field label="접근할 수 있는 자료" hint="최소 권한 원칙. 필요한 것만 켜세요.">
            <div className="flex flex-wrap gap-1.5">
              {DATA_SOURCES.map((d) => {
                const on = dataAccess.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setDataAccess((prev) => (on ? prev.filter((x) => x !== d) : [...prev, d]))
                    }
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${
                      on ? 'border-gold text-gold' : 'border-stone-700 text-stone-500'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        <hr className="my-5 border-stone-800" />

        {/* 5. API 연결 */}
        <SectionTitle>마력 코어 연결 · AI API</SectionTitle>
        {connected ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-vital/40 bg-vital/10 px-3 py-2 text-xs">
            <Badge tone="vital">연결됨</Badge>
            <span className="text-stone-200">
              {employee.binding.provider} / {employee.binding.model}
            </span>
            <span className="text-stone-400">키: {employee.binding.maskedKey} (서버 보관)</span>
            <span className="text-stone-400">
              작업당 {money(employee.binding.perTaskLimitUsd, company.currency)} · 월{' '}
              {money(employee.binding.monthlyLimitUsd, company.currency)}
            </span>
            <Button size="sm" variant="quiet" onClick={() => setWizardOpen(true)}>
              다시 설정
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Notice tone="warn">
              연결 전에는 이 직원에게 업무를 배정할 수 없습니다. 연결 마법사에서 모델과 비용 한도를 함께
              설정합니다.
            </Notice>
            <Button onClick={() => setWizardOpen(true)}>API 연결 마법사 열기 (10단계)</Button>
          </div>
        )}

        <hr className="my-5 border-stone-800" />

        {/* 6. 첫 임무 부여 */}
        <Field label="첫 임무 부여 (선택)" hint="비워두면 나중에 오피스에서 지시할 수 있습니다.">
          <TextArea
            rows={2}
            value={firstOrder}
            placeholder={`예) ${employee.title}로서 이번 주에 확인해야 할 것을 정리해 주세요`}
            onChange={(e) => setFirstOrder(e.target.value)}
          />
        </Field>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            남은 면담 {queue.length - 1}명
          </span>
          <Button disabled={!connected || !scope.trim()} onClick={finish}>
            면담 완료 {queue.length > 1 ? '· 다음 직원 →' : '· 첫 공동 프로젝트로 →'}
          </Button>
        </div>
      </motion.div>

      {wizardOpen ? <ApiWizard employeeId={employee.id} onClose={() => setWizardOpen(false)} /> : null}
    </div>
  );
}
