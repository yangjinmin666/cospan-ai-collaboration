<script setup lang="ts">
import type { Filters, Role, Status } from '../domain/discovery';
import UiIcon from './UiIcon.vue';
const props = defineProps<{ draft: Filters; count: number }>();
const emit = defineEmits<{ change: [Filters]; cancel: []; reset: []; confirm: [] }>();
const statuses: { value: Status; label: string }[] = [{ value: 'seeking', label: '正在找队伍' }, { value: 'recruiting', label: '团队正在招人' }, { value: 'support', label: '可交流／可支援' }];
const roles: { value: Role; label: string }[] = [{ value: 'hardware', label: '硬件／结构' }, { value: 'design', label: '设计／路演' }, { value: 'ai', label: 'AI／算法' }, { value: 'product', label: '产品／研究' }, { value: 'growth', label: '增长／运营' }, { value: 'safety', label: '安全／隐私' }];
const distances = [{ value: 'event', label: '整个会场' }, { value: 'nearby', label: '附近' }, { value: 'very_near', label: '很近' }] as const;
function toggle(group: 'roles' | 'statuses', value: string) {
  const items: string[] = [...props.draft[group]];
  const index = items.indexOf(value);
  if (index >= 0) items.splice(index, 1); else items.push(value);
  emit('change', { ...props.draft, [group]: items });
}
</script>
<template>
  <view class="overlay" role="dialog" aria-label="筛选偏好" aria-modal="true">
    <view class="backdrop" @tap="emit('cancel')" />
    <view class="sheet filter-sheet">
      <view class="sheet-heading"><button aria-label="取消筛选" class="round-back" @tap="emit('cancel')"><UiIcon name="back" /></button><text class="sheet-title">筛选偏好</text><button class="reset" @tap="emit('reset')">重置</button></view>
      <scroll-view class="filter-scroll" scroll-y>
        <view class="filter-section"><view class="section-heading"><text>协作状态</text><text class="muted">可多选</text></view><view class="chips"><button v-for="item in statuses" :key="item.value" :class="['chip', { selected: draft.statuses.includes(item.value) }]" :aria-pressed="draft.statuses.includes(item.value)" @tap="toggle('statuses', item.value)">{{ item.label }}</button></view></view>
        <view class="filter-section"><view class="section-heading"><text>需要的职能</text><text class="muted">可多选</text></view><view class="chips"><button v-for="item in roles" :key="item.value" :class="['chip', { selected: draft.roles.includes(item.value) }]" :aria-pressed="draft.roles.includes(item.value)" @tap="toggle('roles', item.value)">{{ item.label }}</button></view></view>
        <view class="filter-section"><view class="section-heading"><text>最低投入时间</text><text class="muted">本次活动</text></view><view class="segments"><button v-for="hours in [0,2,4,8]" :key="hours" :class="{ selected: draft.minimumHours === hours }" :aria-pressed="draft.minimumHours === hours" @tap="emit('change', { ...draft, minimumHours: hours })">{{ hours ? '≥ ' + hours + 'h' : '不限' }}</button></view></view>
        <view class="filter-section"><view class="section-heading"><text>现场范围</text><text class="muted">仅使用已授权距离</text></view><view class="segments"><button v-for="item in distances" :key="item.value" :class="{ selected: draft.distance === item.value }" :aria-pressed="draft.distance === item.value" @tap="emit('change', { ...draft, distance: item.value })">{{ item.label }}</button></view></view>
        <button class="evidence-switch" :aria-pressed="draft.evidenceRequired" @tap="emit('change', { ...draft, evidenceRequired: !draft.evidenceRequired })"><view><text class="block">只看有公开项目的人</text><text class="muted">先通过作品了解对方</text></view><view :class="['toggle', { on: draft.evidenceRequired }]"><view /></view></button>
        <text class="filter-summary">当前条件下 {{ count }} 位 · 不自动放宽筛选</text>
      </scroll-view>
      <view class="sheet-footer"><button class="secondary" @tap="emit('cancel')">取消</button><button class="primary" @tap="emit('confirm')">确认筛选</button></view>
    </view>
  </view>
</template>
<style scoped>
@import './sheet.css';
.filter-sheet { padding: 0 18px; }
.sheet-heading { display: flex; align-items: center; gap: 10px; padding: 12px 0 10px; border-bottom: 1px solid #dee3e9; }
.round-back { width: 44px; height: 44px; display: flex; justify-content: center; align-items: center; border: 1px solid #d8dfe7; border-radius: 50%; }
.sheet-title { flex: 1; font-size: 22px; font-weight: 750; letter-spacing: -.04em; }
.reset { min-width: 44px; min-height: 44px; font-size: 13px; color: #667483; }
.filter-scroll { height: min(62vh, 550px); }
.filter-section { padding: 19px 0; border-bottom: 1px solid #e7ebf0; }
.section-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-size: 14px; font-weight: 700; }
.section-heading .muted { font-size: 12px; font-weight: 400; }
.chips { display: flex; flex-wrap: wrap; gap: 7px; }
.chip { min-height: 44px; padding: 0 12px; border: 1px solid #d8dfe7; border-radius: 99px; background: #f8f9fb; color: #536170; font-size: 12px; display: flex; align-items: center; }
.chip.selected { border-color: #243342; background: #243342; color: white; }
.segments { display: flex; border-bottom: 1px solid #dde3ea; }
.segments button { flex: 1; min-height: 44px; border-bottom: 2px solid transparent; color: #687583; font-size: 13px; }
.segments .selected { border-bottom-color: var(--brand); color: var(--brand-deep); }
.evidence-switch { width: 100%; display: flex; justify-content: space-between; align-items: center; text-align: left; padding: 18px 0; font-size: 14px; }
.evidence-switch .muted { font-size: 12px; }
.toggle { width: 40px; height: 24px; padding: 3px; border-radius: 99px; background: #d8dfe7; }
.toggle view { width: 18px; height: 18px; border-radius: 50%; background: white; transition: transform .15s; }
.toggle.on { background: var(--brand); }.toggle.on view { transform: translateX(16px); }
.filter-summary { display: block; padding: 0 0 12px; color: var(--muted); font-size: 12px; }
</style>
