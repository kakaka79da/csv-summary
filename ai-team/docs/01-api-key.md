# Anthropic API 키 발급 — 상세 가이드

> 로컬 LLM(vLLM/Ollama)은 API 키가 **필요 없습니다**. 유료 키는 Claude 하나만 발급받으면 됩니다.

---

## 0. 준비물

| 항목 | 내용 |
|---|---|
| 이메일 | 개인 메일도 가능 (Google 로그인 지원) |
| 결제수단 | 해외결제 가능한 신용/체크카드 (VISA/Master). **선불 크레딧 충전 방식** |
| 최소 충전 | 보통 $5부터. 테스트만 할 거면 $5로 충분 |
| 휴대폰 | 계정 인증에 필요할 수 있음 |

---

## 1. 콘솔 가입

1. https://platform.claude.com 접속
2. **Sign up** → 이메일 또는 Google 계정으로 가입
3. 이메일 인증 완료
4. 조직(Organization) 이름 입력 — 개인이면 아무 이름이나 (예: `my-ai-team`)

> ⚠️ **claude.ai(챗봇 구독)와 API는 별개입니다.** Claude Pro/Max를 결제해도 API 크레딧은 안 생깁니다. 반대도 마찬가지입니다.

---

## 2. 결제수단 등록 + 크레딧 충전

**Settings → Billing** (또는 좌측 메뉴 `Billing`)

1. **Add payment method** — 카드 등록
2. **Buy credits** — 첫 충전 (권장: **$20**)
   - $5: 동작 테스트만
   - $20: 에이전트 팀 1~2주 시범 운영
   - $50+: 본격 운영
3. **Auto-reload**(자동 충전)는 **처음엔 끄세요.** 루프 버그로 크레딧이 순삭될 수 있습니다.

### 지출 한도 걸기 (반드시 하세요)

**Billing → Limits** 에서:

| 설정 | 권장값 | 이유 |
|---|---|---|
| Monthly spend limit | 첫 달 $30 | 무한 루프 사고 방지 |
| Alert threshold | $10, $20 | 메일로 경고 수신 |

24시간 자동 운영에서 **이 설정 하나가 사고 대부분을 막습니다.**

---

## 3. Workspace 만들기 (선택이지만 강력 권장)

**Settings → Workspaces → Create Workspace**

- 이름: `ai-team-prod`
- 워크스페이스별로 **개별 지출 한도**와 **개별 rate limit**을 걸 수 있습니다.
- 나중에 "리서처는 이만큼, 실무자는 이만큼" 예산 분리가 가능해집니다.

---

## 4. API 키 발급

**Settings → API keys → Create Key**

| 입력 항목 | 값 |
|---|---|
| Name | `n8n-ai-team` (용도가 드러나게) |
| Workspace | 위에서 만든 `ai-team-prod` |

**Create Key** 클릭 → `sk-ant-api03-...` 형태의 키가 표시됩니다.

> 🚨 **키는 이 화면에서 딱 한 번만 보입니다.** 창을 닫으면 다시 볼 수 없고, 새로 발급받아야 합니다. 지금 바로 복사해서 안전한 곳(비밀번호 관리자)에 저장하세요.

### 키를 만들면 안 되는 곳
- ❌ 소스코드에 하드코딩
- ❌ GitHub 커밋 (푸시되는 순간 봇이 수 초 내에 스캔합니다)
- ❌ 카카오톡/디스코드로 자신에게 전송
- ✅ 환경변수 또는 `.env` 파일(`.gitignore`에 반드시 추가)
- ✅ n8n의 Credentials 저장소(암호화 저장됨)

---

## 5. 키 저장 (Windows + WSL2)

### 5-1. WSL2 안에서 (권장 — 대부분의 작업이 여기서 돌아감)

```bash
# ~/.bashrc 맨 아래에 추가
echo 'export ANTHROPIC_API_KEY="sk-ant-api03-여기에붙여넣기"' >> ~/.bashrc
source ~/.bashrc

# 확인 (앞 12자만 출력 — 전체를 화면에 띄우지 마세요)
echo "${ANTHROPIC_API_KEY:0:12}..."
```

