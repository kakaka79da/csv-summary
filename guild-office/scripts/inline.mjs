/**
 * dist/ 의 JS·CSS 를 HTML 한 파일 안으로 인라인한다.
 *
 * 왜 필요한가: 이 앱은 서버 런타임이 필요 없는 정적 산출물이라, JS·CSS 를 HTML 안에
 * 통째로 넣으면 **파일 하나로 전체가 동작한다**. 링크 하나로 공유하거나, 정적 호스팅
 * 없이 더블클릭만으로 열어 보여 줄 때 쓴다.
 *
 * 사용법:
 *   npm run bundle                      → dist/guild-office-demo.html
 *   npm run bundle -- /어디/파일.html    → 원하는 경로로
 *
 * 반드시 `npm run build` 뒤에 실행해야 한다(npm run bundle 이 둘을 이어서 돈다).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ASSETS = join(DIST, 'assets');

if (!existsSync(ASSETS)) {
  console.error(`빌드 산출물이 없습니다: ${ASSETS}\n먼저 "npm run build" 를 실행하세요.`);
  process.exit(1);
}

const files = readdirSync(ASSETS);
const jsFile = files.find((f) => f.endsWith('.js'));
const cssFile = files.find((f) => f.endsWith('.css'));

if (!jsFile || !cssFile) {
  console.error(`assets 에서 JS 또는 CSS 를 찾지 못했습니다: ${files.join(', ')}`);
  process.exit(1);
}

// </script 가 코드 문자열 안에 있으면 브라우저가 거기서 스크립트를 끊는다.
const js = readFileSync(join(ASSETS, jsFile), 'utf8').replaceAll('</script', '<\\/script');
const css = readFileSync(join(ASSETS, cssFile), 'utf8');

// 완전한 문서로 내보낸다. file:// 로 열면 인코딩을 알려 줄 HTTP 헤더가 없어서,
// <meta charset> 이 없으면 브라우저가 추측하다가 한글이 깨질 수 있다.
const out = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>길드 오피스</title>
<style>
${css}
</style>
</head>
<body>
<div id="root"></div>
<script type="module">
${js}
</script>
</body>
</html>
`;

const target = resolve(process.argv[2] ?? join(DIST, 'guild-office-demo.html'));
writeFileSync(target, out);

const kb = (s) => `${(s.length / 1024).toFixed(0)}KB`;
console.log(`js  ${jsFile}  ${kb(js)}`);
console.log(`css ${cssFile}  ${kb(css)}`);
console.log(`→   ${target}  ${kb(out)}`);
