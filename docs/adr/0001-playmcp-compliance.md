# ADR 0001: PlayMCP 제약을 기준으로 한 서버 구조

## 상태

Accepted

## 배경

청약콕은 PlayMCP에 등록되는 MCP 서버로 동작해야 한다. PlayMCP 심사 조건은 단순한 배포 체크리스트가 아니라 제품 구조에 직접 영향을 준다. 특히 tool 응답 속도, stateless 권장, tool 개수 제한, annotations 필수 조건, result size 제한 때문에 “사용자 요청 시 실시간으로 공고를 수집하고 원문을 분석하는 구조”는 적합하지 않다.

Agentic Player 10 참가를 위한 PlayMCP in KC는 예선 접수 기간인 2026년 6월 15일부터 2026년 7월 14일까지만 MCP 서버 발급을 지원한다. 발급받은 KC MCP Endpoint URL로 PlayMCP에 등록해야 하고, 계정당 등록 가능한 MCP 서버는 2대다. 또한 공모전 목적 외 사용이나 예선 미접수 시 서버가 회수될 수 있으며, 무상 지원 종료 후에는 별도 과금 또는 다른 클라우드 이전 계획이 필요하다.

청약 공고 데이터는 마이홈, 청약홈, LH, SH, GH, 지방 주택공사 등 여러 출처에 흩어져 있다. 목록과 일부 메타데이터는 API로 조회할 수 있지만, 소득/자산/무주택/세대 구성/우선공급/제출서류 같은 세부 조건은 PDF, HWP, HWPX, HTML, XLSX 등 원문 파일 확인이 필요한 경우가 많다.

## 결정

청약콕은 사용자-facing MCP tool call과 background data pipeline을 분리한다.

사용자-facing MCP tool은 다음 일만 수행한다.

- 사전 수집된 공고 DB/cache 조회
- canonical notice 검색과 상세 조회
- 구조화된 조건 기준의 빠른 eligibility rule evaluation
- 누락된 사용자 조건 질문 생성
- 신청 준비 체크리스트 생성

background pipeline은 다음 일을 수행한다.

- 마이홈, 청약홈, LH 등 공식 API에서 공고 목록 수집
- 출처별 공고를 canonical notice로 정규화
- 중복 공고와 정정/변경 version 관리
- 원문 파일 다운로드와 보관
- PDF/HWP/HWPX/HTML/XLSX 문서 파싱
- LLM 기반 조건 후보 추출
- 추출 결과 검증 상태와 evidence 저장

V0 저장소는 SQLite와 local file storage를 사용한다. 단, repository 인터페이스를 먼저 정의해 상용화 단계에서 Postgres와 object storage로 교체할 수 있게 한다.

V0에서는 OAuth와 사용자 프로필 저장을 하지 않는다. 사용자 조건은 tool input으로 받고, 서버에는 공고 데이터와 구조화된 조건만 저장한다.

배포 운영은 공모전 기간과 무상 지원 종료 가능성을 전제로 설계한다. V0는 PlayMCP in KC에 올리되, 상용화 단계에서는 같은 application contract를 유지한 채 다른 cloud runtime으로 이전할 수 있어야 한다.

## Tool 초안

V0의 public MCP tool은 6개 안팎으로 유지한다.

- `search_notices`: 지역, 공급 유형, 기간, 키워드 기준 공고 검색
- `get_notice_detail`: canonical notice 상세와 원문 링크 조회
- `evaluate_eligibility`: 사용자 조건 기준 적합 가능성 평가
- `recommend_notices`: 사용자 조건 기준 추천 공고 목록 반환
- `get_missing_profile_fields`: 판정 정확도를 높이기 위한 추가 질문 반환
- `generate_preparation_checklist`: 공고별 준비 서류와 일정 체크리스트 반환

수집 갱신용 `refresh_notice_cache`는 public MCP tool로 노출하지 않는다. 수집은 CLI, scheduler, deployment hook, admin-only endpoint 중 하나로 처리한다.

## 결과

좋은 점:

- PlayMCP 성능 조건을 만족하기 쉽다.
- 공고 수집 장애가 사용자 요청 전체 장애로 번지지 않는다.
- LLM 비용과 지연 시간을 background 작업으로 밀어낼 수 있다.
- 상용화 시 API 서버, MCP 서버, worker, scheduler로 자연스럽게 분리할 수 있다.
- PlayMCP in KC 무상 지원 종료 후 다른 cloud runtime으로 이전하기 쉽다.

비용:

- 초기 구현에 수집 DB/cache와 background job 개념이 필요하다.
- 공고가 실시간으로 반영되지 않고 수집 주기에 따라 지연될 수 있다.
- 문서 파싱과 조건 추출 품질을 별도로 관리해야 한다.
- 공모전 기간 안에 KC Endpoint 발급, PlayMCP 등록, 심사 요청, 예선 접수를 모두 끝내야 한다.

## 구현 규칙

- MCP adapter는 core service를 호출하는 얇은 계층으로 유지한다.
- tool handler에서 외부 공고 사이트를 직접 호출하지 않는다.
- tool handler에서 LLM API를 직접 호출하지 않는다.
- tool handler에서 원문 파일 파싱을 직접 수행하지 않는다.
- 모든 tool 정의는 `config/playmcp-tool-rules.json` 기준으로 검증 가능해야 한다.
- 모든 적합성 판정은 `eligible`, `maybe`, `not_eligible`, `unknown` 중 하나로 반환한다.
- 모든 판정에는 `reason`, `evidence`, `needsConfirmation`을 포함한다.
- deployment config는 KC Endpoint URL에 의존하되, runtime 이전을 막는 vendor-specific code를 core domain에 넣지 않는다.
