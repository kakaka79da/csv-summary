/**
 * 조직 관리(인간 직원 초대 / AI 직원 추가 요청 / 지사·서버 선택)와 설정·보안 화면.
 * 2단계 이후 기능은 UI만 준비하고, 실제 동작은 백엔드 도입 시 연결한다.
 */
import { useState } from 'react';
import { useWorld } from '@/state/store';
import { money } from '@/lib/format';
import { Badge, Button, Field, Notice, SectionTitle, Select, TextInput } from '@/components/ui/primitives';

const BRANCHES = [
  { id: 'kr', label: '한국 본사', region: 'ap-northeast-2 (서울)', status: '운영 중' },
  { id: 'jp', label: '일본 지사', region: 'ap-northeast-1 (도쿄)', status: '3단계에서 개설' },
  { id: 'us', label: '미국 지사', region: 'us-west-2 (오레곤)', status: '3단계에서 개설' },
  { id: 'eu', label: '유럽 지사', region: 'eu-central-1 (프랑크푸르트)', status: '3단계에서 개설' },
];

export function PeoplePanel() {
  const company = useWorld((s) => s.company);
  const employees = useWorld((s) => s.employees);
  const order = useWorld((s) => s.employeeOrder);
  const setToast = useWorld((s) => s.setToast);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [invites, setInvites] = useState<Array<{ email: string; role: string }>>([]);
  if (!company) return null;

  return (
    <div className="space-y-4">
      {/* AI 직원 */}
      <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
        <SectionTitle>AI 직원 ({order.length}명)</SectionTitle>
        <div className="space-y-1.5">
          {order.map((id) => {
            const e = employees[id];
            if (!e) return null;
            return (
              <div key={id} className="flex items-center justify-between rounded-lg border border-stone-800 px-3 py-2 text-[11px]">
                <span className="min-w-0">
                  <span className="block text-stone-100">
                    {e.name} <span className="text-stone-500">· {e.title}</span>
                  </span>
                  <span className="text-stone-500">{e.scope}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {e.onLeave ? <Badge>휴직</Badge> : <Badge tone="vital">근무</Badge>}
                  <Badge tone={e.binding.status === 'connected' ? 'gold' : 'ember'}>
                    {e.binding.status === 'connected' ? e.binding.model : '미연결'}
                  </Badge>
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setToast('AI 직원 추가는 대표 승인 사항입니다. 2단계에서 활성화됩니다.')}
          >
            AI 직원 추가 요청 (승인 필요)
          </Button>
        </div>
      </div>

      {/* 인간 직원 초대 */}
      <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
        <SectionTitle>인간 직원 초대</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field label="초대할 이메일">
              <TextInput
                type="email"
                value={inviteEmail}
                placeholder="teammate@example.com"
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </Field>
          </div>
          <Field label="권한">
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="viewer">열람만</option>
              <option value="operator">업무 지시 가능</option>
              <option value="reviewer">문서 검토 가능</option>
            </Select>
          </Field>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">권한 변경은 대표 승인 사항입니다</span>
          <Button
            size="sm"
            disabled={!inviteEmail.includes('@')}
            onClick={() => {
              setInvites((v) => [...v, { email: inviteEmail, role: inviteRole }]);
              setInviteEmail('');
              setToast('초대 대기 목록에 추가했습니다. 실제 발송은 백엔드 연결 후 동작합니다.');
            }}
          >
            초대 (대기)
          </Button>
        </div>
        {invites.length > 0 ? (
          <ul className="mt-3 space-y-1 text-[11px] text-stone-400">
            {invites.map((i) => (
              <li key={i.email} className="flex justify-between border-b border-stone-800 py-1">
                <span>{i.email}</span>
                <span className="text-stone-600">{i.role} · 발송 대기</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* 지사 / 서버 */}
      <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4">
        <SectionTitle>지사 및 서버</SectionTitle>
        <div className="space-y-1.5 text-[11px]">
          {BRANCHES.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-lg border border-stone-800 px-3 py-2">
              <span>
                <span className="block text-stone-100">{b.label}</span>
                <span className="text-stone-500">{b.region}</span>
              </span>
              <Badge tone={b.label === company.branch ? 'gold' : 'neutral'}>
                {b.label === company.branch ? '현재 지사' : b.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const company = useWorld((s) => s.company);
  const session = useWorld((s) => s.session);
  const resetAll = useWorld((s) => s.resetAll);
  const logout = useWorld((s) => s.logout);
  if (!company) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-700 bg-stone-900/60 p-4 text-[11px]">
        <SectionTitle>현재 세션</SectionTitle>
        <Row k="로그인 계정" v={`${session?.accountName} (${session?.role})`} />
        <Row k="회사" v={company.name} />
        <Row k="회사 대표" v={`${company.ceoName} CEO`} />
        <Row k="기본 지사 / 통화" v={`${company.branch} / ${company.currency}`} />
        <Row k="월간 AI 예산" v={money(company.monthlyBudgetUsd, company.currency)} />
      </div>

      <div className="rounded-xl border border-ember/40 bg-ember/5 p-4">
        <SectionTitle>보안 — 이 프로토타입의 한계</SectionTitle>
        <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-stone-300">
          <li>실제 인증이 없습니다. 데모 로그인은 누구나 어떤 역할로도 진입할 수 있습니다.</li>
          <li>상태가 브라우저 localStorage 에 저장됩니다. 공용 PC에서는 사용을 피하세요.</li>
          <li>
            API 키는 <strong>어떤 형태로도 저장하지 않습니다.</strong> 연결 정보에는 서버 참조 ID와 마스킹
            문자열만 있습니다.
          </li>
          <li>비용 차단은 클라이언트에서만 이루어집니다. 실제 서비스에서는 서버가 최종 게이트여야 합니다.</li>
          <li>감사 로그를 클라이언트가 보관하므로 위·변조가 가능합니다.</li>
        </ul>
        <p className="mt-2 text-[11px] text-stone-500">
          해결 방법은 <code className="text-gold">docs/SECURITY.md</code> 와{' '}
          <code className="text-gold">docs/BACKEND-MIGRATION.md</code> 에 정리되어 있습니다.
        </p>
      </div>

      <Notice>
        데이터 초기화는 되돌릴 수 없습니다. 회사·직원·미션·비용 기록이 모두 삭제됩니다.
      </Notice>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={logout}>
          로그아웃
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            if (confirm('모든 데이터를 삭제할까요? 되돌릴 수 없습니다.')) resetAll();
          }}
        >
          전체 초기화
        </Button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-stone-800 py-1 last:border-0">
      <span className="shrink-0 text-stone-500">{k}</span>
      <span className="truncate text-right text-stone-200">{v}</span>
    </div>
  );
}
