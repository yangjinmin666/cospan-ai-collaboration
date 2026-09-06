<script setup lang="ts">
withDefaults(defineProps<{ name: string; tone?: 'ink' | 'white' | 'blue' | 'muted' }>(), { tone: 'ink' });
</script>
<template><image class="ui-icon" :src="`/static/generated/${name}-${tone}.svg`" mode="aspectFit" aria-hidden="true" /></template>
<style scoped>.ui-icon { display: block; width: 24px; height: 24px; flex: 0 0 24px; }</style>
