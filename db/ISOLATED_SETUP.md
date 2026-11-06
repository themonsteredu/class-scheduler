# Shared-project scheduler database

This fresh installation uses **monster-moakit** (`awjndrxyyqyngybulyor`) and the
dedicated `class_scheduler` schema. Its Auth accounts are shared with the existing
project; scheduler memberships and business records are isolated. Existing
`public`, `lms`, `edu`, `ops`, `moalab`, `moasem`, and `ai_upcycling` objects are
not migrated, overwritten, or deleted.

The new scheduler starts with empty business tables. This installation does not
recover or import records from the previous scheduler project.

## Apply order

**Do not run `db/schema.sql` or migrations `0001` through `0006` in this shared
project.** Those historical scripts target `public` and install a global Auth
signup trigger; `0006` also treats all pre-existing Auth users as administrators.
The fresh installation below replaces that bootstrap path.

| Step | File | Effect |
| --- | --- | --- |
| 1 | `migrations/20261105121704_scheduler_isolated_schema.sql` | Creates the two new schemas, the original 11 scheduler tables and two views, RLS, guarded RPCs, and scoped grants. |
| 2 | `seed_scheduler_owner.sql` | Seeds only the independently verified, confirmed Auth account as the scheduler owner. |
| 3 | `migrations/20261105122240_scheduler_expose_schema.sql` | Preserves the eight existing API schemas and appends `class_scheduler`. |
| 4 | `verify_isolated_schema.sql` | Runs read-only catalog, owner, and nonmember authorization checks and rolls back. |

The two migration filenames were generated with Supabase CLI 3.0.0
`supabase migration new`; their SQL is stored in this repository's existing
`db/migrations` location. Apply the first migration in one transaction. It fails
if either new namespace already exists, so it cannot silently modify an
unreviewed pre-existing installation. Record it in the migration history; do not
reapply it as an idempotent repair script.

The owner seed requires two transaction-local values obtained by checking the
real `auth.users` record. The seed checks both values and email confirmation,
refuses to replace a different configured owner, and never changes Auth data:

```sql
begin;
select set_config('class_scheduler.bootstrap_owner_id', '<verified Auth UUID>', true);
select set_config('class_scheduler.bootstrap_owner_email', '<verified Auth email>', true);
-- Run the contents of db/seed_scheduler_owner.sql here.
commit;
```

No password or service-role key belongs in these files. The scheduler application
uses the project's publishable/anon key with the signed-in user's session and
`db: { schema: "class_scheduler" }` in each Supabase client.

## Data API exposure maintenance

Immediately before applying the exposure migration, recheck the live API's
exposed schema list. The verified baseline at this installation was:

```text
public, graphql_public, lms, edu, ops, moalab, moasem, ai_upcycling
```

The second migration preserves that order and appends only `class_scheduler`.
**Never expose `class_scheduler_private`.** It contains internal authorization
lookups, guarded RPC implementations, and the singleton owner configuration.

The exposure migration uses `ALTER ROLE authenticator SET pgrst.db_schemas`
because a management-config tool was unavailable and the Dashboard was not
authenticated. This role-level override takes precedence over a later Dashboard
schema-list setting. Future exposure changes must update this override together
with the Dashboard configuration, preserving every schema required by the other
applications. Then notify PostgREST to reload its config and schema cache. Do not
blindly reset the override or replace it with a list that omits existing schemas.

## Authorization model

| Caller | Scheduler access |
| --- | --- |
| Anonymous request | No scheduler table or RPC access. Auth sign-in/sign-up use the separate Auth API. |
| Shared Auth user without a scheduler profile | No business data. An explicit `ensure_profile` request can create only that user's own pending profile. |
| Pending member | Own profile only; cannot create business data or promote itself. |
| Approved instructor | Assigned classes and loans, own instructor record, and the owner's equipment/components/program mapping. Returns a loan through one validated RPC. |
| Configured owner | CRUD for its own business records; reads and manages only its own scheduler memberships. |

