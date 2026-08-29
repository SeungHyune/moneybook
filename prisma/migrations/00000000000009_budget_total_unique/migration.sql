-- 월 전체 예산(categoryId IS NULL)은 가구·연월마다 한 행이어야 한다.
-- @@unique([householdId, yearMonth, categoryId]) 만으로는 막히지 않는다 —
-- Postgres 에서 NULL 은 서로 같지 않아 유니크 검사를 통과해 버린다.
CREATE UNIQUE INDEX IF NOT EXISTS "budgets_household_month_total_key"
  ON "budgets" ("householdId", "yearMonth")
  WHERE "categoryId" IS NULL;
