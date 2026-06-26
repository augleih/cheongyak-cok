const NOTICE_OPERATIONS = {
  public_rental: "rsdtRcritNtcList",
  public_sale: "ltRsdtRcritNtcList",
};

export function normalizeMyHomeOpenApiResponse(response, options) {
  const noticeType = options?.noticeType;
  const operation = NOTICE_OPERATIONS[noticeType];

  if (!operation) {
    throw new Error(`Unsupported MyHome noticeType: ${noticeType}`);
  }

  const header = response?.response?.header;
  if (header?.resultCode === "03") {
    return [];
  }

  if (header?.resultCode && header.resultCode !== "00") {
    throw new Error(`MyHome OpenAPI error ${header.resultCode}: ${header.resultMsg ?? ""}`);
  }

  return readItems(response).map((item) =>
    normalizeNoticeItem(item, noticeType, operation),
  );
}

function normalizeNoticeItem(item, noticeType, operation) {
  const sourceNoticeId = stringValue(item?.pblancId);
  const sourceUnitId = stringValue(item?.houseSn);

  if (!sourceNoticeId) {
    throw new Error("MyHome OpenAPI notice is missing pblancId");
  }

  const sourceNoticeGroupId = `myhome:${noticeType}:${sourceNoticeId}`;
  const id = sourceUnitId ? `${sourceNoticeGroupId}:${sourceUnitId}` : sourceNoticeGroupId;

  return removeUndefined({
    id,
    sourceNoticeGroupId,
    noticeType,
    source: removeUndefined({
      system: "myhome",
      contract: "data_go_kr_openapi",
      endpoint: "HWSPR02",
      operation,
      sourceNoticeId,
      sourceUnitId,
    }),
    title: stringValue(item?.pblancNm),
    provider: removeUndefined({
      name: stringValue(item?.suplyInsttNm),
    }),
    region: removeUndefined({
      sidoCode: stringValue(item?.brtcCode),
      sidoName: stringValue(item?.brtcCodeNm ?? item?.brtcNm),
      sigunguCode: stringValue(item?.signguCode),
      sigunguName: stringValue(item?.signguCodeNm ?? item?.signguNm),
    }),
    categories: removeUndefined({
      houseType: namedCode(item?.houseTy, item?.houseTyNm),
      supplyType: namedCode(item?.suplyTy, item?.suplyTyNm),
      leaseType: leaseType(item?.lfstsTyAt),
      monthlyRent: namedCode(item?.bassMtRntchrgSe, item?.bassMtRntchrgSeNm),
    }),
    dates: removeUndefined({
      noticeDate: yyyymmdd(item?.rcritPblancDe),
      winnerAnnouncementDate: yyyymmdd(item?.przwnerPresnatnDe),
      applicationStartDate: yyyymmdd(item?.beginDe),
      applicationEndDate: yyyymmdd(item?.endDe),
    }),
    status: removeUndefined({
      sourceLabel: stringValue(item?.prgrStts ?? item?.sttusNm),
    }),
    links: removeUndefined({
      sourceUrl: stringValue(item?.url),
      pcUrl: stringValue(item?.pcUrl),
      mobileUrl: stringValue(item?.mobileUrl),
    }),
    attachments: attachments(item),
  });
}

function readItems(response) {
  const body = response?.response?.body;
  return asArray(body?.items?.item ?? body?.item ?? body?.items);
}

function asArray(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function namedCode(code, name) {
  const normalizedCode = stringValue(code);
  const normalizedName = stringValue(name);

  if (!normalizedCode && !normalizedName) {
    return undefined;
  }

  return removeUndefined({
    code: normalizedCode,
    name: normalizedName,
  });
}

function leaseType(value) {
  const normalized = stringValue(value);

  if (!normalized) {
    return undefined;
  }

  return {
    isJeonseType: normalized.toUpperCase() === "Y",
  };
}

function attachments(item) {
  const fileId = stringValue(item?.atchFileId);
  const fileName = stringValue(item?.orginlFileNm);

  if (!fileId && !fileName) {
    return [];
  }

  return [
    removeUndefined({
      fileId,
      fileName,
    }),
  ];
}

function yyyymmdd(value) {
  const normalized = stringValue(value);

  if (!/^\d{8}$/.test(normalized)) {
    return normalized || undefined;
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
}

function stringValue(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}

function removeUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  );
}
