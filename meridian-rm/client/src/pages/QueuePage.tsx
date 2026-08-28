import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, Users, DollarSign, FolderOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usd, pct, apy, num } from '../lib/format';

export interface QueueRow {
  customer_id: string;
  customer_display_name: string;
  tier: string;
  home_metro: string;
  tenure_years: number;
  revenue_at_risk_usd: string;
  balance_at_risk_usd: string;
  attrition_risk_score: string;
  decision_priority: string;
  flag: 'ACT NOW' | 'WATCH' | 'MONITOR';
  recommended_action: string | null;
  recommended_offer_product_id: string | null;
  recommended_rate_apy: string | null;
  predicted_net_value_usd: string | null;
  case_id: number | null;
  case_status: string | null;
  latest_action_status: string | null;
}

function FlagBadge({ flag }: { flag: string }) {
  const variant =
    flag === 'ACT NOW' ? 'destructive' : flag === 'WATCH' ? 'default' : 'secondary';
  return <Badge variant={variant}>{flag}</Badge>;
}

function StatusBadge({ label }: { label: string | null }) {
  if (!label) return <span className="text-muted-foreground text-xs">—</span>;
  const variant =
    label === 'approved' ? 'default' : label === 'proposed' ? 'secondary' : 'outline';
  return <Badge variant={variant}>{label}</Badge>;
}

export function QueuePage({
  onSelect,
  selectedId,
  refreshKey,
}: {
  onSelect?: (id: string) => void;
  selectedId?: string | null;
  refreshKey?: number;
}) {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/retention/queue')
      .then((r) => {
        if (!r.ok) throw new Error(`Queue request failed: ${r.status}`);
        return r.json() as Promise<QueueRow[]>;
      })
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load queue'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const actNow = rows.filter((r) => r.flag === 'ACT NOW').length;
  const totalRevAtRisk = rows.reduce((s, r) => s + num(r.revenue_at_risk_usd), 0);
  const openCases = rows.filter((r) => r.case_status).length;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-indigo-700 via-indigo-800 to-sky-800 p-5 text-white shadow-md">
        {/* radar rings — customer-360 sweep */}
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-white/15" />
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-14 h-52 w-52 rounded-full border border-white/10" />
        <div aria-hidden className="pointer-events-none absolute right-4 top-2 h-32 w-32 rounded-full border border-white/[0.07]" />
        <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-2xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-200">
              Customer 360 · Retention Radar
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-1.5 leading-tight">
              Catch attrition before the balance leaves
            </h2>
            <p className="text-sm text-indigo-100/85 mt-1.5">
              Real-time next-best-action for relationship managers — surface the riskiest
              relationships, understand <em>why</em>, and approve a retention offer on the call.
              Ranked by revenue&nbsp;at&nbsp;risk &times; attrition probability.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
            disabled={loading}
            className="shrink-0 bg-white/15 text-white hover:bg-white/25 border-white/20"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="In queue" value={String(rows.length)} icon={Users} tone="indigo" />
        <KpiCard label="ACT NOW" value={String(actNow)} icon={AlertTriangle} tone="red" />
        <KpiCard label="Revenue at risk" value={usd(totalRevAtRisk)} icon={DollarSign} tone="amber" />
        <KpiCard label="Open cases" value={String(openCases)} icon={FolderOpen} tone="emerald" />
      </div>

      {error && (
        <div className="text-destructive bg-destructive/10 p-3 rounded-md text-sm">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranked at-risk customers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flag</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Rev at risk</TableHead>
                  <TableHead className="text-right">Attrition</TableHead>
                  <TableHead className="text-right">Priority</TableHead>
                  <TableHead>Recommended action</TableHead>
                  <TableHead className="text-right">Pred. net value</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading &&
                  Array.from({ length: 6 }, (_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={10}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      Queue is empty.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r) => (
                    <TableRow
                      key={r.customer_id}
                      onClick={() => onSelect?.(r.customer_id)}
                      className={`cursor-pointer ${
                        selectedId === r.customer_id ? 'bg-muted' : ''
                      }`}
                    >
                      <TableCell>
                        <FlagBadge flag={r.flag} />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.customer_display_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.customer_id} &middot; {r.home_metro}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{r.tier}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {usd(r.revenue_at_risk_usd)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pct(r.attrition_risk_score)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {num(r.decision_priority).toLocaleString('en-US', {
                          maximumFractionDigits: 0,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{r.recommended_action ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.recommended_offer_product_id}
                          {r.recommended_rate_apy ? ` @ ${apy(r.recommended_rate_apy)}` : ''}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {usd(r.predicted_net_value_usd)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={r.case_status} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={r.latest_action_status} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const TONES: Record<string, { chip: string; value: string }> = {
  indigo: { chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', value: '' },
  red: { chip: 'bg-red-500/10 text-red-600 dark:text-red-400', value: 'text-red-600 dark:text-red-400' },
  amber: { chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', value: '' },
  emerald: { chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', value: '' },
};

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'indigo',
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
}) {
  const t = TONES[tone];
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="pt-6 flex items-center gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${t.chip}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground truncate">{label}</div>
          <div className={`text-2xl font-bold mt-0.5 tabular-nums ${t.value}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
