# DB 마이그레이션

Supabase 대시보드 → **SQL Editor**에서 아래 순서대로 한 번씩 실행하세요.
모든 파일은 여러 번 실행해도 안전합니다(`if not exists` / `create or replace` 기반).

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `0001_equipment.sql` | 교구 대장(`equipment`), 대여·반납 이력(`equipment_loans`), 재고 뷰, RLS |
| 2 | `0002_equipment_components.sql` | 구성품(`equipment_components`), 반납 부족 기록(`equipment_loan_shortages`), RLS |

## 실행 방법
1. Supabase 프로젝트 → 왼쪽 메뉴 **SQL Editor** → **New query**
2. `0001_equipment.sql` 내용을 붙여넣고 **Run**
3. 이어서 `0002_equipment_components.sql` 내용을 붙여넣고 **Run**

> 이미 이전에 `db/schema.sql`을 통째로 실행해 교구 테이블을 만들었다면,
> `0002`만 실행해도 됩니다. (`db/schema.sql`은 전체 스키마 스냅샷이라 두 마이그레이션 내용을 모두 포함합니다.)
