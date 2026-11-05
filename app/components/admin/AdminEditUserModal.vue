<!-- app/components/admin/AdminEditUserModal.vue -->
<!-- Модалка редактирования профиля пользователя (name/email/phone/address).
     Роль меняется селектом в таблице (role.put), пароль здесь не трогаем.
     Escape закрывает модалку (кроме отправки); label привязаны через for/id —
     тап по подписи открывает клавиатуру с нужным типом поля на мобильных. -->
<template lang="pug">
.modal(v-if="isOpen" class="modal-open" role="dialog" aria-modal="true" :aria-label="$t('admin.userForm.editTitle', { name: userName })")
  .modal-box.max-w-md.w-full.p-4(class="sm:p-6")
    //- Кнопка закрытия
    button.btn.btn-xs.btn-circle.btn-error.absolute.right-2.top-2(
      @click="handleCancel"
      :disabled="isSubmitting"
      :aria-label="$t('admin.common.close')"
    ) ✕

    h3.text-base.font-bold.mb-3(class="sm:text-lg") {{ $t('admin.userForm.editTitle', { name: userName }) }}
    form(@submit.prevent="handleSubmit" v-if="form")
      //- Имя
      .form-control.mb-2
        label.label.py-1(for="admin-user-name")
          span.label-text.text-xs {{ $t('admin.userForm.nameLabel') }}
        input#admin-user-name.input.input-bordered.input-sm.w-full(
          type="text"
          v-model="form.name"
          required
          maxlength="50"
          autocomplete="off"
          :disabled="isSubmitting"
        )

      //- Email (смена — с подсказкой про вход)
      .form-control.mb-2
        label.label.py-1(for="admin-user-email")
          span.label-text.text-xs {{ $t('admin.userForm.emailLabel') }}
        input#admin-user-email.input.input-bordered.input-sm.w-full(
          type="email"
          v-model="form.email"
          required
          autocomplete="off"
          :disabled="isSubmitting"
        )
        label.label.py-1(v-if="emailChanged")
          span.label-text-alt.text-warning {{ $t('admin.userForm.emailHint') }}

      //- Телефон и адрес
      .grid.gap-2.mb-2(class="grid-cols-1 sm:grid-cols-2")
        .form-control
          label.label.py-1(for="admin-user-phone")
            span.label-text.text-xs {{ $t('admin.userForm.phoneLabel') }}
          input#admin-user-phone.input.input-bordered.input-sm.w-full(
            type="tel"
            v-model="form.phone"
            maxlength="30"
            :placeholder="$t('admin.userForm.phonePlaceholder')"
            :disabled="isSubmitting"
          )
        .form-control
          label.label.py-1(for="admin-user-address")
            span.label-text.text-xs {{ $t('admin.userForm.addressLabel') }}
          input#admin-user-address.input.input-bordered.input-sm.w-full(
            type="text"
            v-model="form.address"
            maxlength="200"
            :placeholder="$t('admin.userForm.addressPlaceholder')"
            :disabled="isSubmitting"
          )

      //- Ошибка
      .alert.alert-error.mt-2.p-2.text-xs(v-if="formError")
        | {{ formError }}

      //- Кнопки
      .modal-action.mt-3
        button.btn.btn-ghost.btn-sm(
          type="button"
          @click="handleCancel"
          :disabled="isSubmitting"
        ) {{ $t('admin.common.cancel') }}
        button.btn.btn-primary.btn-sm(
          type="submit"
          :disabled="isSubmitting || !isFormValid"
        )
          span.loading.loading-spinner.loading-xs.mr-1(v-if="isSubmitting")
          span(v-if="isSubmitting") {{ $t('admin.common.saving') }}
          span(v-else) {{ $t('admin.common.save') }}
</template>

<script setup>
// ============================================
// Компонент: AdminEditUserModal
// Модалка «Редактировать» на /admin/users.
// PUT /api/admin/users/:id — name/email/phone/address; сервер валидирует
// формат email и уникальность (409), текст ошибки приходит в error.data.
// После успеха эмитит userSaved с уже очищенной от пароля записью —
// страница подменяет строку без перезагрузки списка.
// ============================================
const notify = useNotifyQueue()
const { t } = useI18n()

const props = defineProps({
  isOpen: Boolean,
  user: Object,
})

const emit = defineEmits(['update:isOpen', 'userSaved'])

const isSubmitting = ref(false)
const form = ref(null)
const formError = ref('')

const userName = computed(() => props.user?.name || '')

// Подсказка о смене email показывается только когда адрес реально правят
const emailChanged = computed(() => {
  if (!form.value || !props.user) return false
  return form.value.email.trim().toLowerCase() !== (props.user.email || '').toLowerCase()
})

const isFormValid = computed(() => {
  if (!form.value) return false
  const hasName = form.value.name.trim().length >= 2
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.value.email.trim())
  return hasName && hasEmail
})

const initializeForm = () => {
  if (props.user) {
    form.value = {
      name: props.user.name || '',
      email: props.user.email || '',
      phone: props.user.phone || '',
      address: props.user.address || '',
    }
  }
}

const handleCancel = () => {
  if (!isSubmitting.value) {
    formError.value = ''
    emit('update:isOpen', false)
  }
}

const handleSubmit = async () => {
  if (!form.value || !isFormValid.value || !props.user) return

  isSubmitting.value = true
  formError.value = ''

  try {
    const data = await $fetch(`/api/admin/users/${props.user.id}`, {
      method: 'PUT',
      body: {
        name: form.value.name.trim(),
        email: form.value.email.trim(),
        phone: form.value.phone.trim(),
        address: form.value.address.trim(),
      },
    })

    if (!data?.success) throw new Error(data?.message)

    notify.success(t('admin.userForm.savedToast'))
    emit('userSaved', data.user)
    emit('update:isOpen', false)
  } catch (error) {
    // ofetch кладёт тело ответа в error.data — там текст ошибки сервера;
    // error.message у FetchError — безликое «[PUT] /api/...: 400»
    formError.value = error?.data?.message || error.message || t('admin.common.error')
  } finally {
    isSubmitting.value = false
  }
}

// Escape закрывает модалку (наряду с ✕ и «Отменой»)
const handleKeydown = (e) => {
  if (e.key === 'Escape') handleCancel()
}
watch(() => props.isOpen, (open) => {
  formError.value = ''
  isSubmitting.value = false
  if (open) {
    initializeForm()
    window.addEventListener('keydown', handleKeydown)
  } else {
    window.removeEventListener('keydown', handleKeydown)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
