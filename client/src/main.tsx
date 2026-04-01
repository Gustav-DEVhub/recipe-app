import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from './lib/queryClient';
import App from './App';
import './styles/globals.css';

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;

  // Vite dev serves from root; we also ship this file under /sw.js via `public/sw.js`.
  navigator.serviceWorker
    .register('/sw.js')
    .catch(() => {
      // Service worker is optional in dev; don't block app loading.
    });
}

registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster richColors expand />
    </QueryClientProvider>
  </React.StrictMode>
);

