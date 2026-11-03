// app/plugins/notify.client.ts
import { useNotifyQueue } from '@/composables/useNotifyQueue';

export default defineNuxtPlugin(() => {
  const notify = useNotifyQueue();

  return {
    provide: {
      notify,
    },
  };
});
