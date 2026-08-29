import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MemberFilter } from "@/components/member-filter";
import { OutflowViews, type OutflowRow } from "@/components/outflow-views";
import { requireHouseholdContext } from "@/lib/auth";
import { getMemberFilter } from "@/lib/member-filter";
import {
  getAssetSummary,
  getCashflowHorizon,
  getHouseholdMembers,
} from "@/lib/queries";
import { formatWon } from "@/lib/utils";

export const metadata = { title: "앞으로 나갈 돈" };

/**
 * 앞으로 한 달 동안 통장에서 나갈 돈과 들어올 돈을 전부 편다.
 *
 * 홈에서는 5건만 보여주니 "합계가 왜 이렇게 크지" 를 확인할 방법이 없었다.
 * 여기서는 하나도 빼지 않고, 카드 청구액에 합쳐진 고정지출까지 적는다.
 */
export default async function OutflowsPage() {
  const { household } = await requireHouseholdContext();

  const [filterMember, members] = await Promise.all([
    getMemberFilter(household.id),
    getHouseholdMembers(household.id),
  ]);
  const memberId = filterMember?.id ?? null;

  const [horizon, assets] = await Promise.all([
    getCashflowHorizon(household.id, memberId),
    getAssetSummary(household.id, memberId),
  ]);

  const { outflows, inflows, outTotal, inTotal, mergedIntoCard } = horizon;

  const cardTotal = outflows
    .filter((item) => item.kind === "CARD")
    .reduce((sum, item) => sum + item.amount, 0);
  const fixedTotal = outTotal - cardTotal;

  // 날짜순으로 훑으면서 잔액이 어떻게 되는지 따라가 본다
  const timeline = [
    ...outflows.map((item) => ({
      key: item.key,
      group: item.group,
      date: item.date,
      name: item.name,
      note: item.note,
      emoji: item.emoji,
      color: item.color,
      amount: -item.amount,
      ddayLabel: item.isOverdue
        ? `${-item.dday}일 밀림`
        : item.dday === 0
          ? "오늘"
          : `D-${item.dday}`,
      isUrgent: item.isOverdue || item.dday <= 2,
      href: item.href as string,
    })),
    ...inflows.map((item) => ({
      key: `in-${item.name}-${item.date.toISOString()}`,
      group: "INCOME" as const,
      date: item.date,
      name: item.name,
      note: "들어올 돈",
      emoji: "💰",
      color: "#2563eb",
      amount: item.amount,
      ddayLabel: item.dday === 0 ? "오늘" : `D-${item.dday}`,
      isUrgent: false,
      href: "/fixed",
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  /*
   * 각 건까지 처리했을 때 남는 돈. map 안에서 바깥 변수를 더해 나가면
   * 렌더 중 재할당이라 react-hooks/purity 에 걸린다 — reduce 로 쌓는다.
   */
  const rows = timeline.reduce<OutflowRow[]>((acc, item) => {
    const previous = acc.at(-1)?.running ?? assets.total;

    acc.push({
      key: item.key,
      group: item.group,
      name: item.name,
      note: item.note,
      emoji: item.emoji,
      color: item.color,
      amount: item.amount,
      dateLabel: `${item.date.getMonth() + 1}/${item.date.getDate()}`,
      ddayLabel: item.ddayLabel,
      isUrgent: item.isUrgent,
      running: previous + item.amount,
      href: item.href,
    });
    return acc;
  }, []);

  return (
    <>
      <AppHeader
        title={
          <MemberFilter
            householdName="앞으로 나갈 돈"
            members={members}
            selectedId={memberId}
          />
        }
      />

      <div className="space-y-4 px-4 py-4">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <p className="text-xs opacity-80">오늘부터 한 달 뒤 남을 돈</p>
          <p className="tabular mt-1 text-3xl font-bold tracking-tight">
            {formatWon(assets.total + inTotal - outTotal)}
          </p>

          <ul className="mt-4 space-y-1.5 border-t border-white/20 pt-3 text-xs">
            <li className="flex justify-between">
              <span className="opacity-80">지금 가진 돈</span>
              <span className="tabular">{formatWon(assets.total)}</span>
            </li>
            <li className="flex justify-between">
              <span className="opacity-80">들어올 돈</span>
              <span className="tabular">+{formatWon(inTotal)}</span>
            </li>
            <li className="flex justify-between">
              <span className="opacity-80">카드 결제</span>
              <span className="tabular">−{formatWon(cardTotal)}</span>
            </li>
            <li className="flex justify-between">
              <span className="opacity-80">고정지출</span>
              <span className="tabular">−{formatWon(fixedTotal)}</span>
            </li>
          </ul>
        </section>

        {mergedIntoCard > 0 && (
          <p className="rounded-xl bg-surface-muted px-3 py-2.5 text-xs leading-relaxed text-muted">
            신용카드로 내는 고정지출{" "}
            <strong className="text-foreground">
              {formatWon(mergedIntoCard)}
            </strong>
            은 위 &ldquo;카드 결제&rdquo;에 이미 들어 있어요. 따로 세면 두 번
            잡힙니다.
          </p>
        )}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
            <p className="text-sm text-muted">한 달 안에 나갈 돈이 없어요.</p>
          </div>
        ) : (
          <OutflowViews rows={rows} />
        )}

        <Link
          href="/fixed"
          className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm transition active:bg-surface-muted"
        >
          <span>고정지출 관리</span>
          <ArrowRight className="size-4 shrink-0 text-muted" />
        </Link>
      </div>
    </>
  );
}
