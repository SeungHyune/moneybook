/**
 * Supabase 는 2025년부터 anon key -> publishable key 로 이름이 바뀌는 중이라
 * 두 환경변수 이름을 모두 받아준다.
 */
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase 환경변수가 없습니다. NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY(또는 ANON_KEY)를 .env 에 설정해 주세요.",
    );
  }

  return { url, key };
}
