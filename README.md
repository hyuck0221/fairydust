# Fairydust

Fairydust는 [Fairy](https://fairy.hada.io/) 후원이 들어왔을 때 GitHub 프로젝트의 `README.md` 또는 원하는 파일에 후원 정보를 자동으로 남겨주는 서비스입니다.

https://fairydust.kr

## 무엇을 할 수 있나요?

- GitHub 계정으로 로그인합니다.
- 내 GitHub repository 중 후원 정보를 표시할 프로젝트를 선택합니다.
- Fairy에서 보내는 `projectName`과 GitHub repository를 연결합니다.
- 후원자 이름, 후원 금액, 후원 메시지 표시 여부를 프로젝트별로 정합니다.
- Fairy 웹훅 수신 결과와 GitHub 반영 결과를 모니터링합니다.

## 시작하기

### 1. GitHub로 로그인

Fairydust에 접속한 뒤 `GitHub로 시작하기`를 누릅니다.

Fairydust는 선택한 repository의 파일을 수정해야 하므로 GitHub repository 접근 권한이 필요합니다.

### 2. Webhook 설정 열기

로그인 후 오른쪽 위의 `Webhook 설정` 버튼을 누릅니다.

여기에서 확인할 수 있는 값은 두 가지입니다.

- `유저 Webhook URL`: Fairy 관리자에 등록할 URL입니다.
- `Fairy webhook secret`: Fairy에서 사용하는 웹훅 secret과 같은 값을 입력합니다.

Webhook URL은 사용자별로 하나만 생성됩니다. 프로젝트마다 URL을 따로 만들지 않습니다.

### 3. Fairy에 Webhook URL 등록

Fairy 관리자에서 Fairydust의 `유저 Webhook URL`을 webhook URL로 등록합니다.

Fairy 쪽 webhook secret에는 Fairydust의 `Webhook 설정`에 저장한 secret과 같은 값을 넣습니다.

### 4. 프로젝트 매핑 만들기

`새 프로젝트 매핑` 영역에서 아래 값을 입력합니다.

- `GitHub repository`: 후원 정보를 표시할 repository
- `Fairy projectName`: Fairy 웹훅 payload의 `data.projectName`
- `업데이트할 파일`: 기본값은 `README.md`
- 표시 옵션:
  - 후원자 이름 표시
  - 후원 금액 표시
  - 후원 메시지 표시

Fairydust는 웹훅을 받으면 `data.projectName`과 같은 매핑을 찾아 해당 repository 파일을 업데이트합니다.

## 실제 테스트하기

프로젝트 매핑을 만든 뒤 `등록된 연결` 카드의 `실제 테스트` 버튼을 누릅니다.

이 테스트는 실제 GitHub 파일을 수정합니다. 테스트가 성공하면 지정한 파일에 Fairydust 영역이 추가되거나 갱신됩니다.

```md
## Fairy Sponsors

<!-- FAIRYDUST:START -->
- **테스트 Fairy** sponsored 1,000원 > Fairydust 실제 반영 테스트입니다.
<!-- FAIRYDUST:END -->
```

이미 Fairydust 영역이 있는 파일은 같은 영역만 갱신합니다.

## 모니터링 보기

`Webhook 모니터링`에서 최근 웹훅 이력을 확인할 수 있습니다.

표시되는 정보:

- 처리 상태: 성공, 실패, 중복, 테스트, 처리 중
- 수신 시간
- projectName
- paymentId
- 금액
- 연결된 repository
- 서명 검증 결과
- 실패 사유 또는 처리 상세

이력은 30개씩 페이지로 볼 수 있고, 프로젝트별로 필터링할 수 있습니다.

## 테스트 발송이 GitHub에 반영되지 않는 경우

Fairy의 테스트 발송은 보통 payload의 `data.source`가 `test`입니다.

Fairydust는 안전을 위해 `source`가 `test`이면 서명 검증과 로그만 남기고 GitHub 파일은 수정하지 않습니다. 실제 반영을 확인하려면 Fairydust 화면의 `실제 테스트` 버튼을 사용하거나, 실제 결제와 같은 payload를 보내야 합니다.

## 연결 해제

잘못 만든 매핑은 `등록된 연결` 카드의 `연결 해제` 버튼으로 삭제할 수 있습니다.

연결을 해제해도 이미 GitHub 파일에 기록된 내용은 자동으로 삭제하지 않습니다. 필요하면 repository에서 직접 수정하세요.

## 자주 확인할 것

- Fairy의 `projectName`과 Fairydust 매핑의 `Fairy projectName`이 정확히 같은지 확인하세요.
- Fairy webhook secret과 Fairydust에 저장한 secret이 같은지 확인하세요.
- GitHub repository에 파일을 수정할 권한이 있는 계정으로 로그인했는지 확인하세요.
- 실패 원인은 `Webhook 모니터링`의 상세 메시지에서 확인하세요.

## 약관과 데이터 처리

- 이용약관: https://fairydust-one.vercel.app/terms
- 데이터처리방침: https://fairydust-one.vercel.app/privacy
