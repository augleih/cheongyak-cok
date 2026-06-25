# ADR 0001: PlayMCP 제약을 기준으로 한 서버 구조

## 상태

Accepted

## 배경

청약콕은 PlayMCP에 등록되는 MCP 서버다. PlayMCP 제약은 배포 체크리스트를 넘어 제품 구조에 영향을 준다. 사용자-facing tool은 빠르게 응답해야 하고, tool 수와 schema도 제한된다. 따라서 사용자 요청 시점에 공고를 수집하거나 원문 문서를 파싱하거나 LLM으로 조건을 추출하는 구조는 적합하지 않다.

청약 공고 데이터는 마이홈, 청약홈, LH, SH/GH, 지방공사 등 여러 공식 출처에 흩어져 있다. V0에서 모든 출처를 동시에 다루면 source normalization, dedup, 문서 파싱 범위가 커져 end-to-end demo가 흐려진다. 목록 API만으로는 소득, 자산, 무주택, 세대 구성, 우선공급, 중복신청, 제출서류 같은 세부 조건을 확정하기 어렵고 원문 파일 확인이 필요하다.

## 결정

사용자-facing MCP tool call과 background data pipeline을 분리한다.

V0 source scope는 마이홈에 등재된 공공임대/공공분양 입주자 모집공고로 제한한다. 청약홈, LH 직접 API, SH/GH/지방공사 직접 출처는 future source adapter로 남긴다. 내부 모델은 처음부터 canonical notice를 사용해 이후 다른 출처를 붙여도 public MCP tool contract가 흔들리지 않게 한다.

public MCP tool은 사전 수집된 DB/cache를 읽고 다음 작업만 수행한다.

- 공고 검색과 상세 조회
- 구조화된 조건 기준의 빠른 eligibility rule evaluation
- 누락된 사용자 조건 질문 생성
- 신청 준비 체크리스트 생성

background pipeline은 다음 작업을 맡는다.

- 마이홈에서 공고 목록 수집 또는 seed import
- canonical notice 정규화
- 중복 공고와 정정/변경 version 관리
- 원문 파일 다운로드와 보관
- PDF/HWP/HWPX/HTML/XLSX 문서 파싱
- LLM 기반 조건 후보 추출
- evidence, confidence, 검증 상태 저장

V0 storage는 SQLite와 local file storage를 사용한다. 단, repository interface를 먼저 두어 Postgres와 object storage로 교체할 수 있게 한다.

V0에서는 OAuth와 사용자 profile 저장을 하지 않는다. 사용자 조건은 tool input으로 받고, 서버에는 공고 데이터와 구조화된 조건만 저장한다.

## Initial Tool Surface

V0 public MCP tool은 6개 안팎으로 유지한다.

- `search_notices`: 마이홈 기반 canonical notice를 명시 필터로 검색
- `get_notice_detail`: 단일 canonical notice의 상세와 원문 근거 조회
- `evaluate_eligibility`: 단일 notice와 사용자 조건 기준으로 지원 가능성 평가
- `recommend_notices`: 사용자 profile 기준으로 마이홈 공고 후보 ranking
- `get_missing_profile_fields`: 판정 정확도를 높이기 위한 누락 조건 질문 생성
- `generate_preparation_checklist`: 공고별 준비 서류와 일정 checklist 생성

수집 갱신용 `refresh_notice_cache`는 public MCP tool로 노출하지 않는다.

## 결과

좋은 점:

- PlayMCP 성능 조건을 만족하기 쉽다.
- 실제 마이홈 공고 샘플로 공모전 demo path를 빠르게 만들 수 있다.
- 공고 수집 장애가 사용자 요청 장애로 바로 번지지 않는다.
- LLM 비용과 지연 시간을 background 작업으로 분리할 수 있다.
- 상용화 시 MCP server, API server, worker, scheduler로 자연스럽게 나눌 수 있다.

비용:

- 초기 구현부터 DB/cache와 background job 개념이 필요하다.
- 공고 반영은 수집 주기에 따라 지연될 수 있다.
- V0에서는 민간 청약과 청약홈 기반 복잡 판정을 다루지 않는다.
- 문서 파싱과 조건 추출 품질을 별도 eval로 관리해야 한다.

## 구현 규칙

- MCP adapter는 core service를 호출하는 얇은 계층으로 유지한다.
- tool handler에서 외부 공고 사이트, LLM API, 원문 파일 parser를 직접 호출하지 않는다.
- 모든 tool 정의는 [config/playmcp-tool-rules.json](../../config/playmcp-tool-rules.json) 기준으로 검증 가능해야 한다.
- 모든 eligibility result는 `eligible`, `maybe`, `not_eligible`, `unknown` 중 하나를 반환한다.
- 모든 eligibility result에는 `reason`, `evidence`, `needsConfirmation`을 포함한다.
- runtime 이전을 막는 vendor-specific code를 core domain에 넣지 않는다.
