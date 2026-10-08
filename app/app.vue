<template lang="pug">
.min-h-screen.flex.flex-col
  OfflineIndicator(show-banner)
  NuxtLayout
    NuxtPage
  InstallPrompt
</template>

<script setup>
// useOffline теперь singleton, но вызывать его в app.vue всё равно не нужно:
// OfflineIndicator сам его вызовет, и стейт будет общий.
</script>