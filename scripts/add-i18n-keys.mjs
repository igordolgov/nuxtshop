#!/usr/bin/env node
// Добавляет недостающие ключи i18n в ru/en/es одним набором (parity by design).
import { readFileSync, writeFileSync } from 'node:fs';

const ADD = {
  common: {
    close: ['Закрыть', 'Close', 'Cerrar'],
    scrollToTop: ['Прокрутить к началу', 'Back to top', 'Volver arriba'],
    errorOccurred: ['Произошла ошибка', 'Something went wrong', 'Ha ocurrido un error'],
    error: ['Ошибка', 'Error', 'Error'],
  },
  catalog: {
    loadError: [
      'Не удалось загрузить товары',
      'Failed to load products',
      'No se han podido cargar los productos',
    ],
    cachedData: [
      'Используются кэшированные данные',
      'Showing cached data',
      'Mostrando datos en caché',
    ],
    noProducts: ['Товары отсутствуют', 'No products available', 'No hay productos disponibles'],
    tryChangeFilters: [
      'Попробуйте изменить параметры фильтрации',
      'Try changing the filters',
      'Prueba a cambiar los filtros',
    ],
    nothingForQuery: [
      'По запросу «{query}» ничего не найдено',
      'Nothing found for "{query}"',
      'No se ha encontrado nada para «{query}»',
    ],
    searchProducts: ['Поиск товаров...', 'Search products...', 'Buscar productos...'],
  },
  product: {
    nameFallback: ['Товар', 'Product', 'Producto'],
    zoomImage: ['Увеличить изображение', 'Zoom image', 'Ampliar imagen'],
  },
  auth: {
    errLogout: ['Не удалось выйти', 'Failed to log out', 'No se ha podido cerrar la sesión'],
    logoutSuccess: ['Вы вышли из системы', 'You have logged out', 'Has cerrado la sesión'],
    errProfileUpdate: [
      'Ошибка обновления профиля',
      'Failed to update profile',
      'Error al actualizar el perfil',
    ],
  },
  offline: {
    updateAvailable: [
      'Доступно обновление. Обновите страницу.',
      'Update available. Please refresh the page.',
      'Hay una actualización disponible. Recarga la página.',
    ],
    synced: ['Данные синхронизированы!', 'Data synced!', '¡Datos sincronizados!'],
  },
  checkout: {
    errCreateNotConfirmed: [
      'Сервер не подтвердил создание заказа',
      'Server did not confirm the order',
      'El servidor no ha confirmado el pedido',
    ],
  },
  orders: {
    errLoad: [
      'Не удалось получить заказы',
      'Failed to load orders',
      'No se han podido cargar los pedidos',
    ],
    methodCourier: ['Курьер', 'Courier', 'Mensajería'],
    methodPickup: ['Самовывоз', 'Pickup', 'Recogida'],
    methodPost: ['Почта', 'Post', 'Correo'],
    payCard: ['Карта', 'Card', 'Tarjeta'],
    payCash: ['Наличные', 'Cash', 'Efectivo'],
  },
  user: {
    productUnavailable: ['Товар недоступен', 'Product unavailable', 'Producto no disponible'],
    logoutConfirm: ['Выйти из системы?', 'Log out?', '¿Cerrar la sesión?'],
    profileUpdated: ['Профиль обновлен', 'Profile updated', 'Perfil actualizado'],
    nameFallback: ['Пользователь', 'User', 'Usuario'],
  },
  cart: {
    unnamedProduct: ['Без названия', 'Unnamed product', 'Producto sin nombre'],
  },
  notify: {
    successTitle: ['Успешно', 'Success', 'Éxito'],
    errorTitle: ['Ошибка', 'Error', 'Error'],
    infoTitle: ['Информация', 'Info', 'Información'],
    warningTitle: ['Внимание', 'Attention', 'Atención'],
    confirmTitle: ['Подтвердите', 'Please confirm', 'Confirma'],
  },
};

const FILES = {
  ru: 'i18n/locales/ru.json',
  en: 'i18n/locales/en.json',
  es: 'i18n/locales/es.json',
};
const IDX = { ru: 0, en: 1, es: 2 };

for (const [loc, path] of Object.entries(FILES)) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  let added = 0;
  for (const [ns, keys] of Object.entries(ADD)) {
    data[ns] = data[ns] || {};
    for (const [k, tr] of Object.entries(keys)) {
      if (data[ns][k] === undefined) {
        data[ns][k] = tr[IDX[loc]];
        added++;
      }
    }
  }
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log(`${loc}: +${added} ключей`);
}
