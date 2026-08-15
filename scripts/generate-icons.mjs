/**
 * PWA 아이콘 생성기.
 *
 * 외부 의존성 없이 Node 만으로 PNG 를 직접 인코딩한다.
 * 디자인을 바꾸고 싶으면 CONFIG 값만 손보고 `pnpm icons` 를 다시 돌리면 된다.
 *
 *   pnpm icons
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/icons");

const CONFIG = {
  /** 배경 그라데이션 (좌상 -> 우하) */
  bgFrom: [59, 91, 253], //  #3b5bfd
  bgTo: [99, 72, 224], //  #6348e0
  symbol: [255, 255, 255],
  /** 슈퍼샘플링 배수 — 높을수록 테두리가 부드럽다 */
  supersample: 4,
};

// ---------------------------------------------------------------------------
// PNG 인코딩
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; //  bit depth
  ihdr[9] = 6; //  color type: RGBA
  ihdr[10] = 0; //  compression
  ihdr[11] = 0; //  filter
  ihdr[12] = 0; //  interlace

  // 스캔라인마다 filter byte(0) 를 앞에 붙인다
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// 그리기
// ---------------------------------------------------------------------------

/** 점 p 와 선분 ab 사이의 거리 */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;

  let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** 라운드 사각형 내부인지 */
function insideRoundRect(px, py, x, y, w, h, r) {
  const left = x + r;
  const right = x + w - r;
  const top = y + r;
  const bottom = y + h - r;

  const cx = Math.max(left, Math.min(px, right));
  const cy = Math.max(top, Math.min(py, bottom));

  if (px < x || px > x + w || py < y || py > y + h) return false;
  return Math.hypot(px - cx, py - cy) <= r;
}

/**
 * ₩ 기호를 선분으로 그린다. (W 4획 + 가로줄 2개)
 * cx, cy 는 기호 중심, size 는 기호 전체 높이.
 */
function wonSymbolSegments(cx, cy, size) {
  const halfW = size * 0.44;
  const top = cy - size * 0.36;
  const bottom = cy + size * 0.36;

  // W 의 5개 꼭짓점
  const points = [
    [cx - halfW, top],
    [cx - halfW * 0.5, bottom],
    [cx, top + size * 0.1],
    [cx + halfW * 0.5, bottom],
    [cx + halfW, top],
  ];

  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push([...points[i], ...points[i + 1]]);
  }

  // 가로줄 2개
  const barHalf = halfW * 1.08;
  segments.push([cx - barHalf, cy - size * 0.05, cx + barHalf, cy - size * 0.05]);
  segments.push([cx - barHalf, cy + size * 0.14, cx + barHalf, cy + size * 0.14]);

  return segments;
}

/**
 * @param size 최종 픽셀 크기
 * @param maskable true 면 배경을 꽉 채우고 기호를 안전영역(80%) 안에 넣는다
 */
function renderIcon(size, { maskable = false } = {}) {
  const ss = CONFIG.supersample;
  const dim = size * ss;

  // 슈퍼샘플 버퍼 (RGBA float 누적 대신 8bit 로 그리고 나중에 평균)
  const hi = Buffer.alloc(dim * dim * 4);

  const radius = maskable ? 0 : dim * 0.225;
  const symbolScale = maskable ? 0.5 : 0.62;
  const strokeWidth = dim * (maskable ? 0.052 : 0.064);

  const segments = wonSymbolSegments(dim / 2, dim / 2, dim * symbolScale);

  for (let y = 0; y < dim; y++) {
    for (let x = 0; x < dim; x++) {
      const index = (y * dim + x) * 4;

      if (!insideRoundRect(x, y, 0, 0, dim, dim, radius)) {
        continue; //  투명하게 남김
      }

      // 대각선 그라데이션
      const t = (x / dim + y / dim) / 2;
      let r = Math.round(CONFIG.bgFrom[0] + (CONFIG.bgTo[0] - CONFIG.bgFrom[0]) * t);
      let g = Math.round(CONFIG.bgFrom[1] + (CONFIG.bgTo[1] - CONFIG.bgFrom[1]) * t);
      let b = Math.round(CONFIG.bgFrom[2] + (CONFIG.bgTo[2] - CONFIG.bgFrom[2]) * t);

      // 기호 위에 흰색 덮기
      let onSymbol = false;
      for (const [ax, ay, bx, by] of segments) {
        if (distanceToSegment(x, y, ax, ay, bx, by) <= strokeWidth / 2) {
          onSymbol = true;
          break;
        }
      }
      if (onSymbol) {
        [r, g, b] = CONFIG.symbol;
      }

      hi[index] = r;
      hi[index + 1] = g;
      hi[index + 2] = b;
      hi[index + 3] = 255;
    }
  }

  // 다운샘플 (박스 필터) — 이 단계가 안티앨리어싱 역할을 한다
  const out = Buffer.alloc(size * size * 4);
  const samples = ss * ss;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let dy = 0; dy < ss; dy++) {
        for (let dx = 0; dx < ss; dx++) {
          const si = ((y * ss + dy) * dim + (x * ss + dx)) * 4;
          const alpha = hi[si + 3] / 255;
          r += hi[si] * alpha;
          g += hi[si + 1] * alpha;
          b += hi[si + 2] * alpha;
          a += hi[si + 3];
        }
      }

      const alphaSum = a / samples;
      const weight = alphaSum === 0 ? 0 : (alphaSum / 255) * samples;

      const di = (y * size + x) * 4;
      out[di] = weight === 0 ? 0 : Math.round(r / weight);
      out[di + 1] = weight === 0 ? 0 : Math.round(g / weight);
      out[di + 2] = weight === 0 ? 0 : Math.round(b / weight);
      out[di + 3] = Math.round(alphaSum);
    }
  }

  return encodePng(size, size, out);
}

