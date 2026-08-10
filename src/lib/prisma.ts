import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 은 driver adapter 를 통해 DB 에 붙는다.
 * Supabase 를 쓸 때는 pooler(6543) 주소를 DATABASE_URL 로 넣는다.
 */
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL 이 설정되지 않았습니다. .env 파일을 확인해 주세요. (.env.example 참고)",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

// dev 에서 HMR 로 커넥션이 계속 늘어나는 걸 막는다.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClientInstance;
};

export const prisma: PrismaClientInstance =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
