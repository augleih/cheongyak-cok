# Project Scope

CheongyakCok(청약콕)은 사용자가 “내가 넣어볼 만한 공고”와 “왜 가능하거나 불확실한지”를 빠르게 이해하도록 돕는 MCP 서버다. 최종 법적 판정자는 아니며, 공식 공고문과 신청 화면 확인을 전제로 한다.

## North Star

- 사용자의 기본 조건으로 지원 가능성이 있는 공고를 빠르게 좁힌다.
- 가능한 이유, 불확실한 이유, 추가 확인이 필요한 조건을 함께 보여준다.
- V0는 작게 만들되, source adapter와 canonical notice 경계는 상용화 구조로 이어지게 둔다.

## V0 Source Scope

- V0 primary source는 마이홈이다.
- V0는 마이홈에 등재된 공공임대/공공분양 입주자 모집공고만 다룬다.
- 청약홈, LH 직접 API, SH/GH/지방공사 직접 출처는 future source adapter로 둔다.
- public MCP tool은 normalized cache만 읽는다.

## Architecture Shape

```text
MyHome source
  -> collector or seed import
  -> canonical notice
  -> document/evidence storage
  -> eligibility criteria
  -> SQLite/cache
  -> MCP tools
```

## Module Boundaries

- MCP adapter: input validation, core service 호출, MCP result 변환.
- source collector: 마이홈 공고 목록 수집 또는 seed import.
- normalizer: 출처별 데이터를 canonical notice로 변환.
- dedup/versioning: 중복, 정정공고, 변경공고, 첨부 변경 관리.
- document processor: 원문 파일 다운로드, 보관, parsing.
- criteria extractor: 원문 조건 후보와 evidence 추출.
- eligibility engine: 구조화된 조건 기반 판정.
- storage: V0는 SQLite와 local file storage, 이후 Postgres/object storage로 교체 가능해야 한다.