// ---------------------------------------------------------------------------

/**
 * iOS 홈 화면 앱 실행 화면(스플래시).
 *
 * iOS 는 Android 와 달리 manifest 로 스플래시를 만들어 주지 않아서,
 * 이 이미지가 없으면 앱을 열 때 흰 화면이 뜬다. 해상도별로 따로 필요하다.
 */
function renderSplash(width, height) {
  const out = Buffer.alloc(width * height * 4);

  // 심볼은 짧은 변의 22% 정도가 보기 좋다
  const symbolSize = Math.round(Math.min(width, height) * 0.22);
  const strokeWidth = symbolSize * 0.1;
  const segments = wonSymbolSegments(width / 2, height / 2, symbolSize);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      const t = (x / width + y / height) / 2;
      let r = Math.round(CONFIG.bgFrom[0] + (CONFIG.bgTo[0] - CONFIG.bgFrom[0]) * t);
      let g = Math.round(CONFIG.bgFrom[1] + (CONFIG.bgTo[1] - CONFIG.bgFrom[1]) * t);
      let b = Math.round(CONFIG.bgFrom[2] + (CONFIG.bgTo[2] - CONFIG.bgFrom[2]) * t);

      // 안티앨리어싱: 선 경계에서 부드럽게 섞는다
      let coverage = 0;
      for (const [ax, ay, bx, by] of segments) {
        const distance = distanceToSegment(x, y, ax, ay, bx, by);
        const edge = strokeWidth / 2;
        if (distance <= edge - 0.5) {
          coverage = 1;
          break;
        }
        if (distance < edge + 0.5) {
          coverage = Math.max(coverage, edge + 0.5 - distance);
        }
      }

      if (coverage > 0) {
        r = Math.round(r + (CONFIG.symbol[0] - r) * coverage);
        g = Math.round(g + (CONFIG.symbol[1] - g) * coverage);
        b = Math.round(b + (CONFIG.symbol[2] - b) * coverage);
      }

      out[index] = r;
      out[index + 1] = g;
      out[index + 2] = b;
      out[index + 3] = 255;
    }
  }

  return encodePng(width, height, out);
}

/**
 * iOS 기기별 실행 화면. media query 로 골라 쓰도록 layout.tsx 에 링크가 있다.
 * iOS 는 해상도가 "정확히 일치"해야만 이미지를 쓴다 — 안 맞으면 흰 화면이 뜬다.
 * 새 아이폰이 나오면 여기와 layout.tsx 의 IOS_SPLASH 에 함께 추가할 것.
 */
const SPLASH_TARGETS = [
  { file: "splash-1320x2868.png", width: 1320, height: 2868 }, //  17 Pro Max/16 Pro Max
  { file: "splash-1260x2736.png", width: 1260, height: 2736 }, //  17 Air
  { file: "splash-1206x2622.png", width: 1206, height: 2622 }, //  17/17 Pro/16 Pro
  { file: "splash-1290x2796.png", width: 1290, height: 2796 }, //  16 Plus/15 Pro Max/14 Pro Max
  { file: "splash-1284x2778.png", width: 1284, height: 2778 }, //  15 Plus/14 Plus/13 Pro Max
  { file: "splash-1179x2556.png", width: 1179, height: 2556 }, //  16/15/15 Pro/14 Pro
  { file: "splash-1170x2532.png", width: 1170, height: 2532 }, //  14/13/12
  { file: "splash-1125x2436.png", width: 1125, height: 2436 }, //  X/XS/11 Pro
  { file: "splash-828x1792.png", width: 828, height: 1792 }, //  XR/11
  { file: "splash-750x1334.png", width: 750, height: 1334 }, //  SE
];

const TARGETS = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: true },
  // 카카오 개발자 콘솔 앱 아이콘용.
  // 동의화면에서 원형으로 잘리므로 배경을 꽉 채우고(maskable) 심볼은 안쪽에 둔다.
  { file: "kakao-app-icon.png", size: 512, maskable: true },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const { file, size, maskable } of TARGETS) {
  const png = renderIcon(size, { maskable });
  writeFileSync(resolve(OUT_DIR, file), png);
  console.log(`✓ ${file} (${size}x${size}, ${(png.length / 1024).toFixed(1)}KB)`);
}

for (const { file, width, height } of SPLASH_TARGETS) {
  const png = renderSplash(width, height);
  writeFileSync(resolve(OUT_DIR, file), png);
  console.log(`✓ ${file} (${width}x${height}, ${(png.length / 1024).toFixed(1)}KB)`);
}

console.log(
  `\n아이콘 ${TARGETS.length}개 + 실행화면 ${SPLASH_TARGETS.length}개를 public/icons 에 만들었습니다.`,
);
