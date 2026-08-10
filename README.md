# 우리집 가계부 (moneybook)

부부가 함께 쓰는 가계부 PWA. 휴대폰 홈 화면에 설치해서 앱처럼 쓴다.

- **Next.js 16** (App Router, Turbopack) + **TypeScript**
- **Supabase** (Auth · Postgres) + **Prisma 7**
- **카카오 로그인** / 초대 링크로 배우자와 공유
- **PWA** (홈 화면 설치, 오프라인 폴백, 푸시 알림 준비됨)
- **Pretendard** 셀프 호스팅 (dynamic subset)

## 화면 정책

모바일 전용 UI 한 벌로 간다. `.app-shell`(`src/app/globals.css`)이 앱 전체를 감싸는 **스크롤 컨테이너**이며,

- **모바일**: 화면을 꽉 채운다 (`100dvh`)
- **768px 이상**: 폭 **512px**로 고정해 화면 가운데에 폰처럼 띄우고, 바깥은 배경으로 채운다

헤더는 `sticky top-0`, 하단 탭은 `sticky bottom-0`으로 이 셸 안에 붙는다. `fixed`를 쓰면 넓은 화면에서 폰 프레임을 뚫고 나가므로 쓰지 않는다. 새 화면을 만들 때 `min-h-dvh` 대신 `min-h-full flex-1`을 쓰면 셸 높이에 맞는다.

폰트는 Pretendard Variable을 **직접 서빙**한다. 통짜 파일(2MB) 대신 dynamic subset(92조각 + `unicode-range`)을 써서 화면에 실제 쓰인 글자 조각만 내려받는다. `scripts/sync-fonts.mjs`가 `node_modules`에서 woff2를 `public/fonts`로, `@font-face` CSS를 `src/app/pretendard.generated.css`로 옮기며 `postinstall`에서 자동 실행된다. 둘 다 생성물이라 git에는 올리지 않는다.

## 무엇을 할 수 있나

**고정지출 관리** — 월급날, 카드 결제일, 아파트 관리비, 통신비처럼 매달 반복되는 항목을 종류별로 등록해 두면 이번 달 일정과 D-day를 홈에서 보여준다. 관리비처럼 금액이 매달 달라지는 항목은 "변동"으로 표시하고 실제 금액을 입력해 확정한다.

**결제 수단 상세** — 현금인지 카드인지, 카드면 어떤 카드로 일시불인지 몇 개월 할부인지까지 남는다. 할부는 회차별 청구 스케줄이 자동으로 만들어져서 "이번 달 25일에 신한카드 얼마 나가는지"를 일시불/할부로 나눠 볼 수 있다.

**부부 공유** — 카카오로 로그인하고, 초대 링크를 카카오톡으로 보내면 배우자가 같은 가계부에 합류한다. 누가 결제했는지도 내역에 남는다.

---

## 셋업

### 0. 준비

```bash
pnpm install
```

Node.js는 **20.19+ / 22.12+ / 24.x** 를 쓴다. (Prisma 7이 지원하는 버전. 25.x 같은 홀수 버전에서는 설치 시 경고가 뜬다.)

### 1. Supabase 프로젝트 만들기

