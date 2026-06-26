# Canonical Schema V0

CheongyakCok(청약콕)은 MyHome OpenAPI, LH/SH/GH 상세 페이지, PDF 공고문처럼 서로 다른 형식의 출처를 같은 도메인 구조로 저장한다. 목표는 모든 공고를 같은 flat row로 맞추는 것이 아니라, 공고를 검색/추천/판정에 필요한 공통 구성요소로 분해하는 것이다.

## Pipeline Shape

```text
raw source payload
  -> source document or parsed artifact
  -> canonical notice
  -> supply units
  -> schedule events
  -> eligibility tracks
  -> atomic eligibility rules
  -> evidence refs
```

public MCP tool은 canonical cache만 읽는다. raw source fetch, PDF parsing, LLM extraction은 background pipeline에서 수행한다.

## Identity

canonical notice id는 source, notice type, source notice id, source unit id를 포함한다.

```text
myhome:<noticeType>:<pblancId>
myhome:<noticeType>:<pblancId>:<houseSn>
```

- `noticeType`: `public_rental`, `public_sale`처럼 CheongyakCok 내부 notice type.
- `pblancId`: MyHome OpenAPI의 공고 id.
- `houseSn`: MyHome OpenAPI에서 같은 `pblancId` 안의 단지/주택 row를 구분하는 값.
- `houseSn`이 있는 source item은 canonical id에 반드시 포함한다.
- source-level grouping이 필요하면 `sourceNoticeGroupId`로 `myhome:<noticeType>:<pblancId>`를 따로 보관한다.

## Core Objects

### notice

공고 또는 공고 안의 source unit을 canonical 검색 단위로 표현한다.

```json
{
  "id": "myhome:public_rental:20623:1",
  "sourceNoticeGroupId": "myhome:public_rental:20623",
  "noticeType": "public_rental",
  "title": "세종서창, 해밀행복주택 예비입주자 모집공고문(2026.06.25)",
  "provider": { "name": "LH" },
  "region": { "sidoName": "세종특별자치시" },
  "categories": {
    "houseType": { "name": "아파트" },
    "supplyType": { "name": "행복주택" }
  },
  "dates": {
    "noticeDate": "2026-06-25",
    "applicationStartDate": "2026-07-07",
    "applicationEndDate": "2026-07-09",
    "winnerAnnouncementDate": "2026-10-12"
  },
  "links": {
    "sourceUrl": "https://apply.lh.or.kr/...",
    "pcUrl": "https://www.myhome.go.kr/..."
  },
  "complexityLevel": "simple_list_only",
  "extractionStatus": {
    "status": "openapi_only",
    "requiresDocumentParsing": false,
    "requiresHumanReview": false
  }
}
```

### supplyUnit

공고 안의 단지, 주소, 주택형, 공급대상, 공급호수, 임대조건을 표현한다. MyHome OpenAPI에서는 `houseSn` row가 supply unit의 seed가 된다. SH 행복주택 PDF처럼 큰 표가 있는 공고는 표의 각 row가 supply unit 후보가 된다.

```json
{
  "id": "myhome:public_rental:20623:1:supply",
  "noticeId": "myhome:public_rental:20623:1",
  "sourceUnitId": "1",
  "complexName": "세종서창",
  "address": "세종특별자치시 조치원읍 조치원중고길 7",
  "houseType": { "name": "아파트" },
  "supplyType": { "name": "행복주택" },
  "supplyCount": 274,
  "depositAmount": 12060000,
  "monthlyRent": 57280
}
```

### scheduleEvent

날짜는 자유 텍스트가 아니라 이벤트 배열로 저장한다. 인터넷 접수와 방문 접수가 나뉘는 SH 공고도 같은 구조에 들어간다.

```json
{
  "noticeId": "myhome:public_rental:20623:1",
  "type": "application_online",
  "startsAt": "2026-07-07",
  "endsAt": "2026-07-09",
  "sourceLabel": "인터넷 접수"
}
```

### eligibilityTrack

공고 하나가 여러 신청 대상과 공급구분을 가질 수 있으므로 track을 분리한다.

```json
{
  "id": "track:sh_happy_2026_1:youth:priority",
  "noticeId": "sh:happy:2026-000254",
  "targetGroup": "youth",
  "supplyMode": "priority",
  "rankRules": ["rank", "score", "residence_period", "lottery"],
  "requiredProfileFields": [
    "household.hasNoHome",
    "applicant.birthDate",
    "income.monthlyAverage",
    "asset.totalAmount",
    "residence.currentDistrict"
  ]
}
```

### eligibilityRule

판정 조건은 atomic rule로 저장한다. rule engine은 evidence가 없거나 사용자 입력이 부족한 조건을 `unknown` 또는 `maybe`로 남긴다.

```json
{
  "id": "rule:sh_happy_2026_1:youth:age",
  "trackId": "track:sh_happy_2026_1:youth:priority",
  "field": "applicant.ageAtNoticeDate",
  "operator": "between",
  "value": { "min": 19, "max": 39 },
  "required": true,
  "evidenceRefs": ["evidence:sh_happy_2026_1:p26:youth_age"]
}
```

### evidenceRef

모든 강한 판정은 evidence를 가져야 한다. PDF 공고는 page와 text snippet을 저장하고, 표에서 온 값은 table/cell/bbox metadata를 추가할 수 있다.

```json
{
  "id": "evidence:sh_happy_2026_1:p26:youth_age",
  "documentId": "doc:sh_happy_2026_1:notice_pdf",
  "page": 26,
  "textSnippet": "입주자모집공고일 현재 만 19세 이상 만 39세 이하인 자",
  "confidence": "high"
}
```

## Complexity Levels

```text
simple_list_only
detail_html_needed
document_needed
complex_multi_track
manual_review_recommended
unsupported
```

- MyHome OpenAPI row는 기본적으로 `simple_list_only`다.
- 원문 PDF의 신청자격이나 제출서류가 필요한 공고는 `document_needed`다.
- SH 행복주택처럼 한 공고에 단지, 주택형, 대상계층, 우선/일반 공급이 여러 갈래인 공고는 `complex_multi_track`이다.
- extraction coverage가 낮거나 표 구조가 깨진 경우 `manual_review_recommended`로 승격한다.

## Storage Shape

V0는 SQLite와 local file storage를 사용한다. table은 relational + JSON hybrid로 둔다.

```text
notices
notice_versions
source_documents
parsed_sections
supply_units
schedule_events
eligibility_tracks
eligibility_rules
evidence_refs
required_documents
caution_rules
```

복잡한 조건은 JSON column으로 저장하되, 검색과 ranking에 자주 쓰는 값은 별도 column으로 승격한다. 예를 들어 `noticeType`, `provider`, `sidoName`, `sigunguName`, `noticeDate`, `applicationStartDate`, `applicationEndDate`, `targetGroup`, `supplyMode`는 indexing 후보로 둔다.

## Evaluation Policy

- OpenAPI만 있는 공고는 검색/추천과 일정 안내에 사용한다.
- eligibility result는 evidence가 있는 rule과 사용자 입력이 만나는 범위에서만 강하게 계산한다.
- 소득, 자산, 자동차, 무주택, 세대구성처럼 공적자료 확인이 필요한 조건은 사용자 입력만으로 확정하지 않는다.
- extractionStatus가 `partial` 또는 `manual_review_recommended`이면 MCP 응답에 확인 필요 항목을 반드시 포함한다.
