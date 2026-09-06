<script setup lang="ts">
import { computed, reactive, ref, onMounted, onUnmounted } from 'vue';
import { onHide } from '@dcloudio/uni-app';
import { createFilterDraft, filterPeople } from '../../domain/discovery';
import { createDeck, type Direction, type DeckResult } from '../../domain/deck';
import { demoPeople, createDemoRequests } from '../../adapters/demo';
import { createAudio } from '../../adapters/audio';
import UiIcon from '../../components/UiIcon.vue';
import Avatar from '../../components/Avatar.vue';
import FilterSheet from '../../components/FilterSheet.vue';
import PersonSheet from '../../components/PersonSheet.vue';

const filters = reactive(createFilterDraft()), requests = reactive(createDemoRequests());
const deck = reactive(createDeck({ sendInterest: id => requests.sendInterest(id), wait: ms => new Promise(r => setTimeout(r, ms)) }));
const index = ref(0), detail = ref(false), expanded = ref(false), scopeOpen = ref(false), labOpen = ref(false);
const message = ref(''), platformTop = ref(0), sheetTop = ref(12), mini = ref(false), sound = createAudio();
const pool = computed(() => filterPeople(demoPeople, filters.applied));
const person = computed(() => pool.value[index.value % pool.value.length]);
const nextPerson = computed(() => pool.value[(index.value + 1) % pool.value.length]);
const count = computed(() => filterPeople(demoPeople, filters.draft).length);
const hasOverlay = computed(() => filters.visible || detail.value || scopeOpen.value || labOpen.value);
const nav = [{ name: 'discover', label: '发现' }, { name: 'connections', label: '连接' }, { name: 'collaboration', label: '协作' }, { name: 'profile', label: '我的' }];
const cardStyle = computed(() => ({
  transform: deck.direction ? `translateX(${deck.direction === 'right' ? 125 : -125}%) rotate(${deck.direction === 'right' ? 12 : -12}deg)` : `translateX(${deck.x}px) rotate(${Math.max(-12, Math.min(12, deck.x * .035))}deg)`,
  opacity: deck.direction ? 0 : 1,
  transition: deck.dragging ? 'none' : 'transform .2s ease, opacity .2s ease',
}));
let timer: ReturnType<typeof setTimeout> | undefined, lastTouch = 0;
type InputEvent = { type?: string; clientX?: number; clientY?: number; touches?: ArrayLike<{ clientX: number; clientY: number }> };
function point(e: InputEvent) {
  if (e.type?.startsWith('touch')) lastTouch = Date.now();
  else if (Date.now() - lastTouch < 700) return null;
  return e.touches?.[0] || (typeof e.clientX === 'number' ? { clientX: e.clientX, clientY: e.clientY || 0 } : null);
}
function start(e: InputEvent) { const p = point(e); if (p && !hasOverlay.value) { sound.prime(); deck.start(p.clientX, p.clientY); } }
function move(e: InputEvent) { const p = point(e); if (p) deck.move(p.clientX, p.clientY); }
function tell(text: string) { message.value = text; if (timer) clearTimeout(timer); timer = setTimeout(() => { message.value = ''; }, 3200); }
function handleResult(result: DeckResult) {
  if (result === 'details') { detail.value = true; expanded.value = false; }
  if (result === 'next') { index.value++; tell('示例操作完成 · 未向真实用户发送请求'); }
  if (result === 'failed') tell(deck.error);
}
async function end(e: InputEvent) {
  if (!point(e) && !e.type?.startsWith('touch')) return;
  if (!person.value || !deck.dragging) return;
  if (deck.axis === 'x' && Math.abs(deck.x) >= 72) sound.play(deck.x > 0 ? 'right' : 'left');
  handleResult(await deck.end(person.value.id));
}
async function choose(direction: Direction) {
  if (!person.value || deck.busy) return;
  detail.value = false; sound.play(direction);
  handleResult(await deck.commit(direction, person.value.id));
}
function cancel() { if (!deck.busy) deck.reset(); }
function openFilters() { if (!deck.busy) filters.open(); }
function confirmFilters() { filters.confirm(); index.value = 0; deck.reset(); }
function back(): boolean {
  if (labOpen.value) labOpen.value = false;
  else if (scopeOpen.value) scopeOpen.value = false;
  else if (filters.visible) filters.cancel();
  else if (detail.value && expanded.value) expanded.value = false;
  else if (detail.value) detail.value = false;
  else return false;
  return true;
}
function keyboard(e: { key: string; preventDefault(): void }) {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); void choose(e.key === 'ArrowLeft' ? 'left' : 'right'); }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); detail.value = true; }
}
const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') back(); };
onMounted(() => {
  // #ifdef MP-WEIXIN
  mini.value = true;
  const capsule = uni.getMenuButtonBoundingClientRect();
  platformTop.value = Math.max(uni.getWindowInfo().statusBarHeight || 24, capsule.top - 2);
  sheetTop.value = capsule.bottom + 8;
  // #endif
  // #ifdef H5
  const host = window as Window & { RallyApp?: { handleBack: () => boolean } };
  host.RallyApp = { handleBack: back };
  window.addEventListener('keydown', escape);
  // #endif
});
onHide(() => { sound.suspend(); cancel(); });
onUnmounted(() => {
  sound.dispose(); if (timer) clearTimeout(timer);
  // #ifdef H5
  window.removeEventListener('keydown', escape);
  delete (window as Window & { RallyApp?: unknown }).RallyApp;
  // #endif
});
</script>

