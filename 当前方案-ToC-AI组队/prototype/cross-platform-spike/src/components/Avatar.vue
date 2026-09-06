<script setup lang="ts">
import { computed } from 'vue';
import positions from '../static/generated/avatar-positions.json';
const props = withDefaults(defineProps<{ avatar: string; size?: number }>(), { size: 90 });
const position = computed(() => positions[props.avatar as keyof typeof positions] || { left: 0, top: 0 });
</script>
<template><view :class="['avatar', avatar]" :style="{ width: size + 'px', height: size + 'px' }" aria-hidden="true"><image class="avatar-image" src="/static/generated/default-memoji-grid.jpg" mode="scaleToFill" :style="{ left: position.left + '%', top: position.top + '%' }" /></view></template>
<style scoped>.avatar { position: relative; flex-shrink: 0; overflow: hidden; border: 1px solid #dce2e9; border-radius: 50%; background-color: #fff; box-shadow: 0 8px 22px rgba(31,48,70,.1); }.avatar-image { position: absolute; display: block; width: 450%; height: 600%; }</style>
