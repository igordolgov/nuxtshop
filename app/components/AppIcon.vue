<!-- app/components/AppIcon.vue -->
<!-- Инлайн-SVG иконки — полная замена клиентского рантайма @nuxt/icon
     (чанк ~33 КБ transfer с eager-фетчем на t≈230 мс, 90 процентов
     неиспользуемого кода по Lighthouse; см. миграцию: ProductCardGrid/ProductImageActions
     перешли на инлайн-SVG раньше, это последний шаг — модуль снят совсем).
     Bodies — ТОЧНЫЕ данные @iconify-json/mdi и @iconify-json/heroicons
     (сгенерировано scripts-генератором по icons.json, без ручного
     копирования); каждый body самодостаточен: fill/stroke внутри
     (mdi — fill="currentColor", heroicons outline — stroke="currentColor").
     API совместим с прежним <Icon>: name + size (по умолчанию 24),
     классы и :class падают на <svg> через inheritAttrs.
    heroicons:shield-user не существует (not_found даже в API iconify —
     иконка на дашборде админки молча не рендерилась), заменён на
     heroicons:shield-check. Новая иконка = новая запись в ICONS.

     ⚠️ Шаблон — ОБЫЧНЫЙ HTML, не pug: pug лоуэркейсит имена атрибутов
     (:viewBox → viewbox), HTML-парсер чинит это только при SSR-загрузке,
     а при SPA-навигации createElementNS + setAttribute('viewbox') не даёт
     SVG-вьюбокс (регистрозависим в DOM) — иконка ломается на клиенте. -->
<template>
  <svg
    class="AppIcon"
    :width="size"
    :height="size"
    :viewBox="viewBox"
    aria-hidden="true"
    v-html="body"
  />
</template>

<script setup>
import { computed } from 'vue'

