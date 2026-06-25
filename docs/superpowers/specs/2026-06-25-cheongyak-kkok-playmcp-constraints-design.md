# 청약콕 PlayMCP 제약 문서화 설계

## 목적

청약콕 MCP 서버의 PlayMCP 심사 제약과 제품 구조 결정을 문서와 규칙 파일로 고정한다. 목표는 구현자가 매번 기억에 의존하지 않고, 심사 조건을 설계와 코드 검증의 기준으로 사용할 수 있게 하는 것이다.

## 범위

이번 설계는 코드 구현이 아니라 제약 정의와 문서화에 집중한다.

포함한다:

- PlayMCP 심사 제약 체크리스트
- PlayMCP 제약이 청약콕 아키텍처에 미치는 결정사항
- 추후 자동 검증 스크립트가 읽을 수 있는 JSON 규칙
- V0에서 지켜야 할 개인정보와 성능 원칙

포함하지 않는다:

- MCP 서버 구현
- 공고 수집기 구현
- 문서 파서 구현
- LLM 조건 추출 구현
- 배포 자동화 구현

## 접근 방식

세 겹으로 제약을 관리한다.

첫째, 사람이 읽는 체크리스트를 둔다. `docs/playmcp-constraints.md`는 PlayMCP 서버 조건, tool 조건, 성능 조건, 응답 조건, 개인정보 조건을 정리한다.

둘째, 아키텍처 결정을 ADR로 남긴다. `docs/adr/0001-playmcp-compliance.md`는 왜 MCP tool call에서 실시간 수집, 문서 파싱, LLM 추출을 하지 않는지 설명한다. 이 결정은 청약콕의 V0 구조와 상용화 구조를 이어주는 핵심 기준이다.

셋째, 기계가 읽을 수 있는 규칙을 둔다. `config/playmcp-tool-rules.json`은 tool name, tool count, 필수 annotations, description 길이, 금지 작업, 응답 정책 등을 정의한다. 이후 `scripts/validate-playmcp-tools.ts`가 이 파일을 읽어 실제 tool 정의를 검증한다.

## 핵심 설계 결정

사용자-facing MCP tool은 빠른 DB/cache 조회와 rule evaluation만 수행한다. 공고 수집, 원문 다운로드, PDF/HWP/HWPX/HTML/XLSX 파싱, LLM 기반 조건 추출은 background pipeline으로 분리한다.

이 결정은 PlayMCP 성능 조건 때문이다. tool 응답은 평균 100ms 이하를 목표로 하고 p99 3000ms 이하를 지켜야 한다. 외부 사이트 호출, 대형 파일 파싱, LLM 호출은 이 조건을 안정적으로 만족하기 어렵다.

V0에서는 OAuth와 사용자 프로필 저장을 사용하지 않는다. 사용자의 나이, 혼인 여부, 세대 구성, 소득/자산 구간 등은 요청 input으로만 받고 서버에 저장하지 않는다. 상용화 단계에서 계정 기반 알림과 이력 저장을 추가할 때 OAuth와 개인정보 동의 구조를 별도로 설계한다.

## 파일 구조

```text
docs/
  playmcp-constraints.md
  adr/
    0001-playmcp-compliance.md
  superpowers/
    specs/
      2026-06-25-cheongyak-kkok-playmcp-constraints-design.md
config/
  playmcp-tool-rules.json
```

## 추후 검증 계획

구현 단계에서 `scripts/validate-playmcp-tools.ts`를 추가한다. 이 스크립트는 실제 MCP tool 정의를 읽고 다음 항목을 검사한다.

- tool 개수 20개 이하
- 권장 tool 개수 3-10개
- tool 이름 정규식 준수
- server/tool 이름에 `kakao` 미포함
- 필수 property 존재
- 필수 annotations 존재
- description 1024자 이하
- public deny list tool 미노출
- eligibility 응답 필드 일관성

검증 스크립트는 로컬 테스트와 CI에서 실행할 수 있게 한다.

## 성공 기준

- PlayMCP 제약이 한 문서에서 빠르게 확인된다.
- “tool call에서 느린 작업 금지” 원칙이 ADR로 고정된다.
- 추후 구현자가 tool 정의를 작성할 때 JSON 규칙을 기준으로 자동 검증할 수 있다.
- V0 구조가 상용화 구조와 충돌하지 않는다.
