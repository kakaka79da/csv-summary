/**
 * AI API 연결 마법사 (10단계).
 *
 * ⚠️ 프로토타입에서는 실제 API 키를 입력받지 않는다.
 * 3단계는 "서버에 키를 등록하는 방법"을 안내만 하고, 이 화면은 서버가 발급한
 * 참조 ID(keyRef)와 마스킹 문자열만 받는다. 키 원문은 브라우저에 존재하지 않는다.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { PROVIDER_CATALOG, findModel } from '@/data/seed';
import { useWorld } from '@/state/store';
import { money, usd } from '@/lib/format';
import { Badge, Button, Field, Modal, Notice, SectionTitle, TextInput } from '@/components/ui/primitives';
import type { ProviderId, ToolId } from '@/types';

const STEP_TITLES = [
  'AI 제공자 선택',
  '모델 선택',
  '서버 측 API 키 등록',
  '연결 테스트',
  '직원에게 모델 할당',
  '작업당 비용 제한',
  '월간 비용 제한',
  '허용 도구 설정',
  '테스트 대화',
  '연결 완료',
];

const TOOL_LABELS: Record<ToolId, { label: string; risk: string }> = {
  web_search: { label: '웹 검색', risk: '외부 네트워크 접근' },
  file_read: { label: '파일 읽기', risk: '지정된 자료만' },
  file_write: { label: '파일 쓰기', risk: '산출물 저장' },
  code_exec: { label: '코드 실행', risk: '샌드박스 필요' },
  email_send: { label: '메일 발송', risk: '외부 발송 — 항상 대표 승인 필요' },
  crm_read: { label: '고객 데이터 조회', risk: '개인정보 취급 주의' },
};

export default function ApiWizard({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const employee = useWorld((s) => s.employees[employeeId]);
  const company = useWorld((s) => s.company);
  const connect = useWorld((s) => s.connectProvider);

  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [perTask, setPerTask] = useState(0.5);
  const [monthly, setMonthly] = useState(15);
  const [tools, setTools] = useState<ToolId[]>(['file_read', 'file_write']);
  const [testState, setTestState] = useState<'idle' | 'running' | 'ok'>('idle');
  const [testReply, setTestReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!employee || !company) return null;
  const modelOpt = findModel(provider, model);

  const canNext = (): boolean => {
    switch (step) {
      case 0:
        return provider !== null;
      case 1:
        return model !== null;
      case 3:
        return testState === 'ok';
      case 5:
        return perTask > 0;
      case 6:
        return monthly >= perTask;
      case 8:
        return testReply !== null;
      default:
        return true;
    }
  };

  const finish = () => {
    if (!provider || !model) return;
    const r = connect(employeeId, {
      provider,
      model,
      perTaskLimitUsd: perTask,
      monthlyLimitUsd: monthly,
      allowedTools: tools,
    });
    if (!r.ok) {
      setError(r.error ?? '연결에 실패했습니다.');
      return;
    }
    onClose();
  };

  return (
    <Modal
      title={`API 연결 마법사 — ${employee.name}`}
      subtitle={`${step + 1}/10 · ${STEP_TITLES[step]}`}
      onClose={onClose}
      wide
    >
      {/* 진행 표시 */}
      <div className="mb-5 flex gap-1">
        {STEP_TITLES.map((t, i) => (
          <div
            key={t}
            title={`${i + 1}. ${t}`}
            className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-gold' : 'bg-stone-700'}`}
          />
        ))}
      </div>

      <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
        {step === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-stone-400">이 직원이 사용할 AI 제공자를 선택합니다.</p>
            {(Object.keys(PROVIDER_CATALOG) as ProviderId[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setProvider(p);
                  setModel(null);
                  setTestState('idle');
                }}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left ${
                  provider === p ? 'border-gold bg-stone-800/60' : 'border-stone-700 hover:border-stone-500'
                }`}
              >
                <span>
                  <span className="block text-sm text-stone-100">{PROVIDER_CATALOG[p].label}</span>
                  <span className="text-[11px] text-stone-500">{PROVIDER_CATALOG[p].hint}</span>
                </span>
                {p === 'local' ? <Badge tone="vital">비용 0</Badge> : null}
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 && provider ? (
          <div className="space-y-2">
            <p className="text-sm text-stone-400">모델에 따라 비용과 품질이 달라집니다.</p>
            {PROVIDER_CATALOG[provider].models.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModel(m.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left ${
                  model === m.id ? 'border-gold bg-stone-800/60' : 'border-stone-700 hover:border-stone-500'
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm text-stone-100">{m.label}</span>
                  <span className="text-[11px] text-stone-500">{m.note}</span>
                </span>
                <span className="shrink-0 text-right text-[11px] text-stone-400">
                  입력 {usd(m.inputPerM)}
                  <br />
                  출력 {usd(m.outputPerM)}
                  <span className="block text-stone-600">/ 100만 토큰</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <Notice tone="warn">
              <strong>이 화면은 API 키를 입력받지 않습니다.</strong> 키를 브라우저에 넣는 순간 번들·
              LocalStorage·네트워크 로그 어디로든 새어 나갈 수 있기 때문입니다.
            </Notice>
            <div className="rounded-lg border border-stone-700 bg-stone-950/60 p-4 text-xs leading-relaxed text-stone-300">
              <SectionTitle>실제 서비스에서의 등록 절차</SectionTitle>
              <ol className="list-decimal space-y-1 pl-4">
                <li>서버 관리자가 제공자 콘솔에서 키를 발급한다.</li>
                <li>키를 서버 환경변수 또는 비밀 관리 서비스에 저장한다 (암호화 보관).</li>
                <li>서버가 키를 검증한 뒤 <code className="text-gold">keyRef</code> 참조 ID를 발급한다.</li>
                <li>프론트엔드는 이 참조 ID와 마스킹 문자열만 받는다.</li>
                <li>모든 AI 호출은 서버를 경유하며, 키는 브라우저로 내려오지 않는다.</li>
              </ol>
              <p className="mt-3 text-stone-500">
                프로토타입에서는 4단계 &ldquo;연결 테스트&rdquo;가 이 과정을 가상으로 수행합니다.
              </p>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-400">
              서버가 저장된 키로 {PROVIDER_CATALOG[provider!].label} 엔드포인트에 연결을 시도합니다.
            </p>
            <div className="rounded-lg border border-stone-700 bg-stone-950/60 p-4 font-mono text-xs text-stone-300">
              {testState === 'idle' ? <span className="text-stone-500">대기 중…</span> : null}
              {testState === 'running' ? <span className="text-arcane-soft">handshake… 마력 코어 공명 중</span> : null}
              {testState === 'ok' ? (
                <div className="space-y-1 text-vital">
                  <div>✔ 인증 성공 (서버 측)</div>
                  <div>✔ 모델 접근 가능: {modelOpt?.label}</div>
                  <div className="text-stone-400">keyRef: srv-keyref://{provider}/{employeeId}</div>
                </div>
              ) : null}
            </div>
            <Button
              disabled={testState === 'running'}
              onClick={() => {
                setTestState('running');
                setTimeout(() => setTestState('ok'), 900);
              }}
            >
              {testState === 'ok' ? '다시 테스트' : '연결 테스트 실행'}
            </Button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3 text-sm">
            <p className="text-stone-400">이 모델을 {employee.name}({employee.title})에게 할당합니다.</p>
            <div className="rounded-lg border border-stone-700 bg-stone-950/60 p-4">
              <Row label="담당 직원" value={`${employee.name} · ${employee.title}`} />
              <Row label="업무 범위" value={employee.scope} />
              <Row label="제공자" value={PROVIDER_CATALOG[provider!].label} />
              <Row label="모델" value={modelOpt?.label ?? '-'} />
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-3">
            <Field label="작업 1건당 비용 상한 (USD)" hint="이 금액을 넘는 작업은 자동으로 대표 승인 대기로 전환됩니다.">
              <TextInput
                type="number"
                step="0.1"
                min="0.05"
                value={perTask}
                onChange={(e) => setPerTask(Math.max(0.05, Number(e.target.value) || 0))}
              />
            </Field>
            <p className="text-xs text-stone-500">현재 설정: {money(perTask, company.currency)}</p>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="space-y-3">
            <Field label="월간 비용 상한 (USD)" hint={`회사 월간 예산은 ${usd(company.monthlyBudgetUsd)} 입니다.`}>
              <TextInput
                type="number"
                step="1"
                min={perTask}
                value={monthly}
                onChange={(e) => setMonthly(Math.max(perTask, Number(e.target.value) || 0))}
              />
            </Field>
            <p className="text-xs text-stone-500">현재 설정: {money(monthly, company.currency)}</p>
            {monthly > company.monthlyBudgetUsd ? (
              <Notice tone="warn">
                직원 한도가 회사 월간 예산보다 큽니다. 회사 예산이 먼저 소진되면 모든 작업이 중단됩니다.
              </Notice>
            ) : null}
          </div>
        ) : null}

        {step === 7 ? (
          <div className="space-y-2">
            <p className="text-sm text-stone-400">이 직원이 사용할 수 있는 도구만 허용합니다. 최소 권한이 원칙입니다.</p>
            {(Object.keys(TOOL_LABELS) as ToolId[]).map((t) => {
              const on = tools.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTools((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${
                    on ? 'border-gold bg-stone-800/60' : 'border-stone-700 hover:border-stone-500'
                  }`}
                >
                  <span>
                    <span className="block text-sm text-stone-100">{TOOL_LABELS[t].label}</span>
                    <span className="text-[11px] text-stone-500">{TOOL_LABELS[t].risk}</span>
                  </span>
                  <span className="text-xs text-stone-400">{on ? '허용' : '차단'}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {step === 8 ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-400">연결이 정상인지 짧은 대화로 확인합니다. (가상 응답)</p>
            <Button
              onClick={() =>
                setTestReply(
                  `안녕하세요, ${company.ceoName} 대표님. ${employee.name}입니다. ${modelOpt?.label} 로 연결되었고, 작업당 ${usd(
                    perTask,
                  )} · 월 ${usd(monthly)} 한도 안에서 움직이겠습니다.`,
                )
              }
            >
              테스트 대화 보내기
            </Button>
            {testReply ? (
              <div className="rounded-lg border border-stone-700 bg-stone-950/60 p-3 text-sm text-stone-200">
                {testReply}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 9 ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-stone-700 bg-stone-950/60 p-4 text-sm">
              <Row label="직원" value={`${employee.name} · ${employee.title}`} />
              <Row label="제공자 / 모델" value={`${PROVIDER_CATALOG[provider!].label} / ${modelOpt?.label}`} />
              <Row label="작업당 한도" value={money(perTask, company.currency)} />
              <Row label="월간 한도" value={money(monthly, company.currency)} />
              <Row label="허용 도구" value={tools.length ? tools.map((t) => TOOL_LABELS[t].label).join(', ') : '없음'} />
              <Row label="키 보관" value="서버 전용 (브라우저에는 참조 ID만)" />
            </div>
            {tools.includes('email_send') ? (
              <Notice tone="warn">
                메일 발송 권한이 포함되어 있습니다. 외부로 나가는 발송은 매번 대표 승인을 거칩니다.
              </Notice>
            ) : null}
            {modelOpt && (modelOpt.inputPerM > 0 || modelOpt.outputPerM > 0) ? (
              <Notice>
                유료 모델 연결은 대표 승인 사항입니다. 아래 버튼을 누르면 대표 승인으로 기록되고 감사 로그에
                남습니다.
              </Notice>
            ) : null}
            {error ? <Notice tone="warn">{error}</Notice> : null}
          </div>
        ) : null}
      </motion.div>

      <div className="mt-6 flex items-center justify-between">
        <Button variant="quiet" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          ← 이전
        </Button>
        {step < 9 ? (
          <Button disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
            다음 →
          </Button>
        ) : (
          <Button onClick={finish}>연결 완료 · 대표 승인</Button>
        )}
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-stone-800 py-1.5 last:border-0">
      <span className="shrink-0 text-xs text-stone-500">{label}</span>
      <span className="text-right text-xs text-stone-200">{value}</span>
    </div>
  );
}

export { Row as WizardRow };
