# AGENTS.md

CheongyakCok(청약콕)은 마이홈 기반 공공주택 청약 공고를 찾고, 사용자의 기본 조건 기준 지원 가능성과 확인 필요 항목을 조심스럽게 설명하는 MCP 서버다.

## Read First

- [docs/README.md](docs/README.md): 문서 지도와 source of truth.
- [docs/project-scope.md](docs/project-scope.md): 제품 목표, V0 범위, source scope.
- [docs/playmcp-constraints.md](docs/playmcp-constraints.md): PlayMCP 제약 체크리스트.
- [config/playmcp-tool-rules.json](config/playmcp-tool-rules.json): tool 정의 자동 검증 기준.
- [docs/adr/0001-playmcp-compliance.md](docs/adr/0001-playmcp-compliance.md): 빠른 MCP tool과 background pipeline을 분리한 결정.
- [docs/eligibility-policy.md](docs/eligibility-policy.md): 판정, evidence, LLM 사용 원칙.
- [docs/user-language-policy.md](docs/user-language-policy.md): 사용자-facing 문구 원칙.

## Hard Rules

- Transport는 Streamable HTTP를 사용한다.
- server name과 tool name에는 `kakao` 문자열을 포함하지 않는다.
- public MCP tool은 live crawling, 문서 parsing, LLM extraction, bulk reindexing을 하지 않는다.
- public MCP tool은 사전 수집된 DB/cache와 가벼운 rule evaluation만 사용한다.
- V0에서는 OAuth와 사용자 profile 저장을 사용하지 않는다.
- MCP adapter는 input validation, core service 호출, MCP result 변환만 맡는다.

## Workflow

- 작업 전 `rg --files`와 관련 문서부터 확인한다.
- 기존 패턴을 따르고, 작은 함수, 명확한 schema, 재현 가능한 fixture를 선호한다.
- 수동 편집은 `apply_patch`를 사용한다.
- 사용자가 만들었을 수 있는 변경사항은 되돌리지 않는다.
- 새 package script가 생기면 그 script로 test, lint, validation을 실행한다.
- 명령어가 없으면 `package.json` 또는 문서를 먼저 확인한다.

## Definition Of Done

- 관련 문서가 최신 상태다.
- PlayMCP 제약을 위반하지 않는다.
- public MCP tool은 느린 외부 작업을 하지 않는다.
- 사용자-facing 문구는 확정 판정을 피한다.
- 테스트 또는 검증 명령을 실행했고, 실행하지 못한 검증은 이유를 남긴다.
