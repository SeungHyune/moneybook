-- Supabase 보안 설정: 모든 테이블에 RLS 를 켠다.
--
-- 왜 필요한가:
--   Supabase 는 public 스키마의 테이블을 PostgREST 로 자동 노출한다.
--   RLS 를 켜지 않으면 브라우저에 노출되는 anon/publishable 키만으로
--   https://<project>.supabase.co/rest/v1/transactions 같은 주소에서
--   가계부 데이터를 그대로 읽어갈 수 있다.
--
-- 왜 정책(POLICY)은 만들지 않는가:
--   이 앱은 데이터 접근을 전부 Prisma(서버)에서 하고,
--   권한 검사는 requireMembership() 이 담당한다.
--   Prisma 는 테이블 소유자인 postgres 롤로 접속하므로 RLS 를 우회한다.
--   따라서 "정책 없이 RLS 만 켠 상태" = PostgREST 차단 + 앱은 정상 동작.
--
--   나중에 클라이언트에서 supabase-js 로 직접 조회할 일이 생기면
--   그때 해당 테이블에만 SELECT 정책을 추가하면 된다.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "households" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "household_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "installment_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recurring_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recurring_occurrences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "card_statements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;
