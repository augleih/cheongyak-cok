# AGENTS.md

이 저장소는 CheongyakCok(청약콕) MCP 서버를 만든다. 목표는 사용자의 기본 조건을 바탕으로 공공/민간 청약 공고를 찾고, 지원 가능성과 확인이 필요한 조건을 조심스럽게 설명하는 것이다.

이 문서는 이 저장소에서 작업하는 에이전트와 개발자가 따라야 할 운영 규칙이다. Andrej Karpathy의 작업 방식에서 자주 보이는 태도, 즉 작은 작동 단위, 실제 데이터, 관찰 가능한 평가, 단순한 시스템, 인간이 이해할 수 있는 자동화를 기준으로 삼는다. 특정 글이나 발언의 공식 요약이 아니라 청약콕 프로젝트에 맞춘 실천 원칙이다.

## Project North Star

- 사용자는 “내가 넣어볼 만한 공고가 무엇인지”와 “왜 가능하거나 불확실한지”를 빠르게 알고 싶다.
- 청약콕은 최종 법적 판정자가 아니다. 항상 공식 공고문, 기관 사이트, 신청 화면 확인을 전제로 답한다.
- V0는 작아야 하지만 버려질 구조여서는 안 된다. V0의 모듈 경계가 상용화 구조로 이어져야 한다.
- MCP 서버는 빠른 사용자-facing interface이고, 공고 수집/문서 파싱/LLM 추출은 background pipeline이다.

## Karpathy-Inspired Engineering Principles

- Keep the core small. 먼저 작게 작동하는 end-to-end path를 만든다.
- Prefer real data. mock은 테스트 보조로만 쓰고, 설계 검증은 마이홈/청약홈/LH 등 실제 공고 샘플로 한다.
- Make behavior visible. 파서, 추출기, 판정기는 입력, 중간 결과, 근거, confidence를 남긴다.
- Build evals early. “그럴듯한 답”보다 재현 가능한 fixture와 regression test를 우선한다.
- Simple beats magical. LLM이 판단을 대신하게 하지 말고, 구조화된 조건과 rule engine이 최종 판정을 내리게 한다.
- Automate after understanding. 처음부터 거대한 agent pipeline을 만들지 말고, 관찰 가능한 script와 작은 job부터 시작한다.
- Data is code. 공고 원문, 추출 schema, dedup key, eligibility fixture는 소스 코드만큼 중요하게 다룬다.
- Human judgment stays in the loop. 애매한 조건은 `unknown` 또는 `maybe`로 남기고 확인 필요 항목을 사용자에게 묻는다.

## Non-Negotiable PlayMCP Constraints

자세한 기준은 `docs/playmcp-constraints.md`와 `config/playmcp-tool-rules.json`을 따른다.

- Transport는 Streamable HTTP를 사용한다.
- MCP protocol version은 `2025-03-26`부터 `2025-11-25` 범위 안에 둔다.
- Agentic Player 10 제출용 MCP 서버는 예선 기간 안에 PlayMCP in KC에서 발급받은 Endpoint URL로 PlayMCP에 등록한다.
- PlayMCP in KC 서버 발급 가능 기간은 2026년 6월 15일부터 2026년 7월 14일까지다.
- 계정당 등록 가능한 MCP 서버는 2대다.
- PlayMCP in KC 무상 지원은 한시적이므로 상용화 이전 계획을 항상 열어둔다.
- server name과 tool name에는 `kakao` 문자열을 포함하지 않는다.
- public tool 개수는 3-10개를 목표로 하고 최대 20개를 넘지 않는다.
- tool name은 영문자, 숫자, `_`, `-`만 사용한다.
- 모든 tool은 `name`, `description`, `inputSchema`, `annotations`를 가진다.
- 모든 `annotations`에는 `title`, `readOnlyHint`, `destructiveHint`, `openWorldHint`, `idempotentHint`를 포함한다.
- 사용자-facing tool call은 평균 100ms 이하, p99 3000ms 이하를 목표로 한다.
- tool call 안에서 live crawling, PDF/HWP/HWPX parsing, LLM extraction, bulk reindexing을 하지 않는다.

## Architecture Rules

- MCP adapter는 얇게 유지한다. adapter는 input validation, core service 호출, MCP result 변환만 맡는다.
- core domain은 MCP 밖에서도 테스트 가능해야 한다.
- source collector, normalizer, dedup/versioning, document processor, criteria extractor, eligibility engine, storage는 분리한다.
- 사용자-facing tool은 사전 수집된 DB/cache를 읽는다.
- 수집과 분석은 CLI, scheduler, deployment hook, admin-only endpoint 중 하나에서 수행한다.
- V0 storage는 SQLite와 local file storage를 기본으로 하되 repository interface를 먼저 둔다.
- 상용화 단계에서는 Postgres와 object storage로 교체할 수 있어야 한다.

