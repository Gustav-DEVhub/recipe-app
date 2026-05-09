import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import ThemeToggle from './components/theme-toggle';
import ErrorBoundary from './components/error-boundary';
import OfflineToast from './components/offline-toast';
import Home from './pages/Home';
import Details from './pages/Details';
import Favorites from './pages/Favorites';
import ShoppingList from './pages/ShoppingList';
import ImportExport from './pages/ImportExport';
import { ChefHat } from 'lucide-react';

function Header() {
  const location = useLocation();
  const title = useMemo(() => {
    if (location.pathname.startsWith('/favorites')) return 'Favorites';
    if (location.pathname.startsWith('/shopping-list')) return 'Shopping List';
    if (location.pathname.startsWith('/import-export')) return 'Import / Export';
    if (location.pathname.startsWith('/details/')) return 'Recipe';
    return 'Recipes';
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-black/10 backdrop-blur dark:bg-black/20">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <ChefHat aria-hidden className="h-6 w-6 text-sky-500 dark:text-sky-400" />
          <span className="text-sm font-semibold tracking-wide text-main sm:text-base">{title}</span>
        </div>
        <nav className="order-3 flex w-full flex-wrap items-center justify-center gap-1.5 sm:order-none sm:ml-auto sm:w-auto sm:justify-end sm:gap-2">
          <Link
            to="/"
            className="rounded-md px-2.5 py-2 text-sm font-medium text-main hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] sm:px-3"
          >
            Home
          </Link>
          <Link
            to="/favorites"
            className="rounded-md px-2.5 py-2 text-sm font-medium text-main hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] sm:px-3"
          >
            Favorites
          </Link>
          <Link
            to="/shopping-list"
            className="rounded-md px-2.5 py-2 text-sm font-medium text-main hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] sm:px-3"
          >
            List
          </Link>
          <Link
            to="/import-export"
            className="rounded-md px-2.5 py-2 text-sm font-medium text-main hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] sm:px-3"
          >
            Import/Export
          </Link>
        </nav>
        <div className="order-2 sm:order-none">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const [mounted, setMounted] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-full">
      <Header />
      <main id="main" className="mx-auto max-w-5xl px-3 py-5 sm:px-4 sm:py-6">
        <OfflineToast />
        {!mounted ? null : (
          <ErrorBoundary>
            <div key={location.pathname} className="route-shell">
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/details/:id" element={<Details />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/shopping-list" element={<ShoppingList />} />
                <Route path="/import-export" element={<ImportExport />} />
                <Route path="*" element={<div className="py-10 text-center">Not found.</div>} />
              </Routes>
            </div>
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
