# Eligibility Policy

청약콕은 청약 가능 여부를 확정하지 않는다. 사용자의 입력과 저장된 공고 조건을 기준으로 지원 가능성을 조심스럽게 평가하고, 확인이 필요한 항목을 함께 반환한다.

## Status

Eligibility status는 다음 네 값만 사용한다.

- `eligible`
- `maybe`
- `not_eligible`
- `unknown`

## Rule Engine First

- 최종 eligibility result는 구조화된 조건과 rule engine으로 계산한다.
- 공고 목록 API만으로 세부 자격을 확정하지 않는다.
- 소득, 자산, 자동차, 무주택, 세대 구성, 우선공급, 중복신청 제한, 제출서류는 원문 근거를 확인한다.
- 조건이 애매하거나 입력이 부족하면 `maybe` 또는 `unknown`으로 남긴다.

## LLM Role

- LLM은 source of truth가 아니다.
- LLM은 자연어 profile 정규화, 누락 질문 생성, 원문 조건 후보 추출, 사용자 설명 생성에만 사용한다.
- LLM이 추출한 조건은 schema, evidence, confidence, extraction status와 함께 저장한다.
- public MCP tool handler에서 LLM API를 직접 호출하지 않는다.

## Evidence

Eligibility result에는 `status`, `reason`, `evidence`, `needsConfirmation`을 포함한다.

Evidence는 가능한 한 다음 정보를 담는다.

- `sourceName`
- `noticeId`
- `noticeVersion`
- `documentUrl`
- `section`
- `excerpt`
- `confidence`
- `extractedAt`

## Privacy

- V0에서는 OAuth를 사용하지 않는다.
- V0에서는 사용자 profile을 서버에 저장하지 않는다.
- 주민등록번호, 로그인 정보, 인증서 정보, 계좌 정보, 정확한 소득/자산 금액은 저장하지 않는다.
- 사용자의 조건은 tool input으로 받아 즉시 판정에만 사용한다.
