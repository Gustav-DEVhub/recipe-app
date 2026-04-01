import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export default function OfflineToast() {
  const hasShownRef = useRef(false);

  useEffect(() => {
    const showOffline = () => {
      if (hasShownRef.current) return;
      hasShownRef.current = true;
      toast.message('You are offline. Favorites will still work.', {
        duration: 4000
      });
    };

    const showOnline = () => {
      hasShownRef.current = false;
    };

    // Immediate state.
    if (!navigator.onLine) showOffline();

    window.addEventListener('offline', showOffline);
    window.addEventListener('online', showOnline);
    return () => {
      window.removeEventListener('offline', showOffline);
      window.removeEventListener('online', showOnline);
    };
  }, []);

  return null;
}

