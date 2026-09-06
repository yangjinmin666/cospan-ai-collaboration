export type Role = 'hardware' | 'design' | 'ai' | 'product' | 'growth' | 'safety';
export type Status = 'seeking' | 'recruiting' | 'support';
export interface Person {
  id: string; name: string; avatar: string; role: string; roleGroup: Role;
  skills: string[]; status: string; statusGroup: Status; distance: 1 | 2 | 3;
  proximity: string; hours: number; publicEvidence: boolean; evidence: string;
  reason: string; fit: string; bio: string; location: string; availability: string;
  collaboration: string; projects: { title: string; detail: string; tags: string[] }[];
}
export interface Filters {
  statuses: Status[]; roles: Role[]; minimumHours: number;
  distance: 'event' | 'nearby' | 'very_near'; evidenceRequired: boolean;
}
export const defaultFilters = (): Filters => ({ statuses: [], roles: [], minimumHours: 0, distance: 'event', evidenceRequired: false });
const copy = (value: Filters): Filters => ({ ...value, statuses: [...value.statuses], roles: [...value.roles] });
export function createFilterDraft() {
  return {
    applied: defaultFilters(), draft: defaultFilters(), visible: false,
    open() { this.draft = copy(this.applied); this.visible = true; },
    cancel() { this.draft = copy(this.applied); this.visible = false; },
    reset() { this.draft = defaultFilters(); },
    confirm() { this.applied = copy(this.draft); this.visible = false; },
  };
}
export function filterPeople(people: Person[], f: Filters): Person[] {
  return people.filter(p => (!f.statuses.length || f.statuses.includes(p.statusGroup))
    && (!f.roles.length || f.roles.includes(p.roleGroup)) && p.hours >= f.minimumHours
    && (f.distance === 'event' || p.distance >= (f.distance === 'very_near' ? 3 : 2))
    && (!f.evidenceRequired || p.publicEvidence));
}
