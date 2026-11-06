# 수업 스케줄러

학교 진로수업 강사 파견 중개용 1인 웹앱. 카카오톡으로 들어온 의뢰를 붙여넣으면
Claude Haiku가 날짜·학교·과목·금액을 자동 추출하고, 월별·강사별·업체별로
분류해 본인 수입을 자동 집계한다.

운영 주소: <https://classschedulerapp.vercel.app>

데이터는 기존 `monster-moakit` Supabase 프로젝트의 `class_scheduler` 전용 스키마에
저장한다. 로그인 계정은 MOAKIT과 공유하고, 관리자·강사 권한은 스케줄러 내부에서 관리한다.

## 스택
- Next.js 16 App Router + React 19 + TypeScript
- Tailwind CSS 4 (CSS-first, `@theme inline`)
- Supabase (@supabase/ssr) · Anthropic Claude (`claude-haiku-4-5`)
- react-hook-form + zod · date-fns-tz · sonner · lucide-react
- Radix UI primitives, shadcn-style 컴포넌트 수동 작성

## 시작하기

1. 의존성 설치

   ```bash
   pnpm install
   ```

2. `.env.local` 작성 (`.env.example` 참고)

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://awjndrxyyqyngybulyor.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ANTHROPIC_API_KEY=
   ANTHROPIC_MODEL=claude-haiku-4-5
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   `NEXT_PUBLIC_SUPABASE_ANON_KEY`에는 해당 프로젝트의 공개 **publishable key**를
   넣는다. 기존 변수명만 유지하는 것이며, 서버용 secret/service_role 키를 넣지 않는다.

3. [스케줄러 전용 DB 설치 절차](db/ISOLATED_SETUP.md)에 따라 새 스키마와 검증된
   관리자 프로필을 설정한다. 공유 프로젝트에는 예전 `db/schema.sql`이나
   `0001`–`0006` 마이그레이션을 실행하지 않는다.

4. 개발 서버

   ```bash
   pnpm dev
   ```

   브라우저에서 `http://localhost:3000` 열면 `/login`으로 리다이렉트된다.
   MOAKIT에 등록된 이메일과 기존 비밀번호로 로그인한다. 스케줄러에 처음 접속한
   강사는 승인 대기 상태가 되며 관리자가 `/team`에서 승인한다. 신규 계정은
   회원가입 후 이메일 인증을 완료하고 로그인한다.

## 계정과 권한

- 관리자는 별도로 확인한 Auth 계정으로 한 번만 설정한다. 첫 가입자에게 관리자 권한을 주지 않는다.
- 강사 연결·승인·해제·삭제는 스케줄러 회원 정보만 처리한다. 공유 계정의 비밀번호와 다른 앱의 가입 정보는 변경하지 않는다.
- 서비스 키 없이, 로그인한 사용자의 권한과 DB의 RLS 및 전용 RPC로 데이터를 보호한다.
- 강사는 배정된 수업·대여 내역을 조회하고 본인 대여 교구만 반납할 수 있다.
- AI 의뢰 분석 API는 스케줄러 관리자만 호출할 수 있다.

## 사용 흐름

1. `/instructors` — 강사 등록
2. `/clients` — 업체(중개처) 등록
3. `/requests/new` — 카카오톡 원문 붙여넣기 → "AI로 자동 채우기" →
   폼 수정 → 저장
4. 수업이 끝나면 상태를 `수업완료` 또는 `정산완료`로 변경
5. `/income` — 월별 내 순수입 확인 (수업별/강사별/업체별 탭)

## 스크립트

```bash
pnpm dev     # 개발 서버
pnpm build   # 프로덕션 빌드 (타입체크 포함)
pnpm lint    # ESLint
```
