import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  clearAllShoppingListItems,
  clearCompletedShoppingItems,
  exportShoppingListCsv,
  exportShoppingListJson,
  getShoppingListItems,
  removeShoppingListItem,
  setShoppingItemChecked,
  type ShoppingListItem
} from '../features/favorites/db';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

type FilterMode = 'all' | 'pending' | 'done';

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ShoppingList() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [loading, setLoading] = useState(true);

  async function refresh(withLoading = true) {
    if (withLoading) setLoading(true);
    try {
      setItems(await getShoppingListItems());
    } finally {
      if (withLoading) setLoading(false);
    }
  }

  useEffect(() => {
    refresh(true).catch(() => {
      setItems([]);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (filterMode === 'pending') return items.filter((item) => !item.checked);
    if (filterMode === 'done') return items.filter((item) => item.checked);
    return items;
  }, [items, filterMode]);

  const doneCount = items.filter((item) => item.checked).length;

  async function toggleItem(item: ShoppingListItem) {
    const nextChecked = !item.checked;
    setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, checked: nextChecked } : entry)));
    try {
      await setShoppingItemChecked(item.id, nextChecked);
      await refresh(false);
    } catch {
      // Restore server-of-truth state if the DB write fails.
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, checked: item.checked } : entry)));
      toast.error('Could not update item state.');
    }
  }

  async function deleteItem(item: ShoppingListItem) {
    setItems((prev) => prev.filter((entry) => entry.id !== item.id));
    try {
      await removeShoppingListItem(item.id);
      await refresh(false);
    } catch {
      await refresh(false);
      toast.error('Could not remove item.');
    }
  }

  async function handleClearCompleted() {
    try {
      await clearCompletedShoppingItems();
      await refresh(false);
      toast.success('Completed items removed.');
    } catch {
      toast.error('Could not clear completed items.');
    }
  }

  async function handleClearAll() {
    try {
      await clearAllShoppingListItems();
      await refresh(false);
      toast.success('Shopping list discarded.');
    } catch {
      toast.error('Could not discard shopping list.');
    }
  }

  async function handleExportCsv() {
    const csv = await exportShoppingListCsv();
    downloadFile('shopping-list.csv', csv, 'text/csv;charset=utf-8');
  }

  async function handleExportJson() {
    const json = await exportShoppingListJson();
    downloadFile('shopping-list.json', json, 'application/json;charset=utf-8');
  }

  return (
    <div className="app-page-shell flex flex-col gap-6">
      <section className="motion-fade-up mx-auto w-full max-w-4xl rounded-xl border border-border bg-card/50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-main text-lg font-semibold">Shopping List</h1>
          <Badge>{items.length} item(s)</Badge>
          <Badge>{doneCount} completed</Badge>
        </div>
        <p className="text-muted mt-2 text-sm">Offline-first checklist from your saved recipe ingredients.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant={filterMode === 'all' ? 'default' : 'ghost'} onClick={() => setFilterMode('all')}>
            All
          </Button>
          <Button
            type="button"
            variant={filterMode === 'pending' ? 'default' : 'ghost'}
            onClick={() => setFilterMode('pending')}
          >
            Pending
          </Button>
          <Button type="button" variant={filterMode === 'done' ? 'default' : 'ghost'} onClick={() => setFilterMode('done')}>
            Completed
          </Button>
          <Button type="button" variant="secondary" onClick={handleClearCompleted}>
            Clear completed
          </Button>
          <Button type="button" variant="destructive" onClick={handleClearAll}>
            Discard list
          </Button>
          <Button type="button" variant="secondary" onClick={handleExportCsv}>
            Export CSV
          </Button>
          <Button type="button" variant="secondary" onClick={handleExportJson}>
            Export JSON
          </Button>
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </section>

      <section className="motion-fade-up mx-auto w-full max-w-4xl rounded-xl border border-border bg-card/50 p-4">
        {loading ? (
          <p className="text-muted text-sm">Loading shopping list...</p>
        ) : !filtered.length ? (
          <p className="text-muted text-sm">No items yet. Add ingredients from recipe cards or details.</p>
        ) : (
          <ul className="motion-stagger space-y-3">
            {filtered.map((item) => (
              <li
                key={item.id}
                className="motion-card flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3"
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleItem(item)}
                  aria-label={`Mark ${item.ingredient} as ${item.checked ? 'pending' : 'completed'}`}
                  className="h-4 w-4 accent-orange-500"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${item.checked ? 'text-muted line-through' : 'text-main'}`}>{item.ingredient}</p>
                  <p className="text-muted text-xs">{item.quantityText || item.measure || 'No quantity'}</p>
                </div>
                <Button type="button" variant="ghost" className="shrink-0" onClick={() => deleteItem(item)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
