/**
 * Pretendard 웹폰트를 node_modules 에서 public/fonts 로 복사한다.
 *
 * 왜 이렇게 하나:
 *  - 폰트를 직접 서빙해야 CDN 요청 없이(오프라인에서도) 뜨고, PWA 캐시에도 잡힌다.
 *  - dist 바이너리를 저장소에 커밋하지 않으려고 postinstall 로 매번 복사한다.
 *    (pretendard 는 devDependency 로 버전이 고정되어 있어 재현 가능하다)
 *
 * dynamic-subset 을 쓰는 이유:
 *  통짜 PretendardVariable.woff2 는 2MB 다. dynamic-subset 은 92조각으로 나뉘어
 *  있고 각 @font-face 에 unicode-range 가 붙어 있어서, 브라우저가 화면에 실제로
 *  쓰인 글자가 든 조각만 받아온다. 한국어 화면이면 보통 수백 KB 수준.
 *
 *   pnpm fonts
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SOURCE_DIR = resolve(
  __dirname,
  "../node_modules/pretendard/dist/web/variable",
);
const OUT_DIR = resolve(__dirname, "../public/fonts/pretendard");
/** @font-face 정의는 번들에 들어가야 별도 요청 없이 첫 페인트에 적용된다 */
const CSS_OUT = resolve(__dirname, "../src/app/pretendard.generated.css");

if (!existsSync(SOURCE_DIR)) {
  console.warn(
    "[fonts] pretendard 패키지를 찾지 못했습니다. `pnpm install` 후 다시 실행하세요.",
  );
  // 폰트가 없어도 시스템 폰트로 폴백되므로 빌드를 막지는 않는다.
  process.exit(0);
}

// 1) woff2 조각들은 public 으로 (브라우저가 unicode-range 보고 필요한 것만 받아간다)
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
cpSync(
  resolve(SOURCE_DIR, "woff2-dynamic-subset"),
  resolve(OUT_DIR, "woff2-dynamic-subset"),
  { recursive: true },
);

// 2) @font-face CSS 는 src 로. 원본의 상대경로(./woff2-dynamic-subset/...)를
//    public 절대경로로 바꿔야 번들된 CSS 안에서도 파일을 찾을 수 있다.
const source = readFileSync(
  resolve(SOURCE_DIR, "pretendardvariable-dynamic-subset.css"),
  "utf8",
);

const rewritten = source.replaceAll(
  "url(./woff2-dynamic-subset/",
  "url(/fonts/pretendard/woff2-dynamic-subset/",
);

const faceCount = (rewritten.match(/@font-face/g) ?? []).length;
if (faceCount === 0 || rewritten.includes("url(./")) {
  throw new Error("[fonts] CSS 경로 치환에 실패했습니다. pretendard 버전을 확인하세요.");
}

writeFileSync(
  CSS_OUT,
  `/* 이 파일은 scripts/sync-fonts.mjs 가 만듭니다. 직접 수정하지 마세요. */\n${rewritten}`,
);

console.log(
  `✓ Pretendard 동기화 완료 — woff2 조각 → public/fonts/pretendard, @font-face ${faceCount}개 → src/app/pretendard.generated.css`,
);