### 5-2. Docker Compose 용 `.env`

```bash
# 프로젝트 폴더에 .env 생성
cat > .env <<'EOF'
ANTHROPIC_API_KEY=sk-ant-api03-여기에붙여넣기
POSTGRES_PASSWORD=바꾸세요_긴_임의문자열
N8N_ENCRYPTION_KEY=바꾸세요_32자이상_임의문자열
EOF

chmod 600 .env
echo ".env" >> .gitignore   # 필수
```

### 5-3. 윈도우 네이티브에서도 필요하다면

PowerShell (관리자 아님):
```powershell
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-api03-...", "User")
# 새 터미널을 열어야 적용됩니다
```

---

## 6. 동작 확인

### WSL2 / bash
```bash
curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-opus-5",
    "max_tokens": 64,
    "messages": [{"role": "user", "content": "한 단어로만 답하세요: OK"}]
  }'
```

정상이면 `"content":[{"type":"text","text":"OK"}]` 같은 응답이 옵니다.

### 자주 나오는 에러

| 응답 | 원인 | 해결 |
|---|---|---|
| `401 authentication_error` | 키 오타 / 앞뒤 공백 / 환경변수 미적용 | `echo ${ANTHROPIC_API_KEY:0:12}` 로 확인, 새 터미널 |
| `400 credit balance is too low` | 크레딧 잔액 0 | Billing에서 충전 |
| `404 not_found_error` | 모델 ID 오타 | `claude-opus-5` (날짜 suffix 붙이지 마세요) |
| `429 rate_limit_error` | 분당 한도 초과 | `retry-after` 헤더만큼 대기. SDK는 자동 재시도 |
| `403 permission_error` | 워크스페이스 권한 | 키가 속한 워크스페이스 확인 |

---

## 7. 모델과 가격 (2026-07 기준, 100만 토큰당)

| 모델 | 모델 ID | 입력 | 출력 | 우리 팀에서의 역할 |
|---|---|---|---|---|
| Claude Opus 5 | `claude-opus-5` | $5 | $25 | **PM / 검수 / 코드** — 틀리면 안 되는 일 |
| Claude Sonnet 5 | `claude-sonnet-5` | $3 ($2 프로모) | $15 ($10 프로모) | 실무자 — 양이 많은 작성 작업 |
| Claude Haiku 4.5 | `claude-haiku-4-5` | $1 | $5 | 분류/라우팅 |

> Sonnet 5는 **2026-08-31까지 도입가 $2/$10** 입니다. 지금 시작하면 한 달간 저렴합니다.

### 비용을 3~10배 줄이는 3가지

1. **Prompt Caching** — 매번 같은 시스템 프롬프트를 보낼 때, 캐시 읽기는 정가의 **약 1/10**. 쓰기는 1.25배(5분 TTL). 에이전트 시스템 프롬프트는 고정이니 거의 공짜가 됩니다.
2. **Batch API** — 급하지 않은 작업(야간 배치)은 **50% 할인**. 최대 24시간 내 처리.
3. **로컬 LLM 분리** — 요약/분류/1차 초안은 3090에서 무료로.

---

## 8. Rate Limit (처음엔 낮습니다)

가입 직후는 **Tier 1**이라 분당 요청 수와 토큰 수가 제한적입니다. 누적 사용액과 경과일에 따라 자동으로 Tier가 올라갑니다.

- 24시간 병렬 에이전트를 돌릴 계획이면 **초반엔 동시 실행 수를 2~3개로 제한**하세요.
- 429가 나면 SDK가 자동 재시도합니다(기본 2회). n8n에서는 노드에 재시도 설정을 켜두세요.

---

## 9. 발급 후 체크리스트

- [ ] 크레딧 충전 완료 (`$20` 권장)
- [ ] Monthly spend limit 설정 (`$30`)
- [ ] Auto-reload **꺼짐**
- [ ] 키를 `.env`에 저장하고 `.gitignore`에 `.env` 추가
- [ ] `curl` 테스트 통과
- [ ] 키를 채팅/코드/커밋 어디에도 남기지 않음

여기까지 되면 `prompts/01-infra.md` 로 넘어가세요.
