import fixtures from '../static/generated/fixtures.json';
import type { Person, Role, Status } from '../domain/discovery';
function roleGroup(text: string): Role {
  if (/硬件|嵌入式|IoT|结构|工业|CMF|打样/i.test(text)) return 'hardware';
  if (/交互|视觉|品牌|创意|WebGL|路演|叙事/i.test(text)) return 'design';
  if (/算法|Embedding|RAG|推荐|Agent|API|后端|AI/i.test(text)) return 'ai';
  if (/安全|隐私|身份|风控|红队/i.test(text)) return 'safety';
  if (/增长|社区|内容|裂变|运营/i.test(text)) return 'growth';
  return 'product';
}
export const demoPeople: Person[] = fixtures.records.map(p => {
  const id = p.id as keyof typeof fixtures.profiles;
  const profile = fixtures.profiles[id];
  return { ...p, ...profile, hours: fixtures.hours[id], publicEvidence: !!p.evidence,
    roleGroup: roleGroup(`${p.role} ${p.skills.join(' ')} ${p.teamRole}`),
    statusGroup: (/未组队|找队伍|正在找/.test(p.status) ? 'seeking' : /招人|急聘|团队缺人/.test(p.status) ? 'recruiting' : 'support') as Status,
    distance: p.signal as 1 | 2 | 3,
  };
});
// Deliberately no network, token import or production endpoint in this isolated visual spike.
export function createDemoRequests() {
  return { failNext: false, sent: [] as string[], async sendInterest(id: string) {
    if (this.failNext) { this.failNext = false; throw new Error('模拟网络失败，仍保留当前卡片，请重试'); }
    if (!this.sent.includes(id)) this.sent.push(id);
  } };
}
