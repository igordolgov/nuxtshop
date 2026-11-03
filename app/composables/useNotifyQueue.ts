// composables/useNotifyQueue.ts

/** Тип всплывающего уведомления */
export type NotifyType = 'success' | 'error' | 'info' | 'warning';

/** Шаг многошагового подтверждения для confirmAsync */
export interface ConfirmStep {
  title?: string;
  message: string;
  breakOnCancel?: boolean;
}

export const useNotifyQueue = () => {
  console.log('🔔 useNotifyQueue initialized - using browser notifications');

  // ===================== НАСТРОЙКИ УВЕДОМЛЕНИЙ =====================

  // Стили для разных типов уведомлений
  const notificationStyles: Record<
    NotifyType,
    { background: string; color: string; borderColor: string }
  > = {
    success: {
      background: '#10b981', // Зеленый фон
      color: 'white', // Белый текст
      borderColor: '#059669', // Темно-зеленая рамка слева
    },
    error: {
      background: '#ef4444', // Красный фон
      color: 'white', // Белый текст
      borderColor: '#dc2626', // Темно-красная рамка слева
    },
    info: {
      background: '#3b82f6', // Синий фон
      color: 'white', // Белый текст
      borderColor: '#2563eb', // Темно-синяя рамка слева
    },
    warning: {
      background: '#f59e0b', // Желтый фон
      color: 'white', // Белый текст
      borderColor: '#d97706', // Темно-желтая рамка слева
    },
  };

  // Иконки для разных типов уведомлений
  const notificationIcons: Record<NotifyType, string> = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  // ПОЗИЦИЯ СВЕРХУ ПО ЦЕНТРУ
  const notificationConfig = {
    position: {
      top: 'calc(var(--header-height, 56px) + 8px)', // Под шапкой на всех экранах (аудит F5)
      left: '50%', // Позиционирование по центру
      transform: 'translateX(-50%)', // Смещение для точного центрирования
    },
    size: {
      minWidth: '250px', // Минимальная ширина
      maxWidth: '500px', // Максимальная ширина
    },
    appearance: {
      padding: '6px 8px', // Внутренние отступы
      borderRadius: '8px', // Скругление углов
      borderLeftWidth: '4px', // Толщина левой рамки
      zIndex: 1000, // z-index для поверх других элементов
    },
    timing: {
      displayDuration: 2500, // Длительность показа (2,5 секунды)
      animationDuration: 300, // Длительность анимации (0.3 секунды)
    },
  };

  // Заголовки по умолчанию — локализуются в момент показа (tr, см. composables/tr.ts)
  const defaultTitles: Record<NotifyType, string> & { confirm: string } = {
    get success() {
      return tr('notify.successTitle', 'Успешно');
    },
    get error() {
      return tr('notify.errorTitle', 'Ошибка');
    },
    get info() {
      return tr('notify.infoTitle', 'Информация');
    },
    get warning() {
      return tr('notify.warningTitle', 'Внимание');
    },
    get confirm() {
      return tr('notify.confirmTitle', 'Подтвердите');
    },
  };

  // ===================== КОНЕЦ НАСТРОЕК =====================

  // Функция для показа красивого уведомления в интерфейсе
  const showBrowserNotification = (type: NotifyType, message: string, title = ''): void => {
    // Используем заголовок по умолчанию, если не передан свой
    const notificationTitle = title || defaultTitles[type];

    // Создаем кастомное уведомление в DOM
    const notificationId = 'custom-notification-' + Date.now();
    const notification = document.createElement('div');

    // Формируем стили для текущего типа уведомления
    const style = notificationStyles[type];
    const styleString = `
      background: ${style.background};
      color: ${style.color};
      border-left: ${notificationConfig.appearance.borderLeftWidth} solid ${style.borderColor};
    `;

    notification.id = notificationId;
    // Класс .custom-notification (main.css): раньше вешался только в CSS,
    // но элемент его никогда не получал — мобильные стили не применялись,
    // тост висел поверх шапки и был узким (аудит F5).
    // Геометрия — через CSS-переменные: инлайн-стили ссылаются на них,
    // поэтому мобильные переопределения из main.css не проигрывают
    // специфичности инлайна.
    notification.innerHTML = `
      <div class="custom-notification" style="
        position: fixed;
        top: var(--notify-top, ${notificationConfig.position.top});
        left: var(--notify-left, ${notificationConfig.position.left});
        right: var(--notify-right, auto);
        transform: translateX(var(--notify-shift, ${notificationConfig.position.transform}));
        padding: ${notificationConfig.appearance.padding};
        border-radius: ${notificationConfig.appearance.borderRadius};
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        z-index: ${notificationConfig.appearance.zIndex};
        min-width: var(--notify-min-width, ${notificationConfig.size.minWidth});
        max-width: var(--notify-max-width, ${notificationConfig.size.maxWidth});
        ${styleString}
        animation: slideInFromTop ${notificationConfig.timing.animationDuration}ms ease-out;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">${notificationIcons[type]}</span>
          <div>
            <div style="font-weight: bold; font-size: 14px;">${notificationTitle}</div>
            <div style="font-size: 13px; opacity: 0.9;">${message}</div>
          </div>
        </div>
      </div>
    `;

    // Добавляем стили для анимации (только если еще не добавлены)
    if (!document.getElementById('notification-styles')) {
      const styleElement = document.createElement('style');
      styleElement.id = 'notification-styles';
      styleElement.textContent = `
        /* АНИМАЦИЯ ДЛЯ ПОЗИЦИИ СВЕРХУ ПО ЦЕНТРУ.
           Сдвиг по X — через --notify-shift: на десктопе -50% (центр),
           на мобильных 0 (тост растянут на всю ширину с полями) */
        @keyframes slideInFromTop {
          from { transform: translateX(var(--notify-shift, -50%)) translateY(-100%); opacity: 0; }
          to { transform: translateX(var(--notify-shift, -50%)) translateY(0); opacity: 1; }
        }
        @keyframes slideOutToTop {
          from { transform: translateX(var(--notify-shift, -50%)) translateY(0); opacity: 1; }
          to { transform: translateX(var(--notify-shift, -50%)) translateY(-100%); opacity: 0; }
        }
      `;
      document.head.appendChild(styleElement);
    }

    document.body.appendChild(notification);

    // Автоматическое удаление через заданное время
    setTimeout(() => {
      if (document.getElementById(notificationId)) {
        notification.style.animation = `slideOutToTop ${notificationConfig.timing.animationDuration}ms ease-in`;
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, notificationConfig.timing.animationDuration);
      }
    }, notificationConfig.timing.displayDuration);

    // Возможность закрыть по клику
    notification.addEventListener('click', () => {
      notification.style.animation = `slideOutToTop ${notificationConfig.timing.animationDuration}ms ease-in`;
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, notificationConfig.timing.animationDuration);
    });
  };

  // Возвращаем методы для использования в компонентах (остается без изменений)
  return {
    success: (message: string, title: string = defaultTitles.success): void => {
      console.log('✅ SUCCESS:', title, message);
      showBrowserNotification('success', message, title);
    },
    error: (message: string, title: string = defaultTitles.error): void => {
      console.log('❌ ERROR:', title, message);
      showBrowserNotification('error', message, title);
    },
    info: (message: string, title: string = defaultTitles.info): void => {
      console.log('ℹ️ INFO:', title, message);
      showBrowserNotification('info', message, title);
    },
    warning: (message: string, title: string = defaultTitles.warning): void => {
      console.log('⚠️ WARNING:', title, message);
      showBrowserNotification('warning', message, title);
    },
    confirm: (message: string, title: string = defaultTitles.confirm): Promise<boolean> => {
      console.log('❓ CONFIRM:', title, message);
      return Promise.resolve(window.confirm(`${title}: ${message}`));
    },
    confirmAsync: async (steps: ConfirmStep[] = []): Promise<boolean[]> => {
      const results: boolean[] = [];
      for (const step of steps) {
        const title = step.title || defaultTitles.confirm;
        const result = window.confirm(`${title}: ${step.message}`);
        results.push(result);
        if (!result && step.breakOnCancel) break;
      }
      return results;
    },
  };
};
