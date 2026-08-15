"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarClock,
  ChevronLeft,
  CreditCard,
  Plus,
  Users,
} from "lucide-react";
import { markTutorialSeen } from "@/app/actions/tutorial";
import { cn } from "@/lib/utils";

/**
 * 첫 방문 튜토리얼.
 *
 * User.tutorialSeenAt 이 비어 있으면 홈에서 자동으로 뜨고,
 * 설정의 "사용 방법 다시 보기"(/?tutorial=1)로도 열 수 있다.
 * 끝까지 보거나 건너뛰면 다시 자동으로 뜨지 않는다.
 */

const STEPS = [
  {
    icon: Plus,
    color: "#3b5bfd",
    title: "지출을 기록해요",
    description:
      "하단 가운데 ＋ 버튼으로 등록해요.\n현금인지 카드인지, 카드라면 어떤 카드로\n일시불인지 할부인지까지 남길 수 있어요.",
  },
  {
    icon: CreditCard,
    color: "#8b5cf6",
    title: "카드와 계좌를 등록해요",
    description:
      "신용카드는 결제일과 이용기간을 넣으면\n“이번 달 카드값”이 자동 계산되고,\n체크카드는 통장을 연결하면 잔액이 바로 빠져요.",
  },
  {
    icon: CalendarClock,
    color: "#f59e0b",
    title: "고정지출을 등록해요",
    description:
      "월급날, 카드값, 관리비, 통신비처럼\n매달 반복되는 항목을 등록해 두면\n홈에서 D-day 로 알려드려요.",
  },
  {
    icon: Users,
    color: "#ec4899",
    title: "배우자를 초대해요",
    description:
      "설정 → 구성원 관리에서 초대 링크를 만들어\n카카오톡으로 보내면 같은 가계부를\n함께 쓸 수 있어요. 누가 썼는지도 남아요.",
  },
  {
    icon: Bell,
    color: "#16a34a",
    title: "앱처럼 쓰고 알림 받아요",
    description:
      "브라우저 공유 → “홈 화면에 추가” 하면\n앱처럼 열리고, 설정에서 알림을 켜면\n납부일 아침에 챙겨드려요.",
  },
];

export function TutorialOverlay({ forceOpen }: { forceOpen: boolean }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [, startTransition] = useTransition();

  // 열려 있는 동안 뒤 화면 스크롤을 막는다
  useEffect(() => {
    if (!isOpen) return;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  function close() {
    setIsOpen(false);
    // 다시 안 뜨게 기록 (다시 보기로 연 경우에도 갱신 — 해가 없다)
    startTransition(async () => {
      await markTutorialSeen();
    });
    // /?tutorial=1 로 열렸다면 주소를 정리한다
    if (forceOpen) router.replace("/", { scroll: false });
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-stretch justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-label="사용 방법 안내"
    >
      {/* PC 에서는 폰 프레임 폭에 맞춘다 */}
      <div className="flex w-full max-w-[512px] flex-col bg-background">
        {/* 상단: 건너뛰기 */}
        <div
          className="flex justify-end px-4"
          style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)" }}
        >
          <button
            type="button"
            onClick={close}
            className="rounded-full px-3 py-1.5 text-sm text-muted active:bg-surface-muted"
          >
            건너뛰기
          </button>
        </div>

        {/* 본문 */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
          <span
            className="flex size-20 items-center justify-center rounded-3xl"
            style={{ backgroundColor: `${current.color}1a`, color: current.color }}
          >
            <Icon className="size-9" strokeWidth={2.2} />
          </span>

          <div className="space-y-3">
            <p
              className="text-sm font-bold"
              style={{ color: current.color }}
            >
              {step + 1}번
            </p>
            <h2 className="text-xl font-bold">{current.title}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
              {current.description}
            </p>
          </div>
        </div>

        {/* 하단: 진행점 + 버튼 */}
        <div
          className="space-y-4 px-6"
          style={{ paddingBottom: "calc(var(--safe-bottom) + 1.5rem)" }}
        >
          <div className="flex justify-center gap-1.5" aria-hidden>
            {STEPS.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === step ? "w-6 bg-primary" : "w-1.5 bg-border",
                )}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((value) => value - 1)}
                aria-label="이전"
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-surface-muted text-muted active:brightness-95"
              >
                <ChevronLeft className="size-5" />
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                isLast ? close() : setStep((value) => value + 1)
              }
              className="h-14 flex-1 rounded-2xl bg-primary text-base font-bold text-primary-foreground transition active:scale-[0.98]"
            >
              {isLast ? "시작하기" : "다음"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
