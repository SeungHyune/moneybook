"use client";

import { useActionState } from "react";
import { updateHousehold } from "@/app/actions/household";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

export function HouseholdSettingsForm({
  householdId,
  name,
  monthStartDay,
  canEdit,
}: {
  householdId: string;
  name: string;
  monthStartDay: number;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(updateHousehold, null);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-border bg-surface p-4"
    >
      <input type="hidden" name="householdId" value={householdId} />

      <h2 className="text-sm font-bold">가계부 설정</h2>

      <Field label="가계부 이름">
        <Input
          name="name"
          defaultValue={name}
          maxLength={30}
          required
          disabled={!canEdit}
        />
      </Field>

      <Field
        label="한 달 시작일"
        hint="월급날이 25일이면 25로 설정해 보세요. 25일부터 다음 달 24일까지를 한 달로 봅니다."
      >
        <Input
          name="monthStartDay"
          type="number"
          inputMode="numeric"
          min={1}
          max={28}
          defaultValue={monthStartDay}
          required
          disabled={!canEdit}
        />
      </Field>

      {state?.error && (
        <p className="text-sm text-expense" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-success" role="status">
          {state.success}
        </p>
      )}

      {canEdit && (
        <SubmitButton size="md" variant="secondary" className="w-full">
          저장
        </SubmitButton>
      )}
    </form>
  );
}