## Data Source Policy

- 공식 출처를 우선한다: 마이홈, 청약홈, LH, 그리고 확인 가능한 SH/GH/지방공사 공식 출처.
- 마이홈은 공공주택 통합 index로 사용하고, 청약홈은 분양/청약통장 기반 공고의 주요 출처로 사용한다.
- SH/GH 등 직접 API가 명확하지 않은 출처는 마이홈 coverage와 공식 원문 링크를 먼저 활용한다.
- 공고 목록 API만으로 세부 자격을 확정하지 않는다.
- 소득, 자산, 자동차, 무주택, 세대 구성, 우선공급, 중복신청 제한, 제출서류는 원문 근거를 확인한다.
- 정정공고와 변경공고는 삭제하지 않고 notice version으로 보관한다.

## LLM Policy

- LLM은 source of truth가 아니다.
- LLM은 자연어 profile 정규화, 누락 질문 생성, 원문 조건 후보 추출, 사용자 설명 생성에 사용한다.
- LLM이 추출한 조건은 schema, evidence, confidence, extraction status와 함께 저장한다.
- 최종 eligibility result는 rule engine이 계산한다.
- 판정 status는 `eligible`, `maybe`, `not_eligible`, `unknown` 중 하나로 제한한다.
- 답변에는 가능한 한 근거와 확인 필요 항목을 함께 제공한다.

## User-Facing Language

- “100% 가능”, “확정”, “무조건 신청 가능”처럼 단정하지 않는다.
- 기본 표현은 다음을 사용한다.
  - `현재 입력된 조건 기준`
  - `지원 가능성이 높습니다`
  - `추가 확인 필요`
  - `최종 신청 전 공고문 원문 확인 필요`
- 사용자가 한글로 이야기하면 한글로 답한다.
- tool description은 PlayMCP 권장에 맞춰 영어 중심으로 작성하되 `CheongyakCok(청약콕)`을 포함한다.

## Privacy Rules

- V0에서는 OAuth를 사용하지 않는다.
- V0에서는 사용자 profile을 서버에 저장하지 않는다.
- 주민등록번호, 인증서 정보, 로그인 정보, 정확한 소득/자산 금액, 계좌 정보는 저장하지 않는다.
- 사용자 조건은 tool input으로 받아 즉시 판정에만 사용한다.
- 계정, 알림, 개인화 이력은 상용화 단계에서 별도 개인정보 설계 후 추가한다.

## Coding Workflow

- 작업 전에 `rg --files`와 관련 문서부터 확인한다.
- 기존 패턴이 생기면 그 패턴을 따른다.
- 수동 편집은 `apply_patch`를 사용한다.
- 사용자가 만들었을 수 있는 변경사항은 되돌리지 않는다.
- 큰 추상화보다 작은 함수, 명확한 schema, 재현 가능한 fixture를 선호한다.
- 새 package script가 생기면 그 script를 통해 test, lint, validation을 실행한다.
- 명령어가 아직 정의되지 않았으면 임의로 가정하지 말고 `package.json` 또는 문서를 먼저 확인한다.

## Testing And Evals

- eligibility rule은 unit test로 검증한다.
- source normalization과 dedup은 fixture 기반 test로 검증한다.
- document extraction은 원문 fixture와 expected criteria snapshot을 둔다.
- PlayMCP tool definition은 `config/playmcp-tool-rules.json` 기준 validator로 검증한다.
- 실제 공고 샘플을 최소 단위 eval set으로 유지한다.
- bug fix는 가능하면 regression fixture를 먼저 추가한다.

## Git And Repository

- canonical remote는 `https://github.com/augleih/cheongyak-cok.git`이다.
- 기본 브랜치는 원격 저장소 설정을 따른다.
- 사용자가 명시적으로 요청하지 않으면 push하지 않는다.
- 커밋은 작고 설명 가능하게 유지한다.
- 설계 결정은 코드보다 먼저 `docs/adr/` 또는 `docs/superpowers/specs/`에 남긴다.

## Definition Of Done

- 관련 문서가 최신 상태다.
- PlayMCP 제약을 위반하지 않는다.
- public MCP tool은 느린 외부 작업을 하지 않는다.
- 사용자-facing 문구는 확정 판정을 피한다.
- 테스트 또는 검증 명령을 실행했고 결과를 설명할 수 있다.
- 실행하지 못한 검증이 있으면 이유를 명확히 남긴다.
