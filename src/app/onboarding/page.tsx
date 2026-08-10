import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getHouseholdContext, requireUser } from "@/lib/auth";

export const metadata = { title: "시작하기" };

export default async function OnboardingPage() {
  const user = await requireUser();

  // 이미 가구가 있으면 홈으로
  const context = await getHouseholdContext();
  if (context) redirect("/");

  return <OnboardingForm nickname={user.nickname} />;
}
