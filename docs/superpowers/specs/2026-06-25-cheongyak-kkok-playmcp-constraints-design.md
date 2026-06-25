# 청약콕 PlayMCP 제약 문서화 설계

이 문서는 2026년 6월 25일 문서화 작업의 설계 기록이다. 현재 운영 기준은 [docs/README.md](../../README.md)의 문서 지도를 따른다.

## 목표

PlayMCP 심사 제약을 기억에 의존하지 않고 문서와 규칙 파일로 확인할 수 있게 한다.

## 결정

- `AGENTS.md`는 짧은 운영 규칙과 핵심 링크만 담는다.
- `docs/playmcp-constraints.md`는 사람이 읽는 PlayMCP 체크리스트로 유지한다.
- `config/playmcp-tool-rules.json`은 validator가 읽을 수 있는 source of truth로 둔다.
- `docs/adr/0001-playmcp-compliance.md`는 사용자-facing tool과 background pipeline을 분리한 이유를 기록한다.

## 핵심 구조

사용자-facing MCP tool은 사전 수집된 DB/cache 조회와 rule evaluation만 수행한다. 공고 수집, 원문 다운로드, 문서 파싱, LLM 조건 추출은 background pipeline으로 분리한다.

이 구조는 평균 100ms, p99 3000ms 이하를 목표로 하는 PlayMCP 응답 조건을 지키기 위한 선택이다.

## 범위 밖

- MCP 서버 구현
- 공고 수집기 구현
- 문서 parser 구현
- LLM 조건 추출 구현
- 배포 자동화 구현

## 후속 검증

구현 단계에서 `scripts/validate-playmcp-tools.ts`를 추가해 실제 tool 정의가 `config/playmcp-tool-rules.json`을 만족하는지 확인한다.
