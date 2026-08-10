import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI(마이그레이션/introspect) 전용 설정.
 *
 * 앱 런타임은 src/lib/prisma.ts 의 PrismaPg 어댑터가 DATABASE_URL(pooler, 6543)로 붙고,
 * 마이그레이션은 DDL 을 실행해야 하므로 여기서 DIRECT_URL(5432)을 쓴다.
 * Prisma 6 까지 schema.prisma 에 있던 directUrl 이 7 부터 이 파일로 옮겨졌다.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
