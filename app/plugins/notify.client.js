// app\plugins\notify.client.js
import { useNotifyQueue } from '@/composables/useNotifyQueue'

export default defineNuxtPlugin(() => {
  const notify = useNotifyQueue();
  
  return {
    provide: {
      notify
    }
  }
});