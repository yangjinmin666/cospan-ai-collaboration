<script setup lang="ts">
import { ref } from 'vue';
import type { Person } from '../domain/discovery';
import Avatar from './Avatar.vue';
import UiIcon from './UiIcon.vue';
defineProps<{ person: Person; expanded: boolean; busy: boolean }>();
const emit = defineEmits<{ expand: [boolean]; close: []; interest: [] }>();
const start = ref<{ x: number; y: number } | null>(null);
function touchStart(e: { touches: ArrayLike<{ clientX: number; clientY: number }> }) {
  const p = e.touches[0]; if (p) start.value = { x: p.clientX, y: p.clientY };
}
function touchEnd(e: { changedTouches: ArrayLike<{ clientX: number; clientY: number }> }) {
  const p = e.changedTouches[0], s = start.value; start.value = null;
  if (!p || !s) return;
  const dx = p.clientX - s.x, dy = p.clientY - s.y;
  if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy)) emit('close');
  else if (dy < -40) emit('expand', true);
  else if (dy > 40) emit('expand', false);
}
</script>
<template>
  <view class="overlay" role="dialog" aria-label="人物详情" aria-modal="true">
    <view class="backdrop" @tap="emit('close')" />
    <view :class="['sheet', 'person-sheet', { expanded }]">
      <view class="drag-zone" @touchstart="touchStart" @touchend="touchEnd"><view class="handle" /><view class="detail-nav"><text>{{ expanded ? '个人资料' : '人物详情' }}</text><button aria-label="关闭详情" @tap="emit('close')"><UiIcon name="close" /></button></view></view>
      <scroll-view class="person-scroll" scroll-y>
        <view class="person-head"><Avatar :avatar="person.avatar" :size="70" /><view class="person-identity"><text class="pill">{{ person.status }}</text><text class="detail-name">{{ person.name }}</text><text class="muted detail-role">{{ person.role }} · {{ person.proximity }}</text></view><text class="fit">{{ person.fit }}</text></view>
        <view class="skills"><text v-for="skill in person.skills" :key="skill">{{ skill }}</text></view>
        <view class="bio"><view class="section-heading"><text>本人简介</text><text class="muted">原文</text></view><text class="body-copy">{{ person.bio }}</text></view>
        <button class="expand-cue" @tap="emit('expand', !expanded)"><view><text class="muted block">{{ expanded ? '完整资料' : '继续上滑' }}</text><text>{{ expanded ? '点击收起完整资料' : '查看过往项目与全部资料' }}</text></view><text>{{ expanded ? '−' : '↑' }}</text></button>
        <view v-if="expanded" class="full-profile">
          <view class="facts"><view><text class="muted block">所在地</text><text>{{ person.location }}</text></view><view><text class="muted block">可投入时间</text><text>{{ person.availability }}</text></view></view>
          <view class="profile-section"><text class="section-title">过往项目</text><view v-for="project in person.projects" :key="project.title" class="project"><text class="project-title">{{ project.title }}</text><text class="body-copy">{{ project.detail }}</text><view class="skills"><text v-for="tag in project.tags" :key="tag">{{ tag }}</text></view></view></view>
          <view class="profile-section"><text class="section-title">协作方式</text><text class="body-copy">{{ person.collaboration }}</text></view>
          <view class="profile-section"><text class="section-title">能力证据</text><text class="body-copy">{{ person.evidence }}</text></view>
          <view class="profile-section"><text class="section-title">系统推荐参考</text><text class="body-copy">{{ person.reason }}</text></view>
        </view>
      </scroll-view>
      <view class="sheet-footer"><button class="secondary" @tap="emit('close')">返回</button><button class="primary" :disabled="busy" @tap="emit('interest')">{{ busy ? '正在处理' : '想认识' }}</button></view>
    </view>
  </view>
</template>
<style scoped>
@import './sheet.css';
.person-sheet { height: min(76vh,680px); padding: 0 20px; transition: height .3s cubic-bezier(.2,.9,.22,1); }
.person-sheet.expanded { height: calc(100dvh - var(--sheet-top, 12px)); border-radius: 0; }
.drag-zone { flex-shrink: 0; padding-top: 10px; touch-action: none; }
.handle { width: 34px; height: 4px; border-radius: 99px; background: #d8dfe7; margin: 0 auto; }
.detail-nav { display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 700; }
.detail-nav button { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; }
/* #ifdef MP-WEIXIN */
.detail-nav { flex-direction: row-reverse; justify-content: flex-end; gap: 8px; }
/* #endif */
.person-scroll { flex: 1; height: 0; min-height: 0; }
.person-head { display: flex; gap: 12px; align-items: center; padding: 8px 0 14px; }
.person-identity { flex: 1; min-width: 0; }.detail-name { display: block; font-size: 28px; font-weight: 750; line-height: 1.3; }.detail-role { display: block; font-size: 12px; }.pill { font-size: 12px; }
.fit { max-width: 64px; font-size: 11px; color: var(--brand-deep); padding: 7px; background: var(--brand-soft); border-radius: 11px; }
.skills { display: flex; gap: 6px; flex-wrap: wrap; }.skills text { padding: 5px 9px; background: #f4f6f8; border: 1px solid #e0e5eb; border-radius: 99px; font-size: 12px; }
.bio { margin: 16px 0; padding: 14px; background: var(--profile-fact-surface); border-radius: 16px; }
.section-heading { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; }
.body-copy { display: block; font-size: 14px; line-height: 1.65; color: #354250; }
.expand-cue { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 14px 0; border-top: 1px solid #e7ebf0; text-align: left; font-size: 14px; }.expand-cue .muted { font-size: 12px; }
.facts { display: flex; gap: 8px; margin: 10px 0 20px; }.facts view { flex: 1; padding: 12px; border-radius: 12px; background: var(--profile-fact-surface); font-size: 13px; }.facts .muted { font-size: 12px; margin-bottom: 5px; }
.profile-section { margin-bottom: 16px; padding: 14px; background: var(--profile-fact-surface); border-radius: 14px; }.section-title { display: block; font-size: 17px; font-weight: 700; margin-bottom: 10px; }.project + .project { margin-top: 14px; padding-top: 14px; border-top: 1px solid #dde3ea; }.project-title { display: block; font-size: 14px; font-weight: 700; margin-bottom: 6px; }.project .skills { margin-top: 8px; }
</style>