Profiles have no direct client insert/update/delete privileges. Private
authorization helpers read only the calling `auth.uid()` and avoid recursive
profile RLS. Only the verified singleton owner can resolve to an administrator.
An arbitrary Auth account cannot create owner-level records just by supplying
its own `user_id`. Display names or Auth user metadata never grant roles.

All original simple foreign keys and columns are retained for the existing
PostgREST joins. Relationship triggers additionally reject a client, instructor,
equipment, class, loan, or component that belongs to a different owner. An
instructor can be linked to at most one scheduler account. Updated timestamps
use invoker triggers limited to the new scheduler tables.

Both `monthly_income` and `equipment_stock` use `security_invoker = true`, so
their underlying table RLS applies. The stock view represents all loans for the
owner; for an instructor it can aggregate only that instructor's visible loans.
Use the owner's inventory page for an organization-wide availability figure.

## RPC contract

All exposed RPCs are `SECURITY INVOKER` wrappers with an empty `search_path`.
Their implementations live in the unexposed private schema, are explicitly
granted only to `authenticated`, and validate the caller on every invocation.

| RPC | Parameters | Return / rule |
| --- | --- | --- |
| `ensure_profile` | `p_display_name text = null` | `SETOF profiles`, one own row. Creates `pending` only when missing; never auto-approves. |
| `approve_member` | `p_profile_id uuid`, `p_instructor_id uuid = null`, `p_new_name text = null` | `SETOF profiles`, one row. Owner-only approval/relink; selects an owned instructor or creates one from a supplied name. |
| `enroll_member_by_email` | `p_email text`, `p_name text`, `p_instructor_id uuid = null` | `SETOF profiles`, one row. Connects an existing confirmed Auth account; does not create/confirm/reset Auth accounts. |
| `revoke_member` | `p_profile_id uuid` | `void`. Sets an owned member to pending and removes its instructor link. |
| `remove_member` | `p_profile_id uuid` | `void`. Deletes only that scheduler membership; preserves the shared Auth account and credentials. A later explicit request can create a new pending membership. |
| `return_my_loan` | `p_loan_id uuid`, `p_returned_on date = null`, `p_condition_memo text = null`, `p_shortages jsonb = []` | `void`. Instructor-only atomic return of its own open loan and validated shortage recording. |

Use `.single()` on profile-returning RPCs when one profile is expected. Shortage
items contain `component_id`, a positive integer `shortage_qty`, and optional
`note`. Component identity must match the loaned equipment; the stored component
name comes from the database. Wrong assignments, wrong components, and repeat
returns fail without a partial return or shortage write.

Every future object migration must include explicit privilege revokes and grants
in the same transaction. PostgreSQL schema-scoped default-privilege revokes do
not cancel global defaults such as `PUBLIC EXECUTE` on new functions. This
installation does not modify the shared project's global default privileges.

## Verification evidence

The complete migration, owner seed, exposure migration, and read-only verification
script compiled and passed 44 local behavioral assertions using PGlite 0.5.15 /
PostgreSQL 18.6. The hosted target uses PostgreSQL 17; the migration uses no
PostgreSQL 18-only features (`security_invoker` views require PostgreSQL 15+).
The local tests used isolated synthetic Auth fixtures, not hosted users.

The assertions covered authenticated owner CRUD and private triggers; pending
write/self-promotion denial; cross-owner foreign-key rejection; instructor class
and loan filtering; rejection of other instructors' returns and unrelated
components; atomic return failure; duplicate-return prevention; invoker-view
isolation; anonymous denial; revoked-member access removal; and preservation of
shared Auth accounts after scheduler membership deletion. The read-only SQL
file provides the smaller repeatable check for the actual hosted deployment.

The local test is not a substitute for deployment checks of PostgREST schema
exposure, the real hosted owner session, or the application's live login page.

## References

- [Supabase: Using Custom Schemas](https://supabase.com/docs/guides/api/using-custom-schemas)
- [Supabase: Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions)
