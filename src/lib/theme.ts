/**
 * 테마 스토어.
 *
 * localStorage 를 단일 소스로 두고 useSyncExternalStore 로 구독한다.
 * 컴포넌트 안에서 document/localStorage 를 직접 만지면
 * React Compiler 규칙(immutability, set-state-in-effect)에 걸리므로
 * 그 작업을 전부 이 모듈로 밀어 넣었다.
 *
 * 첫 페인트 전 적용은 layout.tsx 의 인라인 스크립트가 담당한다.
 */

export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "theme";

let listeners: (() => void)[] = [];

function isTheme(value: string | null): value is "light" | "dark" {
  return value === "light" || value === "dark";
}

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    // 시크릿 모드 등에서 localStorage 가 막힌 경우
    return "system";
  }
}

/** 서버 렌더 / hydration 시점의 값 */
export function getServerTheme(): Theme {
  return "system";
}

export function subscribeTheme(callback: () => void) {
  listeners = [...listeners, callback];

  // 다른 탭에서 바꿨을 때도 따라간다
  window.addEventListener("storage", callback);

  return () => {
    listeners = listeners.filter((listener) => listener !== callback);
    window.removeEventListener("storage", callback);
  };
}

function isDarkNow(theme: Theme) {
  return (
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

function applyToDocument(theme: Theme) {
  const root = document.documentElement;

  if (theme === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }

  // PWA 상태바 색이 테마와 어긋나지 않도록 meta 도 같이 맞춘다
  const color = isDarkNow(theme) ? "#0e0f13" : "#f5f6f8";
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", color);
  }
}

export function setTheme(theme: Theme) {
  try {
    if (theme === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  } catch {
    // 저장이 안 되더라도 화면에는 반영해 준다
  }

  applyToDocument(theme);

  for (const listener of listeners) listener();
}
