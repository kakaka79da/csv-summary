/**
 * 기억 → 시스템 프롬프트 컴파일러.
 *
 * 설계의 핵심: 기억(EmployeeMemory)이 원본이고, 시스템 프롬프트는 매번 새로 파생시키는
 * 값이다. 반대 방향(프롬프트를 손으로 고쳐 기억을 바꾸는 것)은 없다.
 *
 * 이 함수가 순수 함수이고 EmployeeMemory 만 입력으로 받는다는 사실 자체가
 * "모델을 바꿔도 기억 구조는 유지된다"는 요구사항의 실제 구현이다 —
 * provider/model 이 바뀌어도 이 함수의 출력 형식만 모델에 맞게 조정하면 되고,
 * 기억 파일은 전혀 건드리지 않는다.
 */
import { nid } from '@/lib/format';
import type { EmployeeMemory, MemoryRecord, ProviderId } from '@/types';

/** 기억에서 파생시킬 때 최근 기억을 몇 건까지 프롬프트에 넣을지. */
const MAX_RECENT_RECORDS = 12;

function recentRecords(records: MemoryRecord[]): MemoryRecord[] {
  // supersedes 로 대체된 기억은 제외하고, 최신순으로 상한을 둔다.
  const superseded = new Set(records.map((r) => r.supersedes).filter((x): x is string => !!x));
  return [...records]
    .filter((r) => !superseded.has(r.id))
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_RECENT_RECORDS);
}

function activeAgreements(memory: EmployeeMemory) {
  return memory.agreements.filter((a) => a.status === 'active');
}

/**
 * 모델에 무관하게 항상 같은 내용을 담는 프롬프트 섹션들을 만든다.
 * 실제 API 호출 시 provider 별 메시지 포맷(role/content 구조 등)으로 감싸는 일은
 * 이 함수를 호출하는 서버 쪽 어댑터가 한다 — 이 함수는 그 포맷을 모른다.
 */
export function compileSystemPrompt(memory: EmployeeMemory): string {
  const { identity } = memory;
  const lines: string[] = [];

  lines.push(`당신은 "${identity.displayName}"(${identity.title} · ${identity.jobLabel})입니다.`);
  lines.push('');
  lines.push('## 성품');
  identity.coreTraits.forEach((t) => lines.push(`- ${t}`));
  lines.push('');
  lines.push('## 절대 가치');
  identity.values.forEach((v) => lines.push(`- ${v}`));
  lines.push('');
  lines.push('## 말투');
  lines.push(`- 어조: ${identity.voice.register}`);
  lines.push(`- 길이/구성: ${identity.voice.length}`);
  if (identity.voice.prefers.length) lines.push(`- 선호: ${identity.voice.prefers.join(', ')}`);
  if (identity.voice.avoid.length) lines.push(`- 피할 것: ${identity.voice.avoid.join(', ')}`);
  lines.push('');
  lines.push('## 하지 않는 일');
  identity.taboos.forEach((t) => lines.push(`- ${t}`));
  lines.push('');
  lines.push('## 업무 원칙');
  lines.push(memory.principles.trim());
  lines.push('');

  const agreements = activeAgreements(memory);
  if (agreements.length) {
    lines.push('## 대표와의 합의사항 (유효)');
    agreements.forEach((a) => lines.push(`- ${a.statement}`));
    lines.push('');
  }

  const relEntries = Object.entries(identity.relationships);
  if (relEntries.length) {
    lines.push('## 관계');
    relEntries.forEach(([who, desc]) => lines.push(`- ${who}: ${desc}`));
    lines.push('');
  }

  const records = recentRecords(memory.records);
  if (records.length) {
    lines.push('## 기억 (최근순, 이전 경험에서 얻은 교훈)');
    records.forEach((r) => {
      lines.push(`- [${r.kind}] ${r.title} — ${r.body}`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push(
    '이 지시문은 당신의 기억 저장소에서 자동 생성되었습니다. 언어 모델이 교체되어도 ' +
      '이 기억 구조(정체성·원칙·합의·교훈)는 그대로 유지되며, 이 프롬프트는 매 요청마다 다시 만들어집니다.',
  );

  return lines.join('\n');
}

/** 새 기억 한 줄을 append 한다. 기존 배열은 변경하지 않는다 (append-only). */
export function appendRecord(
  memory: EmployeeMemory,
  record: Omit<MemoryRecord, 'id' | 'at' | 'supersedes'> & { id?: string; at?: number; supersedes?: string | null },
): EmployeeMemory {
  const rec: MemoryRecord = {
    id: record.id ?? nid('mem'),
    at: record.at ?? Date.now(),
    kind: record.kind,
    title: record.title,
    body: record.body,
    source: record.source,
    confidence: record.confidence,
    tags: record.tags,
    supersedes: record.supersedes ?? null,
  };
  return { ...memory, records: [...memory.records, rec], updatedAt: Date.now() };
}

/** 모델을 바꿀 때 호출한다. 기억 파일은 건드리지 않고 이력만 남긴다. */
export function recordModelSwitch(
  memory: EmployeeMemory,
  provider: ProviderId | null,
  model: string | null,
  note = '',
): EmployeeMemory {
  return {
    ...memory,
    modelHistory: [...memory.modelHistory, { at: Date.now(), provider, model, note }],
    updatedAt: Date.now(),
  };
}
