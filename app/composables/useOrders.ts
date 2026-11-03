// app/composables/useOrders.ts
// ============================================
// Composable: useOrders — клиентский доступ к заказам.
// Без singleton-состояния: checkout отправляет заказ один раз,
// админские списки будут жить локально на своей странице.
// Ошибки $fetch (4xx/5xx) пробрасываются наверх — вызывающий
// компонент показывает их через $notify (паттерн useProducts).
// ============================================

/** Позиция заказа — клиент передаёт серверу только id и количество */
export interface OrderItemInput {
  id: string | number;
  quantity: number;
}

/** Тело POST /api/orders (зеркало CreateOrderInput из server/lib/orderHelpers.ts;
 *  деньги сервер пересчитывает сам — клиентские суммы не передаются) */
export interface CreateOrderPayload {
  items: OrderItemInput[];
  deliveryMethod: string;
  paymentMethod: string;
  promoCode?: string | null;
  customer: {
    name: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    postalCode?: string;
  };
  notify?: { email?: string; pushSubscribed?: boolean };
  comment?: string;
}

/** Заказ, как его отдаёт API (минус внутренние поля, клиенту не нужные) */
export interface OrderLike {
  id: string;
  status: string;
  items?: Array<{
    id: string;
    slug: string | null;
    name: string;
    price: number;
    quantity: number;
    image: string | null;
    category: string | null;
    variantId: string | null;
    variantName: string | null;
  }>;
  subtotal?: number;
  discount?: number;
  promoCode?: string | null;
  deliveryMethod?: string;
  deliveryPrice?: number;
  paymentMethod?: string;
  total: number;
  customer?: {
    userId?: string | null;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
  } | null;
  notify?: { email?: string; pushSubscribed?: boolean; telegramChat?: string | null };
  comment?: string;
  statusHistory?: Array<{ status: string; at: string; comment?: string }>;
  createdAt: string;
  updatedAt?: string;
}

export const useOrders = () => {
  /** Создание заказа из checkout. Сервер сам считает деньги —
   *  клиент передаёт только id+количество, контакты и способы. */
  const createOrder = async (payload: CreateOrderPayload): Promise<OrderLike> => {
    const response = await $fetch<{
      success: boolean;
      order?: OrderLike;
      message?: string;
    }>('/api/orders', { method: 'POST', body: payload });
    if (!response.success || !response.order) {
      throw new Error(
        response.message ||
          tr('checkout.errCreateNotConfirmed', 'Сервер не подтвердил создание заказа'),
      );
    }
    return response.order;
  };

  /** Список заказов (админ). status — опциональный фильтр ('new', ...). */
  const fetchOrders = async (status: string | null = null, limit = 100) => {
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    query.limit = limit;
    const response = await $fetch<{
      success: boolean;
      total: number;
      orders: OrderLike[];
      message?: string;
    }>('/api/orders', { query });
    if (!response.success) {
      throw new Error(response.message || 'Не удалось получить заказы');
    }
    return response; // { success, total, orders }
  };

  /** Смена статуса (админ). comment — необязательный комментарий к смене. */
  const updateStatus = async (
    orderId: string,
    status: string,
    comment?: string,
  ): Promise<OrderLike> => {
    const response = await $fetch<{
      success: boolean;
      order?: OrderLike;
      message?: string;
    }>(`/api/orders/${orderId}`, {
      method: 'PUT',
      body: { status, comment },
    });
    if (!response.success || !response.order) {
      throw new Error(response.message || 'Сервер не подтвердил смену статуса');
    }
    return response.order;
  };

  return { createOrder, fetchOrders, updateStatus };
};
