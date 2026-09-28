<!-- app\error.vue -->
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
      <h1 class="text-3xl font-bold text-gray-800 mb-2">
        {{ error?.statusCode || 'Ошибка' }}
      </h1>
      <p class="text-gray-600 mb-6">
        {{ error?.statusCode === 404 ? 'Страница не найдена' : 'Произошла ошибка' }}
      </p>
      <NuxtLink 
        to="/" 
        class="inline-block bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
      >
        На главную
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
const error = useError()
</script>
