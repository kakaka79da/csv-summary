/**
 * 플랫폼 관리자 부트스트랩 자격증명.
 *
 * ⚠️⚠️ 읽고 넘어가야 할 것 ⚠️⚠️
 *
 * 이 프로젝트의 보안 원칙은 "프론트엔드 코드에 관리자 암호를 저장하지 않는다"이다.
 * 그래서 여기에는 **암호 원문이 없다.** PBKDF2-SHA256 으로 만든 해시와 소금뿐이며,
 * 번들을 뜯어봐도 문자열로 나오지 않는다.
 *
 * 그렇다고 안전한 것은 아니다. 짧은 암호는 이 해시만 있으면 대입으로 풀린다.
 * 이것은 **개발·시연 기간의 임시 진입로**이며, 원칙 문서(`docs/SECURITY.md` §3)가
 * 말하는 Bootstrap Password 그 자체다. 지켜야 할 것:
 *
 *   1) 서버가 생기면 **환경변수에서만** 읽는다 (`BOOTSTRAP_ADMIN_PASSWORD`)
 *   2) 관리자가 자기 암호를 정하면 이 값은 **더 이상 쓰이지 않는다**
 *      (스토어의 credentials['admin'] 이 있으면 그쪽이 이긴다)
 *   3) 그때까지 관리자 화면에는 "부트스트랩 암호를 쓰는 중"이라는 경고가 계속 뜬다
 *
 * 실제 서비스 데이터를 넣기 전에 반드시 2)를 끝내야 한다.
 */
import type { StoredCredential } from '@/lib/password';

export const ADMIN_ACCOUNT_KEY = 'admin';

/** 관리자 부트스트랩 자격증명 (해시만). 대표·사원 암호와 같은 형식이다. */
export const ADMIN_BOOTSTRAP_CREDENTIAL: StoredCredential = {
  salt: '2c0121e6350ca38f08b771e8e5234572',
  hash: 'c9b2fc8d82ac4c0f4dd300e62177fcc567de1baba85939716ba1fef4f8947465',
  iterations: 120_000,
  updatedAt: 0,
};
