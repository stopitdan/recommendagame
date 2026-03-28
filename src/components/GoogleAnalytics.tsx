'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

const GA_ID = 'G-5W6KCSVEJP';

/**
 * Loads Google Analytics only when the user has accepted cookies.
 * Listens for changes to localStorage (from CookieConsent) via a storage event
 * and also checks on mount.
 */
export default function GoogleAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    // Check on mount
    setConsented(localStorage.getItem('cookie-consent') === 'accepted');

    // Listen for consent changes (CookieConsent writes to localStorage in the same tab,
    // so we also poll briefly after mount to catch same-tab updates)
    function handleStorage(e: StorageEvent) {
      if (e.key === 'cookie-consent') {
        setConsented(e.newValue === 'accepted');
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!consented) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
