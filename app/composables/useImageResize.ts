// app/composables/useImageResize.ts
// ============================================
// Composable: useImageResize
// Клиентский ресайз изображений → WebP data-URI через canvas.
// Используется в админ-модалках перед отправкой товара на сервер:
// payload сжимается в ~10 раз, серверная оптимизация не нужна.
// ============================================

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// Лимит исходного файла. Можем позволить много: ресайз идёт на клиенте,
// до сервера доедает только webp ~50–150 КБ.
export const IMAGE_MAX_FILE_SIZE_MB = 10;

export interface ResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  /** 0..1, качество webp-кодирования */
  quality?: number;
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { valid: false, error: `Неподдерживаемый формат: ${file.name}` };
  }
  if (file.size > IMAGE_MAX_FILE_SIZE_MB * 1024 * 1024) {
    return {
      valid: false,
      error: `${file.name} слишком большой (макс. ${IMAGE_MAX_FILE_SIZE_MB} МБ)`,
    };
  }
  return { valid: true };
}

export const useImageResize = () => {
  /**
   * Читает файл, масштабирует с сохранением пропорций и кодирует в WebP.
   * resolve всегда возвращает data-URI; если браузер не умеет кодировать
   * webp (старые Safari), вернёт png — тоже рабочий вариант.
   */
  const resizeToWebp = (file: File, options: ResizeOptions = {}): Promise<string> => {
    const { maxWidth = 1200, maxHeight = 1200, quality = 0.8 } = options;

    return new Promise((resolve, reject) => {
      if (!import.meta.client) {
        reject(new Error('Ресайз изображений доступен только на клиенте'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Не удалось декодировать изображение'));
        img.onload = () => {
          try {
            // Один масштаб по обеим сторонам — без искажения пропорций
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
            const width = Math.max(1, Math.round(img.width * scale));
            const height = Math.max(1, Math.round(img.height * scale));

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas недоступен'));
              return;
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            const result = canvas.toDataURL('image/webp', quality);
            if (!result.startsWith('data:image/webp')) {
              console.warn('[useImageResize] браузер не поддержал webp-кодирование, вернул png');
            }
            resolve(result);
          } catch (err) {
            reject(err instanceof Error ? err : new Error('Ошибка обработки изображения'));
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  return { resizeToWebp };
};
