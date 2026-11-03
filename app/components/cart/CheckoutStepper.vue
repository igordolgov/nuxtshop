<!-- app/components/cart/CheckoutStepper.vue — горизонтальная полоса шагов
     оформления заказа (разбивка checkout.vue, этап 6). Только индикация:
     активный/пройденный шаг считается из currentStep; навигация остаётся
     в форме. Каскад прокрутки на узких экранах — в scoped-стилях. -->
<template lang="pug">
.steps-horizontal-wrapper.card.bg-base-100.shadow-lg.mt-2(class="lg:mt-0 lg:mb-6")
  .card-body.p-2.w-auto.flex.items-center.justify-center(class="lg:p-4")
    .steps-container
      .step-horizontal.flex.items-center.text-center.mx-2(
        v-for="(step, index) in steps"
        :key="index"
        :class="{ 'step-active': currentStep === index + 1, 'step-completed': currentStep > index + 1 }"
      )
        .step-content.flex.flex-col.items-center.px-2
          .step-number.mb-1(:class="{ 'bg-primary text-primary-content': currentStep >= index + 1, 'bg-base-300': currentStep < index + 1 }") {{ index + 1 }}
          span.step-name.whitespace-nowrap.overflow-hidden.text-ellipsis.max-w-full.text-center(class="lg:font-medium text-[0.6rem] lg:text-sm") {{ $t(step.nameKey) }}
        .step-connector(v-if="index < steps.length - 1")
</template>

<script setup>
defineProps({
  steps: { type: Array, required: true },
  currentStep: { type: Number, required: true },
})
</script>

<style scoped>
/* ========== ШАГИ ========== */
.steps-horizontal-wrapper {
  overflow-x: auto;
  overflow-y: hidden;
  border-radius: 12px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 90px;
  width: 100%;
}

.steps-horizontal-wrapper::-webkit-scrollbar {
  display: none;
}

.steps-horizontal-wrapper .card-body {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 1rem;
  padding-bottom: 1rem;
  width: 100%;
  height: 100%;
}

.steps-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: fit-content;
  flex-wrap: nowrap;
}

.step-horizontal {
  display: flex;
  align-items: center;
  position: relative;
}

.step-horizontal .step-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* Раньше анимация приходила из scoped-стилей страницы (шаги были в одном
     файле с формой); после разбивки полоса шагов несёт её сама */
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step-horizontal .step-number {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  flex-shrink: 0;
  /* Раньше rgba(255,255,255,.2) — в тёмной теме кольцо исчезало */
  border: 3px solid color-mix(in oklab, var(--color-base-content) 15%, transparent);
}

.step-horizontal .step-name {
  /* daisyUI 5: --color-* — готовые цвета; старый oklch(var(--bc)/x)
     был невалидным значением и не применялся */
  color: color-mix(in oklab, var(--color-base-content) 70%, transparent);
  font-weight: 400;
  line-height: 1.2;
  max-width: 100px;
  word-break: break-word;
}

.step-connector {
  width: 2px;
  height: 1.5rem;
  margin-left: 0.5rem;
  margin-right: 0.5rem;
  background-color: var(--color-base-300);
  border-radius: 1px;
}

.step-horizontal.step-active .step-name {
  color: var(--color-primary);
  font-weight: 600;
}

.step-horizontal.step-completed + .step-connector {
  background-color: var(--color-primary);
}

/* ========== ДЕСКТОП (lg: 1024px+) ========== */
@media (min-width: 1024px) {
  .steps-horizontal-wrapper {
    min-height: 110px;
  }

  .steps-horizontal-wrapper .card-body {
    padding-top: 1.25rem;
    padding-bottom: 1.25rem;
  }

  .step-horizontal .step-number {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }

  .step-horizontal .step-name {
    font-size: 0.875rem;
    white-space: nowrap;
    max-width: none;
  }

  .step-connector {
    width: 2px;
    height: 2rem;
    margin-left: 1rem;
    margin-right: 1rem;
  }

  .steps-container {
    gap: 1rem;
  }
}

/* ========== МОБИЛЬНЫЕ (до 1023px) ========== */
@media (max-width: 1023px) {
  .steps-horizontal-wrapper {
    margin-left: -0.75rem;
    margin-right: -0.75rem;
    border-radius: 0;
    width: calc(100% + 1.5rem);
    justify-content: center;
  }

  .steps-horizontal-wrapper .card-body {
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }

  .steps-container {
    justify-content: center;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
}
</style>
