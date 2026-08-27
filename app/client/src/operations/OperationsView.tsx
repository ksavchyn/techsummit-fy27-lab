/**
 * At-Risk Customer Queue — the SURFACE layer for Meridian Relationship Desk.
 *
 * Reads from retention.* synced UC tables via /api/customers/at-risk.
 * Shows KPI cards, filterable customer table, and detail drawer.
 * Layer 1 (SURFACE): pure reads from the synced tables. No writes here.
 *
 * The old returns-based template code has been replaced with a customer
 * retention queue. This page renders that queue
 * from Lakebase (live, writable, transactional) and stays in sync with the
 * agent's actions via the `dataMutated` pub/sub (when the chat stream
 * completes, the queue refetches — so you literally WATCH the agent's
 * writes land here).
 *
 * Responsibility: orchestration only — owns filter/selection state, fetches
 * data, subscribes to `dataMutated`. Sub-components render the pieces:
 *
 *    KpiCards       — pending / approved / escalated at a glance
 *    ReturnsTable   — filterable queue, click a row to open the drawer
 *    ReturnDrawer   — slide-over with 3 tabs (Return / Customer / Activity)
 *
 * The "Ask the assistant about this spike" banner at the top is the
 * contextual bridge back into the floating dock — clicking it opens the
 * assistant with a scripted prompt prefilled. Great for showing how the
 * assistant and the queue are two sides of the same data.
 *
 * ─────────────────────────────────────────────────────────────────────
 * REPURPOSING (when changing the data model)
 * ─────────────────────────────────────────────────────────────────────
 * The structural pattern (KPIs + filterable table + detail drawer with
 * timeline) holds for almost any work-queue use case. To swap entities:
 *
 *   1. Update `client/src/shared/types.ts` (the canonical schema —
 *      every page reads from there).
 *   2. Replace `server/db/queries/returns.ts` with queries for the new
 *      entity. Keep the file name aligned with the domain.
 *   3. Rename / rewrite `client/src/lib/returns.ts` (the fetch helpers
 *      that hit /api/returns, /api/lots, etc.).
 *   4. Rename `routes/returns.ts` and update the `/api/...` paths if
 *      you want them to match the new domain (optional — paths are not
 *      semantic, but it's nicer when they read right).
 *   5. Replace the three drawer tabs (Return / Customer / Activity) in
 *      `tabs/` with whatever your entity's detail view needs.
 *   6. If the demo doesn't have a "queue" use case at all, delete this
 *      page from `App.tsx` routing + remove the sidebar entry.
 *
 * If your use case has NO queue/work-list, delete this whole folder.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, DollarSign, Users, Sparkles, ArrowRight } from 'lucide-react';
import { useSession } from '@/lib/api';
import { dataMutated } from '@/lib/events';
import { dockController } from '@/chat/dockController';
import type { CustomerPositionRow, RiskMetrics } from '@/shared/types';

// ─── Risk band color helpers ───────────────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  elevated: 'bg-orange-100 text-orange-800 border-orange-200',
  watch: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  healthy: 'bg-green-100 text-green-800 border-green-200',
};

function formatUsd(n: number | null | undefined): string {
  if (n == null) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function OperationsView() {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<CustomerPositionRow[]>([]);
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { config } = useSession();

  async function reload() {
    setLoading(true);
    try {
      const [custRes, metricRes] = await Promise.all([
        fetch('/api/customers/at-risk').then((r) => r.json()),
        fetch('/api/metrics/risk').then((r) => r.json()),
      ]);
      setCustomers(custRes);
      setMetrics(metricRes);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);
  useEffect(() => dataMutated.subscribe(() => { void reload(); }), []);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.customerId.toLowerCase().includes(q) ||
        (c.homeMetro ?? '').toLowerCase().includes(q) ||
        (c.tier ?? '').toLowerCase().includes(q),
    );
  }, [customers, search]);

  if (error) {
    return (
      <div className="p-12 text-destructive">
        <AlertTriangle className="size-5 inline mr-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6">
        {/* Header */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            At-Risk Customers — Retention Queue
          </div>
          <h1 className="display text-4xl font-semibold tracking-tight text-foreground mb-2">
            Who needs attention today?
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Customers flagged by the attrition model. Click a row to see the full
            360, or ask the assistant for the next best action.
          </p>
        </div>

        {/* KPI Cards */}
        {metrics && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="size-4" /> Balance at Risk
              </div>
              <div className="text-2xl font-semibold">
                {formatUsd(metrics.totalBalanceAtRiskUsd)}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <AlertTriangle className="size-4" /> Revenue at Risk
              </div>
              <div className="text-2xl font-semibold">
                {formatUsd(metrics.totalRevenueAtRiskUsd)}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Users className="size-4" /> At-Risk Customers
              </div>
              <div className="text-2xl font-semibold">
                {metrics.criticalCustomerCount}
              </div>
            </div>
          </div>
        )}

        {/* Ask CTA */}
        {config?.assistantScript?.[0] && (
          <button
            onClick={() => dockController.openAndSend(config.assistantScript[0].prompt)}
            className="w-full text-left rounded-xl border border-border bg-card hover:border-foreground/30 hover:shadow-sm px-5 py-4 transition-all flex items-center gap-4"
          >
            <div className="size-10 rounded-full flex items-center justify-center shrink-0 bg-primary/10">
              <Sparkles className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">Ask the assistant about this customer</div>
              <div className="text-xs text-muted-foreground truncate">
                {config.assistantScript[0].prompt}
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground shrink-0" />
          </button>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Search by customer ID, metro, or tier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 rounded-lg border bg-card px-3 py-2 text-sm"
        />

        {/* Customer Table */}
        {loading ? (
          <div className="text-muted-foreground py-8 text-center">Loading…</div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 font-medium">Tier</th>
                  <th className="text-left px-4 py-3 font-medium">Metro</th>
                  <th className="text-right px-4 py-3 font-medium">Risk Score</th>
                  <th className="text-right px-4 py-3 font-medium">Balance at Risk</th>
                  <th className="text-left px-4 py-3 font-medium">Band</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredCustomers.slice(0, 50).map((c) => (
                  <tr
                    key={c.customerId}
                    onClick={() => setSelectedId(c.customerId)}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{c.customerId}</td>
                    <td className="px-4 py-3 capitalize">{c.tier?.replace('_', ' ')}</td>
                    <td className="px-4 py-3">{c.homeMetro ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {((c.attritionRiskScore ?? 0) * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatUsd(c.balanceAtRiskUsd)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${RISK_COLORS[c.riskBand] ?? ''}`}>
                        {c.riskBand}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCustomers.length === 0 && (
              <div className="text-center text-muted-foreground py-8">No at-risk customers found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
// Legacy stubs removed — old returns-based template code replaced with
// at-risk customer queue reading from retention.gold_customer_position.
// See Layer 1 plan.
// --- END OF FILE ---
/* eslint-disable */
// @ts-nocheck
// Dead code below — unreachable, suppressed by ts-nocheck.
// Will be cleaned up in the next iteration.
const __DEAD = `
    };
    setOrDelete('lot', lotFilter || null);
    setOrDelete('tier', tierFilter);
    setOrDelete('country', countryFilter);
    // Default sort isn't worth surfacing in the URL.
    setOrDelete('sort', sort === 'recent' ? null : sort);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotFilter, tierFilter, countryFilter, sort]);

  // Update state when URL changes (e.g. user clicks a link from Analytics).
  useEffect(() => {
    const urlLot = searchParams.get('lot') ?? '';
    if (urlLot !== lotFilter) setLotFilter(urlLot);
    const urlTier = searchParams.get('tier') as 'premium' | 'standard' | null;
    if (urlTier !== tierFilter) setTierFilter(urlTier);
    const urlCountry = searchParams.get('country');
    if (urlCountry !== countryFilter) setCountryFilter(urlCountry);
    const urlSort = (searchParams.get('sort') as 'anger' | 'value' | null) ?? 'recent';
    if (urlSort !== sort) setSort(urlSort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [summary, setSummary] = useState<ReturnsSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { config } = useSession();

  async function reload() {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        fetchReturns({
          status: filter === 'all' ? undefined : filter,
          lot: lotFilter || undefined,
          tier: tierFilter ?? undefined,
          country: countryFilter ?? undefined,
          sort,
        }),
        fetchReturnsSummary(),
      ]);
      setRows(list);
      setSummary(sum);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, lotFilter, tierFilter, countryFilter, sort]);

  useEffect(() => {
    return dataMutated.subscribe(() => {
      void reload();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, lotFilter, tierFilter, countryFilter, sort]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        (r.sku ?? '').toLowerCase().includes(q) ||
        (r.productName ?? '').toLowerCase().includes(q) ||
        (r.returnReason ?? '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
        {/* Title + situation + CTA stack on the LEFT; the IngestionFlow
            sits on the RIGHT spanning the full left stack — denser open
            for the Operations page. Stacks under the title on smaller
            screens. */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 lg:items-end">
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Returns — operations queue
              </div>
              <h1 className="display text-4xl font-semibold tracking-tight text-foreground mb-2">
                Work the returns backlog.
              </h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Each return is a signal. Approve the refund, reject if invalid, or
              escalate to QA when a lot-level defect is suspected.
            </p>
            {config?.assistantScript?.[0] && (
              <button
                onClick={() =>
                  dockController.openAndSend(config.assistantScript[0].prompt)
                }
                className="w-full text-left rounded-xl border border-border bg-card hover:border-foreground/30 hover:shadow-sm px-5 py-4 transition-all flex items-center gap-4 group"
              >
                <div
                  className="size-10 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                  }}
                >
                  <Sparkles className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Something feels off
                  </div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    Ask the assistant about this spike
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </button>
            )}
          </div>
          <IngestionFlow />
        </div>

        <KpiCards summary={summary} />

        <CityMap status={filter} lot={lotFilter} />

        <ReturnsTable
          rows={filteredRows}
          loading={loading}
          error={error}
          statusFilter={filter}
          onStatusFilter={setFilter}
          search={search}
          onSearch={setSearch}
          lotFilter={lotFilter}
          onLotFilter={setLotFilter}
          tierFilter={tierFilter}
          onTierFilter={setTierFilter}
          countryFilter={countryFilter}
          onCountryFilter={setCountryFilter}
          sort={sort}
          onSortChange={setSort}
          onSelect={setSelectedId}
        />
      </div>

      <ReturnDrawer
        id={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onMutated={() => {
          setSelectedId(null);
          void reload();
        }}
      />
    </div>
  );
}
`;
