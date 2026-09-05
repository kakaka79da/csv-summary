/**
 * 개인 암호 — 해시 만들기와 대조.
 *
 * ⚠️ 먼저 분명히 해 둘 것: **이것은 진짜 보안이 아니다.**
 * 이 앱에는 서버가 없다. 대조가 브라우저 안에서 일어나므로, 개발자 도구를 아는
 * 사람은 대조 자체를 건너뛰고 남의 계정으로 들어갈 수 있다. 여기서 얻는 것은
 * 딱 두 가지다.
 *   1) **어깨너머·실수로** 남의 계정에 들어가는 일을 막는다 (이메일만 알면 되던 것보다 낫다)
 *   2) 암호 원문이 어디에도 저장되지 않는다 — localStorage 를 열어 봐도 해시뿐이다
 *
 * 진짜 인증은 서버가 대조해야 하며 백엔드 항목이다(`docs/SECURITY.md`).
 * 다만 여기서 만든 저장 형태(salt + 반복 횟수 + 해시)는 서버로 옮길 때 그대로 쓰이므로,
 * 지금 구조를 제대로 잡아 두면 나중에 화면을 다시 만들 필요가 없다.
 *
 * 알고리즘: PBKDF2-SHA256. 브라우저 표준(Web Crypto)만 쓰므로 의존성이 늘지 않는다.
 * 서버로 옮길 때는 Argon2id 로 바꾸는 것이 좋다 — 그건 서버에서만 쓸 수 있다.
 */

/** 반복 횟수. 브라우저에서 체감되지 않으면서(≈100ms) 대입 공격 비용을 올리는 선. */
export const PBKDF2_ITERATIONS = 120_000;

/** 저장되는 자격증명. 암호 원문은 여기에 없다. */
export interface StoredCredential {
  /** 무작위 소금 (hex). 같은 암호라도 사람마다 다른 해시가 나오게 한다. */
  salt: string;
  /** 파생 키 (hex) */
  hash: string;
  iterations: number;
  updatedAt: number;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): ArrayBuffer {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  // .buffer 를 그대로 넘기면 SharedArrayBuffer 일 수 있다는 타입 오류가 난다.
  // 새 ArrayBuffer 로 복사해 타입과 실제를 모두 확실하게 한다.
  const buf = new ArrayBuffer(out.length);
  new Uint8Array(buf).set(out);
  return buf;
}

/** 무작위 소금 (16바이트) */
export function makeSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const buf = new ArrayBuffer(bytes.length);
  new Uint8Array(buf).set(bytes);
  return toHex(buf);
}

async function derive(password: string, saltHex: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex), iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(bits);
}

/** 암호에서 저장할 자격증명을 만든다. */
export async function hashPassword(
  password: string,
  saltHex = makeSalt(),
  iterations = PBKDF2_ITERATIONS,
  now = Date.now(),
): Promise<StoredCredential> {
  return { salt: saltHex, hash: await derive(password, saltHex, iterations), iterations, updatedAt: now };
}

/**
 * 암호가 맞는지 본다.
 *
 * 비교는 길이와 무관하게 같은 시간이 걸리도록 한다. 브라우저 안에서는 큰 의미가
 * 없지만, 이 코드가 그대로 서버로 옮겨갈 것이므로 처음부터 맞게 써 둔다.
 */
export async function verifyPassword(password: string, cred: StoredCredential | undefined): Promise<boolean> {
  if (!cred) return false;
  const got = await derive(password, cred.salt, cred.iterations);
  if (got.length !== cred.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ cred.hash.charCodeAt(i);
  return diff === 0;
}

/* ─────────────────────────── 암호 규칙 ─────────────────────────── */

/** 너무 쉬운 암호를 막는다. 흔한 것들만 걸러도 대부분의 사고를 막는다. */
const TOO_COMMON = [
  'password',
  '12345678',
  '123456789',
  'qwerty123',
  'iloveyou',
  'admin123',
  '11111111',
  '00000000',
  'abcd1234',
];

export const MIN_PASSWORD_LENGTH = 8;

export function checkPassword(password: string): { ok: boolean; error?: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `암호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` };
  }
  if (password.length > 200) {
    return { ok: false, error: '암호가 너무 깁니다.' };
  }
  if (TOO_COMMON.includes(password.toLowerCase())) {
    return { ok: false, error: '너무 흔한 암호입니다. 다른 것으로 정해 주세요.' };
  }
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, error: '같은 글자만으로는 만들 수 없습니다.' };
  }
  return { ok: true };
}

/* ─────────────────────── 로그인 시도 제한 ─────────────────────── */

/** 이 횟수를 연달아 틀리면 잠근다. */
export const MAX_FAILED_ATTEMPTS = 5;
/** 잠금 시간 (ms) */
export const LOCKOUT_MS = 5 * 60 * 1000;

export interface AttemptState {
  failed: number;
  lockedUntil: number | null;
}

/** 지금 잠겨 있는가. 잠겨 있으면 남은 시간(초)도 함께 돌려준다. */
export function lockoutLeft(state: AttemptState | undefined, now = Date.now()): number {
  if (!state?.lockedUntil) return 0;
  return Math.max(0, Math.ceil((state.lockedUntil - now) / 1000));
}

/** 틀렸을 때의 다음 상태 */
export function afterFailure(state: AttemptState | undefined, now = Date.now()): AttemptState {
  const failed = (state?.failed ?? 0) + 1;
  return {
    failed,
    lockedUntil: failed >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_MS : null,
  };
}

/** 맞았을 때의 다음 상태 (초기화) */
export function afterSuccess(): AttemptState {
  return { failed: 0, lockedUntil: null };
}
