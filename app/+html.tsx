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
input, textarea { font-family: inherit; caret-color: #B91C1C; }
input:focus, textarea:focus { outline: none; }
input:focus-visible, textarea:focus-visible { box-shadow: 0 0 0 2px rgba(185, 28, 28, 0.35); border-radius: 10px; }
:focus-visible { outline: 2px solid rgba(185, 28, 28, 0.6); outline-offset: 2px; }
::selection { background: rgba(185, 28, 28, 0.18); color: #1C1C1E; }
* { -webkit-tap-highlight-color: transparent; }
input::placeholder { color: #8E8E93; }
`;

/** The service worker (public/sw.js) keeps the installed app working offline. */
const registerServiceWorker = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('${base}sw.js', { scope: '${base}' });
  });
}
`;
