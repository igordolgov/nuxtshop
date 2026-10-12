<!-- app/components/layout/MainContent.vue — контейнер контента.
    Плавающая кнопка фильтров (FAB) удалена: фильтры открываются
    кнопкой в Header (рядом с поиском) — один вход, без плавающего мусора. -->
<template lang="pug">
.flex-1.min-w-0.flex.flex-col
  slot
</template>