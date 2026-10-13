// app/composables/useOrders.js
// ============================================
// Composable: useOrders — клиентский доступ к заказам.
// Без singleton-состояния: checkout отправляет заказ один раз,
// админские списки будут жить локально на своей странице.
// Ошибки $fetch (4xx/5xx) пробрасываются наверх — вызывающий
// компонент показывает их через $notify (паттерн useProducts).
// ============================================

export const useOrders = () => {
  /** Создание заказа из checkout. Сервер сам считает деньги —
   *  клиент передаёт только id+количество, контакты и способы. */
  const createOrder = async (payload) => {
    const response = await $fetch('/api/orders', { method: 'POST', body: payload })
    if (!response.success || !response.order) {
      throw new Error(response.message || 'Сервер не подтвердил создание заказа')
    }
    return response.order
  }

  /** Список заказов (админ). status — опциональный фильтр ('new', ...). */
  const fetchOrders = async (status = null, limit = 100) => {
    const query = {}
    if (status) query.status = status
    query.limit = limit
    const response = await $fetch('/api/orders', { query })
    if (!response.success) {
      throw new Error(response.message || 'Не удалось получить заказы')
    }
    return response // { success, total, orders }
  }

  /** Смена статуса (админ). comment — необязательный комментарий к смене. */
  const updateStatus = async (orderId, status, comment) => {
    const response = await $fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      body: { status, comment },
    })
    if (!response.success || !response.order) {
      throw new Error(response.message || 'Сервер не подтвердил смену статуса')
    }
    return response.order
  }

  return { createOrder, fetchOrders, updateStatus }
}