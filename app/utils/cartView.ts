// app/utils/cartView.ts
// Состояние показа страницы корзины — чистая функция вместо цепочки
// v-if в шаблоне (регрессия «мигает фото последнего товара», 2026-11):
//
// Раньше скелет держался только до isMounted (onMounted компонента),
// а localStorage-снапшот корзины читается позже — fetchCart() по
// app:suspense:resolve (см. useCart). Между этими событиями на каждый
// открывшийся /cart на весь экран вспыхивало «Корзина пуста»
// (.empty-cart — fixed-оверлей), затем список перестраивался и все
// <img> позиций монтировались заново — последнее фото подгружалось
// с нуля и заметно мигало. Скелет теперь держится до фактической
// загрузки корзины (cartLoaded), пустое состояние показывается только
// когда корзина точно прочитана и позиций в ней нет.

export type CartViewMode = 'skeleton' | 'empty' | 'items';

export const cartViewMode = (
  isMounted: boolean,
  cartLoaded: boolean,
  itemCount: number,
): CartViewMode => {
  // До монтирования И до чтения снапшота (localStorage/аккаунт-синк)
  // показываем скелет — ни «пусто», ни список раньше времени.
  if (!isMounted || !cartLoaded) return 'skeleton';
  return itemCount > 0 ? 'items' : 'empty';
};
