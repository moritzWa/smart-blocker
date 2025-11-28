import { useEffect } from 'react';

export function useFaviconStrictMode(strictMode: boolean) {
  useEffect(() => {
    const favicon16 = document.getElementById('favicon-16') as HTMLLinkElement;
    const favicon32 = document.getElementById('favicon-32') as HTMLLinkElement;

    if (favicon16 && favicon32) {
      if (strictMode) {
        favicon16.href = '/images/strict-mode/icon16.png';
        favicon32.href = '/images/strict-mode/icon32.png';
      } else {
        favicon16.href = '/images/icon16.png';
        favicon32.href = '/images/icon32.png';
      }
    }
  }, [strictMode]);
}
