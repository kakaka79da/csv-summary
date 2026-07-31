# 프롬프트 1/3 — 인프라 구축 (3090 × 1장 기준)

**사용법:** 아래 블록 전체를 복사해서 Claude Code(또는 Claude)에 붙여넣으세요.
`#` 로 시작하는 줄은 당신이 읽으라고 넣은 주석입니다. 그대로 붙여넣어도 됩니다.

---

```text
# ─────────────────────────────────────────────────────────────
# [프롬프트 1/3] AI 팀원 시스템 — 인프라 구축
# 목표: WSL2 위에 n8n + Postgres(pgvector) + 로컬 LLM 서버를 올린다
# 실행 위치: WSL2(Ubuntu) 터미널의 프로젝트 폴더
# ─────────────────────────────────────────────────────────────

당신은 내 로컬 머신에 "AI 팀원 시스템"의 인프라를 구축하는 엔지니어입니다.
아래 사양을 그대로 따라 파일을 생성하고, 실행 가능한 상태까지 만들어 주세요.

## 내 환경
- OS: Windows 11 + WSL2 (Ubuntu 22.04) + Docker Desktop (WSL2 backend)
- GPU: RTX 3090 24GB × 1장   # ← 나중에 2장으로 늘릴 예정. 그때 바꿀 곳을 주석으로 표시해줄 것
- 목적: 여러 역할의 AI 에이전트를 24시간 돌려 실무를 자동화

## 만들 것

### 1. 사전 점검 스크립트 `scripts/00-preflight.sh`
다음을 순서대로 확인하고, 실패하면 "무엇을 어떻게 고치면 되는지"를 한국어로 출력할 것.
- WSL2 버전이 2인지
- `nvidia-smi` 가 WSL 안에서 동작하고 3090이 보이는지
- Docker가 GPU를 쓸 수 있는지 (nvidia-container-toolkit)
- 디스크 여유 공간 100GB 이상인지 (모델 가중치용)
- `.env` 파일 존재 및 ANTHROPIC_API_KEY 형식 확인 (값은 절대 출력하지 말고 앞 12자만)

### 2. `.env.example`
아래 키만 포함. 실제 값은 비워두고 설명 주석을 한국어로 달 것.
- ANTHROPIC_API_KEY
- POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
- N8N_ENCRYPTION_KEY
- N8N_BASIC_AUTH_USER / N8N_BASIC_AUTH_PASSWORD
- LOCAL_LLM_BASE_URL (기본값 http://vllm:8000/v1)
- DAILY_TOKEN_BUDGET_USD (기본값 3)

동시에 `.gitignore` 를 만들어 `.env`, `data/`, `models/` 를 제외할 것.

### 3. `docker-compose.yml`
서비스 4개:

(a) postgres
  - 이미지: pgvector/pgvector:pg16
  - 볼륨: ./data/postgres:/var/lib/postgresql/data
  - healthcheck 포함

(b) n8n
  - 이미지: n8nio/n8n:latest
  - DB는 위 postgres 사용 (DB_TYPE=postgresdb)
  - 포트 5678
  - 환경변수로 basic auth 활성화
  - GENERIC_TIMEZONE=Asia/Seoul, TZ=Asia/Seoul
  - 볼륨: ./data/n8n:/home/node/.n8n
  - depends_on: postgres (healthy 조건)

(c) vllm  ← 로컬 LLM (OpenAI 호환 엔드포인트)
  - 이미지: vllm/vllm-openai:latest
  - GPU 할당: deploy.resources.reservations.devices 로 nvidia 1개
  - 모델: Qwen/Qwen3-14B-AWQ      # 24GB 1장 기준 가장 안정적인 선택
  - 인자:
      --quantization awq
      --max-model-len 32768
      --gpu-memory-utilization 0.80   # 임베딩 컨테이너 몫으로 20% 남김
      --served-model-name local-worker
  - 볼륨: ./models:/root/.cache/huggingface
  - 포트 8000
  # ★ 3090 2장으로 늘릴 때 바꿀 곳:
  #   count: 1 → 2, 그리고 인자에 --tensor-parallel-size 2 추가
  #   그러면 Qwen3-32B-AWQ 또는 Qwen3-30B-A3B-AWQ 로 교체 가능
  #   이 부분을 docker-compose.yml 안에 한국어 주석으로 명시할 것

(d) embeddings
  - 이미지: ghcr.io/huggingface/text-embeddings-inference:1.5 (또는 최신 안정판)
  - 모델: BAAI/bge-m3
  - 같은 GPU 공유, 포트 8080
  # ★ VRAM 예산 (24GB 기준): vLLM ~19GB + 임베딩 ~1.5GB + 여유 3.5GB

### 4. `db/init/01-schema.sql`
Postgres 초기화 SQL. `CREATE EXTENSION IF NOT EXISTS vector;` 포함하고,
아래 테이블을 만들 것 (모든 컬럼에 한국어 주석 COMMENT ON 추가):

- tasks           : 작업 큐 (id, title, spec, status, assigned_agent, priority,
                    parent_task_id, created_at, started_at, finished_at, retry_count)
                    status ENUM: queued / running / review / approval_wait / done / failed
- artifacts       : 산출물 (id, task_id, agent_id, kind, content, meta_json, created_at)
- reviews         : 검수 기록 (id, artifact_id, verdict, score, reasons_json, created_at)
                    verdict ENUM: pass / revise / reject
- agent_memory    : 에이전트별 장기 메모리 (id, agent_id, namespace, content,
                    embedding vector(1024), created_at)  ← bge-m3는 1024차원
- token_ledger    : 토큰/비용 원장 (id, task_id, agent_id, model, input_tokens,
                    output_tokens, cache_read_tokens, cost_usd, created_at)
- approvals       : 승인 게이트 (id, task_id, action_type, payload_json, status,
                    decided_by, decided_at)

인덱스: tasks(status, priority), token_ledger(created_at),
        agent_memory 에는 ivfflat 벡터 인덱스.

### 5. `Makefile`
한국어 설명이 붙은 타겟:
- `make up`      : 전체 기동
- `make down`    : 정지
- `make logs`    : 로그 팔로우
- `make check`   : 00-preflight.sh 실행
- `make smoke`   : postgres / n8n / vllm / embeddings 4개 모두 응답하는지 확인
- `make gpu`     : nvidia-smi 로 VRAM 사용량 출력

### 6. `README.md` (ai-team 폴더용)
"처음부터 끝까지 뭘 치면 되는지"를 번호 순서로. 초보자 기준으로.

## 지켜야 할 규칙
1. API 키나 비밀번호를 파일에 하드코딩하지 말 것. 전부 .env 참조.
2. 모든 스크립트는 실패 시 한국어로 원인과 해결책을 출력할 것.
3. 각 파일 상단에 "이 파일이 무엇인지" 한국어 주석 1~3줄.
4. 3090을 2장으로 늘릴 때 수정할 지점은 전부 `# ★ 2장 확장 시:` 주석으로 표시.
5. 만들기 전에 계획을 짧게 보여주고, 내가 "진행"이라고 하면 파일을 생성할 것.

먼저 계획만 보여주세요.
```

---

## 이 프롬프트가 끝나면

```bash
make check   # 사전 점검 통과 확인
make up      # 기동 (첫 실행은 모델 다운로드로 10~30분)
make smoke   # 4개 서비스 응답 확인
```

브라우저에서 http://localhost:5678 → n8n 로그인 화면이 뜨면 성공입니다.
그 다음 `02-agents.md` 로 넘어가세요.
