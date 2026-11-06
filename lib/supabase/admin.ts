import "server-only";

// Legacy imports fail closed. Scheduler membership now uses authenticated RPCs,
// so this app must never administer the shared MOAKIT Auth accounts.
/** @deprecated Use the guarded membership RPCs in actions/team.ts. */
export function isAdminConfigured(): boolean {
  return false;
}

/** @deprecated Shared Auth account administration is not supported here. */
export function createAdminClient(): never {
  throw new Error("스케줄러 회원 관리는 로그인한 관리자 계정으로 처리합니다.");
}
