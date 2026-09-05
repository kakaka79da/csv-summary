import { describe, expect, it } from 'vitest';
import {
  MAX_FAILED_ATTEMPTS,
  MIN_PASSWORD_LENGTH,
  afterFailure,
  afterSuccess,
  checkPassword,
  hashPassword,
  lockoutLeft,
  makeSalt,
  verifyPassword,
} from '@/lib/password';
import { ADMIN_BOOTSTRAP_CREDENTIAL } from '@/data/adminCredential';

describe('hashPassword / verifyPassword', () => {
  it('맞는 암호는 통과, 틀린 암호는 거절', async () => {
    const cred = await hashPassword('올바른암호123');
    expect(await verifyPassword('올바른암호123', cred)).toBe(true);
    expect(await verifyPassword('틀린암호123', cred)).toBe(false);
  });

  it('암호 원문이 저장값 어디에도 남지 않는다', async () => {
    const secret = '내비밀번호12345';
    const cred = await hashPassword(secret);
    const dump = JSON.stringify(cred);
    expect(dump).not.toContain(secret);
    // 해시·소금은 16진수 문자열이어야 한다
    expect(cred.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(cred.salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it('같은 암호라도 사람마다 다른 해시가 나온다 (소금)', async () => {
    const a = await hashPassword('같은암호12345');
    const b = await hashPassword('같은암호12345');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    // 그래도 각자의 대조는 통과해야 한다
    expect(await verifyPassword('같은암호12345', a)).toBe(true);
    expect(await verifyPassword('같은암호12345', b)).toBe(true);
  });

  it('자격증명이 없으면 무조건 거절한다', async () => {
    expect(await verifyPassword('아무거나', undefined)).toBe(false);
  });

  it('한글·이모지·공백이 섞여도 그대로 다룬다', async () => {
    const pw = '내 암호 🔐 입니다';
    const cred = await hashPassword(pw);
    expect(await verifyPassword(pw, cred)).toBe(true);
    expect(await verifyPassword('내 암호 🔐 입니다 ', cred)).toBe(false);
  });

  it('makeSalt 는 매번 다른 값을 준다', () => {
    expect(makeSalt()).not.toBe(makeSalt());
  });
});

describe('관리자 부트스트랩 자격증명', () => {
  it('약속된 암호로 열린다', async () => {
    expect(await verifyPassword('mkang428', ADMIN_BOOTSTRAP_CREDENTIAL)).toBe(true);
  });

  it('다른 암호로는 열리지 않는다', async () => {
    expect(await verifyPassword('mkang429', ADMIN_BOOTSTRAP_CREDENTIAL)).toBe(false);
    expect(await verifyPassword('', ADMIN_BOOTSTRAP_CREDENTIAL)).toBe(false);
  });

  it('소스에 암호 원문이 들어 있지 않다', () => {
    // 해시·소금뿐이어야 한다 — 번들을 뜯어도 문자열로 나오지 않는다
    const dump = JSON.stringify(ADMIN_BOOTSTRAP_CREDENTIAL);
    expect(dump).not.toContain('mkang428');
  });
});

describe('checkPassword', () => {
  it('짧으면 거절한다', () => {
    const r = checkPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1));
    expect(r.ok).toBe(false);
    expect(r.error).toContain(`${MIN_PASSWORD_LENGTH}자`);
  });

  it('흔한 암호를 거절한다', () => {
    expect(checkPassword('password').ok).toBe(false);
    expect(checkPassword('PASSWORD').ok).toBe(false);
    expect(checkPassword('12345678').ok).toBe(false);
  });

  it('같은 글자만 반복하면 거절한다', () => {
    expect(checkPassword('aaaaaaaa').ok).toBe(false);
  });

  it('길이만 채우면 통과시킨다 — 규칙을 과하게 만들지 않는다', () => {
    expect(checkPassword('mkang428').ok).toBe(true);
    expect(checkPassword('우리회사암호').ok).toBe(false); // 6자라 짧다
    expect(checkPassword('우리회사암호입니다').ok).toBe(true);
  });
});

describe('로그인 시도 제한', () => {
  it('정해진 횟수를 연달아 틀리면 잠근다', () => {
    let st = afterFailure(undefined, 1000);
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) st = afterFailure(st, 1000);
    expect(st.failed).toBe(MAX_FAILED_ATTEMPTS);
    expect(st.lockedUntil).not.toBe(null);
    expect(lockoutLeft(st, 1000)).toBeGreaterThan(0);
  });

  it('잠금 시간이 지나면 다시 열린다', () => {
    let st = afterFailure(undefined, 0);
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) st = afterFailure(st, 0);
    expect(lockoutLeft(st, 10 * 60 * 1000)).toBe(0);
  });

  it('성공하면 횟수가 초기화된다', () => {
    expect(afterSuccess()).toEqual({ failed: 0, lockedUntil: null });
    expect(lockoutLeft(afterSuccess())).toBe(0);
  });

  it('잠기기 전까지는 잠금이 걸리지 않는다', () => {
    const st = afterFailure(afterFailure(undefined, 0), 0);
    expect(st.lockedUntil).toBe(null);
    expect(lockoutLeft(st, 0)).toBe(0);
  });
});
