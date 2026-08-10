import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

const APP_NAME = "우리집 가계부";

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
      <body className="app-backdrop">
        {/*
          앱 셸. 모바일에서는 화면을 꽉 채우고,
          넓은 화면에서는 폰 크기로 가운데에 뜬다. (globals.css 의 .app-shell)
          이 요소가 스크롤 컨테이너라서 헤더/하단탭의 sticky 가 여기에 붙는다.
        */}
        <div className="app-shell">{children}</div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
