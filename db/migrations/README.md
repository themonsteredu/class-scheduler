# DB 마이그레이션

## 현재 설치: monster-moakit / class_scheduler

현재 스케줄러는 기존 `monster-moakit` 프로젝트 안의 전용 `class_scheduler`
스키마를 사용합니다. **이 프로젝트에는 `db/schema.sql`이나 `0001`~`0006`을
실행하지 마세요.** 이전 파일은 공용 `public` 테이블과 Auth 가입 트리거를
사용하므로 다른 앱의 계정·테이블과 충돌할 수 있습니다.

| 순서 | 파일 | 내용 |
| --- | --- | --- |
| 1 | `20261105121704_scheduler_isolated_schema.sql` | 스케줄러 전용 테이블·뷰·RLS·RPC 생성 |
| 2 | `../seed_scheduler_owner.sql` | 검증한 기존 Auth 계정 한 명만 관리자 연결 |
| 3 | `20261105122240_scheduler_expose_schema.sql` | 기존 API 노출 스키마 8개를 유지하며 `class_scheduler` 추가 |
| 4 | `../verify_isolated_schema.sql` | 실제 설치의 권한과 관리자 연결을 읽기 전용으로 확인 |

새 설치 파일은 Supabase CLI가 생성한 타임스탬프를 사용하며, 기존 스키마가
있으면 실패하도록 설계한 **한 번만 실행하는 마이그레이션**입니다. 관리자
seed의 검증값과 API 노출 설정의 유지보수 주의사항은
[전용 스키마 설치 안내](../ISOLATED_SETUP.md)를 따르세요.

## 이전 프로젝트의 변경 이력

다음 파일은 이전 전용 프로젝트의 이력으로 보관합니다. 현재 공유 프로젝트의
새 설치 순서가 아닙니다. 특히 `0006`은 기존 Auth 사용자 전체를 관리자로
지정하므로 공유 프로젝트에 실행하면 안 됩니다.

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `0001_equipment.sql` | 교구 대장(`equipment`), 대여·반납 이력(`equipment_loans`), 재고 뷰, RLS |
| 2 | `0002_equipment_components.sql` | 구성품(`equipment_components`), 반납 부족 기록(`equipment_loan_shortages`), RLS |
| 3 | `0003_push_subscriptions.sql` | 웹 푸시 알림 구독(`push_subscriptions`), RLS |
| 4 | `0004_program_equipment.sql` | 프로그램(과목)별 교구 매핑(`program_equipment`), RLS |
| 5 | `0005_sessions_region_material.sql` | 수업 차시·지역 컬럼 + 프로그램별 재료비 규칙(`program_material_fees`), RLS |
| 6 | `0006_profiles_roles.sql` | 강사 로그인 역할(`profiles`), 강사 접근 권한(RLS), 신규가입 트리거. **강사 가입 전 먼저 실행** |

