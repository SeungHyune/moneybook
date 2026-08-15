import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

const APP_NAME = "우리집 가계부";

/** iOS 기기별 실행 화면 (scripts/generate-icons.mjs 가 만든 파일과 짝을 이룬다) */
const IOS_SPLASH = [
  { width: 1290, height: 2796, ratio: 3 }, //  15/14 Pro Max
  { width: 1179, height: 2556, ratio: 3 }, //  15/15 Pro/14 Pro
  { width: 1170, height: 2532, ratio: 3 }, //  14/13/12
  { width: 1125, height: 2436, ratio: 3 }, //  X/XS/11 Pro
  { width: 828, height: 1792, ratio: 2 }, //  XR/11
  { width: 750, height: 1334, ratio: 2 }, //  SE
];

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "부부가 함께 쓰는 가계부. 고정지출과 카드 할부까지 한눈에 관리하세요.",
  manifest: "/manifest.json",
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    // 상태바를 앱 배경과 이어지게
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    // 전화번호로 오인식되는 금액 자동 링크 방지
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 홈 화면 앱에서 핀치 줌으로 레이아웃이 깨지는 걸 막는다
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f13" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/*
          첫 페인트 전에 저장된 테마를 적용한다. 이게 없으면 라이트로 한 번
          그려진 뒤 다크로 바뀌면서 화면이 번쩍인다.
          쿠키 대신 localStorage 를 쓰는 이유: 쿠키를 읽으면 layout 이 동적 렌더가 되어
          /login, /offline 같은 정적 페이지까지 매 요청 서버를 타게 된다.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />

        {/*
          iOS 홈 화면 앱 실행 화면.
          Android 는 manifest 의 background_color + icon 으로 알아서 만들어 주지만,
          iOS 는 이 이미지가 없으면 앱을 열 때 흰 화면이 뜬다. 기기 해상도별로 지정한다.
        */}
        {IOS_SPLASH.map(({ width, height, ratio }) => (
          <link
            key={`${width}x${height}`}
            rel="apple-touch-startup-image"
            href={`/icons/splash-${width}x${height}.png`}
            media={`(device-width: ${width / ratio}px) and (device-height: ${height / ratio}px) and (-webkit-device-pixel-ratio: ${ratio})`}
          />
        ))}
      </head>
      <body className="app-backdrop">
        {/*
          앱 셸. 모바일에서는 화면을 꽉 채우고,
          넓은 화면에서는 폰 크기로 가운데에 뜬다. (globals.css 의 .app-shell)
          이 요소가 스크롤 컨테이너라서 헤더/하단탭의 sticky 가 여기에 붙는다.
        */}
        <div className="app-shell">{children}</div>

        {/* 홈 화면 앱으로 열었을 때만 잠깐 뜨는 실행 화면 (globals.css) */}
        <div className="app-splash" aria-hidden>
          <span className="app-splash-mark">₩</span>
        </div>

        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
