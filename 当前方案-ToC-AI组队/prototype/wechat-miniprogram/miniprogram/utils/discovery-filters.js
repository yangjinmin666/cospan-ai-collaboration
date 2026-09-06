// Mobile Web's five filter groups, evaluated against authorized API fields only.
const defaults = () => ({ statuses: [], roles: [], minimumHours: 0, distance: "event", evidenceRequired: false });
const statusOptions = [
  { value: "seeking", label: "正在找队伍" }, { value: "recruiting", label: "团队正在招人" },
  { value: "support", label: "可交流／可支援" },
];
const roleOptions = [
  { value: "hardware", label: "硬件／结构" }, { value: "design", label: "设计／路演" },
  { value: "ai", label: "AI／算法" }, { value: "product", label: "产品／研究" },
  { value: "growth", label: "增长／运营" }, { value: "safety", label: "安全／隐私" },
];
const hourOptions = [0, 2, 4, 8].map(value => ({ value, label: value ? "≥ " + value + "h" : "不限" }));
const distanceOptions = [{ value: "event", label: "整个会场" }, { value: "nearby", label: "附近" }, { value: "very_near", label: "很近" }];
function copy(filters) { return { ...defaults(), ...filters, statuses: [...(filters.statuses || [])], roles: [...(filters.roles || [])] }; }
function statusFor(person) {
  if (/未组队|找队伍|正在找/.test(person.status || "")) return "seeking";
  if (/招人|急聘|团队缺人/.test(person.status || "")) return "recruiting";
  return "support";
}
function roleFor(person) {
  const text = (person.role || "") + " " + (person.skills || []).join(" ");
  if (/硬件|嵌入式|IoT|结构|工业|CMF|打样/i.test(text)) return "hardware";
  if (/设计|交互|视觉|品牌|创意|WebGL|路演|叙事/i.test(text)) return "design";
  if (/算法|Embedding|RAG|推荐|Agent|API|后端|AI/i.test(text)) return "ai";
  if (/安全|隐私|身份|风控|红队/i.test(text)) return "safety";
  if (/增长|社区|内容|裂变|运营/i.test(text)) return "growth";
  return "product";
}
function filterPeople(people, input) {
  const filters = copy(input);
  return people.filter(person => {
    // Legacy callers remain valid; the UI uses the five shared groups.
    if (filters.status && filters.status !== person.status) return false;
    if (filters.skill && !(person.skills || []).includes(filters.skill)) return false;
    if (filters.statuses.length && !filters.statuses.includes(statusFor(person))) return false;
    if (filters.roles.length && !filters.roles.includes(roleFor(person))) return false;
    const hours = String(person.availability || "").match(/(\d+(?:\.\d+)?)\s*(?:小?时|h)/i);
    if ((hours ? Number(hours[1]) : 0) < filters.minimumHours) return false;
    const band = person.distance?.band;
    if (filters.distance === "nearby" && !["under_50m", "under_200m"].includes(band)) return false;
    if (filters.distance === "very_near" && band !== "under_50m") return false;
    if (filters.evidenceRequired && !(person.evidence || []).some(item => String(item).trim()) && !(person.platform_links || []).length) return false;
    return true;
  });
}
function count(filters) {
  const f = copy(filters);
  return [f.statuses.length > 0, f.roles.length > 0, f.minimumHours > 0, f.distance !== "event", f.evidenceRequired].filter(Boolean).length;
}
module.exports = { defaults, copy, filterPeople, count, statusOptions, roleOptions, hourOptions, distanceOptions };
