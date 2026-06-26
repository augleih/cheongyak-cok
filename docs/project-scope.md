# Project Scope

CheongyakCok(청약콕)은 사용자가 “내가 넣어볼 만한 공고”와 “왜 가능하거나 불확실한지”를 빠르게 이해하도록 돕는 MCP 서버다. 최종 법적 판정자는 아니며, 공식 공고문과 신청 화면 확인을 전제로 한다.

## North Star

- 사용자의 기본 조건으로 지원 가능성이 있는 공고를 빠르게 좁힌다.
- 가능한 이유, 불확실한 이유, 추가 확인이 필요한 조건을 함께 보여준다.
- V0는 작게 만들되, source adapter와 canonical notice 경계는 상용화 구조로 이어지게 둔다.

## V0 Source Scope

- V0 primary source는 공공데이터포털의 `국토교통부_마이홈포털 공공주택 모집공고 조회 서비스`다.
- 공식 endpoint는 `https://apis.data.go.kr/1613000/HWSPR02`이고, background collector가 `.env`의 `MYHOME_SERVICE_KEY`로 호출한다.
- V0에서 사용하는 상세 기능은 공공임대주택 모집공고 조회 `/rsdtRcritNtcList`와 공공분양주택 모집공고 조회 `/ltRsdtRcritNtcList`다.
- V0는 마이홈에 등재된 공공임대/공공분양 입주자 모집공고만 다룬다.
- 마이홈 웹 화면의 내부 endpoint는 필드 비교와 보조 검증용 reference로만 사용하고 primary source로 두지 않는다.
- 청약홈, LH 직접 API, SH/GH/지방공사 직접 출처는 future source adapter로 둔다.
- public MCP tool은 normalized cache만 읽는다.

## Architecture Shape

```text
data.go.kr MyHome OpenAPI
  -> collector or seed import
  -> raw snapshot
  -> canonical notice schema
  -> document/evidence storage
  -> eligibility criteria
  -> SQLite/cache
  -> MCP tools
```

## Module Boundaries

- MCP adapter: input validation, core service 호출, MCP result 변환.
- source collector: 공식 MyHome OpenAPI 공고 목록 수집 또는 seed import.
- normalizer: 출처별 데이터를 [canonical schema v0](canonical-schema-v0.md)로 변환.
- dedup/versioning: 중복, 정정공고, 변경공고, 첨부 변경 관리.
- document processor: 원문 파일 다운로드, 보관, parsing.
- criteria extractor: 원문 조건 후보와 evidence 추출.
- eligibility engine: 구조화된 조건 기반 판정.
- storage: V0는 SQLite와 local file storage, 이후 Postgres/object storage로 교체 가능해야 한다.

## Local Collection

- 로컬 개발자는 `.env.example`을 참고해 `.env`에 `MYHOME_SERVICE_KEY`를 넣는다.
- 실제 키는 git에 커밋하지 않는다.
- 공식 API 단일 페이지 smoke 수집은 다음처럼 실행한다.

```bash
node scripts/collect-myhome-notices.mjs --noticeType public_rental --pageNo 1 --numOfRows 10
node scripts/collect-myhome-notices.mjs --noticeType public_sale --pageNo 1 --numOfRows 10
```

- raw snapshot과 canonical JSON cache를 함께 만들 때는 sync 명령을 사용한다.

```bash
node scripts/sync-myhome-notice-cache.mjs --pageSize 100
node scripts/sync-myhome-notice-cache.mjs --pageSize 1 --maxPages 1
```

- sync 출력은 `data/raw/myhome/<runId>/`와 `data/cache/myhome-notices.json`에 저장된다.
- `data/`는 git에 커밋하지 않는다.
- public MCP tool은 이 결과가 저장된 cache/DB를 읽는 구조로 이어진다.

cache 검색 smoke는 다음처럼 실행한다.

```bash
node scripts/search-notices.mjs --cachePath data/cache/myhome-notices.json --keyword 행복주택 --limit 5
node scripts/search-notices.mjs --cachePath data/cache/myhome-notices.json --sidoName 서울특별시 --noticeType public_rental
```
