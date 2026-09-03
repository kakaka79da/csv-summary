# 실제 백엔드로 전환할 때 필요한 항목

컴포넌트는 교체 지점을 기준으로 나눠 두었습니다. 아래 표의 "교체할 파일"만 손대면
화면 코드는 그대로 둔 채 실제 서버로 옮길 수 있습니다.

---

## 1. 교체 지점 요약

| 기능 | 지금 | 교체할 파일 | 바꿀 내용 |
|---|---|---|---|
| 인증 | 역할별 데모 버튼 | `components/auth/LoginScreen.tsx`, `store.loginDemo` | 세션 쿠키 기반 로그인/로그아웃 API |
| 상태 저장 | `zustand/persist` → localStorage | `state/store.ts` 의 `persist` 설정 | 서버 API + 낙관적 업데이트 |
| 실시간 동기화 | `requestAnimationFrame` 로컬 tick | `App.tsx` 의 `useEngine` | WebSocket 구독으로 서버가 보내는 상태 적용 |
| AI 호출 | 목 응답 | `store.sendChat`, `advanceWorld` | 서버 프록시 호출 (`POST /api/agents/:id/messages`) |
| 비용 계산 | 견적 공식 | `state/missionMachine.ts` | 서버가 실제 토큰 사용량으로 기록 |
| 승인 | 클라이언트 배열 | `store.decideApproval` | 서버 승인 레코드 + 권한 검사 |
| 감사 로그 | 클라이언트 배열 | `store.audit` | 서버 append-only 로그 조회 |
| 결제 | 없음 | 신규 | 구독/크레딧 결제 연동 |
| 다중 사용자 | 없음 | 신규 | 회사(tenant) 단위 격리 |
| 국가별 서버 | 지사 목록만 표시 | `components/panels/SidePanels.tsx` | 리전 라우팅 |
| 구글 드라이브 연결 | 대표가 직접 만든 폴더 링크를 수동으로 붙여넣음 (`Company.driveFolderUrl`) | `components/panels/SidePanels.tsx` 의 `DriveConnectionSetting`, `store.setCompanyDriveLink` | OAuth 2.0(각 회사별 토큰), Drive API 업로드 프록시, 채팅/자료 첨부 시 자동 라우팅 |
| 미연결 시 임시 저장 | 없음 (이 데모에는 서버가 없어 구현 불가) | 신규 | 서버 스토리지(S3 등) + TTL 기반 자동 삭제 배치 |
| 채팅 파일 첨부 | 없음 (텍스트 메시지만) | `types/index.ts` 의 `Message`, `store.sendChat` | 첨부 필드 추가 + 업로드 API |
| 날씨 | 브라우저에서 직접 Open-Meteo 호출 (키 불필요) | `hooks/useWeather.ts` | 그대로 두어도 된다. 호출량이 문제가 되면 서버에서 좌표 격자 단위로 캐시하는 프록시를 두는 정도 |

---

## 2. 데이터 모델 → 테이블

`src/types/index.ts` 의 타입이 그대로 스키마의 초안이 됩니다.

```
companies         (id, name, ceo_user_id, country, branch, currency,
                   monthly_budget_usd, first_goal, created_at)
users             (id, email, password_hash, role, company_id, created_at,
                   failed_login_count, locked_until)
employees         (id, company_id, kind, name, title, job_class, home_room,
                   scope, report_style, data_access jsonb, on_leave, state,
                   pos_x, pos_y, mood, focus)
provider_bindings (employee_id, provider, model, key_ref, masked_key,
                   per_task_limit_usd, monthly_limit_usd, allowed_tools jsonb,
                   status, last_tested_at)
missions          (id, company_id, name, objective, requester_id, owner_id,
                   difficulty, priority, status, est_cost_usd, actual_cost_usd,
                   requires_approval, approval_id, created_at, started_at, finished_at)
mission_steps     (id, mission_id, idx, title, description, assignee_id, room,
                   work_state, monster_kind, status, progress, est_cost_usd,
                   actual_cost_usd, est_seconds, handoff_to, artifact_id)
artifacts         (id, mission_id, step_id, produced_by, kind, title, body, created_at)
approvals         (id, company_id, kind, title, reason, requester_id, mission_id,
                   est_cost_usd, risk, model, tools jsonb, data_scope jsonb,
                   status, note, created_at, decided_at, decided_by)
ledger            (id, company_id, employee_id, mission_id, step_id, model,
                   input_tokens, output_tokens, cost_usd, note, created_at)
audit_log         (id, company_id, actor_id, action, target, detail, created_at)   -- append only
messages          (id, company_id, employee_id, from_role, kind, text, created_at)
```

키 원문을 담는 컬럼은 없습니다. `key_ref` 는 비밀 관리 서비스의 참조 ID입니다.

---

## 3. 최소 API 표면

