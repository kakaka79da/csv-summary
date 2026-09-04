/**
 * 일정 · 타임라인 — 회사 전체 / 지사별.
 *
 * 화면 구성의 핵심 규칙 하나: **전사 공용 일정(branchId === null)은 어느 지사를
 * 봐도 함께 보인다.** 그래서 본사를 열면 "전사 공용"과 "본사 내부"가 두 줄로
 * 나뉘고, 부산 지사를 열면 "전사 공용"과 "부산 지사"가 나뉜다. 회사 전체를 열면
 * 전사 공용 + 지사별로 묶어서 한눈에 본다.
 *
 * 프로젝트(미션) 막대는 저장하지 않고 미션에서 그때그때 만든다 — 저장하면
 * 미션이 끝났는데 타임라인만 옛날 상태로 남는 일이 생긴다.
 */
import { useMemo, useState } from 'react';
import { useWorld } from '@/state/store';
import {
  SCHEDULE_KINDS,
  SCHEDULE_KIND_LABEL,
  addDays,
  eventsForBranch,
  groupByBranch,
  isWeekend,
  layoutBars,
  missionsToEvents,
  shortDay,
  todayDay,
} from '@/lib/schedule';
import { Badge, Button, Notice, SectionTitle, Select, TextInput, Tooltip } from '@/components/ui/primitives';
import type { Bar } from '@/lib/schedule';
import type { ScheduleEvent, ScheduleKind } from '@/types';

/** 한 화면에 보여줄 날짜 수. 2주가 "이번 주와 다음 주"를 담기에 알맞다. */
const WINDOW_DAYS = 14;

const KIND_COLOR: Record<ScheduleKind, string> = {
  project: 'bg-arcane/70 border-arcane',
  meeting: 'bg-gold/60 border-gold',
  deadline: 'bg-ember/70 border-ember',
  holiday: 'bg-vital/60 border-vital',
  trip: 'bg-stone-500/70 border-stone-400',
  other: 'bg-stone-600/70 border-stone-500',
};

