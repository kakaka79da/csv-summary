/**
 * 통합 테스트 — 검증 시나리오의 핵심 규칙을 코드로 고정한다.
 * 여기서 실패하면 UI가 아무리 잘 보여도 규칙이 깨진 것이다.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useWorld } from '@/state/store';
import { COMPANY_DEFAULTS } from '@/data/seed';
import type { Employee } from '@/types';

/** 회사 창립 → 직원 소환까지 진행한 상태를 만든다. */
function bootstrap(monthlyBudgetUsd = 60) {
  const w = useWorld.getState();
  w.resetAll();
  useWorld.getState().loginDemo('ceo');
  useWorld.getState().foundCompany({ ...COMPANY_DEFAULTS, monthlyBudgetUsd });
  useWorld.getState().buildOffice();
  useWorld.getState().summonEmployees();
}

/** 세 직원 모두 저비용 모델에 연결한다. */
function connectAll(perTask = 0.5, monthly = 20) {
  for (const id of useWorld.getState().employeeOrder) {
    const r = useWorld.getState().connectProvider(id, {
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
      perTaskLimitUsd: perTask,
      monthlyLimitUsd: monthly,
      allowedTools: ['file_read', 'file_write'],
    });
    expect(r.ok).toBe(true);
  }
}

/** 시뮬레이션을 최대 maxSeconds 동안 돌리되, 조건이 충족되면 멈춘다. */
function run(seconds: number, until?: () => boolean) {
  const stepMs = 200;
  const steps = Math.ceil((seconds * 1000) / stepMs);
  for (let i = 0; i < steps; i++) {
    useWorld.getState().tick(stepMs);
    if (until && until()) return;
  }
}

function emp(id: string): Employee {
  return useWorld.getState().employees[id];
}

/**
 * 이스터에그 대본은 실제 벽시계 시각(Date.now())을 기준으로 진행되므로,
 * 테스트에서 실제로 20분을 기다리지 않고도 검증할 수 있도록 매 스텝마다
 * startedAt 을 dtMs 만큼 과거로 밀어 넣는다 — 걸음(이동)과 대본 진행 속도를
 * 정확히 같은 비율로 "빨리 감기" 하는 셈이다.
 */
function advanceEggBy(seconds: number) {
  const stepMs = 200;
  const steps = Math.ceil((seconds * 1000) / stepMs);
  for (let i = 0; i < steps; i++) {
    const cur = useWorld.getState().easterEgg;
    if (cur.active && cur.startedAt !== null) {
      useWorld.setState({ easterEgg: { ...cur, startedAt: cur.startedAt - stepMs } });
    }
    useWorld.getState().tick(stepMs);
  }
}

beforeEach(() => {
  useWorld.getState().resetAll();
});

describe('회사 창립 흐름', () => {
  it('로그인 → 창립 → 사무실 → 소환까지 상태가 이어진다', () => {
    bootstrap();
    const s = useWorld.getState();
    expect(s.company?.name).toBe('크림바스켓');
    expect(s.company?.ceoName).toBe('강민호');
    expect(s.phase).toBe('summon');
    expect(s.employeeOrder).toHaveLength(3);
    expect(s.employees.emp_admin.title).toBe('총무 매니저');
    expect(s.employees.emp_engineer.title).toBe('수석 연구 엔지니어');
    expect(s.employees.emp_professor.title).toBe('행동 심리학 교수');
  });

  it('인간 직원 로그인은 회사 창립 전에는 차단된다', () => {
    useWorld.getState().resetAll();
    useWorld.getState().loginDemo('human_staff');
    expect(useWorld.getState().session).toBeNull();
    expect(useWorld.getState().ui.toast).toContain('회사 창립 이후');
  });
});

