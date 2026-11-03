// app/composables/useProductMutations.ts
// API-мутации каталога (update/create/delete + массовые операции).
// Разбивка useProducts (этап 6): функции не владеют стейтом — получают
// его через контекст (products/loading/error/persist/…), поэтому behavior
// идентичен прежнему коду внутри createProducts(). Административные
// операции НЕ имеют локальных fallback: ошибка сервера — ошибка в UI.
import type { Ref } from 'vue';
import type { CatalogProduct } from './catalogProduct';
import { fixProductImages, updateProductStockStatus } from './catalogProduct';

/** Стейт и утилиты, с которыми работают мутации (живут в useProducts). */
export interface ProductMutationsCtx {
  products: Ref<CatalogProduct[]>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  favorites: ReturnType<typeof useFavorites>;
  persist: () => void;
  showNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  errorMessage: (err?: unknown) => string;
}

export function useProductMutations(ctx: ProductMutationsCtx) {
  const { products, loading, error, favorites, persist, showNotification, errorMessage } = ctx;

  const toggleFavorite = async (
    productOrId?: CatalogProduct | string | number | null,
  ): Promise<boolean> => {
    try {
      const isObject = !!productOrId && typeof productOrId === 'object';
      const id = isObject ? productOrId.id || productOrId._id : productOrId;

      if (!id) {
        console.warn('[useProducts] toggleFavorite: не передан ID или объект');
        return false;
      }

      const idx = products.value.findIndex((p) => String(p.id) === String(id));
      const product = idx !== -1 ? products.value[idx] : isObject ? productOrId : null;

      if (!product) {
        console.warn('[useProducts] toggleFavorite: товар не найден по ID', id);
        return false;
      }

      favorites.toggleFavorite(product);

      if (idx !== -1) {
        products.value[idx] = {
          ...products.value[idx],
          isFavorite: favorites.isFavorite(id),
        };
        persist();
      }

      return true;
    } catch (err) {
      console.error('[useProducts] Ошибка переключения избранного:', err);
      showNotification('error', 'Ошибка при обновлении избранного');
      return false;
    }
  };

  const updateProduct = async (
    productId: string | number,
    updatedData: Record<string, unknown> & { stockQuantity?: number },
  ): Promise<CatalogProduct> => {
    loading.value = true;
    error.value = null;

    try {
      const finalData = { ...updatedData, inStock: (updatedData.stockQuantity ?? 0) > 0 };
      const response = await $fetch<{
        success: boolean;
        product?: CatalogProduct;
        message?: string;
      }>(`/api/products/${productId}`, {
        method: 'PUT',
        body: finalData,
      });

      if (!response.success || !response.product) {
        throw new Error(response.message || 'Сервер не подтвердил обновление');
      }

      const index = products.value.findIndex((p) => String(p.id) === String(productId));
      const wasFavorite = favorites.isFavorite(productId);

      const base = (index !== -1 ? products.value[index] : {}) as CatalogProduct;
      const merged = updateProductStockStatus(
        fixProductImages({
          ...base,
          ...response.product,
          isFavorite: wasFavorite,
        }) as CatalogProduct,
      );

      if (index !== -1) {
        products.value[index] = merged;
      } else {
        products.value.push(merged);
      }
      persist();
      return merged;
    } catch (err) {
      console.error('[useProducts] Ошибка обновления товара:', err);
      error.value = errorMessage(err);
      showNotification('error', `Ошибка обновления товара: ${errorMessage(err)}`);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createProduct = async (
    productData: Record<string, unknown> & { stockQuantity?: number },
  ): Promise<CatalogProduct> => {
    loading.value = true;
    error.value = null;

    try {
      const finalData = { ...productData, inStock: (productData.stockQuantity ?? 0) > 0 };
      const response = await $fetch<{
        success: boolean;
        product?: CatalogProduct;
        message?: string;
      }>('/api/products', { method: 'POST', body: finalData });

      if (!response.success || !response.product) {
        throw new Error(response.message || 'Сервер не подтвердил создание');
      }

      const newProduct = updateProductStockStatus(
        fixProductImages({ ...response.product, isFavorite: false }) as CatalogProduct,
      );
      products.value = [newProduct, ...products.value];
      persist();
      return newProduct;
    } catch (err) {
      console.error('[useProducts] Ошибка создания товара:', err);
      error.value = errorMessage(err);
      showNotification('error', `Ошибка создания товара: ${errorMessage(err)}`);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteProduct = async (productId: string | number): Promise<boolean> => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ success: boolean; message?: string }>(
        `/api/products/${productId}`,
        { method: 'DELETE' },
      );
      if (!response.success) throw new Error(response.message || 'Ошибка при удалении товара');

      const idx = products.value.findIndex((p) => String(p.id) === String(productId));
      if (idx === -1) return false;
      const name = products.value[idx].name;
      products.value.splice(idx, 1);
      persist();
      if (favorites.isFavorite(productId)) favorites.removeFromFavorites(productId);
      showNotification('success', `Товар "${name}" удален`);
      return true;
    } catch (err) {
      console.error('[useProducts] Ошибка удаления товара:', err);
      error.value = errorMessage(err);
      // 401 — сессия истекла (например, после рестарта dev-сервера)
      showNotification('error', `Ошибка удаления товара: ${errorMessage(err)}`);
      return false;
    } finally {
      loading.value = false;
    }
  };

  // Один PATCH на весь выбор: сервер применяет патч атомарно (одно
  // чтение и одна запись KV) и возвращает только реально изменённые
  // товары — мерджим их в стейт, сохраняя isFavorite этого устройства.
  const bulkUpdateProducts = async (
    ids: Array<string | number>,
    patch: Record<string, unknown>,
  ) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        success: boolean;
        products?: CatalogProduct[];
        message?: string;
      }>('/api/products/bulk', {
        method: 'PATCH',
        body: { ids, ...patch },
      });
      if (!response.success) {
        throw new Error(response.message || 'Сервер не подтвердил обновление');
      }

      const byId = new Map((response.products || []).map((p) => [String(p.id), p]));
      products.value = products.value.map((p) => {
        const upd = byId.get(String(p.id));
        if (!upd) return p;
        return updateProductStockStatus(
          fixProductImages({ ...upd, isFavorite: favorites.isFavorite(p.id) }) as CatalogProduct,
        );
      });
      persist();
      return response;
    } catch (err) {
      console.error('[useProducts] Ошибка массового обновления товаров:', err);
      error.value = errorMessage(err);
      showNotification('error', `Массовое обновление: ${errorMessage(err)}`);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // DELETE с телом { ids } — h3 readBody читает тело и из DELETE.
  // Удалённые id приходят в deletedIds — вычищаем стейт и избранное.
  const bulkDeleteProducts = async (ids: Array<string | number>) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        success: boolean;
        deletedIds?: Array<string | number>;
        message?: string;
      }>('/api/products/bulk', {
        method: 'DELETE',
        body: { ids },
      });
      if (!response.success) {
        throw new Error(response.message || 'Сервер не подтвердил удаление');
      }

      const gone = new Set((response.deletedIds || []).map(String));
      products.value = products.value.filter((p) => !gone.has(String(p.id)));
      gone.forEach((id) => {
        if (favorites.isFavorite(id)) favorites.removeFromFavorites(id);
      });
      persist();
      return response;
    } catch (err) {
      console.error('[useProducts] Ошибка массового удаления товаров:', err);
      error.value = errorMessage(err);
      showNotification('error', `Массовое удаление: ${errorMessage(err)}`);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    toggleFavorite,
    updateProduct,
    createProduct,
    deleteProduct,
    bulkUpdateProducts,
    bulkDeleteProducts,
  };
}