<template>
  <view :class="['app', { 'is-mini': mini }]" :style="{ '--platform-top': platformTop + 'px', '--sheet-top': sheetTop + 'px' }">
    <view class="main">
      <view class="header">
        <button class="filter-trigger" aria-label="打开筛选" :disabled="deck.busy" @tap="openFilters"><UiIcon name="filter" /></button>
        <view v-if="!mini" class="brand"><text class="brand-name">COSPAN</text><text class="brand-caption">合拍 · 发现</text></view>
        <button class="scope-trigger" aria-label="当前范围" @tap="scopeOpen = true"><UiIcon name="event" /><view><text class="muted block">当前范围</text><text class="scope-name">She Nicest 2026</text></view></button>
      </view>
      <view class="tabs"><button class="active">推荐</button><button @tap="tell('此小样验证推荐卡片，附近定位尚未迁入')">附近</button><button @tap="tell('此小样验证推荐卡片，名册尚未迁入')">名册</button></view>
      <view class="intro"><view><text class="muted block">为你的项目推荐</text><text class="need">共同发起者 × 1</text></view><text class="counter">{{ pool.length ? (index % pool.length) + 1 : 0 }} / {{ pool.length }}</text></view>
      <view v-if="person" class="deck">
        <view class="card next-card" aria-hidden="true"><Avatar :avatar="nextPerson.avatar" :size="64" /></view>
        <view :key="person.id" class="card active-card" :style="cardStyle" tabindex="0" role="button" :aria-label="person.name + '，点击看详情，左右滑动表达意愿'" @touchstart="start" @touchmove="move" @touchend="end" @touchcancel="cancel" @mousedown="start" @mousemove="move" @mouseup="end" @mouseleave="cancel" @keydown="keyboard">
          <view class="card-head"><text class="status"><text class="dot" />{{ person.status }}</text><text class="muted">{{ person.proximity }}</text></view>
          <view class="identity"><Avatar :avatar="person.avatar" /><view><text class="name">{{ person.name }}</text><text class="role">{{ person.role }}</text></view></view>
          <view class="skills"><text v-for="skill in person.skills" :key="skill">{{ skill }}</text></view>
          <view class="evidence"><text class="muted block">做过什么</text><text class="evidence-copy">{{ person.evidence }}</text></view>
          <view class="reason"><text class="muted block">为什么值得聊</text><text class="reason-copy">{{ person.reason }}</text></view>
          <view class="card-foot"><text>点击查看完整信息</text><text class="fit">{{ person.fit }}</text></view>
          <view v-if="deck.x !== 0" :class="['verdict', deck.x > 0 ? 'yes' : 'no']" :style="{ opacity: Math.min(Math.abs(deck.x) / 90, 1) }">{{ deck.x > 0 ? '想认识' : '暂不看' }}</view>
        </view>
      </view>
      <view v-else class="empty"><text>当前筛选下暂无推荐结果</text><text class="muted">不会自动放宽你的筛选条件</text><button class="primary" @tap="openFilters">调整筛选</button></view>
      <view class="actions">
        <button aria-label="暂不看" :disabled="!person || deck.busy" @tap="choose('left')"><view class="circle"><UiIcon name="close" /></view><text>暂不看</text></button>
        <button aria-label="看详情" :disabled="!person || deck.busy" @tap="detail = true; expanded = false"><view class="circle"><UiIcon name="details" /></view><text>看详情</text></button>
        <button aria-label="想认识" :disabled="!person || deck.busy" @tap="choose('right')"><view class="circle like"><UiIcon name="wave" tone="white" /></view><text>想认识</text></button>
      </view>
      <button class="lab-link" @tap="labOpen = true">跨端验证 · 示例数据 · 不发送真实请求</button>
    </view>
    <view v-if="!hasOverlay" class="bottom-nav"><button v-for="item in nav" :key="item.name" :class="{ selected: item.name === 'discover' }" @tap="item.name !== 'discover' && tell('本次只迁移发现切片，其他页面请继续使用原版')"><UiIcon :name="item.name" :tone="item.name === 'discover' ? 'blue' : 'muted'" /><text>{{ item.label }}</text></button></view>
    <FilterSheet v-if="filters.visible" :draft="filters.draft" :count="count" @change="filters.draft = $event" @cancel="filters.cancel()" @reset="filters.reset()" @confirm="confirmFilters" />
    <PersonSheet v-if="detail && person" :person="person" :expanded="expanded" :busy="deck.busy" @expand="expanded = $event" @close="detail = false; expanded = false" @interest="choose('right')" />
    <view v-if="scopeOpen" class="overlay" role="dialog" aria-label="发现范围"><view class="backdrop" @tap="scopeOpen = false" /><view class="sheet compact"><text class="sheet-title">你想在哪里发现人？</text><view class="scope-option"><UiIcon name="event" /><view><text class="block">She Nicest 2026</text><text class="muted">本次小样使用原 Web 的展会示例名单</text></view></view><text class="muted">附近定位尚未迁入，不会显示虚假定位结果。</text><button class="primary" @tap="scopeOpen = false">返回推荐</button></view></view>
    <view v-if="labOpen" class="overlay" role="dialog" aria-label="验证说明"><view class="backdrop" @tap="labOpen = false" /><view class="sheet compact"><text class="sheet-title">跨端验证，不是正式版本</text><text class="body-copy">共用一套发现、筛选和详情源码。人物来自原 Web 的示例数据；本页不读取账号、不连接生产后端。</text><text class="body-copy">本次示例认识操作：{{ requests.sent.length }} 位</text><button class="secondary" @tap="requests.failNext = true; labOpen = false; tell('下一次想认识会模拟失败，验证卡片恢复')">模拟下一次请求失败</button><button class="secondary" @tap="sound.enabled = !sound.enabled; tell(sound.enabled ? '音效已开启' : '音效已关闭')">切换滑卡音效</button><button class="primary" @tap="labOpen = false">返回验证</button></view></view>
    <view v-if="message" class="toast" role="status">{{ message }}</view>
  </view>
