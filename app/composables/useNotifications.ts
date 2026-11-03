// app/composables/useNotifications.ts
import { ref, computed } from 'vue';

/** Плашка в углу экрана (список живёт внутри композабла) */
export interface AppNotification {
  id: number;
  message: string;
  type: string;
  timestamp: Date;
}

let notificationsInstance: ReturnType<typeof createNotifications> | null = null;

export const useNotifications = () => {
  if (import.meta.server) return createNotifications();

  if (notificationsInstance) return notificationsInstance;
  notificationsInstance = createNotifications();
  return notificationsInstance;
};

function createNotifications() {
  const notifications = ref<AppNotification[]>([]);

  const removeNotification = (id: number) => {
    const index = notifications.value.findIndex((n) => n.id === id);
    if (index !== -1) notifications.value.splice(index, 1);
  };

  const addNotification = (message: string, type = 'info'): AppNotification => {
    const id = Date.now() + Math.random();
    const notification: AppNotification = { id, message, type, timestamp: new Date() };
    notifications.value.push(notification);

    if (import.meta.client) {
      setTimeout(() => removeNotification(id), 5000);
    }
    return notification;
  };

  const clearAllNotifications = () => {
    notifications.value = [];
  };

  return {
    notifications: computed(() => notifications.value),
    addNotification,
    removeNotification,
    clearAllNotifications,
  };
}
