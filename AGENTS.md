# AGENTS.md

CheongyakCok(청약콕)은 사용자의 기본 조건으로 공공/민간 청약 공고를 찾고, 지원 가능성과 추가 확인이 필요한 조건을 조심스럽게 설명하는 MCP 서버다. 최종 법적 판정은 하지 않으며, 항상 공식 공고문과 신청 화면 확인을 전제로 한다.

## Read First

- [docs/README.md](docs/README.md): 문서 지도와 source of truth.
- [docs/playmcp-constraints.md](docs/playmcp-constraints.md): 사람이 확인하는 PlayMCP 제약 체크리스트.
- [config/playmcp-tool-rules.json](config/playmcp-tool-rules.json): tool 정의 자동 검증 기준.
- [docs/adr/0001-playmcp-compliance.md](docs/adr/0001-playmcp-compliance.md): 사용자-facing tool과 background pipeline을 분리한 이유.

## North Star

- 사용자는 “내가 넣어볼 만한 공고”와 “왜 가능하거나 불확실한지”를 빠르게 알고 싶다.
- V0는 작게 만들되, 모듈 경계는 상용화 구조로 이어질 수 있어야 한다.
- MCP 서버는 빠른 사용자-facing interface이고, 공고 수집/문서 파싱/LLM 추출은 background pipeline이다.

## Non-Negotiables

- Transport는 Streamable HTTP를 사용한다.
- MCP protocol version 범위, tool 수, naming, annotations 기준은 `config/playmcp-tool-rules.json`을 따른다.
- server name과 tool name에는 `kakao` 문자열을 포함하지 않는다.
- public tool call 안에서 live crawling, PDF/HWP/HWPX parsing, LLM extraction, bulk reindexing을 하지 않는다.
- public tool은 사전 수집된 DB/cache 조회와 가벼운 rule evaluation만 수행한다.
- V0에서는 OAuth와 사용자 profile 저장을 사용하지 않는다.

## Architecture

- MCP adapter는 input validation, core service 호출, MCP result 변환만 맡는다.
- core domain은 MCP 밖에서도 테스트 가능해야 한다.
- source collector, normalizer, dedup/versioning, document processor, criteria extractor, eligibility engine, storage는 분리한다.
- V0 storage는 SQLite와 local file storage를 기본으로 하되 repository interface를 먼저 둔다.
- 상용화 단계에서는 Postgres와 object storage로 교체할 수 있어야 한다.

## Data And Eligibility

- 공식 출처를 우선한다: 마이홈, 청약홈, LH, 확인 가능한 SH/GH/지방공사 공식 출처.
- 공고 목록 API만으로 세부 자격을 확정하지 않는다.
- 소득, 자산, 자동차, 무주택, 세대 구성, 우선공급, 중복신청 제한, 제출서류는 원문 근거를 확인한다.
- LLM은 source of truth가 아니다. 조건 후보 추출과 설명 생성을 돕되, 최종 eligibility result는 rule engine이 계산한다.
- 판정 status는 `eligible`, `maybe`, `not_eligible`, `unknown` 중 하나로 제한한다.

## User-Facing Language

- 사용자가 한글로 이야기하면 한글로 답한다.
- “100% 가능”, “확정”, “무조건 신청 가능”처럼 단정하지 않는다.
- 기본 표현은 `현재 입력된 조건 기준`, `지원 가능성이 높습니다`, `추가 확인 필요`, `최종 신청 전 공고문 원문 확인 필요`를 사용한다.
- tool description은 영어 중심으로 작성하되 `CheongyakCok(청약콕)`을 포함한다.

## Coding Workflow

- 작업 전 `rg --files`와 관련 문서부터 확인한다.
- 기존 패턴을 따르고, 큰 추상화보다 작은 함수, 명확한 schema, 재현 가능한 fixture를 선호한다.
- 수동 편집은 `apply_patch`를 사용한다.
- 사용자가 만들었을 수 있는 변경사항은 되돌리지 않는다.
- 새 package script가 생기면 그 script로 test, lint, validation을 실행한다.
- 명령어가 없으면 임의로 가정하지 말고 `package.json` 또는 문서를 먼저 확인한다.
- 설계 결정은 필요할 때 `docs/adr/` 또는 `docs/superpowers/specs/`에 남긴다.

## Definition Of Done

- 관련 문서가 최신 상태다.
- PlayMCP 제약을 위반하지 않는다.
- public MCP tool은 느린 외부 작업을 하지 않는다.
- 사용자-facing 문구는 확정 판정을 피한다.
- 테스트 또는 검증 명령을 실행했고, 실행하지 못한 검증은 이유를 남긴다.
