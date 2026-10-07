/** @type {import('tailwindcss').Config} */
module.exports = {
  // Указываем правильные пути для Nuxt 4 (папка app)
  content: [
    "./app/components/**/*.{js,vue,ts}",
    "./app/layouts/**/*.vue",
    "./app/pages/**/*.vue",
    "./app/app.vue",
    "./app/error.vue",
  ],

  darkMode: 'media', // Или 'class', если хотите переключатель темы

  theme: {
    extend: {
      colors: {
        // Ваши кастомные цвета
        sliderTrack: '#7c146bff',
        sliderThumb: '#1f2937',
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        base: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        }
      }
    },
  },
  plugins: [
    require('daisyui'), // Просто подключаем плагин
    // require('@tailwindcss/forms'), // Если нужен, установите: npm i -D @tailwindcss/forms
    // require('@tailwindcss/typography'),
  ],
}