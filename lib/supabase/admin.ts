import "server-only";
import { createClient } from "@supabase/supabase-js";

// 서비스 롤 키를 쓰는 관리자 클라이언트. RLS를 우회하고 auth.admin API를 씁니다.
// 절대 클라이언트로 노출되면 안 됩니다(서버 액션에서만 사용).
export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "서버에 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다. Vercel 환경변수에 추가하고 재배포해 주세요.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
