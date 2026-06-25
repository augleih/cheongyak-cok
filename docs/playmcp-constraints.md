# PlayMCP 제약 체크리스트

이 문서는 청약콕 MCP 서버가 PlayMCP 심사와 운영 조건을 만족하기 위해 지켜야 할 제약을 정리한다. 구현 중 판단이 갈리면 이 문서를 우선 기준으로 삼는다.

## 서버 조건

- MCP 서버는 원격 서버로 공개 접근 가능한 URL 또는 도메인을 가져야 한다.
- 전송 방식은 Streamable HTTP를 사용한다.
- 지원 MCP 버전은 최소 `2025-03-26`, 최대 `2025-11-25` 범위 안에 둔다.
- 서버는 stateless 구조를 기본으로 한다. 사용자별 장기 세션을 서버 메모리에 의존하지 않는다.
- 예선 제출용 서버는 Kakao Cloud 배포를 기본 경로로 본다.
- 제출 전 MCP Inspector로 tool discovery와 tool call을 확인한다.
- 서버 이름과 tool 이름에는 `kakao` 문자열을 포함하지 않는다. 대소문자와 위치를 구분하지 않는다.

## PlayMCP in KC 공모전 운영 조건

아래 조건은 사용자가 제공한 공모전 참가 유의사항 기준이다. 공식 공지 변경 가능성이 있으므로 제출 전 최신 공지를 다시 확인한다.

- PlayMCP in KC는 Agentic Player 10 공모전 참가작을 위한 한시적 MCP 서버 배포 지원이다.
- MCP 서버 발급 가능 기간은 예선 접수 기간인 2026년 6월 15일부터 2026년 7월 14일까지다.
- MCP 서버 발급 후 PlayMCP 등록과 심사를 거쳐야 하므로 마감 직전에 발급하지 않는다.
- PlayMCP in KC에서 발급받은 MCP Endpoint URL로 PlayMCP에 등록해야 공모전 참여가 가능하다.
- PlayMCP in KC 서버는 일정 기간만 무상 지원된다. 공모전 종료 후 일정 기간 유지 뒤 무상 지원이 종료될 수 있다.
- 무상 지원 종료 후 계속 운영하려면 별도 과금 유지 또는 다른 클라우드 서비스로 이전하는 계획이 필요하다.
- 발급받은 MCP 서버를 공모전 참가 외 용도로 사용하거나 예선에 접수하지 않으면 회수될 수 있다.
- PlayMCP in KC는 PlayMCP 회원만 이용할 수 있다.
- 계정당 등록 가능한 MCP 서버는 2대다.
- PlayMCP in KC 자체 오류 외에 MCP 개발 중 발생하는 이슈는 별도 기술 지원 대상이 아니다.
- 공모전 진행이나 PlayMCP in KC 이용 문의는 카카오 고객센터 경로를 사용한다.

## Tool 설계 조건

- tool 개수는 최대 20개이며, 청약콕은 3-10개 안에서 유지한다.
- tool 이름은 1-128자이고 영문자, 숫자, `_`, `-`만 사용한다.
- tool 이름은 대소문자를 구분하며 서버 안에서 유일해야 한다.
- tool에는 `name`, `description`, `inputSchema`, `annotations`가 모두 있어야 한다.
- `annotations`에는 다음 필드를 모두 둔다.
  - `title`
  - `readOnlyHint`
  - `destructiveHint`
  - `openWorldHint`
  - `idempotentHint`
- description은 1024자 이하로 유지한다.
- description에는 서비스명을 영문/한글 병기로 포함한다. 예: `CheongyakCok(청약콕)`.
- description은 가능한 한 영어 중심으로 작성하되, 고유명사와 사용자-facing 의미가 필요한 부분은 한글을 병기한다.

## 성능 조건

- 사용자-facing MCP tool call은 평균 100ms 이하를 목표로 한다.
- p99 응답 시간은 3000ms 이하를 넘지 않도록 설계한다.
- tool call 안에서 원격 사이트 크롤링, PDF/HWP/HWPX 파싱, LLM 추출, 대량 DB 재색인은 수행하지 않는다.
- tool call은 사전 수집된 DB/cache를 읽고, 가벼운 rule evaluation만 수행한다.
- 공고 수집, 원문 다운로드, 문서 파싱, LLM 기반 조건 추출은 background collector 또는 admin CLI에서 수행한다.

## 응답 조건

- tool result는 필요한 정보만 작게 반환한다.
- 원천 API 응답이나 원문 파싱 결과를 그대로 노출하지 않는다.
- 오류가 발생하면 raw stack trace나 raw API response 대신 정제된 text 또는 markdown을 반환한다.
- 청약 가능 여부는 확정 판정처럼 말하지 않는다.
- 사용자-facing 표현은 다음 원칙을 따른다.
  - `현재 입력된 조건 기준`
  - `지원 가능성이 높습니다`
  - `추가 확인 필요`
  - `최종 신청 전 공고문 원문 확인 필요`

## 개인정보와 인증

- V0에서는 OAuth를 사용하지 않는다.
- 사용자의 나이, 혼인 여부, 세대 구성, 소득/자산 구간 등은 요청 input으로만 받고 서버에 저장하지 않는다.
- 개인 식별 정보, 민감 정보, 청약 계정 정보, 공동인증서, 로그인 세션은 다루지 않는다.
- 상용화 단계에서 계정 저장, 알림, 개인화 이력을 제공할 경우 OAuth와 개인정보 동의 화면을 별도 설계한다.
- PlayMCP OAuth redirect URI는 등록 후 발급되는 다음 형식을 따른다.
  - `https://playmcp.kakao.com/api/v1/applied-mcps/{mcpId}/authorize/oauth:callback`

## 청약콕에 적용되는 핵심 원칙

- MCP 서버는 “실시간 수집기”가 아니라 “빠른 공고 검색/판정 인터페이스”다.
- 공고의 원천 진실은 마이홈, 청약홈, LH/SH/GH 등 공식 출처와 원문 파일이다.
- 공고 조건 추출에는 LLM을 사용할 수 있지만, 최종 적합성 판정은 구조화된 조건과 rule engine을 기준으로 한다.
- LLM 출력은 근거가 있는 조건 후보로 저장하고, confidence와 evidence를 함께 보관한다.
- 정정공고, 변경공고, 첨부파일 변경은 삭제하지 않고 version으로 관리한다.
- 신청서 제출, 로그인 자동화, 실제 청약 접수 대행은 범위 밖이다.
