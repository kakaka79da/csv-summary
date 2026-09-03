/**
 * 인간 사원 상세 패널 — 오피스에서 사원을 클릭하면 오른쪽에 열린다.
 *
 * AI 직원 패널(EmployeePanel)과 나란히 놓이지만 내용은 다르다. AI 는 상태 머신이
 * 계산한 값을 보여 주면 되지만, **사람이 뭘 하는지는 이 앱이 알 수 없다**.
 * 그래서 "지금 하는 일"은 사원 본인이 남긴 한 줄을 그대로 보여 주고, 언제 남겼는지도
 * 같이 표시한다 — 오래된 값을 최신인 척 보여 주지 않기 위해서다.
 */
import { useEffect, useRef, useState } from 'react';
import { useWorld } from '@/state/store';
import { EMPLOYEE_APPEARANCES } from '@/data/seed';
import CharacterSprite from '@/components/office/CharacterSprite';
import { clock, money } from '@/lib/format';
import { Badge, Button, CopyButton, MailLink, Notice, SectionTitle, TextInput } from '@/components/ui/primitives';
import type { WorkMode } from '@/types';

const WORK_MODE: Record<WorkMode, { label: string; tone: 'vital' | 'arcane' | 'neutral'; where: string }> = {
  office: { label: '출근', tone: 'vital', where: '사무실 휴게실 근처에 있습니다.' },
  remote: { label: '재택', tone: 'arcane', where: '자택에서 근무 중이라 오피스 지도에는 그리지 않습니다.' },
  not_started: { label: '미출근', tone: 'neutral', where: '아직 도착하지 않아 오른쪽 출근길에 서 있습니다.' },
};