```
POST   /api/auth/login                  세션 쿠키 발급
POST   /api/auth/logout
POST   /api/auth/bootstrap-password     최초 1회 관리자 암호 변경 (강제)

POST   /api/companies                   회사 창립
GET    /api/companies/:id/state         오피스 전체 스냅샷

POST   /api/employees/:id/binding       제공자 연결 (서버가 키 검증 후 key_ref 발급)
PATCH  /api/employees/:id/limits        한도 변경 (인상은 승인 필요)
POST   /api/employees/:id/leave         휴직/복귀 요청

POST   /api/missions                    업무 지시 (서버가 견적·승인 필요 여부 판정)
POST   /api/missions/:id/stop
POST   /api/missions/:id/accept

GET    /api/approvals?status=pending
POST   /api/approvals/:id/decide        승인/조건부/수정요청/거절

POST   /api/employees/:id/messages      1:1 대화 (서버가 제공자 API 호출)
GET    /api/ledger, /api/audit

WS     /api/stream                      상태 변화 푸시
```

**서버가 지켜야 할 불변식** (클라이언트를 믿지 않는다):

1. 승인이 필요한 미션은 유효한 `approvals.status IN ('approved','conditional')` 없이는 실행되지 않는다.
2. 어떤 호출도 `per_task_limit_usd` / `monthly_limit_usd` / `monthly_budget_usd` 를 넘지 못한다.
3. `employees.on_leave = true` 인 직원에게는 어떤 작업도 배정되지 않는다.
4. 허용되지 않은 도구·데이터에는 접근할 수 없다.
5. 모든 승인·발송·권한 변경은 `audit_log` 에 기록된다.

---

## 4. 실시간 동기화

지금은 `useEngine` 이 로컬에서 시뮬레이션합니다. 실제로는 서버가 진행 상태의 주인입니다.

```ts
// App.tsx 의 useEngine 을 이것으로 교체
useEffect(() => {
  const ws = new WebSocket(`${WS_URL}/api/stream`);
  ws.onmessage = (e) => useWorld.getState().applyServerPatch(JSON.parse(e.data));
  return () => ws.close();
}, []);
```

`advanceWorld` 의 이동 계산은 클라이언트에 남겨도 됩니다 — 서버는 "어느 방으로 가라"만
보내고, 보간(interpolation)은 브라우저가 하는 편이 대역폭에 유리합니다.
단, **상태(state)와 진행률(progress)은 반드시 서버 값을 따릅니다.**

---

## 5. 단계별 순서

**2단계 — 실제 AI 연결**
1. 서버 프로젝트 생성, `employees` / `provider_bindings` 테이블
2. `POST /api/employees/:id/messages` 프록시 (키는 서버 보관)
3. 실제 토큰 사용량으로 `ledger` 기록
4. 승인 게이트를 서버로 이전
5. 인간 직원 초대 (이메일 + 역할)

**3단계 — 다중 사용자**
6. 세션 인증 + 회사 단위 격리 (RLS 또는 쿼리 스코프)
7. WebSocket 상태 동기화
8. 다중 AI 회의 (여러 에이전트가 하나의 대화에 참여)
9. 국가별 리전 라우팅

**4단계 — 확장**
10. 미션 실행을 워커 큐로 분리 (직원 수천 명 대비)
11. 오피스 뷰를 뷰포트 컬링 + 캔버스/WebGL 렌더링으로 교체
12. 회사 간 협업, 모바일/데스크톱 앱

---

## 6. 회사별 구글 드라이브 자동 연결 (OAuth)

지금은 대표가 직접 만든 폴더의 공유 링크를 붙여넣는 방식이다(`Company.driveFolderUrl`).
"연결하기" 버튼 한 번으로 실제 구글 계정을 붙이려면:

1. Google Cloud Console 에서 이 앱의 배포 도메인을 승인된 자바스크립트 원본으로 등록하고
   OAuth 2.0 클라이언트 ID(웹 애플리케이션)를 발급한다 — **클라이언트 시크릿은 절대
   프론트엔드 번들에 넣지 않는다.**
2. 브라우저에서 Google Identity Services(또는 `@react-oauth/google`)로 PKCE 인가 코드
   흐름을 실행해 임시 액세스 토큰을 받는다. 여기까지는 순수 클라이언트에서도 가능하다.
3. **다만 액세스 토큰은 보통 1시간 안에 만료되고, 조용히 갱신하려면 리프레시 토큰이
   필요하다 — 리프레시 토큰은 반드시 서버가 암호화해 보관해야 한다.** 그래서 "브라우저가
   대표 대신 인가 코드를 받고, 서버가 토큰 교환·갱신·업로드 프록시를 맡는" 구조가 된다.
4. 서버가 `companies.google_drive_refresh_token_ref`(비밀 관리 서비스 참조, 원문 아님)를
   저장하고, `POST /api/companies/:id/drive/files` 같은 업로드 프록시 엔드포인트를 연다.
5. 채팅·자료 공유에서 일정 크기 이상 파일은 이 프록시로 라우팅하고, 그 외(또는 미연결
   회사)는 만료 정책이 있는 임시 스토리지에 넣는다.

---

## 7. 지금 구조에서 그대로 가져갈 수 있는 것

- `src/types/index.ts` — 서버와 공유하는 계약. 패키지로 분리하면 좋다.
- `src/state/agentMachine.ts` — 상태 전이 규칙. **서버에서도 같은 파일을 쓰세요.**
- `src/state/missionMachine.ts` — 미션 상태 전이와 견적 공식.
- `src/lib/pathfinding.ts` — 클라이언트 전용으로 남겨도 무방.

상태 머신을 클라이언트와 서버가 공유하면, 화면과 실제 상태가 어긋나는 문제를
구조적으로 막을 수 있습니다.
