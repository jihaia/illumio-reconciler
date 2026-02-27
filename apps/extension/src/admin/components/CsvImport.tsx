import { useState, useRef } from 'react';
import {
  listPortfolios, createPortfolio,
  listAssets, createAsset,
  listAppGroupings, createAppGrouping,
  listApplications, createApplication,
  listComponents, createComponent,
  listComponentTypes,
} from '../api';

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

interface CsvRow {
  portfolio: string;
  asset: string;
  app_grouping: string;
  application: string;
  component: string;
  component_type?: string;
}

interface ImportResult {
  created: Record<string, number>;
  skipped: Record<string, number>;
  errors: string[];
}

export function CsvImport({ onDone, onCancel }: Props) {
  const [csvText, setCsvText] = useState('');
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parsed, setParsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function parseCsv(text: string) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      setError('CSV must have a header row and at least one data row');
      return;
    }

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const required = ['portfolio', 'asset', 'app_grouping', 'application', 'component'];
    const missing = required.filter(r => !header.includes(r));
    if (missing.length > 0) {
      setError(`Missing columns: ${missing.join(', ')}`);
      return;
    }

    const parsed: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim());
      if (vals.length < header.length) continue;
      const row: Record<string, string> = {};
      header.forEach((h, idx) => { row[h] = vals[idx]; });
      if (!row.portfolio || !row.asset || !row.app_grouping || !row.application || !row.component) continue;
      parsed.push(row as unknown as CsvRow);
    }

    if (parsed.length === 0) {
      setError('No valid data rows found');
      return;
    }

    setRows(parsed);
    setParsed(true);
    setError('');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setCsvText(text);
      parseCsv(text);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    setImporting(true);
    setError('');
    const created: Record<string, number> = { portfolio: 0, asset: 0, app_grouping: 0, application: 0, component: 0 };
    const skipped: Record<string, number> = { portfolio: 0, asset: 0, app_grouping: 0, application: 0, component: 0 };
    const errors: string[] = [];

    // Cache for IDs: "level:parentId:name" → id
    const cache = new Map<string, string>();

    // Load component types for lookup
    const typesData = await listComponentTypes().catch(() => ({ data: [], count: 0 }));
    const typeMap = new Map(typesData.data.map(t => [t.label.toLowerCase(), t.component_type_id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // 1. Portfolio
        const pfKey = `portfolio::${row.portfolio}`;
        let pfId = cache.get(pfKey);
        if (!pfId) {
          const existing = await listPortfolios();
          const found = existing.data.find(p => p.name === row.portfolio);
          if (found) {
            pfId = found.portfolio_id;
            skipped.portfolio++;
          } else {
            const created_ = await createPortfolio({ name: row.portfolio });
            pfId = created_.portfolio_id;
            created.portfolio++;
          }
          cache.set(pfKey, pfId);
        }

        // 2. Asset
        const asKey = `asset:${pfId}:${row.asset}`;
        let asId = cache.get(asKey);
        if (!asId) {
          const existing = await listAssets(pfId, undefined, row.asset);
          const found = existing.data.find(a => a.name === row.asset);
          if (found) {
            asId = found.asset_id;
            skipped.asset++;
          } else {
            const created_ = await createAsset({ name: row.asset, portfolio_id: pfId });
            asId = created_.asset_id;
            created.asset++;
          }
          cache.set(asKey, asId);
        }

        // 3. App Grouping
        const agKey = `app_grouping:${asId}:${row.app_grouping}`;
        let agId = cache.get(agKey);
        if (!agId) {
          const existing = await listAppGroupings(asId, undefined, row.app_grouping);
          const found = existing.data.find(g => g.name === row.app_grouping);
          if (found) {
            agId = found.app_grouping_id;
            skipped.app_grouping++;
          } else {
            const created_ = await createAppGrouping({ name: row.app_grouping, asset_id: asId });
            agId = created_.app_grouping_id;
            created.app_grouping++;
          }
          cache.set(agKey, agId);
        }

        // 4. Application
        const appKey = `application:${agId}:${row.application}`;
        let appId = cache.get(appKey);
        if (!appId) {
          const existing = await listApplications(agId, undefined, row.application);
          const found = existing.data.find(a => a.name === row.application);
          if (found) {
            appId = found.application_id;
            skipped.application++;
          } else {
            const created_ = await createApplication({ name: row.application, app_grouping_id: agId });
            appId = created_.application_id;
            created.application++;
          }
          cache.set(appKey, appId);
        }

        // 5. Component
        const cKey = `component:${appId}:${row.component}`;
        if (!cache.has(cKey)) {
          const existing = await listComponents(appId, undefined, row.component);
          const found = existing.data.find(c => c.name === row.component);
          if (found) {
            skipped.component++;
          } else {
            const compTypeId = row.component_type ? typeMap.get(row.component_type.toLowerCase()) : undefined;
            await createComponent({ name: row.component, application_id: appId, component_type_id: compTypeId });
            created.component++;
          }
          cache.set(cKey, 'done');
        }
      } catch (err: any) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    setResult({ created, skipped, errors });
    setImporting(false);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text">Import CSV</h2>
        <button onClick={onCancel} className="text-xs text-text-muted hover:text-text">Cancel</button>
      </div>

      {result ? (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-green-600">Import Complete</h3>
          <div className="grid grid-cols-5 gap-2 text-center">
            {(['portfolio', 'asset', 'app_grouping', 'application', 'component'] as const).map(level => (
              <div key={level} className="bg-gray-50 rounded p-2">
                <div className="text-[10px] text-text-muted capitalize">{level.replace('_', ' ')}</div>
                <div className="text-sm font-medium text-green-600">+{result.created[level]}</div>
                <div className="text-[10px] text-text-muted">{result.skipped[level]} existing</div>
              </div>
            ))}
          </div>
          {result.errors.length > 0 && (
            <div className="bg-red-50 rounded p-2">
              <p className="text-xs text-red-600 font-medium mb-1">{result.errors.length} error(s):</p>
              {result.errors.slice(0, 10).map((e, i) => (
                <p key={i} className="text-[10px] text-red-500">{e}</p>
              ))}
            </div>
          )}
          <button onClick={onDone} className="btn btn-primary btn-sm">Done</button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            Upload a CSV with columns: <code className="bg-gray-100 px-1 rounded">portfolio, asset, app_grouping, application, component</code>.
            Optional: <code className="bg-gray-100 px-1 rounded">component_type</code>.
          </p>

          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="hidden"
            />
            <button onClick={() => fileRef.current?.click()} className="btn btn-outline btn-sm">
              Choose File
            </button>
          </div>

          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={"portfolio,asset,app_grouping,application,component,component_type\nPortfolio-A,Asset-1,Group-1,App-1,Comp-1,Tomcat"}
            rows={8}
            className="input text-xs font-mono"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2">
            {!parsed && (
              <button onClick={() => parseCsv(csvText)} disabled={!csvText.trim()} className="btn btn-outline btn-sm">
                Preview
              </button>
            )}
            {parsed && (
              <>
                <p className="text-xs text-text-muted self-center">{rows.length} rows to import</p>
                <button onClick={handleImport} disabled={importing} className="btn btn-primary btn-sm">
                  {importing ? 'Importing...' : `Import ${rows.length} rows`}
                </button>
                <button onClick={() => { setParsed(false); setRows([]); }} className="btn btn-outline btn-sm">
                  Reset
                </button>
              </>
            )}
          </div>

          {parsed && rows.length > 0 && (
            <div className="overflow-x-auto border border-border rounded">
              <table className="text-[10px] w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-2 py-1 text-left">Portfolio</th>
                    <th className="px-2 py-1 text-left">Asset</th>
                    <th className="px-2 py-1 text-left">App Grouping</th>
                    <th className="px-2 py-1 text-left">Application</th>
                    <th className="px-2 py-1 text-left">Component</th>
                    <th className="px-2 py-1 text-left">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1">{r.portfolio}</td>
                      <td className="px-2 py-1">{r.asset}</td>
                      <td className="px-2 py-1">{r.app_grouping}</td>
                      <td className="px-2 py-1">{r.application}</td>
                      <td className="px-2 py-1">{r.component}</td>
                      <td className="px-2 py-1 text-text-muted">{r.component_type || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 20 && (
                <p className="text-[10px] text-text-muted text-center py-1">...and {rows.length - 20} more</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
