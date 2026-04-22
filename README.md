# 수업 스케줄러

학교 진로수업 강사 파견 중개용 1인 웹앱. 카카오톡으로 들어온 의뢰를 붙여넣으면
Claude Haiku가 날짜·학교·과목·금액을 자동 추출하고, 월별·강사별·업체별로
분류해 본인 수입을 자동 집계한다.

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
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ANTHROPIC_API_KEY=
   ANTHROPIC_MODEL=claude-haiku-4-5
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

3. Supabase SQL Editor에서 `db/schema.sql` 실행 (최초 1회)

4. 개발 서버

   ```bash
   pnpm dev
   ```

   브라우저에서 `http://localhost:3000` 열면 `/login`으로 리다이렉트된다.
   Supabase Auth에 생성해둔 이메일/비밀번호로 로그인.

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
