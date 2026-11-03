// composables/useFullscreen.ts
import { ref, onMounted, onUnmounted } from 'vue';

// Vendor-префиксные свойства Fullscreen API не входят в стандартный DOM-lib
type FullscreenDoc = Document & {
  webkitFullscreenEnabled?: boolean;
  mozFullScreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
};

type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
};

export const useFullscreen = () => {
  const isFullscreen = ref(false);
  const isSupported = ref(false);

  const checkFullscreenSupport = (): boolean => {
    const doc = document as FullscreenDoc;
    return !!(
      doc.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      doc.mozFullScreenEnabled ||
      doc.msFullscreenEnabled
    );
  };

  const enterFullscreen = async (): Promise<boolean> => {
    if (!isSupported.value) return false;

    try {
      const element = document.documentElement as FullscreenEl;

      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }

      isFullscreen.value = true;
      return true;
    } catch (error) {
      console.error('Ошибка при входе в полноэкранный режим:', error);
      return false;
    }
  };

  const exitFullscreen = async (): Promise<void> => {
    if (!isSupported.value) return;

    try {
      const doc = document as FullscreenDoc;
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }

      isFullscreen.value = false;
    } catch (error) {
      console.error('Ошибка при выходе из полноэкранного режима:', error);
    }
  };

  const toggleFullscreen = async (): Promise<void> => {
    if (isFullscreen.value) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  };

  // Обработчики событий полноэкранного режима
  const handleFullscreenChange = () => {
    const doc = document as FullscreenDoc;
    isFullscreen.value = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
  };

  onMounted(() => {
    isSupported.value = checkFullscreenSupport();

    if (isSupported.value) {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('mozfullscreenchange', handleFullscreenChange);
      document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    }
  });

  onUnmounted(() => {
    if (isSupported.value) {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    }
  });

  return {
    isFullscreen,
    isSupported,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  };
};
