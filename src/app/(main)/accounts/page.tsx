import Link from "next/link";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MemberFilter } from "@/components/member-filter";
import { requireHouseholdContext } from "@/lib/auth";
import { getMemberFilter } from "@/lib/member-filter";
import { prisma } from "@/lib/prisma";
import { getAssetSummary, getHouseholdMembers } from "@/lib/queries";
import { ACCOUNT_TYPE_LABEL, ownerPrefix } from "@/lib/labels";
import { formatWon } from "@/lib/utils";

export const metadata = { title: "가진 돈" };

/**
 * 가진 돈이 어디에 얼마씩 있는지.
 *
 * 홈의 "가진 돈" 타일에서 들어온다. 총액만 보면 그 숫자가 어디서 왔는지
 * 알 수 없어서, 종류별 합계와 계좌 하나하나를 같이 편다.
 */
export default async function AccountsPage() {
  const { household } = await requireHouseholdContext();

  const [filterMember, members] = await Promise.all([
    getMemberFilter(household.id),
    getHouseholdMembers(household.id),
  ]);
  const memberId = filterMember?.id ?? null;

  const [assets, accounts] = await Promise.all([
    getAssetSummary(household.id, memberId),
    prisma.account.findMany({
      where: {
        householdId: household.id,
        isActive: true,
        ...(memberId ? { ownerMemberId: memberId } : {}),
      },
      include: { ownerMember: { select: { displayName: true } } },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const rows = [
    { key: "CASH", label: "현금", value: assets.cash },
    { key: "CHECKING", label: "입출금", value: assets.checking },
    { key: "SAVINGS", label: "예적금", value: assets.savings },
    { key: "INVESTMENT", label: "투자", value: assets.investment },
    { key: "OTHER", label: "기타", value: assets.other },
  ].filter((row) => row.value !== 0);

  return (
    <>
      <AppHeader
        title={
          <MemberFilter
            householdName="가진 돈"
            members={members}
            selectedId={memberId}
          />
        }
        action={
          <Link
            href="/cards/new"
            aria-label="계좌 추가"
            className="flex size-9 items-center justify-center rounded-full text-primary transition active:bg-surface-muted"
          >
            <Plus className="size-5" />
          </Link>
        }
      />

      <div className="space-y-4 px-4 py-4">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <p className="text-xs opacity-80">가진 돈</p>
          <p className="tabular mt-1 text-3xl font-bold tracking-tight">
            {formatWon(assets.total)}
          </p>

          {rows.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-white/20 pt-3 text-xs">
              {rows.map((row) => (
                <li key={row.key} className="flex justify-between">
                  <span className="opacity-80">{row.label}</span>
                  <span className="tabular">{formatWon(row.value)}</span>
                </li>
              ))}
              {assets.loanDebt > 0 && (
                <li className="flex justify-between border-t border-white/20 pt-1.5">
                  <span className="opacity-80">대출 잔액</span>
                  <span className="tabular">−{formatWon(assets.loanDebt)}</span>
                </li>
              )}
            </ul>
          )}
        </section>

        {accounts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
            <p className="text-4xl">🏦</p>
            <p className="mt-3 text-sm font-medium">등록된 계좌가 없어요</p>
            <Link
              href="/cards/new"
              className="mt-4 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
            >
              계좌 등록하기
            </Link>
          </div>
        ) : (
          <section className="space-y-2">
            <h2 className="px-1 text-sm font-bold">계좌별</h2>

            <ul className="space-y-2">
              {accounts.map((account) => (
                <li key={account.id}>
                  {/* 눌러서 이 계좌의 입출금 내역만 본다 */}
                  <Link
                    href={`/accounts/${account.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition active:bg-surface-muted"
                  >
                    <span
                      className="h-10 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: account.color }}
                      aria-hidden
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {ownerPrefix(account.ownerMember)}
                        {account.bankName ? `${account.bankName} ` : ""}
                        {account.name}
                      </p>
                      <p className="text-xs text-muted">
                        {ACCOUNT_TYPE_LABEL[account.type]}
                        {account.last4 && ` · ${account.last4}`}
                      </p>
                    </div>

                    <span
                      className={`tabular shrink-0 text-sm font-bold ${
                        account.balance < 0 ? "text-expense" : ""
                      }`}
                    >
                      {formatWon(account.balance)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
