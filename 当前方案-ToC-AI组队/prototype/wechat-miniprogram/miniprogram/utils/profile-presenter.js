const PLATFORM_LABELS = Object.freeze({
  website: "个人网站",
  github: "GitHub",
  xiaohongshu: "小红书",
});

function authorizationPresentation(profile, field) {
  const authorized = new Set(profile?.visibility?.public_fields || []).has(field);
  if (!authorized) return { authorized: false, authorizationLabel: "未公开" };
  return {
    authorized: true,
    authorizationLabel: profile?.visibility?.state === "VISIBLE"
      ? "已授权公开"
      : "已授权 · 当前暂停",
  };
}

function buildProfileBlocks(profile, platformLinks = []) {
  const evidenceAuthorization = authorizationPresentation(profile, "evidence");
  const evidenceBlocks = (Array.isArray(profile?.evidence) ? profile.evidence : [])
    .filter(Boolean)
    .map((title, index) => ({
      id: `evidence-${index}`,
      mark: "证",
      kicker: "PROJECT / EVIDENCE",
      title,
      detail: "已收录的协作证据",
      ...evidenceAuthorization,
    }));
  const platformAuthorization = authorizationPresentation(profile, "platform_links");
  const linkBlocks = (Array.isArray(platformLinks) ? platformLinks : [])
    .filter((item) => item?.url)
    .map((item, index) => ({
      id: `platform-${item.platform || "other"}-${index}`,
      mark: item.platform === "github" ? "GH" : "链",
      kicker: "AUTHORIZED PLATFORM",
      title: PLATFORM_LABELS[item.platform] || item.platform || "公开主页",
      detail: item.url,
      ...platformAuthorization,
    }));
  return [...evidenceBlocks, ...linkBlocks];
}

module.exports = {
  buildProfileBlocks,
};
