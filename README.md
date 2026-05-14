# Fairydust

Fairy 후원 웹훅을 받아 GitHub 저장소의 `README.md` 또는 지정 파일에 후원 정보를 표시하는 Vercel용 React + Serverless 앱입니다.

## 필요한 패키지 설치

```bash
npm install
```

## 파일 구조

```text
api/
  auth/                 GitHub OAuth, 세션 API
  mappings.ts           저장소와 Fairy projectName 매핑 CRUD 시작점
  repos.ts              GitHub 저장소 목록 조회
  webhook-settings.ts   유저별 webhook URL 조회와 Fairy secret 저장
  webhook.ts            POST /webhook?token=...
  webhook/[token].ts    POST /webhook/{token}
lib/server/
  crypto.ts             세션 서명, 토큰 암복호화, timing-safe 비교
  db.ts                 MariaDB pool
  github.ts             GitHub Contents API 파일 갱신
  session.ts            쿠키 세션
  webhook-handler.ts    Fairy raw body HMAC 검증과 비즈니스 로직
scripts/
  schema.sql            MariaDB 테이블
  sign-webhook.mjs      로컬 테스트용 서명 생성
src/
  main.tsx              관리자 페이지
  styles.css            관리자 페이지 스타일
```

## 환경변수

`.env.example`을 기준으로 Vercel Project Environment Variables와 로컬 `.env`에 값을 넣습니다.

```bash
openssl rand -base64 32
```

위 명령 결과를 `APP_ENCRYPTION_KEY`로 사용하는 것을 권장합니다. 64자리 hex 문자열이나 긴 임의 문자열도 동작하지만, 운영 중에는 값을 바꾸면 기존에 저장된 GitHub 토큰을 복호화할 수 없으니 고정해야 합니다. `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`은 GitHub OAuth App을 만들어 발급받고, callback URL은 `https://배포도메인/api/auth/github/callback`으로 등록합니다. private repository까지 수정하려면 현재 구현의 OAuth scope는 `repo`입니다.

MariaDB에는 `scripts/schema.sql`을 실행합니다.

## 로컬 실행

Vercel 서버리스 라우트까지 같이 확인하려면 Vercel CLI로 실행합니다.

```bash
npx vercel dev
```

프론트만 확인할 때는 다음 명령을 사용할 수 있습니다.

```bash
npm run dev
```

## 간단한 테스트 방법

1. `npx vercel dev` 실행
2. GitHub 로그인
3. `Webhook 설정`에서 유저 webhook URL을 복사하고 Fairy webhook secret을 저장
4. repository, Fairy `projectName`, 대상 파일, 표시 옵션을 선택해 프로젝트 매핑 생성
5. 같은 raw JSON 문자열로 서명을 만든 뒤 요청

```bash
FAIRY_SECRET='Webhook 설정에 저장한 secret'
BODY='{"event":"payment.completed","timestamp":"2026-04-16T10:30:00.000Z","data":{"paymentId":"260416_ab12cd34","amount":10000,"fairyName":"홍길동","fairyEmail":"supporter@example.com","fairyMessage":"응원합니다!","projectName":"hshim","source":"payple","payload":{"source":"geeknews","campaign":"spring-launch"}}}'
SIG=$(FAIRY_SECRET="$FAIRY_SECRET" node scripts/sign-webhook.mjs "$BODY")

curl -i \
  -X POST "http://localhost:3000/webhook/유저토큰" \
  -H "Content-Type: application/json" \
  -H "X-Fairy-Signature: $SIG" \
  -H "X-Fairy-Timestamp: 2026-04-16T10:30:00.000Z" \
  -H "X-Fairy-Event: payment.completed" \
  --data "$BODY"
```

`data.source`가 `test`이면 서명 검증과 로그만 남기고 GitHub 파일 갱신은 건너뜁니다.

## 서명 검증 포인트

`lib/server/webhook-handler.ts`는 먼저 URL의 유저 webhook token으로 사용자를 찾고, 그 사용자가 `Webhook 설정`에서 저장한 Fairy secret을 복호화합니다. 그 다음 요청 스트림에서 읽은 raw request body 문자열을 그대로 사용해 HMAC SHA256 hex 서명을 생성합니다. 이 값을 `X-Fairy-Signature`와 timing-safe 방식으로 비교하며, JSON.parse 후 다시 stringify한 값은 서명 검증에 사용하지 않습니다.

로그에는 `event`, `timestamp`, `data.paymentId`, `data.amount`, `data.projectName`, `data.source`, 검증 성공 여부가 남습니다. 검증이 끝나면 `data.projectName`으로 해당 유저의 repository 매핑을 찾습니다. `paymentId`는 `payments.payment_id` unique key로 저장되어 같은 결제가 다시 오면 중복 처리하지 않습니다.
