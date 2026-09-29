import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/** Web-only document shell: PWA meta tags for "Add to Home Screen" on iPhone. */
const base = process.env.EXPO_BASE_URL ? `${process.env.EXPO_BASE_URL.replace(/\/$/, '')}/` : '/';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Colosseum" />
        <meta name="theme-color" content="#F2F2F7" />
        <link rel="manifest" href={`${base}manifest.webmanifest`} />
        <link rel="apple-touch-icon" href={`${base}brand/app-icon-180.png`} />
        <link rel="icon" href={`${base}brand/app-icon-32.png`} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: css }} />
        {process.env.NODE_ENV === 'production' ? (
          <script dangerouslySetInnerHTML={{ __html: registerServiceWorker }} />
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}

const css = `
html, body { background: #F2F2F7; -webkit-font-smoothing: antialiased; overscroll-behavior: none; }
body { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif; }
input, textarea { font-family: inherit; }
input:focus, textarea:focus { outline: none; }
* { -webkit-tap-highlight-color: transparent; }
`;

/** The service worker (public/sw.js) keeps the installed app working offline. */
const registerServiceWorker = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('${base}sw.js', { scope: '${base}' });
  });
}
`;
