-- Prisma 가 관리하는 마이그레이션 이력 테이블도 PostgREST 로 노출된다.
-- 큰 위험은 아니지만(이름/체크섬만) 굳이 공개할 이유가 없으므로 막는다.
-- Prisma CLI 는 테이블 소유자인 postgres 로 붙으므로 계속 정상 동작한다.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
