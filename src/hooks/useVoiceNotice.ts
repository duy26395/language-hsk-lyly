import { useEffect, useState } from 'react';

export function useVoiceNotice() {
  const [showVoiceNotice, setShowVoiceNotice] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('voice-mobile-notice-seen') !== 'true') {
      const timeoutId = window.setTimeout(() => setShowVoiceNotice(true), 350);
      return () => window.clearTimeout(timeoutId);
    }
  }, []);

  const closeNotice = () => {
    localStorage.setItem('voice-mobile-notice-seen', 'true');
    setShowVoiceNotice(false);
  };

  return {
    showVoiceNotice,
    closeNotice,
  };
}