export default function SchedulePanel() {
  const session = useWorld((s) => s.session);
  const company = useWorld((s) => s.company);
  const branches = useWorld((s) => s.branches);
  const branchOrder = useWorld((s) => s.branchOrder);
  const schedule = useWorld((s) => s.schedule);
  const missions = useWorld((s) => s.missions);
  const missionOrder = useWorld((s) => s.missionOrder);

  const [scope, setScope] = useState<string>('all');
  const [windowStart, setWindowStart] = useState(() => addDays(todayDay(), -2));
  const [formOpen, setFormOpen] = useState(false);

  const isCeo = session?.role === 'ceo';
  const branchList = useMemo(
    () => branchOrder.map((id) => branches[id]).filter((b): b is NonNullable<typeof b> => Boolean(b)),
    [branchOrder, branches],
  );

  // 미션 막대는 저장하지 않고 여기서 만든다. 전사 공용으로 둔다 —
  // 미션에는 아직 지사 개념이 없기 때문에, 없는 소속을 지어내지 않는다.
  const missionBars = useMemo(
    () => missionsToEvents(missionOrder.map((id) => missions[id]).filter(Boolean)),
    [missions, missionOrder],
  );

  const allEvents = useMemo(() => [...schedule, ...missionBars], [schedule, missionBars]);

  if (!company) return null;

  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(windowStart, i));
  const today = todayDay();

  /* 화면에 그릴 묶음을 정한다 */
  let groups: Array<{ key: string; label: string; hint?: string; events: ScheduleEvent[] }>;
  if (scope === 'all') {
    groups = groupByBranch(allEvents, branchList).map((g) => ({
      ...g,
      hint: g.key === 'company' ? '모든 지사에 함께 보이는 일정입니다.' : undefined,
    }));
  } else {
    const split = eventsForBranch(allEvents, scope);
    const branchName = branches[scope]?.name ?? scope;
    const isHq = branches[scope]?.kind === 'headquarters';
    groups = [
      {
        key: 'company',
        label: '전사 공용',
        hint: '회사 전체 일정입니다. 어느 지사를 봐도 함께 보입니다.',
        events: split.company,
      },
      {
        key: scope,
        label: isHq ? `${branchName} 내부` : `${branchName} 일정`,
        hint: isHq ? '본사에서만 진행하는 일정입니다.' : undefined,
        events: split.own,
      },
    ];
  }

  const totalShown = groups.reduce((n, g) => n + g.events.length, 0);

  return (
    <div className="space-y-3">
      {/* 범위 고르기 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Tooltip text="전사 공용 일정과 모든 지사 일정을 지사별로 묶어서 봅니다.">
          <button
            type="button"
            onClick={() => setScope('all')}
            className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
              scope === 'all' ? 'border-gold text-gold' : 'border-stone-700 text-stone-400 hover:border-stone-500'
            }`}
          >
            🏢 회사 전체
          </button>
        </Tooltip>
        {branchList.map((b) => (
          <Tooltip
            key={b.id}
            text={
              b.kind === 'headquarters'
                ? '전사 공용 일정과 본사 내부 일정을 나눠서 봅니다.'
                : `전사 공용 일정과 ${b.name} 일정을 나눠서 봅니다.`
            }
          >
            <button
              type="button"
              onClick={() => setScope(b.id)}
              className={`rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
                scope === b.id ? 'border-gold text-gold' : 'border-stone-700 text-stone-400 hover:border-stone-500'
              }`}
            >
              {b.kind === 'headquarters' ? '🏛 ' : '📍 '}
              {b.name}
            </button>
          </Tooltip>
        ))}
      </div>

      {/* 기간 이동 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" hint="2주 앞으로 돌립니다." onClick={() => setWindowStart(addDays(windowStart, -WINDOW_DAYS))}>
            ← 이전
          </Button>
          <Button size="sm" variant="quiet" hint="오늘이 보이는 자리로 돌아옵니다." onClick={() => setWindowStart(addDays(todayDay(), -2))}>
            오늘
          </Button>
          <Button size="sm" variant="ghost" hint="2주 뒤로 넘깁니다." onClick={() => setWindowStart(addDays(windowStart, WINDOW_DAYS))}>
            다음 →
          </Button>
          <span className="ml-1 text-[11px] text-stone-500">
            {shortDay(days[0])} ~ {shortDay(days[days.length - 1])}
          </span>
        </div>
        {isCeo ? (
          <Button
            size="sm"
            hint="일정을 추가합니다. 전사 공용으로 두면 모든 지사에 함께 보입니다."
            onClick={() => setFormOpen((v) => !v)}
          >
            {formOpen ? '닫기' : '+ 일정 추가'}
          </Button>
        ) : null}
      </div>

      {formOpen && isCeo ? <ScheduleForm branchList={branchList} onDone={() => setFormOpen(false)} /> : null}

      {/* 타임라인 */}
      <div className="overflow-x-auto rounded-lg border border-stone-800">
        <div className="min-w-[760px]">
          {/* 날짜 머리글 */}
          <div
            className="grid border-b border-stone-800 bg-stone-950/60"
            style={{ gridTemplateColumns: `150px repeat(${WINDOW_DAYS}, minmax(0, 1fr))` }}
          >
            <div className="px-2.5 py-1.5 text-[10px] uppercase tracking-widest text-stone-600">일정</div>
            {days.map((d) => (
              <div
                key={d}
                className={`border-l border-stone-800 px-1 py-1.5 text-center text-[10px] ${
                  d === today ? 'bg-gold/10 font-semibold text-gold' : isWeekend(d) ? 'text-stone-600' : 'text-stone-500'
                }`}
              >
                {shortDay(d).replace(' ', '')}
              </div>
            ))}
          </div>

          {totalShown === 0 ? (
            <div className="px-3 py-6 text-center text-[11px] text-stone-600">
              이 기간에 일정이 없습니다.
              {isCeo ? ' 위의 "+ 일정 추가" 로 넣어 보세요.' : ''}
            </div>
          ) : (
            groups.map((g) => (
              <ScheduleGroup key={g.key} group={g} days={days} windowStart={windowStart} today={today} isCeo={isCeo} />
            ))
          )}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-stone-500">
        {SCHEDULE_KINDS.map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={`inline-block h-2 w-3 rounded-sm border ${KIND_COLOR[k]}`} />
            {SCHEDULE_KIND_LABEL[k].ko}
          </span>
        ))}
        <span className="text-stone-600">· 점선 테두리 = 미션에서 자동으로 만든 막대 (여기서 고칠 수 없습니다)</span>
      </div>
    </div>
  );
}

