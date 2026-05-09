import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import type { ImportConflictStrategy, ImportRecipeDTO } from '../features/favorites/db';
import {
  exportRecipesAsJson,
  exportRecipesAsMarkdown,
  exportRecipesAsPaprikaJson,
  getExportableRecipesSummary,
  importRecipesFromJson,
  importRecipesFromMarkdown,
  importRecipesFromPaprika,
  runBulkImport
} from '../features/import-export/service';

type ImportFormat = 'json' | 'markdown' | 'paprika';

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function detectFormat(fileName: string): ImportFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'markdown';
  if (lower.includes('paprika')) return 'paprika';
  return 'json';
}

export default function ImportExport() {
  const [strategy, setStrategy] = useState<ImportConflictStrategy>('skip');
  const [previewRows, setPreviewRows] = useState<ImportRecipeDTO[]>([]);
  const [sourceFormat, setSourceFormat] = useState<ImportFormat>('json');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('No file selected');
  const [exportCount, setExportCount] = useState(0);
  const [exportSourceLabel, setExportSourceLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getExportableRecipesSummary()
      .then((summary) => {
        setExportCount(summary.count);
        setExportSourceLabel(summary.source);
      })
      .catch(() => {
        setExportCount(0);
        setExportSourceLabel('local recipe data');
      });
  }, []);

  const previewStats = useMemo(() => {
    return {
      total: previewRows.length,
      withIngredients: previewRows.filter((r) => r.recipe.ingredients.length > 0).length
    };
  }, [previewRows]);

  async function handleExport(kind: 'json' | 'markdown' | 'paprika') {
    try {
      if (kind === 'json') {
        const content = await exportRecipesAsJson();
        downloadFile('recipes-export.json', content, 'application/json;charset=utf-8');
      } else if (kind === 'markdown') {
        const content = await exportRecipesAsMarkdown();
        downloadFile('recipes-export.md', content, 'text/markdown;charset=utf-8');
      } else {
        const content = await exportRecipesAsPaprikaJson();
        downloadFile('recipes-export-paprika.json', content, 'application/json;charset=utf-8');
      }
      toast.success('Export generated.');
    } catch {
      toast.error('Could not export recipes.');
    }
  }

  async function handleFileSelect(file: File) {
    const text = await file.text();
    const format = detectFormat(file.name);
    setSourceFormat(format);
    setSelectedFileName(file.name);

    try {
      let rows: ImportRecipeDTO[] = [];
      if (format === 'markdown') rows = importRecipesFromMarkdown(text);
      else if (format === 'paprika') rows = importRecipesFromPaprika(text);
      else rows = importRecipesFromJson(text);

      setPreviewRows(rows);
      toast.success(`Loaded ${rows.length} recipe(s) for preview.`);
    } catch {
      setPreviewRows([]);
      setSelectedFileName('No file selected');
      toast.error('Could not parse file. Check the format and try again.');
    }
  }

  async function executeImport() {
    if (!previewRows.length || isImporting) return;
    setIsImporting(true);
    try {
      const summary = await runBulkImport(previewRows, sourceFormat, strategy);
      toast.success(
        `Import complete: ${summary.imported} imported, ${summary.skipped} skipped, ${summary.failed} failed.`
      );
      setPreviewRows([]);
      setSelectedFileName('No file selected');
      if (fileInputRef.current) fileInputRef.current.value = '';
      const latestExportSummary = await getExportableRecipesSummary();
      setExportCount(latestExportSummary.count);
      setExportSourceLabel(latestExportSummary.source);
    } catch {
      toast.error('Import failed.');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="app-page-shell flex flex-col gap-6">
      <section className="motion-fade-up rounded-xl border border-border bg-card/50 p-4">
        <h1 className="text-main text-lg font-semibold">Import / Export Recipes</h1>
        <p className="text-muted mt-2 text-sm">
          Export all local recipes directly, or import from a file with preview and conflict handling.
        </p>
        <p className="text-muted mt-2 text-sm">
          {exportCount} local recipe(s) ready to export from {exportSourceLabel || 'local recipe data'}.
        </p>
        <h2 className="text-main mt-4 text-sm font-semibold">Export your local recipes</h2>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => handleExport('markdown')}>
            Export Markdown
          </Button>
          <Button type="button" onClick={() => handleExport('json')}>
            Export JSON
          </Button>
          <Button type="button" onClick={() => handleExport('paprika')}>
            Export Paprika JSON
          </Button>
        </div>
      </section>

      <section className="motion-fade-up rounded-xl border border-border bg-card/50 p-4">
        <h2 className="text-main text-sm font-semibold">Import from file</h2>
        <p className="text-muted mt-2 text-sm">
          Supports Markdown (`.md`), JSON, and Paprika-style JSON files.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.md,.markdown,.paprikarecipes"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                handleFileSelect(file).catch(() => toast.error('Could not read file.'));
              }
            }}
            className="sr-only"
            id="import-file-picker"
          />
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
            Select file
          </Button>
          <span className="text-muted text-sm">{selectedFileName}</span>
          <select
            value={strategy}
            onChange={(event) => setStrategy(event.target.value as ImportConflictStrategy)}
            className="h-10 rounded-md border border-[color:var(--panel-border)] bg-[color:var(--surface-strong)] px-3 text-sm text-[color:var(--text-main)]"
            aria-label="Import conflict strategy"
          >
            <option value="skip">Skip duplicates</option>
            <option value="overwrite">Overwrite existing</option>
          </select>

          <Button type="button" onClick={executeImport} disabled={!previewRows.length || isImporting}>
            {isImporting ? 'Importing...' : 'Import all'}
          </Button>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-background/30 p-3">
          <p className="text-sm text-main">
            Preview: {previewStats.total} recipe(s), {previewStats.withIngredients} with ingredients.
          </p>
          {!previewRows.length ? (
            <p className="text-muted mt-1 text-xs">Select a file to preview recipes before import.</p>
          ) : (
            <ul className="motion-stagger mt-3 max-h-64 space-y-2 overflow-auto">
              {previewRows.slice(0, 50).map((row) => (
                <li key={`${row.source}-${row.recipe.id}`} className="motion-card rounded-md border border-border bg-background/40 px-3 py-2">
                  <p className="text-sm font-medium text-main">{row.recipe.title}</p>
                  <p className="text-muted text-xs">
                    {row.recipe.category || 'Uncategorized'} | {row.recipe.area || 'Unknown area'} |{' '}
                    {row.recipe.ingredients.length} ingredient(s)
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
