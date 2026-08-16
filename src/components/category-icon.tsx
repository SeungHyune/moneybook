import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BookOpen,
  Building2,
  Bus,
  Clapperboard,
  Coffee,
  Coins,
  CreditCard,
  Gift,
  GraduationCap,
  HandCoins,
  HeartHandshake,
  Home,
  Inbox,
  Landmark,
  Lightbulb,
  PartyPopper,
  PawPrint,
  PiggyBank,
  Pill,
  Plane,
  ReceiptText,
  Shirt,
  ShieldCheck,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 카테고리/고정지출 픽토그램.
 *
 * DB 에는 이모지가 저장돼 있지만, 이모지는 OS 마다 생김새가 제각각이라
 * 화면 품질이 들쭉날쭉하다. 이모지를 키로 벡터 아이콘(lucide)에 매핑해서
 * "색 배경 라운드 타일 + 선명한 아이콘" 스타일로 그린다.
 * 매핑에 없는 이모지(사용자 커스텀)는 이모지 그대로 폴백한다.
 */
const EMOJI_ICON: Record<string, LucideIcon> = {
  // 지출 카테고리
  "🍚": UtensilsCrossed,
  "☕": Coffee,
  "🚗": Bus,
  "🏢": Building2,
  "📱": Smartphone,
  "🧻": ShoppingBasket,
  "👕": Shirt,
  "💊": Pill,
  "📚": BookOpen,
  "🎬": Clapperboard,
  "✈️": Plane,
  "🎁": Gift,
  "🛡️": ShieldCheck,
  "🐷": PiggyBank,
  "🏦": Landmark,
  "🧾": ReceiptText,
  "🐾": PawPrint,
  "📌": Tag,

  // 수입 카테고리
  "💰": Wallet,
  "🎉": PartyPopper,
  "🪙": Coins,
  "🧧": HandCoins,
  "📈": TrendingUp,
  "📥": Inbox,

  // 고정지출 종류 (labels.ts RECURRING_KIND_META 의 이모지)
  "💳": CreditCard,
  "💡": Lightbulb,
  "🏠": Home,
  "🤝": HeartHandshake,
  "💵": Banknote,
  "✨": Sparkles,
  "🎓": GraduationCap,
};

const SIZES = {
  sm: { tile: "size-7 rounded-lg", icon: "size-3.5", emoji: "text-sm" },
  md: { tile: "size-9 rounded-xl", icon: "size-[18px]", emoji: "text-base" },
  lg: { tile: "size-10 rounded-xl", icon: "size-5", emoji: "text-lg" },
} as const;

export function CategoryIcon({
  icon,
  color = "#9ca3af",
  size = "md",
  className,
}: {
  /** DB 의 icon 값 (이모지) */
  icon: string | null | undefined;
  color?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = icon ? EMOJI_ICON[icon] : undefined;
  const preset = SIZES[size];

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center",
        preset.tile,
        className,
      )}
      style={{ backgroundColor: `${color}1f`, color }}
      aria-hidden
    >
      {Icon ? (
        <Icon className={preset.icon} strokeWidth={2.2} />
      ) : (
        <span className={preset.emoji}>{icon ?? "•"}</span>
      )}
    </span>
  );
}