function ScheduleGroup({
  group,
  days,
  windowStart,
  today,
  isCeo,
}: {
  group: { key: string; label: string; hint?: string; events: ScheduleEvent[] };
  days: string[];
  windowStart: string;
  today: string;
  isCeo: boolean;
}) {
  const bars = layoutBars(group.events, windowStart, days.length);

  return (
    <div className="border-b border-stone-800 last:border-b-0">
      <div className="flex items-baseline gap-2 bg-stone-900/40 px-2.5 py-1">
        <span className="text-[11px] font-semibold text-stone-300">{group.label}</span>
        <span className="text-[10px] text-stone-600">{group.events.length}건</span>
        {group.hint ? <span className="text-[10px] text-stone-600">· {group.hint}</span> : null}
      </div>

      {bars.length === 0 ? (
        <div className="px-2.5 py-2 text-[10px] text-stone-700">이 기간에는 없음</div>
      ) : (
        bars.map((bar) => <ScheduleRow key={bar.event.id} bar={bar} days={days} today={today} isCeo={isCeo} />)
      )}
    </div>
  );
}

function ScheduleRow({ bar, days, today, isCeo }: { bar: Bar; days: string[]; today: string; isCeo: boolean }) {
  const removeScheduleEvent = useWorld((s) => s.removeScheduleEvent);
  const e = bar.event;
  const label = SCHEDULE_KIND_LABEL[e.kind];
  const derived = e.derived === true;

  return (
    <div
      className="grid items-center border-t border-stone-900"
      style={{ gridTemplateColumns: `150px repeat(${days.length}, minmax(0, 1fr))` }}
    >
      <div className="flex items-center gap-1 px-2.5 py-1.5">
        <span className="truncate text-[11px] text-stone-300" title={e.title}>
          {label.icon} {e.title}
        </span>
        {isCeo && !derived ? (
          <button
            type="button"
            aria-label={`${e.title} 일정 지우기`}
            title="이 일정을 지웁니다"
            onClick={() => removeScheduleEvent(e.id)}
            className="ml-auto shrink-0 text-[10px] text-stone-600 hover:text-ember"
          >
            ✕
          </button>
        ) : null}
      </div>

      {/* 날짜 칸 배경 */}
      {days.map((d) => (
        <div
          key={d}
          className={`h-8 border-l border-stone-900 ${d === today ? 'bg-gold/5' : isWeekend(d) ? 'bg-stone-950/40' : ''}`}
        />
      ))}

      {/* 막대 — 배경 칸 위에 겹쳐 놓는다 */}
      <div
        className="pointer-events-none col-start-2 col-end-[-1] row-start-1 grid"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {/* 자리는 이 div 가 잡는다. Tooltip 은 감싸는 span 을 하나 더 만들기 때문에,
            gridColumn 을 안쪽 요소에 주면 그리드 자식이 아니라서 먹지 않는다. */}
        <div
          className="min-w-0 self-center px-0.5"
          style={{ gridColumn: `${bar.offset + 1} / span ${bar.span}` }}
        >
          <Tooltip
            full
            text={`${e.title} · ${label.ko} · ${shortDay(e.startDay)} ~ ${shortDay(e.endDay)}${
              e.note ? ` — ${e.note}` : ''
            }${derived ? ' (미션에서 자동 생성)' : ''}`}
          >
            <span
              className={`pointer-events-auto block w-full truncate rounded px-1.5 text-[10px] leading-5 text-stone-950 ${
                KIND_COLOR[e.kind]
              } ${derived ? 'border border-dashed' : 'border'} ${bar.clippedStart ? 'rounded-l-none' : ''} ${
                bar.clippedEnd ? 'rounded-r-none' : ''
              }`}
            >
              {bar.clippedStart ? '‹ ' : ''}
              {e.title}
              {bar.clippedEnd ? ' ›' : ''}
            </span>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

function ScheduleForm({
  branchList,
  onDone,
}: {
  branchList: Array<{ id: string; name: string; kind: string }>;
  onDone: () => void;
}) {
  const addScheduleEvent = useWorld((s) => s.addScheduleEvent);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ScheduleKind>('project');
  const [branchId, setBranchId] = useState<string>('__company__');
  const [startDay, setStartDay] = useState(todayDay());
  const [endDay, setEndDay] = useState(addDays(todayDay(), 2));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-stone-700 bg-stone-950/50 p-3">
      <SectionTitle>새 일정</SectionTitle>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-stone-400">
          이름
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 신제품 출시 준비" />
        </label>
        <label className="text-[11px] text-stone-400">
          종류
          <Select value={kind} onChange={(e) => setKind(e.target.value as ScheduleKind)}>
            {SCHEDULE_KINDS.map((k) => (
              <option key={k} value={k}>
                {SCHEDULE_KIND_LABEL[k].icon} {SCHEDULE_KIND_LABEL[k].ko}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-[11px] text-stone-400">
          어디 일정인가
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="__company__">🏢 전사 공용 (모든 지사에 표시)</option>
            {branchList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.kind === 'headquarters' ? '🏛 ' : '📍 '}
                {b.name} 내부
              </option>
            ))}
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-stone-400">
            시작
            <input
              type="date"
              value={startDay}
              onChange={(e) => setStartDay(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-900 px-2 py-1.5 text-xs text-stone-100"
            />
          </label>
          <label className="text-[11px] text-stone-400">
            끝
            <input
              type="date"
              value={endDay}
              onChange={(e) => setEndDay(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-900 px-2 py-1.5 text-xs text-stone-100"
            />
          </label>
        </div>
        <label className="text-[11px] text-stone-400 sm:col-span-2">
          메모 (선택)
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="한 줄 설명" />
        </label>
      </div>

      {error ? <p className="mt-2 text-[11px] text-ember">{error}</p> : null}

      <div className="mt-3 flex gap-1.5">
        <Button
          size="sm"
          onClick={() => {
            const r = addScheduleEvent({
              title,
              kind,
              branchId: branchId === '__company__' ? null : branchId,
              startDay,
              endDay,
              note,
            });
            if (!r.ok) {
              setError(r.error ?? '추가할 수 없습니다.');
              return;
            }
            setTitle('');
            setNote('');
            setError(null);
            onDone();
          }}
        >
          추가
        </Button>
        <Button size="sm" variant="quiet" onClick={onDone}>
          취소
        </Button>
      </div>
    </div>
  );
}

/** 지사가 본사 하나뿐일 때 보여 줄 안내 — 지사 탭이 하나만 있으면 이유를 알려 준다. */
export function ScheduleEmptyBranchNote() {
  const branchOrder = useWorld((s) => s.branchOrder);
  if (branchOrder.length > 1) return null;
  return (
    <Notice>
      아직 본사만 있어 지사 탭이 하나입니다. <Badge tone="gold">조직 · 지사</Badge> 패널에서 지사를 세우면
      이 화면에 지사별 일정 탭이 생깁니다.
    </Notice>
  );
}
