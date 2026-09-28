// app\plugins\hydration.client.js
export default defineNuxtPlugin(() => {
  // Игнорируем ошибки гидратации в development режиме
  if (process.dev) {
    const originalWarn = console.warn
    console.warn = (...args) => {
      if (args[0] && args[0].includes('Hydration')) {
        return
      }
      originalWarn.apply(console, args)
    }
  }
})