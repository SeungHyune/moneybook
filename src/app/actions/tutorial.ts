"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

/** 튜토리얼을 끝까지 봤거나 건너뛰었을 때 — 다시 자동으로 뜨지 않게 한다 */
export async function markTutorialSeen() {
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: { tutorialSeenAt: new Date() },
  });

  return { success: true };
}