/** "3분 전" 처럼 얼마나 지났는지. 오래된 값을 최신처럼 보이지 않게 하려고 쓴다. */
function ago(ts: number, now: number): string {
  const min = Math.floor((now - ts) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

export default function HumanStaffPanel({ staffId }: { staffId: string }) {
  const record = useWorld((s) => s.humanStaff[staffId]);
  const session = useWorld((s) => s.session);
  const company = useWorld((s) => s.company);
  const branches = useWorld((s) => s.branches);
  const messages = useWorld((s) => s.staffChats[staffId]);
  const sendStaffMessage = useWorld((s) => s.sendStaffMessage);
  const updateOwnTaskNote = useWorld((s) => s.updateOwnTaskNote);
  const selectStaff = useWorld((s) => s.selectStaff);

  const [draft, setDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  // 급여·연락처가 들어 있어 어깨너머로 보이기 쉬운 칸이다. 기본은 가려 둔다.
  const [infoOpen, setInfoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const thread = messages ?? [];
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length]);

  // 본인이 열었을 때는 "지금 하는 일" 입력칸에 지금 값을 채워 둔다.
  const isSelf = session?.role === 'human_staff' && session.humanStaffId === staffId;
  useEffect(() => {
    setNoteDraft(record?.currentTaskNote ?? '');
  }, [record?.currentTaskNote, staffId]);

  if (!record || !company) return null;

  const isCeo = session?.role === 'ceo';
  const canChat = isCeo || isSelf;
  const appearance = EMPLOYEE_APPEARANCES[record.appearanceId];
  const mode = WORK_MODE[record.workMode];
  const branch = record.branchId ? branches[record.branchId] : null;
  const now = Date.now();
  // 메일 앱 제목 줄을 미리 채워 둔다 — 받는 사람이 어느 회사에서 온 메일인지 바로 알도록.
  const mailSubject = `[${company.name}] `;

  const send = () => {
    const r = sendStaffMessage(staffId, draft);
    if (!r.ok) {
      setError(r.error ?? '보낼 수 없습니다.');
      return;
    }
    setError(null);
    setDraft('');
  };

  return (
    <div className="panel flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-start gap-3 border-b border-stone-700/70 p-4">
        <svg viewBox="0 0 24 28" className="h-20 w-16 shrink-0">
          <CharacterSprite
            palette={appearance.palette}
            sigil={appearance.sigil}
            state="idle"
            jobClass={appearance.jobClass}
            gender={appearance.gender}
          />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="rune-title text-lg">{record.name}</h2>
            <span className="text-xs text-stone-400">{record.role || '직책 미정'}</span>
          </div>
          <div className="truncate text-[11px] text-stone-500">
            <MailLink email={record.email} subject={mailSubject} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={mode.tone}>{mode.label}</Badge>
            <Badge tone="neutral">🧑 인간 사원</Badge>
            {isSelf ? <Badge tone="gold">나</Badge> : null}
          </div>
        </div>
        <Button size="sm" variant="quiet" hint="패널을 닫습니다." onClick={() => selectStaff(null)}>
          ✕
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto scroll-thin p-4">
        {/* 지금 하는 일 */}
        <div>
          <SectionTitle>지금 하는 일</SectionTitle>
          {record.currentTaskNote ? (
            <div className="mt-1.5 rounded-lg border border-stone-700 bg-stone-900/60 px-3 py-2">
              <p className="text-sm text-stone-100">{record.currentTaskNote}</p>
              <p className="mt-1 text-[10px] text-stone-500">
                본인이 {record.currentTaskUpdatedAt ? ago(record.currentTaskUpdatedAt, now) : '언젠가'} 남김
                {record.currentTaskUpdatedAt ? ` · ${clock(record.currentTaskUpdatedAt)}` : ''}
              </p>
            </div>
          ) : (
            <p className="mt-1.5 text-[11px] text-stone-500">
              아직 남긴 내용이 없습니다. 사람이 무엇을 하는지는 시스템이 알 수 없어, 본인이 직접 적은
              한 줄만 보여 줍니다.
            </p>
          )}

          {isSelf ? (
            <div className="mt-2 flex gap-2">
              <TextInput
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="지금 무슨 일을 하고 있나요?"
              />
              <span className="shrink-0">
                <Button size="sm" hint="현황판과 이 패널에 보이는 한 줄을 갱신합니다." onClick={() => updateOwnTaskNote(noteDraft)}>
                  갱신
                </Button>
              </span>
            </div>
          ) : null}
        </div>

        {/* 근무 정보 — 급여·연락처가 있어 기본은 가려 둔다 */}
        <div>
          <div className="flex items-center justify-between gap-2">
            <SectionTitle className="mb-0">근무 정보</SectionTitle>
            <Button
              size="sm"
              variant="quiet"
              hint={
                infoOpen
                  ? '근무 정보를 다시 가립니다.'
                  : '급여·연락처 등이 들어 있어 기본은 가려 둡니다. 눌러서 펼칩니다.'
              }
              onClick={() => setInfoOpen((v) => !v)}
            >
              {infoOpen ? '가리기' : '나오기'}
            </Button>
          </div>

          {!infoOpen ? (
            <p className="mt-1 text-[10px] text-stone-600">
              급여 · 연락처 등이 들어 있어 가려 두었습니다. 이메일은 위 이름 아래에서 바로 누를 수 있습니다.
            </p>
          ) : null}

          <dl className={`mt-1.5 space-y-1 text-[11px] ${infoOpen ? '' : 'hidden'}`}>
            <Row label="근무 형태" value={`${mode.label} — ${mode.where}`} />
            <Row
              label="이메일"
              value={
                <span className="flex flex-wrap items-center gap-1.5">
                  <MailLink email={record.email} subject={mailSubject} />
                  <CopyButton value={record.email} label="주소 복사" />
                </span>
              }
            />
            <Row label="소속 지사" value={branch ? `${branch.name} (${branch.country})` : '본사 (미배치)'} />
            {isCeo ? (
              <Row
                label="월 급여"
                value={record.monthlySalaryUsd === null ? '미설정' : money(record.monthlySalaryUsd, company.currency)}
              />
            ) : null}
            <Row label="복지" value={record.benefits.length > 0 ? record.benefits.join(', ') : '없음'} />
            <Row label="연락처" value={record.phone || '미등록'} />
            <Row
              label="승인일"
              value={record.decidedAt ? `${clock(record.decidedAt)} · ${record.decidedBy ?? '-'}` : '-'}
            />
          </dl>
          {isCeo && infoOpen ? (
            <p className="mt-1.5 text-[10px] text-stone-600">
              직책 · 급여 · 복지 · 근무 형태 변경은 <span className="text-stone-400">조직 · 지사</span> 패널에서 합니다.
            </p>
          ) : null}
        </div>

        {/* 1:1 대화 */}
        <div>
          <SectionTitle>1:1 대화</SectionTitle>
          <div ref={scrollRef} className="mt-1.5 max-h-56 space-y-1.5 overflow-y-auto scroll-thin text-[11px]">
            {thread.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg px-2.5 py-1.5 ${m.from === 'ceo' ? 'bg-gold/10' : 'bg-stone-800/60'}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={m.from === 'ceo' ? 'text-gold' : 'text-stone-300'}>
                    {m.authorName}
                    <span className="ml-1 text-stone-600">{m.from === 'ceo' ? '대표' : '사원'}</span>
                  </span>
                  <span className="text-stone-600">{clock(m.ts)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-stone-200">{m.text}</p>
              </div>
            ))}
            {thread.length === 0 ? <p className="text-stone-600">아직 주고받은 대화가 없습니다.</p> : null}
          </div>

          {error ? <p className="mt-1.5 text-[11px] text-ember">{error}</p> : null}

          {canChat ? (
            <div className="mt-2 flex gap-2">
              <TextInput
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={isCeo ? `${record.name}님에게 보낼 말…` : '대표님에게 보낼 말…'}
              />
              {/* 버튼이 줄바꿈되지 않도록 폭을 고정한다 (입력칸이 남는 폭을 다 가져간다). */}
              <span className="shrink-0">
                <Button size="sm" disabled={!draft.trim()} onClick={send}>
                  전송
                </Button>
              </span>
            </div>
          ) : (
            <div className="mt-2">
              <Notice>이 대화는 대표와 본인만 쓸 수 있습니다.</Notice>
            </div>
          )}

          <p className="mt-2 text-[10px] leading-relaxed text-stone-600">
            이 데모는 브라우저 한 곳에 저장됩니다. 대표가 쓴 말은 그 사원 계정으로 다시 로그인하면
            보이고, 그 반대도 같습니다. 실시간으로 서로의 화면에 뜨는 것은 서버가 있어야 하며
            백엔드 구현 항목입니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-stone-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-stone-300">{value}</dd>
    </div>
  );
}
