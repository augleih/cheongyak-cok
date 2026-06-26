# PlayMCP 제약 체크리스트

이 문서는 사람이 빠르게 확인하는 요약이다. 자동 검증 가능한 기준은 [config/playmcp-tool-rules.json](../config/playmcp-tool-rules.json)을 source of truth로 둔다.

Tool 정의 검증은 다음 명령으로 실행한다.

```bash
node scripts/validate-playmcp-tools.mjs <tool-definitions.json>
```

## Server And Contest

- MCP 서버는 공개 접근 가능한 원격 URL 또는 도메인을 가져야 한다.
- Transport는 Streamable HTTP를 사용한다.
- MCP protocol version은 `2025-03-26`부터 `2025-11-25` 범위 안에 둔다.
- 서버는 stateless 구조를 기본으로 한다.
- server name과 tool name에는 `kakao` 문자열을 포함하지 않는다. 대소문자와 위치를 구분하지 않는다.
- Agentic Player 10 제출용 PlayMCP in KC 서버 발급 가능 기간은 2026년 6월 15일부터 2026년 7월 14일까지다.
- PlayMCP in KC에서 발급받은 Endpoint URL로 PlayMCP에 등록해야 한다.
- 계정당 등록 가능한 MCP 서버는 2대다.
- PlayMCP in KC 무상 지원은 한시적이므로 상용화 이전 또는 운영 종료 계획을 남긴다.
- 제출 전 최신 공식 공지와 MCP Inspector의 tool discovery/tool call 결과를 다시 확인한다.

## Tool Surface

- public tool 개수는 3-10개를 목표로 하고 최대 20개를 넘지 않는다.
- tool name은 `^[A-Za-z0-9_-]{1,128}$`를 따른다.
- 모든 tool은 `name`, `description`, `inputSchema`, `annotations`를 가진다.
- 모든 `annotations`에는 `title`, `readOnlyHint`, `destructiveHint`, `openWorldHint`, `idempotentHint`를 포함한다.
- description은 1024자 이하로 유지한다.
- description은 영어 중심으로 작성하되 `CheongyakCok(청약콕)`을 포함한다.
- 수집/파싱/추출/재색인용 작업은 public MCP tool로 노출하지 않는다.

## Performance And Work Placement

- 사용자-facing MCP tool call은 평균 100ms 이하를 목표로 한다.
- p99 응답 시간은 3000ms 이하를 넘지 않도록 설계한다.
- public tool call에서는 live crawling, 원격 공고 사이트 fetch, PDF/HWP/HWPX/XLSX parsing, LLM extraction, bulk reindexing을 하지 않는다.
- public tool은 사전 수집된 DB/cache를 읽고 가벼운 rule evaluation만 수행한다.
- 공고 수집, 원문 다운로드, 문서 파싱, LLM 기반 조건 추출은 background collector, scheduler, deployment hook, admin CLI 중 하나에서 수행한다.

## Response Policy

- tool result는 필요한 정보만 작게 반환한다.
- raw API response, raw parsing output, raw stack trace를 사용자에게 노출하지 않는다.
- eligibility status는 `eligible`, `maybe`, `not_eligible`, `unknown` 중 하나로 제한한다.
- eligibility result에는 `status`, `reason`, `evidence`, `needsConfirmation`을 포함한다.
- 사용자-facing 표현은 `현재 입력된 조건 기준`, `추가 확인 필요`, `최종 신청 전 공고문 원문 확인 필요`처럼 확정 판정을 피한다.

## Privacy

- V0에서는 OAuth를 사용하지 않는다.
- V0에서는 사용자 profile을 서버에 저장하지 않는다.
- 주민등록번호, 로그인 정보, 인증서 정보, 계좌 정보, 정확한 소득/자산 금액은 저장하지 않는다.
- 사용자의 조건은 tool input으로 받아 즉시 판정에만 사용한다.
- 계정, 알림, 개인화 이력은 상용화 단계에서 별도 개인정보 설계 후 추가한다.

## CheongyakCok Rules

- V0 primary source는 공공데이터포털의 `국토교통부_마이홈포털 공공주택 모집공고 조회 서비스`다.
- background collector는 `.env`의 `MYHOME_SERVICE_KEY`로 공식 endpoint `https://apis.data.go.kr/1613000/HWSPR02`를 호출한다.
- V0 상세 기능은 공공임대 `/rsdtRcritNtcList`와 공공분양 `/ltRsdtRcritNtcList`다.
- V0는 마이홈에 등재된 공공임대/공공분양 입주자 모집공고만 다룬다.
- 마이홈 웹 내부 endpoint는 primary source가 아니라 reference로만 사용한다.
- 청약홈, LH 직접 API, SH/GH/지방공사 직접 출처는 future source adapter로 둔다.
- 공고의 원천 진실은 공식 공고문과 원문 파일이다.
- LLM은 조건 후보 추출과 설명 생성을 돕지만 source of truth가 아니다.
- 최종 eligibility result는 구조화된 조건과 rule engine으로 계산한다.
- 정정공고, 변경공고, 첨부파일 변경은 삭제하지 않고 notice version으로 관리한다.
- 실제 청약 접수 대행, 로그인 자동화, 신청서 제출 자동화는 범위 밖이다.
