// Only present fields already authorized by the discovery API.
function buildPersonDetail(person = {}, scope = "event") {
  const texts = values => Array.isArray(values) ? values.filter(v => typeof v === "string" && v.trim()) : [];
  const evidence = texts(person.evidence);
  return {
    bio: person.collaboration_need || "这位参与者没有授权公开个人简介。",
    location: scope === "nearby" ? "日常附近" : "本场展会",
    availability: person.availability || "投入时间未公开",
    collaboration: texts(person.collaboration_preferences).join("、") || "协作偏好未公开",
    projects: evidence.map((detail, i) => ({ number: String(i + 1).padStart(2, "0"), title: "公开证据 " + (i + 1), detail })),
    evidence: evidence.join("\n") || "尚未公开能力证据。",
    reason: texts(person.recommendation?.reasons).join("；") || "暂无推荐参考。",
    caution: person.recommendation?.needs_confirmation || "具体投入时间和分工仍需当面确认。",
    fit: texts(person.recommendation?.ranking_factors)[0] || "同场协作",
    fitDetail: person.recommendation?.generated_by === "RULE_FALLBACK" ? "规则推荐" : "公开资料",
  };
}
module.exports = { buildPersonDetail };