//- name → { body, w, h }: body — внутренности <svg> из @iconify-json
const ICONS = {
  'mdi:close': { body: '<path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"/>', w: 24, h: 24 },
  'mdi:download': { body: '<path fill="currentColor" d="M5 20h14v-2H5m14-9h-4V3H9v6H5l7 7z"/>', w: 24, h: 24 },
  'mdi:alert-circle': { body: '<path fill="currentColor" d="M13 13h-2V7h2m0 10h-2v-2h2M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2"/>', w: 24, h: 24 },
  'mdi:wifi-off': { body: '<path fill="currentColor" d="M2.28 3L1 4.27l1.47 1.47c-.43.26-.86.55-1.27.86L3 9c.53-.4 1.08-.75 1.66-1.07l2.23 2.23c-.74.34-1.45.75-2.09 1.24l1.8 2.4c.78-.58 1.66-1.03 2.6-1.33L11.75 15c-1.25.07-2.41.5-3.35 1.2L12 21l2.46-3.27L17.74 21L19 19.72M12 3c-2.15 0-4.2.38-6.1 1.07l2.39 2.4C9.5 6.16 10.72 6 12 6c3.38 0 6.5 1.11 9 3l1.8-2.4C19.79 4.34 16.06 3 12 3m0 6c-.38 0-.75 0-1.12.05l3.19 3.2c1.22.28 2.36.82 3.33 1.55l1.8-2.4C17.2 9.89 14.7 9 12 9"/>', w: 24, h: 24 },
  'mdi:wifi': { body: '<path fill="currentColor" d="m12 21l3.6-4.8c-1-.75-2.25-1.2-3.6-1.2s-2.6.45-3.6 1.2zm0-18C7.95 3 4.21 4.34 1.2 6.6L3 9c2.5-1.88 5.62-3 9-3s6.5 1.12 9 3l1.8-2.4C19.79 4.34 16.05 3 12 3m0 6c-2.7 0-5.19.89-7.2 2.4l1.8 2.4C8.1 12.67 9.97 12 12 12s3.9.67 5.4 1.8l1.8-2.4C17.19 9.89 14.7 9 12 9"/>', w: 24, h: 24 },
  'mdi:package-variant': { body: '<path fill="currentColor" d="M2 10.96a.985.985 0 0 1-.37-1.37L3.13 7c.11-.2.28-.34.47-.42l7.83-4.4c.16-.12.36-.18.57-.18s.41.06.57.18l7.9 4.44c.19.1.35.26.44.46l1.45 2.52c.28.48.11 1.09-.36 1.36l-1 .58v4.96c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18s-.41-.06-.57-.18l-7.9-4.44A.99.99 0 0 1 3 16.5v-5.54c-.3.17-.68.18-1 0m10-6.81v6.7l5.96-3.35zM5 15.91l6 3.38v-6.71L5 9.21zm14 0v-3.22l-5 2.9c-.33.18-.7.17-1 .01v3.69zm-5.15-2.55l6.28-3.63l-.58-1.01l-6.28 3.63z"/>', w: 24, h: 24 },
  'mdi:phone-rotate-portrait': { body: '<path fill="currentColor" d="M9 1H3a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h1v-3H3V3h6v8h2V3a2 2 0 0 0-2-2m14 20v-6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2M9 21v-6h12v6zm14-11h-1.5c0-3-1.81-5.73-4.58-6.91L16 5l-2-4a9 9 0 0 1 9 9"/>', w: 24, h: 24 },
  'heroicons:chart-bar': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875zm6.75-4.5c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125zm6.75-4.5c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125z"/>', w: 24, h: 24 },
  'heroicons:arrow-down-tray': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>', w: 24, h: 24 },
  'heroicons:squares-2x2': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25zm0 9.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18zM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25zm0 9.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18z"/>', w: 24, h: 24 },
  'heroicons:ticket': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125z"/>', w: 24, h: 24 },
  'heroicons:arrow-path': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>', w: 24, h: 24 },
  'heroicons:shopping-bag': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007M8.625 10.5a.375.375 0 1 1-.75 0a.375.375 0 0 1 .75 0m7.5 0a.375.375 0 1 1-.75 0a.375.375 0 0 1 .75 0"/>', w: 24, h: 24 },
  'heroicons:banknotes': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 18.75a60 60 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0a3 3 0 0 1 6 0m3 0h.008v.008H18zm-12 0h.008v.008H6z"/>', w: 24, h: 24 },
  'heroicons:cube': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>', w: 24, h: 24 },
  'heroicons:shield-check': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75L11.25 15L15 9.75m-3-7.036A11.96 11.96 0 0 1 3.598 6A12 12 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623c5.176-1.332 9-6.03 9-11.622c0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285"/>', w: 24, h: 24 },
  'heroicons:arrow-right-on-rectangle': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/>', w: 24, h: 24 },
  'heroicons:newspaper': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6z"/>', w: 24, h: 24 },
  'heroicons:pencil-square': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"/>', w: 24, h: 24 },
  'heroicons:star': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.56.56 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.56.56 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.56.56 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.56.56 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.56.56 0 0 0 .475-.345z"/>', w: 24, h: 24 },
  'heroicons:chevron-right': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m8.25 4.5l7.5 7.5l-7.5 7.5"/>', w: 24, h: 24 },
  'heroicons:chevron-down': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m19.5 8.25l-7.5 7.5l-7.5-7.5"/>', w: 24, h: 24 },
  'heroicons:plus': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.5v15m7.5-7.5h-15"/>', w: 24, h: 24 },
  'heroicons:adjustments-horizontal': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"/>', w: 24, h: 24 },
  'heroicons:trash': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21q.512.078 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48 48 0 0 0-3.478-.397m-12 .562q.51-.088 1.022-.165m0 0a48 48 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a52 52 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a49 49 0 0 0-7.5 0"/>', w: 24, h: 24 },
  'heroicons:x-mark': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"/>', w: 24, h: 24 },
  'heroicons:eye': { body: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M2.036 12.322a1 1 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178c.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178"/><path d="M15 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0"/></g>', w: 24, h: 24 },
  'heroicons:eye-slash': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.98 8.223A10.5 10.5 0 0 0 1.934 12c1.292 4.339 5.31 7.5 10.066 7.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.499a10.52 10.52 0 0 1-4.293 5.773M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"/>', w: 24, h: 24 },
  'heroicons:check': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m4.5 12.75l6 6l9-13.5"/>', w: 24, h: 24 },
  'heroicons:photo': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5m10.5-11.25h.008v.008h-.008zm.375 0a.375.375 0 1 1-.75 0a.375.375 0 0 1 .75 0"/>', w: 24, h: 24 },
  'heroicons:arrow-up': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"/>', w: 24, h: 24 },
  'heroicons:arrow-down': { body: '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"/>', w: 24, h: 24 },
}

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 24 },
})

//- Неизвестное имя → пустой <svg> (как несуществующая иконка iconify),
//- не падаем: опечатка в имени видна как пустое место, не как ошибка
const def = computed(() => ICONS[props.name] ?? { body: '', w: 24, h: 24 })
const body = computed(() => def.value.body)
const viewBox = computed(() => `0 0 ${def.value.w} ${def.value.h}`)
</script>

<style scoped>
.AppIcon {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
