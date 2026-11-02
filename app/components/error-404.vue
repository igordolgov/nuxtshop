<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-4xl font-bold">404</h1>
      <p class="text-xl">{{ $t('notFound.title') }}</p>
      <NuxtLink :to="$localePath('/')" class="text-blue-500 hover:underline">{{ $t('notFound.home') }}</NuxtLink>
    </div>
  </div>
</template>