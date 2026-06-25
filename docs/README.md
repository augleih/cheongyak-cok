# 문서 지도

이 저장소의 문서는 짧은 운영 규칙, 사람이 읽는 체크리스트, 기계가 읽는 규칙, 의사결정 기록으로 역할을 나눈다.

| 문서 | 역할 | 언제 볼까 |
| --- | --- | --- |
| [AGENTS.md](../AGENTS.md) | 에이전트와 개발자가 매 작업 전에 지킬 운영 규칙 | 작업 시작, 리뷰, Definition of Done 확인 |
| [docs/playmcp-constraints.md](playmcp-constraints.md) | PlayMCP 제약의 사람이 읽는 체크리스트 | tool 설계, 배포 준비, 심사 전 점검 |
| [config/playmcp-tool-rules.json](../config/playmcp-tool-rules.json) | tool 정의 자동 검증 기준 | validator, test, CI 작성 |
| [docs/adr/0001-playmcp-compliance.md](adr/0001-playmcp-compliance.md) | 빠른 MCP tool과 느린 background pipeline을 분리한 결정 | 구조 변경, tool handler 구현 |
| [docs/superpowers/specs/](superpowers/specs/) | 과거 설계 과정의 스냅샷 | 당시 의도 확인이 필요할 때 |

## Source Of Truth

- 반복되는 세부 수치는 `config/playmcp-tool-rules.json`에 둔다.
- 사람이 빠르게 읽어야 하는 제약은 `docs/playmcp-constraints.md`에 둔다.
- “왜 이렇게 만들었는가”는 ADR에 둔다.
- `AGENTS.md`에는 매 작업에 필요한 최소 규칙과 링크만 둔다.

## 문서 작성 원칙

- 새 내용을 넣기 전에 기존 문서 중 source of truth가 있는지 먼저 확인한다.
- 같은 규칙을 여러 문서에 풀어 쓰지 말고 링크로 연결한다.
- 정책은 체크리스트에, 결정 이유는 ADR에, 자동 검증 조건은 JSON에 둔다.
- 오래된 설계 문서는 현재 정책처럼 고치지 말고, 필요하면 새 ADR 또는 현재 문서로 승격한다.