describe('API 연결', () => {
  it('대표가 아니면 유료 모델을 연결할 수 없다', () => {
    bootstrap();
    useWorld.getState().loginDemo('platform_admin');
    const r = useWorld.getState().connectProvider('emp_admin', {
      provider: 'anthropic',
      model: 'claude-opus-5',
      perTaskLimitUsd: 1,
      monthlyLimitUsd: 10,
      allowedTools: [],
    });
    expect(r.ok).toBe(false);
  });

  it('연결 정보에 API 키 원문이 저장되지 않는다', () => {
    bootstrap();
    connectAll();
    const binding = emp('emp_admin').binding;
    expect(binding.status).toBe('connected');
    expect(binding.keyRef).toMatch(/^srv-keyref:\/\//);
    expect(binding.maskedKey).toMatch(/••••/);
    // 상태 전체를 직렬화해도 sk- 로 시작하는 실제 키 형태가 없어야 한다.
    const dump = JSON.stringify(useWorld.getState());
    expect(dump).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
  });

  it('유료 모델 연결은 승인 기록으로 남는다', () => {
    bootstrap();
    connectAll();
    const paid = useWorld.getState().approvals.filter((a) => a.kind === 'paid_model');
    expect(paid).toHaveLength(3);
    expect(paid.every((a) => a.status === 'approved')).toBe(true);
  });
});

describe('업무 지시와 승인 게이트', () => {
  it('휴직 중인 직원에게는 업무를 배정할 수 없다', () => {
    bootstrap();
    connectAll();
    useWorld.getState().requestLeave('emp_engineer');
    const leaveApproval = useWorld.getState().approvals.find((a) => a.kind === 'leave')!;
    useWorld.getState().decideApproval(leaveApproval.id, 'approved');

    expect(emp('emp_engineer').onLeave).toBe(true);
    expect(emp('emp_engineer').state).toBe('on_leave');

    const est = useWorld.getState().estimateTask('emp_engineer', '로그 분석', 'normal');
    expect(est.blockers.some((b) => b.includes('휴직'))).toBe(true);

    const r = useWorld.getState().orderTask('emp_engineer', '로그 분석', 'normal');
    expect(r.ok).toBe(false);
    expect(useWorld.getState().missionOrder).toHaveLength(0);
  });

  it('승인 없는 유료 작업은 시작되지 않고 비용도 발생하지 않는다', () => {
    bootstrap();
    // 작업당 한도를 아주 낮게 잡아 승인이 강제되게 한다.
    for (const id of useWorld.getState().employeeOrder) {
      useWorld.getState().connectProvider(id, {
        provider: 'anthropic',
        model: 'claude-opus-5',
        perTaskLimitUsd: 0.01,
        monthlyLimitUsd: 50,
        allowedTools: ['file_read'],
      });
    }
    const r = useWorld.getState().orderTask('emp_engineer', '대규모 시스템 감사', 'elite');
    expect(r.ok).toBe(true);

    const mission = useWorld.getState().missions[r.missionId!];
    expect(mission.requiresApproval).toBe(true);
    expect(mission.status).toBe('awaiting_approval');

    run(10);
    const after = useWorld.getState().missions[r.missionId!];
    expect(after.status).toBe('awaiting_approval');
    expect(after.steps.every((s) => s.status === 'pending')).toBe(true);
    expect(after.actualCostUsd).toBe(0);
    // 가장 중요한 단언: 원장에 어떤 비용도 기록되지 않았다.
    expect(useWorld.getState().ledger).toHaveLength(0);
    expect(emp('emp_engineer').spendTodayUsd).toBe(0);
  });

  it('대표가 승인하면 작업이 시작되고 비용이 기록된다', () => {
    bootstrap();
    for (const id of useWorld.getState().employeeOrder) {
      useWorld.getState().connectProvider(id, {
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
        perTaskLimitUsd: 0.01,
        monthlyLimitUsd: 50,
        allowedTools: ['file_read'],
      });
    }
    const r = useWorld.getState().orderTask('emp_engineer', '데이터 정합성 점검', 'elite');
    const approval = useWorld.getState().approvals.find((a) => a.missionId === r.missionId)!;
    expect(approval.status).toBe('pending');

    // 승인과 함께 한도도 올려 주어야 실제로 진행된다.
    useWorld.getState().requestLimitChange('emp_engineer', 5, 50);
    const limitApproval = useWorld.getState().approvals.find((a) => a.kind === 'raise_limit')!;
    useWorld.getState().decideApproval(limitApproval.id, 'approved');
    useWorld.getState().decideApproval(approval.id, 'approved');

    expect(useWorld.getState().missions[r.missionId!].status).toBe('queued');

    run(60, () => useWorld.getState().missions[r.missionId!].status === 'review');
    const done = useWorld.getState().missions[r.missionId!];
    expect(done.status).toBe('review');
    expect(useWorld.getState().ledger.length).toBeGreaterThan(0);
    expect(done.actualCostUsd).toBeGreaterThan(0);
  });
});

describe('첫 공동 프로젝트', () => {
  it('엔지니어 → 교수 → 총무 → 대표 보고 순서로 진행되어 완료된다', () => {
    bootstrap();
    connectAll(2, 40);
    for (const id of useWorld.getState().employeeOrder) {
      useWorld.getState().completeInterview(id, {
        scope: '기본 업무 범위',
        reportStyle: 'concise',
        dataAccess: ['사내 공개 문서'],
      });
    }
    expect(useWorld.getState().tutorial.interviewsDone).toBe(true);
    expect(useWorld.getState().phase).toBe('first_mission');

    useWorld.getState().createFirstMission();
    const missionId = useWorld.getState().missionOrder[0];
    expect(useWorld.getState().missions[missionId].steps).toHaveLength(5);

    run(180, () => useWorld.getState().missions[missionId].status === 'review');
    const mission = useWorld.getState().missions[missionId];

    expect(mission.status).toBe('review');
    expect(mission.steps.every((s) => s.status === 'done')).toBe(true);
    expect(mission.loot).toHaveLength(5);

    // 담당자 순서가 사양대로인지 확인
    expect(mission.steps.map((s) => s.assigneeId)).toEqual([
      'emp_admin',
      'emp_engineer',
      'emp_professor',
      'emp_admin',
      'emp_admin',
    ]);

    // 최종 보고 메시지가 대표 이름을 담고 있어야 한다
    const adminChat = useWorld.getState().chats.emp_admin ?? [];
    expect(adminChat.some((m) => m.text.includes('강민호 대표님, 요청하신 결과물입니다'))).toBe(true);

    useWorld.getState().acceptMissionResult(missionId);
    expect(useWorld.getState().missions[missionId].status).toBe('completed');
    expect(useWorld.getState().tutorial.firstMissionDone).toBe(true);
  });

  it('회사 월간 예산을 넘기면 미션이 중단되고 승인 요청이 생긴다', () => {
    bootstrap(0.02); // 회사 예산을 거의 0으로
    connectAll(5, 50);
    useWorld.getState().createFirstMission();
    const missionId = useWorld.getState().missionOrder[0];

    run(30, () => useWorld.getState().missions[missionId].status === 'blocked');
    const mission = useWorld.getState().missions[missionId];
    expect(mission.status).toBe('blocked');
    expect(
      useWorld.getState().approvals.some((a) => a.kind === 'budget_overrun_resume' && a.status === 'pending'),
    ).toBe(true);
  });
});

describe('업무 중단', () => {
  it('중단하면 미션이 취소되고 담당자가 대기 상태로 돌아간다', () => {
    bootstrap();
    connectAll(2, 40);
    useWorld.getState().createFirstMission();
    const missionId = useWorld.getState().missionOrder[0];
    run(4);
    useWorld.getState().stopMission(missionId);

    expect(useWorld.getState().missions[missionId].status).toBe('cancelled');
    for (const id of useWorld.getState().employeeOrder) {
      expect(emp(id).currentMissionId).toBeNull();
      expect(emp(id).state).not.toBe('fighting');
    }
  });
});

describe('개인 기억 (모델 무관)', () => {
  it('직원을 소환하면 세 명 모두 기억이 채워진다', () => {
    bootstrap();
    const memories = useWorld.getState().memories;
    expect(Object.keys(memories).sort()).toEqual(['emp_admin', 'emp_engineer', 'emp_professor']);
    expect(memories.emp_admin.identity.displayName).toBe('엘레나');
    expect(memories.emp_admin.agreements.length).toBeGreaterThan(0);
    expect(memories.emp_admin.records.length).toBeGreaterThan(0);
  });

  it('모델을 연결/교체해도 기억(정체성·원칙·합의·교훈)은 그대로고, 이력만 늘어난다', () => {
    bootstrap();
    const before = useWorld.getState().memories.emp_admin;

    connectAll(0.5, 20); // 세 명 다 anthropic/claude-haiku-4-5 로 연결

    const afterFirst = useWorld.getState().memories.emp_admin;
    expect(afterFirst.identity).toEqual(before.identity);
    expect(afterFirst.principles).toEqual(before.principles);
    expect(afterFirst.agreements).toEqual(before.agreements);
    expect(afterFirst.records).toEqual(before.records);
    expect(afterFirst.modelHistory).toHaveLength(1);
    expect(afterFirst.modelHistory[0].provider).toBe('anthropic');
    expect(afterFirst.modelHistory[0].model).toBe('claude-haiku-4-5');

    // 다른 제공자로 다시 연결 — "모델 교체"
    const r = useWorld.getState().connectProvider('emp_admin', {
      provider: 'openai',
      model: 'gpt-tier-b',
      perTaskLimitUsd: 0.5,
      monthlyLimitUsd: 20,
      allowedTools: ['file_read'],
    });
    expect(r.ok).toBe(true);

    const afterSwitch = useWorld.getState().memories.emp_admin;
    expect(afterSwitch.identity).toEqual(before.identity);
    expect(afterSwitch.principles).toEqual(before.principles);
    expect(afterSwitch.agreements).toEqual(before.agreements);
    expect(afterSwitch.records).toEqual(before.records);
    expect(afterSwitch.modelHistory).toHaveLength(2);
    expect(afterSwitch.modelHistory[1].provider).toBe('openai');
  });

  it('첫 미션을 완료하면 담당자의 기억에 사건 기록이 append 된다', () => {
    bootstrap();
    connectAll(2, 40);
    const before = useWorld.getState().memories.emp_admin.records.length;

    useWorld.getState().createFirstMission();
    const missionId = useWorld.getState().missionOrder[0];
    run(180, () => useWorld.getState().missions[missionId].status === 'review');

    const after = useWorld.getState().memories.emp_admin.records;
    expect(after.length).toBeGreaterThan(before);
    expect(after.some((r) => r.kind === 'episode' && r.source.startsWith('mission:'))).toBe(true);
  });

  it('대표가 추가한 합의사항은 append 되고 기존 합의는 지워지지 않는다', () => {
    bootstrap();
    const before = useWorld.getState().memories.emp_admin.agreements.length;

    useWorld.getState().addAgreement('emp_admin', '주간 보고는 매주 금요일에 올린다.');

    const agreements = useWorld.getState().memories.emp_admin.agreements;
    expect(agreements).toHaveLength(before + 1);
    expect(agreements.at(-1)?.statement).toBe('주간 보고는 매주 금요일에 올린다.');
    expect(agreements.at(-1)?.status).toBe('active');
  });

  it('컴파일된 시스템 프롬프트에는 정체성·원칙·합의사항이 모두 들어간다', () => {
    bootstrap();
    const prompt = useWorld.getState().compileEmployeePrompt('emp_admin');
    expect(prompt).toContain('엘레나');
    expect(prompt).toMatch(/대표의 승인 없이는 비용이 발생하는 작업을 시작하지 않는다/);
    expect(prompt).toMatch(/업무 원칙/);
  });
});

describe('우선순위 회의 소집', () => {
  it('자유 상태인 직원 전원이 회의 테이블로 모이고, 지시가 각자의 대화창에 전달된다', () => {
    bootstrap();
    const r = useWorld.getState().callPriorityMeeting('이번 주는 A 프로젝트를 최우선으로 진행합니다.');

    expect(r.gathered.sort()).toEqual(['emp_admin', 'emp_engineer', 'emp_professor']);
    expect(r.busy).toHaveLength(0);

    for (const id of r.gathered) {
      const e = emp(id);
      expect(e.destinationRoom).toBe('meeting');
      expect(e.state).toBe('walking');
      expect(e.path.length).toBeGreaterThan(0);

      const chat = useWorld.getState().chats[id] ?? [];
      const order = chat.at(-1)!;
      expect(order.from).toBe('ceo');
      expect(order.kind).toBe('task_order');
      expect(order.text).toContain('A 프로젝트를 최우선으로 진행합니다.');
    }

    // 실제로 걸어서 회의 테이블 근처(원탁 anchor)에 도착한다.
    run(10, () => Object.values(useWorld.getState().employees).every((e) => e.path.length === 0));
    for (const id of r.gathered) {
      expect(emp(id).state).not.toBe('walking');
    }
  });

  it('유료 작업 중인 직원은 강제로 끊지 않고 불참으로 분류한다', () => {
    bootstrap();
    connectAll(2, 40);
    useWorld.getState().createFirstMission();
    const missionId = useWorld.getState().missionOrder[0];

    // 담당자가 작업 장소까지 걸어가서 실제로 일을 시작할 때까지 진행시킨다.
    run(30, () => {
      const m = useWorld.getState().missions[missionId];
      const a = useWorld.getState().employees[m.steps[m.currentStepIndex].assigneeId];
      return a.currentMissionId === missionId && a.state !== 'walking';
    });

    const before = useWorld.getState().missions[missionId];
    const workingId = before.steps[before.currentStepIndex].assigneeId;
    expect(useWorld.getState().employees[workingId].currentMissionId).toBe(missionId);
    expect(useWorld.getState().employees[workingId].state).not.toBe('walking');

    const r = useWorld.getState().callPriorityMeeting('');
    expect(r.busy).toContain(workingId);
    expect(r.gathered).not.toContain(workingId);

    // 업무 중이던 직원은 미션도, 상태도 그대로다 — 회의 소집이 진행 중인 유료 작업을 끊지 않는다.
    expect(useWorld.getState().employees[workingId].currentMissionId).toBe(missionId);
    expect(useWorld.getState().missions[missionId].status).not.toBe('cancelled');
  });

  it('휴직 중인 직원은 소집되지 않는다', () => {
    bootstrap();
    connectAll();
    useWorld.getState().requestLeave('emp_engineer');
    const leaveApproval = useWorld.getState().approvals.find((a) => a.kind === 'leave')!;
    useWorld.getState().decideApproval(leaveApproval.id, 'approved');
    expect(emp('emp_engineer').onLeave).toBe(true);

    const r = useWorld.getState().callPriorityMeeting('전체 공지');
    expect(r.busy).toContain('emp_engineer');
    expect(r.gathered).not.toContain('emp_engineer');
  });

  it('지시 없이 소집하면 집합 안내만 전달된다', () => {
    bootstrap();
    useWorld.getState().callPriorityMeeting('   ');
    const chat = useWorld.getState().chats.emp_admin!.at(-1)!;
    expect(chat.kind).toBe('system');
    expect(chat.text).toContain('회의 테이블로 집합');
  });
});

describe('이스터에그 — 탱크형 변형 휠 데모', () => {
  it('틀린 코드는 아무것도 바꾸지 않는다', () => {
    const ok = useWorld.getState().tryEasterEggCode('아무거나');
    expect(ok).toBe(false);
    expect(useWorld.getState().session).toBeNull();
    expect(useWorld.getState().easterEgg.active).toBe(false);
  });

  it('맞는 코드는 로그인·창립·소환이 안 되어 있어도 전부 자동으로 준비하고 시작한다', () => {
    expect(useWorld.getState().session).toBeNull();
    expect(useWorld.getState().company).toBeNull();

    const ok = useWorld.getState().tryEasterEggCode('mkang428428');
    expect(ok).toBe(true);

    const s = useWorld.getState();
    expect(s.session?.role).toBe('ceo');
    expect(s.company).not.toBeNull();
    expect(Object.keys(s.employees).sort()).toEqual(['emp_admin', 'emp_engineer', 'emp_professor']);
    expect(s.phase).toBe('live');
    expect(s.easterEgg.active).toBe(true);
    expect(s.easterEgg.startedAt).not.toBeNull();
    expect(s.ui.toast).toContain('이스터에그');
  });

  it('이미 진행 중인 회사/직원이 있으면 그대로 이어서 쓴다', () => {
    bootstrap();
    connectAll();
    const before = useWorld.getState().company?.name;

    useWorld.getState().tryEasterEggCode('mkang428428');

    expect(useWorld.getState().company?.name).toBe(before);
    expect(useWorld.getState().easterEgg.active).toBe(true);
  });

  it('시나리오 도중 카일이 버그를 만나면 낚시터로, 이어서 훈련장으로 이동한다', () => {
    useWorld.getState().tryEasterEggCode('mkang428428');

    // 6:40 이후 낚시터로 향하고, 도착하면 'fishing' 상태가 된다.
    advanceEggBy(7 * 60 + 15);
    expect(emp('emp_engineer').state).toBe('fishing');
    expect(emp('emp_engineer').destinationRoom).toBe('fishing');

    // 9:10 이후 훈련장으로 이동해 'playing'(훈련) 상태가 된다.
    advanceEggBy(2 * 60 + 30); // 누적 약 9:45
    expect(emp('emp_engineer').state).toBe('playing');
    expect(emp('emp_engineer').destinationRoom).toBe('training');
  });

  it('20분 대본이 끝나면 최종 보고가 남고, 실제 비용은 전혀 발생하지 않는다', () => {
    useWorld.getState().tryEasterEggCode('mkang428428');

    advanceEggBy(21 * 60); // 대본 전체 길이(약 19:45)보다 넉넉히 더 돌린다

    const s = useWorld.getState();
    expect(s.easterEgg.active).toBe(false);

    const adminChat = s.chats.emp_admin ?? [];
    const report = adminChat.find((m) => m.kind === 'report' && m.text.includes('탱크형 변형 휠'));
    expect(report).toBeTruthy();
    expect(report?.text).toContain('이스터에그 데모 시나리오');

    // 핵심 보장: 이스터에그는 실제 미션/원장에 아무 흔적도 남기지 않는다.
    expect(s.ledger).toHaveLength(0);
    expect(Object.keys(s.missions)).toHaveLength(0);
    for (const id of s.employeeOrder) {
      expect(s.employees[id].spendTodayUsd).toBe(0);
      expect(s.employees[id].spendMonthUsd).toBe(0);
    }
  });

  it('도중에 종료하면 세 직원 모두 안전하게 대기 상태로 돌아간다', () => {
    useWorld.getState().tryEasterEggCode('mkang428428');
    advanceEggBy(3 * 60); // 회의 중간쯤

    useWorld.getState().stopEasterEgg();

    const s = useWorld.getState();
    expect(s.easterEgg.active).toBe(false);
    for (const id of s.employeeOrder) {
      expect(['idle', 'walking']).toContain(s.employees[id].state);
    }
  });
});