</template>

<style>
.app { position: relative; width: 100%; max-width: 430px; height: 100vh; height: 100dvh; margin: auto; overflow: hidden; background: #fff; }
.main { height: calc(100% - 100px - env(safe-area-inset-bottom)); padding: max(22px, var(--platform-top)) 18px 0; display: grid; grid-template-rows: 44px 44px 40px minmax(0,1fr) 70px 22px; gap: 8px; }
.header { display: flex; align-items: center; gap: 10px; }.filter-trigger { width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 1px solid #d8dfe7; border-radius: 15px; }.brand { flex: 1; }.brand-name { display: block; font-size: 23px; font-weight: 750; letter-spacing: -.06em; line-height: 1; }.brand-caption { display: block; font-size: 11px; color: #74818e; font-weight: 650; margin-top: 5px; }
.scope-trigger { display: flex; align-items: center; gap: 7px; height: 44px; width: 142px; min-width: 0; padding: 5px 9px; border: 1px solid #d8dfe7; border-radius: 16px; text-align: left; font-size: 12px; }.scope-trigger>view { min-width: 0; }.scope-name { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 700; }.is-mini .header { justify-content: flex-start; }
.muted { color: var(--muted); }.block { display: block; }.tabs { display: flex; border-bottom: 1px solid #dce3eb; }.tabs button { flex: 1; min-height: 44px; position: relative; font-size: 14px; font-weight: 650; color: #7a8695; }.tabs .active { color: var(--brand-deep); }.tabs .active::before { content: ''; position: absolute; bottom: -1px; width: 30px; height: 2px; background: var(--brand); left: calc(50% - 15px); border-radius: 3px; }
.intro { display: flex; align-items: center; justify-content: space-between; padding: 0 2px; font-size: 12px; }.need { font-size: 14px; font-weight: 700; }.counter { color: #7b8794; font-size: 11px; font-family: monospace; }
.deck { position: relative; width: 100%; max-height: 410px; min-height: 0; }.card { position: absolute; inset: 0; border: 1px solid #d7dee7; border-radius: 30px; background: white; overflow: hidden; }.next-card { inset: 9px 13px -8px; display: flex; align-items: center; justify-content: center; background: #eef1f5; box-shadow: 0 10px 24px rgba(31,48,70,.08); transform: scale(.975); }.next-card .avatar { opacity: .18; filter: grayscale(1); }
.active-card { display: flex; flex-direction: column; padding: 16px; z-index: 2; box-shadow: 0 20px 46px rgba(31,48,70,.15); touch-action: pan-y; user-select: none; overflow-y: auto; scrollbar-width: none; }.active-card::-webkit-scrollbar { display: none; }
.card-head { display: flex; align-items: center; justify-content: space-between; font-size: 12px; }.status { display: flex; align-items: center; gap: 6px; border-radius: 99px; padding: 6px 9px; color: #207a52; background: #eaf7f0; font-weight: 650; }.dot { width: 5px; height: 5px; background: #207a52; border-radius: 50%; }
.identity { display: flex; align-items: center; gap: 14px; margin: 17px 0 12px; }.name { display: block; font-size: 28px; font-weight: 750; line-height: 1; letter-spacing: -.055em; }.role { display: block; margin-top: 6px; color: #667483; font-size: 14px; }.skills { display: flex; flex-wrap: wrap; gap: 6px; }.skills text { padding: 6px 9px; border: 1px solid #dce2e9; border-radius: 99px; background: #f7f8fa; color: #42505f; font-size: 12px; font-weight: 650; }
.evidence { margin-top: 14px; padding: 12px 13px; border-left: 3px solid var(--brand); border-radius: 3px 14px 14px 3px; background: #f3f6fa; }.evidence .muted, .reason .muted { font-size: 11px; margin-bottom: 5px; }.evidence-copy { font-size: 14px; font-weight: 700; line-height: 1.5; }.reason { margin-top: 13px; }.reason-copy { font-size: 14px; line-height: 1.5; color: #354250; }.card-foot { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 11px; border-top: 1px solid #e5e9ee; font-size: 11px; color: #8a949f; }.fit { padding: 5px 8px; border-radius: 9px; color: var(--brand-deep); background: var(--brand-soft); font-size: 12px; font-weight: 650; }
.verdict { position: absolute; top: 32px; padding: 7px 10px; border: 2px solid currentColor; border-radius: 10px; background: #fffffff0; font-size: 14px; font-weight: 800; pointer-events: none; }.verdict.yes { left: 20px; color: var(--brand-deep); transform: rotate(-7deg); }.verdict.no { right: 20px; color: #596572; transform: rotate(7deg); }
.actions { display: flex; justify-content: center; gap: 21px; align-items: flex-end; }.actions button { width: 62px; display: flex; flex-direction: column; gap: 4px; align-items: center; font-size: 11px; color: #778391; }.circle { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border: 1px solid #d9e0e8; border-radius: 50%; background: white; box-shadow: 0 8px 20px rgba(31,48,70,.1); }.circle.like { background: var(--brand); border-color: var(--brand); }
.lab-link { font-size: 10px; color: #7b8794; line-height: 22px; height: 22px; }.bottom-nav { position: absolute; left: 16px; right: 16px; bottom: max(16px, env(safe-area-inset-bottom)); height: 74px; display: flex; align-items: center; padding: 8px; border: 1px solid #e0e5eb; border-radius: 25px; background: #f7f8fa; box-shadow: 0 8px 16px rgba(31,48,70,.18); }.bottom-nav button { flex: 1; display: flex; align-items: center; flex-direction: column; gap: 3px; font-size: 11px; font-weight: 650; color: #87928d; }.bottom-nav .selected { color: var(--brand); }
.overlay { position: fixed; z-index: 30; inset: 0; display: flex; align-items: flex-end; justify-content: center; }.backdrop { position: absolute; inset: 0; background: rgba(20,28,38,.3); backdrop-filter: blur(8px); }.sheet { position: relative; width: 100%; max-width: 430px; max-height: calc(100dvh - var(--platform-top,12px)); display: flex; flex-direction: column; border-radius: 30px 30px 0 0; background: white; overflow: hidden; color: var(--ink); }.sheet-footer { display: flex; gap: 8px; flex-shrink: 0; padding: 12px 0 calc(18px + env(safe-area-inset-bottom)); border-top: 1px solid #e1e6ec; }.primary, .secondary { min-height: 48px; padding: 12px 16px; font-size: 14px; font-weight: 650; border-radius: 14px; text-align: center; }.primary { background: var(--brand); color: white; }.secondary { border: 1px solid #d8dfe7; background: #fff; }.sheet-footer .primary { flex: 1; }.sheet-footer .secondary { min-width: 76px; }.compact { padding: 22px; gap: 18px; }.sheet-title { font-size: 22px; font-weight: 700; }.compact .muted { font-size: 13px; }.body-copy { font-size: 14px; line-height: 1.6; }.scope-option { display: flex; align-items: center; gap: 14px; padding: 14px; border: 1px solid #d8dfe7; border-radius: 20px; }.empty { display: flex; flex-direction: column; gap: 16px; justify-content: center; text-align: center; font-size: 17px; }.empty .muted { font-size: 13px; }.toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: 110px; z-index: 50; max-width: 340px; width: max-content; padding: 12px 16px; background: #243342; color: white; font-size: 13px; border-radius: 12px; }
@media (max-height: 740px) { .main { padding-top: max(12px, var(--platform-top)); gap: 5px; grid-template-rows: 44px 44px 34px minmax(0,1fr) 66px 20px; }.identity { margin: 9px 0; }.identity .avatar { width: 64px!important; height: 64px!important; }.evidence { margin-top: 8px; padding: 8px 10px; }.reason { margin-top: 8px; }.card-foot { padding-top: 6px; } }
@media (prefers-reduced-motion: reduce) { .active-card { transition: none!important; } }
.tabs button { display: flex; align-items: center; justify-content: center; }
.dot { display: inline-block; }
.is-mini .identity { margin: 12px 0 9px; }
</style>
