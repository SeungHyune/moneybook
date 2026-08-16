import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // 빌드 시각 스탬프. 설정 화면 하단에 보여줘서
    // "지금 어느 버전을 보고 있는지"를 기기에서 바로 확인할 수 있다.
    NEXT_PUBLIC_BUILD_AT: new Date()
      .toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })
      .slice(0, 16),
  },
};

export default nextConfig;
