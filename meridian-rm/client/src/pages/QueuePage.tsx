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
import { RefreshCw } from 'lucide-react';
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Retention Queue</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Open at-risk customers, ranked by decision priority (revenue at risk &times; attrition
            probability). Reads the synced gold layer joined to live case state.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="In queue" value={String(rows.length)} />
        <KpiCard label="ACT NOW" value={String(actNow)} accent="text-destructive" />
        <KpiCard label="Revenue at risk" value={usd(totalRevAtRisk)} />
        <KpiCard label="Open cases" value={String(openCases)} />
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

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${accent ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
