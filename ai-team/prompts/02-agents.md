# 프롬프트 2/3 — 팀원(에이전트) 정의 + 모델 라우터 + 비용 안전장치

**사용법:** 프롬프트 1이 끝나고 `make smoke` 가 통과한 뒤에 붙여넣으세요.

---

```text
# ─────────────────────────────────────────────────────────────
# [프롬프트 2/3] AI 팀원 시스템 — 에이전트 정의와 실행 엔진
# 전제: 프롬프트 1로 docker compose(postgres/n8n/vllm/embeddings)가 떠 있음
# 목표: "직원 4명"의 인격·권한·산출물 규격을 정의하고, 이들을 실행하는
#       파이썬 러너와 비용 안전장치를 만든다
# ─────────────────────────────────────────────────────────────

당신은 내 AI 팀원 시스템의 "인사팀 + 백엔드 엔지니어" 역할입니다.
아래 사양대로 에이전트 정의와 실행 엔진을 만들어 주세요.

## 팀 구성 (딱 4명. 늘리지 마세요)

| agent_id  | 역할        | 모델            | 핵심 책임 |
|-----------|-------------|-----------------|-----------|
| pm        | 기획/분해   | claude-opus-5   | 하루 목표를 실행 가능한 태스크로 쪼개고 완료 기준을 정의 |
| worker    | 실무        | claude-sonnet-5 | 태스크를 실제로 수행하고 산출물 생성 |
| grunt     | 대량처리    | local-worker    | 요약·분류·태깅·1차 초안 (로컬 LLM, 비용 0) |
| reviewer  | 검수        | claude-opus-5   | 산출물이 완료 기준을 충족하는지 판정 (pass/revise/reject) |

## 만들 것

### 1. `agents/*.yaml` — 에이전트 정의 4개
각 파일에 다음 필드를 두고, 모든 필드에 한국어 주석을 달 것:

```yaml
agent_id: pm
display_name: 기획 담당
model: claude-opus-5
effort: high            # low/medium/high/xhigh/max — 비용과 품질의 손잡이
max_tokens: 16000
system_prompt: |
  (여기에 역할·판단기준·하지 말아야 할 것을 서술)
tools:                  # 이 에이전트가 쓸 수 있는 도구 화이트리스트
  - read_task
  - write_task
memory_namespace: pm    # agent_memory 테이블에서 이 에이전트가 접근할 영역
output_schema:          # 자유 서술 금지. 반드시 JSON 스키마로 규격화
  type: object
  properties: { ... }
  required: [ ... ]
  additionalProperties: false
daily_token_cap_usd: 1.0   # 이 에이전트 하루 상한
```

**system_prompt 작성 원칙 (중요):**
- "CRITICAL:", "반드시", "무조건" 같은 과격한 표현을 쓰지 말 것.
  최신 Claude는 지시를 문자 그대로 따르기 때문에 과잉 동작합니다.
- 대신 "언제 이 도구를 쓰는지"를 조건문으로 서술할 것.
- 각 에이전트에 "하지 말아야 할 것"을 3줄 이상 명시할 것.
  (예: reviewer는 직접 산출물을 수정하지 않고 판정만 한다)
- 요청받은 범위를 넘어서지 말라는 지시를 넣을 것.
  (최신 모델은 시키지 않은 일을 추가하는 경향이 있습니다)
- 검증 지시("다시 한번 확인해라")는 넣지 말 것. 요즘 모델은 스스로 검증하며,
  검증을 시키면 오히려 과잉 검증으로 토큰만 낭비합니다.

### 2. `runner/claude_client.py` — Claude API 래퍼

```python
# 아래 규칙을 정확히 지켜 구현할 것 (최신 API 사양)
```
- 공식 SDK 사용: `pip install anthropic`. requests/httpx 직접 호출 금지.
- 클라이언트: `anthropic.Anthropic()` — 키는 환경변수 ANTHROPIC_API_KEY 자동 인식
- 모델 ID는 날짜 suffix 없이 그대로: `claude-opus-5`, `claude-sonnet-5`
- `temperature` / `top_p` / `top_k` 는 **넘기지 말 것** (Opus 5/Sonnet 5에서 400 에러)
- `thinking={"type": "enabled", "budget_tokens": N}` 도 **금지** (400 에러).
  깊이 조절은 `output_config={"effort": "..."}` 로만.
- Opus 5는 thinking이 기본 ON이라 max_tokens가 (사고 + 답변)을 함께 덮습니다.
  → max_tokens에 충분한 여유를 줄 것 (최소 16000)
- max_tokens가 16000을 넘으면 반드시 스트리밍:
  `with client.messages.stream(...) as s: msg = s.get_final_message()`
- 산출물 규격화는 `output_config={"format": {"type": "json_schema", "schema": ...}}`
  또는 `client.messages.parse(output_format=PydanticModel)` 사용.
  assistant 프리필(마지막 턴을 assistant로 채우기)은 **400 에러**이므로 금지.
- Prompt Caching: 고정 시스템 프롬프트 블록에
  `cache_control={"type": "ephemeral"}` 를 달 것. 캐시 읽기는 정가의 약 1/10.
  주의: 시스템 프롬프트에 현재시각/UUID 같은 변하는 값을 절대 넣지 말 것
  (한 바이트만 달라져도 캐시가 전부 무효화됩니다)
- 응답 처리 시 `response.stop_reason` 을 **먼저** 확인할 것:
    - "refusal"   → 안전 분류기 거절. content가 비어 있을 수 있으므로
                    content[0] 을 무조건 읽지 말 것. 로그 남기고 실패 처리
    - "max_tokens" → 잘림. max_tokens 올려 재시도
    - "end_turn"  → 정상
- 예외 처리는 좁은 것부터 넓은 것 순으로 체이닝:
  NotFoundError → RateLimitError → APIStatusError → APIConnectionError
- 매 호출 후 `response.usage` 에서
  input_tokens / output_tokens / cache_read_input_tokens 를 꺼내
  token_ledger 테이블에 기록할 것.

### 3. `runner/local_client.py` — 로컬 LLM 래퍼
- vLLM의 OpenAI 호환 엔드포인트(LOCAL_LLM_BASE_URL) 호출
- 모델명은 `local-worker`
- 타임아웃 120초, 재시도 2회
- 인터페이스는 claude_client.py와 동일하게 맞춰서, 라우터가 갈아끼울 수 있게 할 것

### 4. `runner/router.py` — 모델 라우터
태스크를 보고 어느 클라이언트로 보낼지 결정:

```
판단 기준:
  - 사람에게 나가는 최종 산출물 / 코드 / 판단     → Claude
  - 요약, 분류, 태깅, 크롤링 후처리, 1차 초안     → 로컬
  - 로컬로 처리했는데 reviewer가 reject 2회       → Claude로 승급
  - 오늘 Claude 예산 80% 소진                     → 전부 로컬로 강등 + 경고 로그
```

### 5. `runner/budget.py` — 비용 안전장치 (가장 중요)
- 호출 **전에** token_ledger를 조회해 오늘 누적 비용 계산
- 단가표를 상수로 (100만 토큰당 USD):
    claude-opus-5   : 입력 5.00 / 출력 25.00
    claude-sonnet-5 : 입력 2.00 / 출력 10.00   # 2026-08-31까지 도입가. 이후 3.00/15.00
    claude-haiku-4-5: 입력 1.00 / 출력 5.00
    local-worker    : 0 / 0
  캐시 읽기는 입력 단가의 0.1배, 캐시 쓰기는 1.25배로 계산
- DAILY_TOKEN_BUDGET_USD 초과 시 `BudgetExceeded` 예외를 던져 **호출 자체를 차단**
- 에이전트별 daily_token_cap_usd도 동일하게 검사
- 자정(Asia/Seoul) 기준으로 리셋

### 6. `runner/memory.py` — 에이전트 메모리
- 텍스트 → bge-m3 임베딩(포트 8080) → agent_memory 테이블 저장
- 검색: 코사인 유사도 상위 K개, **반드시 agent_id로 필터링**
  (에이전트 간 기억이 섞이면 인격이 무너집니다)

### 7. `runner/run_task.py` — 진입점
```
1. tasks 테이블에서 queued 상태 1건을 SELECT ... FOR UPDATE SKIP LOCKED 로 잠금
2. status=running 으로 변경
3. budget 검사 → 초과면 즉시 중단하고 status=queued 복구
4. router로 클라이언트 선택
5. memory에서 관련 기억 top-5 로드해 프롬프트에 주입
6. 실행 → 산출물을 output_schema로 검증 → artifacts 저장
7. token_ledger 기록
8. status=review 로 변경
9. 모든 단계를 구조화 로그(JSON)로 출력
```
실패 시: retry_count += 1, 3회 초과하면 status=failed 로 두고 사람이 볼 큐에 남길 것.

## 지켜야 할 규칙
1. 위에 적은 Claude API 사양(금지 파라미터, stop_reason 확인 등)을 정확히 지킬 것.
   기억에 의존하지 말고 위 명세를 그대로 따를 것.
2. 모든 파이썬 파일은 타입 힌트 포함, 주요 로직마다 한국어 주석.
3. `runner/test_smoke.py` 를 만들어 다음을 확인:
   - Claude 1회 호출 성공 (max_tokens=64, 가장 싼 모델로)
   - 로컬 LLM 1회 호출 성공
   - 임베딩 1회 생성 성공
   - budget.py가 한도 초과 시 정말 차단하는지 (가짜 원장으로 테스트)
4. 만들기 전에 파일 목록과 각 파일의 역할을 한 줄씩 보여주고,
   내가 "진행"이라고 하면 생성할 것.

먼저 계획만 보여주세요.
```

---

## 이 프롬프트가 끝나면

```bash
python -m runner.test_smoke     # 4개 항목 모두 통과해야 함
python -m runner.run_task       # 태스크 1건을 수동 실행해보기
```

여기까지 되면 **에이전트 1명이 실제로 일을 끝내는 것**을 확인한 셈입니다.
이 단계를 건너뛰고 다음으로 가면 거의 항상 실패합니다.
