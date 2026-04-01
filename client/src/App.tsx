import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import ThemeToggle from './components/theme-toggle';
import ErrorBoundary from './components/error-boundary';
import OfflineToast from './components/offline-toast';
import Home from './pages/Home';
import Details from './pages/Details';
import Favorites from './pages/Favorites';
import { ChefHat } from 'lucide-react';

function Header() {
  const location = useLocation();
  const title = useMemo(() => {
    if (location.pathname.startsWith('/favorites')) return 'Favorites';
    if (location.pathname.startsWith('/details/')) return 'Recipe';
    return 'Recipes';
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-black/20 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <ChefHat aria-hidden className="h-6 w-6 text-sky-400" />
          <span className="text-sm font-semibold tracking-wide text-sky-100">{title}</span>
        </div>
        <nav className="ml-auto flex items-center gap-2">
          <Link
            to="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Home
          </Link>
          <Link
            to="/favorites"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Favorites
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-full">
      <Header />
      <main id="main" className="mx-auto max-w-5xl px-4 py-6">
        <OfflineToast />
        {!mounted ? null : (
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/details/:id" element={<Details />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="*" element={<div className="py-10 text-center">Not found.</div>} />
            </Routes>
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}