1. [supabase.com/dashboard](https://supabase.com/dashboard) 에서 새 프로젝트 생성 (리전은 **Northeast Asia (Seoul)** 권장)
2. DB 비밀번호는 따로 보관해 둔다
3. **Project Settings → API** 에서 `Project URL` 과 `publishable key`(또는 `anon key`) 복사
4. 상단 **Connect → ORMs → Prisma** 에서 연결 문자열 두 개 복사

### 2. 카카오 로그인 설정

**카카오 개발자 콘솔** ([developers.kakao.com](https://developers.kakao.com))

1. 애플리케이션 추가 → **앱 키**의 `REST API 키` 복사
   - JavaScript 키·네이티브 앱 키는 쓰지 않는다. 카카오 SDK를 직접 붙일 때 필요한 것이고,
     여기서는 Supabase가 OAuth를 대행하므로 REST API 키 하나면 된다.
2. **카카오 로그인** 활성화 ON
3. **Redirect URI** 에 아래 주소 등록 (앱 주소가 아니라 Supabase 주소다)
   ```
   https://<프로젝트ID>.supabase.co/auth/v1/callback
   ```
4. **동의 항목** 에서 `닉네임`, `프로필 사진`은 필수 동의로, `카카오계정(이메일)`은 선택 동의로 설정
5. **보안** 탭에서 `Client Secret` 생성 후 활성화 ON, 값 복사

> 카카오 앱 키는 코드나 `.env` 에 넣지 않는다. Supabase 대시보드에만 입력한다.

**Supabase 대시보드**

1. **Authentication → Sign In / Providers → Kakao** 활성화
2. `REST API 키` → **Kakao Client ID**, `Client Secret` → **Kakao Client Secret** 에 입력
3. **Authentication → URL Configuration** 에서
   - `Site URL`: 배포 주소 (개발 중이면 `http://localhost:3000`)
   - `Redirect URLs`: `http://localhost:3000/**` 와 배포 주소 `https://.../**` 추가

### 3. 환경변수

`.env.example` 을 참고해 `.env` 를 채운다.

```bash
cp .env.example .env
```

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key (구 프로젝트는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `DATABASE_URL` | **pooler(6543)** 주소. 앱 런타임이 사용 |
| `DIRECT_URL` | **직접 연결(5432)** 주소. 마이그레이션이 사용 |

> Prisma 7부터 `directUrl` 은 `schema.prisma` 가 아니라 `prisma.config.ts` 에서 읽는다. 이 저장소는 이미 그렇게 설정해 두었다.

### 4. DB 테이블 만들기

```bash
pnpm db:deploy     # prisma/migrations 의 SQL 적용
pnpm db:generate   # Prisma Client 생성
```

`prisma/migrations` 에는 두 개가 들어 있다.

- `00000000000000_init` — 테이블/enum 전체
- `00000000000001_enable_rls` — **모든 테이블에 RLS 활성화** (아래 "보안" 참고)

### 5. 실행

```bash
pnpm dev
```

http://localhost:3000 → 카카오 로그인 → 가계부 생성 → 카드/계좌 등록 → 고정지출 등록 순으로 진행하면 된다.

---

## 배포 (Vercel)

1. GitHub에 푸시하고 Vercel에서 임포트
2. Environment Variables 에 `.env` 의 4개 값을 그대로 등록
3. 배포 후 도메인을 아래 두 곳에 반영
   - Supabase → Authentication → URL Configuration (`Site URL`, `Redirect URLs`)
   - 카카오 개발자 콘솔 → 플랫폼 → Web 사이트 도메인

빌드 명령은 `pnpm build` (내부에서 `prisma generate` 를 먼저 돌린다).

## 휴대폰에 설치하기

- **iOS (Safari)**: 공유 → "홈 화면에 추가"
- **Android (Chrome)**: 메뉴 → "앱 설치" 또는 하단 배너

설치하면 주소창 없이 앱처럼 뜨고, 홈 화면 아이콘을 길게 누르면 "지출 입력" / "고정지출 보기" 바로가기가 나온다.

---

## 구조

```
src/
├─ app/
│  ├─ (main)/              하단 탭이 있는 메인 앱
│  │  ├─ page.tsx          홈 — 이번 달 요약 / 다가오는 고정지출 / 카드 청구 예정
│  │  ├─ transactions/     내역 목록, 등록
│  │  ├─ fixed/            고정지출 일정, 등록
│  │  ├─ cards/            카드·계좌 목록, 등록
│  │  └─ settings/         가계부 설정, 구성원 관리
│  ├─ actions/             서버 액션 (household / transaction / recurring / asset)
│  ├─ auth/                카카오 OAuth 콜백, 로그아웃
│  ├─ invite/[code]/       초대 링크 수락
│  ├─ login/               로그인
│  └─ onboarding/          가계부 생성 or 초대 코드 입력
├─ components/             UI 컴포넌트
├─ lib/
│  ├─ auth.ts              로그인·권한 검사 (requireMembership)
│  ├─ billing.ts           카드 청구 주기 / 할부 스케줄 / 고정지출 예정일 계산
│  ├─ queries.ts           대시보드용 조회
│  ├─ prisma.ts            Prisma 클라이언트 (PrismaPg 어댑터)
│  └─ supabase/            브라우저/서버 Supabase 클라이언트
├─ proxy.ts                세션 갱신 + 로그인 가드 (Next 16의 middleware)
└─ generated/prisma/       Prisma Client (자동 생성, git 제외)
```

### 데이터 모델 요약

| 모델 | 역할 |
| --- | --- |
| `Household` / `HouseholdMember` / `Invite` | 가계부 공간, 구성원, 초대 |
| `Account` / `Card` | 계좌, 카드 (결제일·이용기간·결제계좌 포함) |
| `Transaction` | 거래. 결제수단·카드·할부개월·승인번호·결제자까지 |
| `InstallmentPlan` | 할부 회차별 청구 스케줄 (일시불도 1회차로 기록) |
| `RecurringRule` / `RecurringOccurrence` | 고정 수입·지출 규칙과 그 달의 처리 상태 |
| `CardStatement` | 월별 카드 청구서 |
| `Category` / `Budget` | 카테고리, 월 예산 |

금액은 전부 **원 단위 정수(Int)** 다. 원화는 소수점이 없고, `Decimal` 은 서버 컴포넌트에서 클라이언트로 넘길 때 직렬화가 막힌다.

---

## 보안

**RLS를 반드시 켜 둔 상태로 유지할 것.** Supabase는 `public` 스키마 테이블을 PostgREST로 자동 노출한다. RLS가 꺼져 있으면 브라우저에 노출되는 publishable 키만으로 `/rest/v1/transactions` 에서 가계부 데이터를 그대로 읽어갈 수 있다.

이 앱은 데이터 접근을 전부 서버(Prisma)에서 하고, 권한은 `requireMembership()` 이 검사한다. Prisma는 테이블 소유자인 `postgres` 롤로 붙으므로 RLS를 우회한다. 그래서 **정책 없이 RLS만 켠 상태**가 정답이다 — PostgREST는 막히고 앱은 그대로 동작한다.

새 테이블을 추가하면 마이그레이션에 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` 를 잊지 말 것.

## 명령어

| 명령 | 설명 |
| --- | --- |
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 프로덕션 빌드 (prisma generate 포함) |
| `pnpm typecheck` | 타입 검사 |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | 스키마 변경 후 마이그레이션 생성·적용 |
| `pnpm db:deploy` | 기존 마이그레이션 적용 (배포용) |
| `pnpm db:studio` | Prisma Studio로 데이터 확인 |
| `pnpm icons` | PWA 아이콘 재생성 (`scripts/generate-icons.mjs`) |
| `pnpm fonts` | Pretendard 재동기화 (`scripts/sync-fonts.mjs`) |

## 아직 안 만든 것

- 거래 수정 (지금은 등록/삭제만)
- 예산(`Budget`) 화면 — 모델만 있음
- 카드 청구서(`CardStatement`) 확정 처리 — 지금은 할부 스케줄로 실시간 계산
- 고정지출 푸시 알림 — 서비스워커에 수신부는 있고, 발송 서버가 없음
- 영수증 사진 업로드 (`receiptUrl` 필드만 준비)
