# 프롬프트 3/3 — n8n 오케스트레이션 + 24시간 스케줄 + 승인 게이트

**사용법:** 프롬프트 2의 `test_smoke` 가 전부 통과한 뒤에 붙여넣으세요.

---

```text
# ─────────────────────────────────────────────────────────────
# [프롬프트 3/3] AI 팀원 시스템 — 오케스트레이션과 24시간 운영
# 전제: 프롬프트 1(인프라) + 프롬프트 2(에이전트/러너)가 동작 중
# 목표: n8n이 하루 종일 태스크를 돌리게 하고, 위험한 행동은 사람이 승인하게 한다
# ─────────────────────────────────────────────────────────────

당신은 내 AI 팀원 시스템의 오케스트레이션 담당입니다.
n8n 워크플로 JSON과 운영 스크립트를 만들어 주세요.

## 만들 것

### 1. `n8n/01-daily-planning.json` — 아침 기획 워크플로
```
Schedule Trigger (매일 08:00 KST)
  → Postgres: 어제 미완료 태스크 + 오늘의 목표 조회
  → Execute Command: python -m runner.run_task --agent pm
  → PM이 목표를 3~7개 태스크로 분해
  → Postgres: tasks 테이블에 status=queued 로 INSERT
  → 요약을 GitHub Issue(또는 Notion 페이지)로 생성
```
※ 태스크를 7개 넘게 만들지 않도록 PM 프롬프트에 상한을 걸 것.

### 2. `n8n/02-work-loop.json` — 실무 루프 (핵심)
```
Schedule Trigger (10분마다)
  → IF: 오늘 예산 80% 미만인가?   ← 아니면 즉시 종료 + 슬랙/메일 경고
  → Postgres: status=queued 인 태스크를 priority 순으로 최대 2건
  → Loop Over Items (동시 실행 2로 제한)      ← rate limit 대비. Tier 오르면 늘릴 것
      → Execute Command: python -m runner.run_task --task-id {{$json.id}}
      → 성공: status=review
      → 실패: retry_count+1, 3회 초과 시 status=failed
  → 실행 결과 요약을 로그 테이블에 기록
```
**중요:** 이 워크플로는 장시간 세션을 유지하지 말 것.
매 실행마다 DB에서 상태를 읽어 컨텍스트를 재구성하는 stateless 구조여야 합니다.

### 3. `n8n/03-review.json` — 검수 루프
```
Schedule Trigger (10분마다, 02번과 5분 엇갈리게)
  → status=review 인 태스크 조회
  → Execute Command: python -m runner.run_task --agent reviewer --task-id ...
  → Switch (verdict):
      pass    → 외부 행동이 필요한가?
                  YES → status=approval_wait (04번으로)
                  NO  → status=done + 결과 게시
      revise  → status=queued 로 되돌리고 reviewer 피드백을 spec에 append
                (단 revise 3회 초과 시 status=failed — 무한 루프 방지)
      reject  → status=failed + 사람 확인 큐
```

### 4. `n8n/04-approval-gate.json` — 승인 게이트
아래 행동은 **반드시 사람 승인 후에만** 실행:
- 이메일/메신저 발송
- 외부 API로 데이터 쓰기 (PR 머지, 결제, 게시물 업로드)
- 파일 삭제 / 덮어쓰기
- 예산 상한 초과 요청

```
status=approval_wait 감지
  → approvals 테이블에 INSERT (action_type, payload_json)
  → 나에게 알림 (메일 또는 텔레그램) — 승인/거부 링크 포함
  → n8n Wait 노드로 대기 (최대 12시간, 초과 시 자동 거부)
  → 승인: 실제 행동 실행 → status=done
  → 거부: status=failed + 거부 사유를 artifacts에 기록
```

### 5. `n8n/05-nightly.json` — 야간 배치
```
Schedule Trigger (매일 01:00 KST)
  → 로컬 LLM만 사용하는 무거운 작업 (대량 요약, 임베딩 재색인, 자료 정리)
  → Claude는 호출하지 않음 (비용 0)
  → 완료 후 GPU 사용량 로그 기록
```

### 6. `n8n/06-daily-report.json` — 일일 보고
```
Schedule Trigger (매일 21:00 KST)
  → 오늘의 완료/실패/대기 태스크 집계
  → token_ledger 에서 오늘 총비용 + 에이전트별 비용
  → 실패 태스크 원인 요약 (Haiku 4.5로 — 싸고 충분)
  → 나에게 리포트 발송
```

### 7. `scripts/kill-switch.sh` — 비상 정지
```bash
# 모든 스케줄 워크플로를 즉시 비활성화하고 실행 중인 태스크를 중단
# 새벽에 뭔가 폭주했을 때 이거 하나만 치면 되게 만들 것
```
반대로 `scripts/resume.sh` 도 만들 것.

### 8. `scripts/import-workflows.sh`
n8n CLI로 위 6개 JSON을 한 번에 임포트하는 스크립트.

### 9. `docs/RUNBOOK.md` — 운영 매뉴얼 (한국어)
다음 상황별 대처법을 표로:
| 증상 | 원인 | 대처 |
- 태스크가 계속 revise만 반복한다
- 비용이 예상보다 3배 나온다
- 429 rate limit이 자주 뜬다
- vLLM 컨테이너가 OOM으로 죽는다
- n8n 워크플로가 조용히 안 돈다
- 산출물 품질이 갑자기 나빠졌다

## 안전 원칙 (반드시 반영)
1. **무한 루프 차단**: 모든 재시도에 상한(3회). revise 루프에도 상한.
2. **예산 게이트를 워크플로 맨 앞에**: 예산 초과면 어떤 노드도 실행되지 않게.
3. **동시 실행 제한**: 초반엔 2. Rate limit Tier가 오르면 늘리라고 주석에 명시.
4. **외부로 나가는 모든 행동은 승인 게이트 경유**: 예외 없음.
5. **모든 워크플로에 에러 브랜치**: 실패를 조용히 삼키지 말 것.
6. **타임존은 Asia/Seoul 고정**.

## 산출물 형식
- n8n 워크플로는 임포트 가능한 JSON으로.
- 각 워크플로 JSON에는 sticky note 노드로 한국어 설명을 붙일 것.
- 만들기 전에 워크플로 6개의 트리거 시각과 상호 관계를 표로 보여주고,
  내가 "진행"이라고 하면 생성할 것.

먼저 계획만 보여주세요.
```

---

## 이 프롬프트가 끝나면

```bash
bash scripts/import-workflows.sh    # n8n에 워크플로 임포트
```

n8n UI(http://localhost:5678)에서 **02-work-loop 하나만 먼저 활성화**하고 하루 돌려보세요.
정상이면 03 → 04 → 05 → 06 순으로 하나씩 켭니다. 한 번에 다 켜지 마세요.

## 첫 주 운영 체크리스트

- [ ] 1일차: 02번만 켜고 태스크 3건 처리 확인
- [ ] 2일차: 03번(검수) 추가 — revise 루프가 3회에서 멈추는지 확인
- [ ] 3일차: 04번(승인 게이트) 추가 — 실제로 알림이 오는지 확인
- [ ] 4일차: 하루 총비용이 예산 안에 들어오는지 확인
- [ ] 5일차: 05, 06번 추가
- [ ] 6~7일차: 인원(에이전트) 추가는 이때부터 검토
