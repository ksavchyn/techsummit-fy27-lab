import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Button,
  Badge,
  Textarea,
  Separator,
  Spinner,
} from '@databricks/appkit-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { Sparkles, FlaskConical, FileText } from 'lucide-react';
import { usd, pct, apy } from '../lib/format';

interface CustomerDetail {
  customer_id: string;
  customer_display_name: string;
  tier: string;
  home_metro: string;
  tenure_years: number;
  profile_summary: string | null;
  total_balance_usd: string;
  deposit_balance_usd: string;
  balance_at_risk_usd: string;
  revenue_at_risk_usd: string;
  attrition_risk_score: string;
  balance_outflow_30d_usd: string;
  churn_signal_score: string;
  product_count: number;
  risk_band: string;
  atrisk_product_id: string | null;
  days_to_maturity: number | null;
  current_rate_apy: string | null;
  recommended_action: string | null;
  recommended_offer_product_id: string | null;
  recommended_rate_apy: string | null;
  predicted_retained_usd: string | null;
  predicted_net_value_usd: string | null;
  case_id: number | null;
  case_status: string | null;
  assigned_rm: string | null;
}

interface RetrievedNote {
  note_id: number;
  author: string | null;
  note_text: string;
  methods: string[];
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}

export function DetailSheet({
  customerId,
  open,
  onClose,
}: {
  customerId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // Assist state
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [scenario, setScenario] = useState('');
  const [whatif, setWhatif] = useState<string | null>(null);
  const [whatifLoading, setWhatifLoading] = useState(false);
  const [memo, setMemo] = useState<string | null>(null);
  const [memoNotes, setMemoNotes] = useState<RetrievedNote[]>([]);
  const [memoMethod, setMemoMethod] = useState<string | null>(null);
  const [memoLoading, setMemoLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setDetail(null);
    setExplanation(null);
    setScenario('');
    setWhatif(null);
    setMemo(null);
    setMemoNotes([]);
    setMemoMethod(null);
    setErr(null);
  };

  useEffect(() => {
    if (!open || !customerId) return;
    reset();
    setLoading(true);
    fetch(`/api/retention/customer/${encodeURIComponent(customerId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Lookup failed: ${r.status}`);
        return r.json() as Promise<CustomerDetail>;
      })
      .then(setDetail)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load customer'))
      .finally(() => setLoading(false));
  }, [open, customerId]);

  const post = useCallback(async (path: string, body: unknown) => {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${path} failed: ${r.status}`);
    return r.json();
  }, []);

  const runExplain = async () => {
    if (!customerId) return;
    setExplaining(true);
    setErr(null);
    try {
      const d = (await post('/api/retention/explain', { customer_id: customerId })) as {
        explanation: string;
      };
      setExplanation(d.explanation);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Explain failed');
    } finally {
      setExplaining(false);
    }
  };

  const runWhatif = async () => {
    if (!customerId || !scenario.trim()) return;
    setWhatifLoading(true);
    setErr(null);
    try {
      const d = (await post('/api/retention/whatif', {
        customer_id: customerId,
        scenario: scenario.trim(),
      })) as { answer: string };
      setWhatif(d.answer);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'What-if failed');
    } finally {
      setWhatifLoading(false);
    }
  };

  const runMemo = async () => {
    if (!customerId) return;
    setMemoLoading(true);
    setErr(null);
    try {
      const d = (await post('/api/retention/memo', { customer_id: customerId })) as {
        memo: string;
        retrieval: { method: string; notes: RetrievedNote[] };
      };
      setMemo(d.memo);
      setMemoNotes(d.retrieval.notes);
      setMemoMethod(d.retrieval.method);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Memo failed');
    } finally {
      setMemoLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{detail?.customer_display_name ?? customerId ?? 'Customer'}</SheetTitle>
          <SheetDescription>
            {customerId} {detail ? `· ${detail.tier} · ${detail.home_metro}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-8 space-y-6">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Spinner /> Loading customer…
            </div>
          )}
          {err && (
            <div className="text-destructive bg-destructive/10 p-3 rounded-md text-sm">{err}</div>
          )}

          {detail && (
            <>
              {/* Position */}
              <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Fact label="Attrition risk" value={pct(detail.attrition_risk_score)} />
                <Fact label="Revenue at risk" value={usd(detail.revenue_at_risk_usd)} />
                <Fact label="Balance at risk" value={usd(detail.balance_at_risk_usd)} />
                <Fact label="Deposits" value={usd(detail.deposit_balance_usd)} />
                <Fact label="30d outflow" value={usd(detail.balance_outflow_30d_usd)} />
                <Fact label="Tenure" value={`${detail.tenure_years} yrs`} />
                <Fact
                  label="At-risk product"
                  value={`${detail.atrisk_product_id ?? '—'}${
                    detail.days_to_maturity != null ? ` · ${detail.days_to_maturity}d` : ''
                  }`}
                />
                <Fact
                  label="Current rate"
                  value={detail.current_rate_apy ? apy(detail.current_rate_apy) : '—'}
                />
                <Fact label="Case" value={detail.case_status ?? 'no open case'} />
              </section>

              <div className="rounded-md border p-3 bg-muted/40">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Model next-best action
                </div>
                <div className="text-sm font-medium">
                  {detail.recommended_action ?? '—'} · {detail.recommended_offer_product_id}
                  {detail.recommended_rate_apy ? ` @ ${apy(detail.recommended_rate_apy)}` : ''}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Predicted net value {usd(detail.predicted_net_value_usd)} · retained{' '}
                  {usd(detail.predicted_retained_usd)}
                </div>
              </div>

              <Separator />

              {/* ASSIST */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Assist
                </h3>

                {/* (a) Why flagged */}
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={runExplain} disabled={explaining}>
                    {explaining ? <Spinner className="mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Why is this customer flagged?
                  </Button>
                  {explanation && (
                    <div className="text-sm whitespace-pre-wrap rounded-md border p-3 bg-card">
                      {explanation}
                    </div>
                  )}
                </div>

                {/* (b) What-if */}
                <div className="space-y-2">
                  <div className="text-xs font-medium flex items-center gap-2">
                    <FlaskConical className="h-4 w-4" /> What-if scenario
                  </div>
                  <Textarea
                    placeholder="e.g. What if we match a competitor at 4.50% APY for 12 months?"
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={runWhatif}
                    disabled={whatifLoading || !scenario.trim()}
                  >
                    {whatifLoading ? <Spinner className="mr-2" /> : null}
                    Run what-if
                  </Button>
                  {whatif && (
                    <div className="text-sm whitespace-pre-wrap rounded-md border p-3 bg-card">
                      {whatif}
                    </div>
                  )}
                </div>

                {/* (c) Draft memo */}
                <div className="space-y-2">
                  <Button variant="outline" size="sm" onClick={runMemo} disabled={memoLoading}>
                    {memoLoading ? <Spinner className="mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                    Draft retention memo
                  </Button>
                  {memoMethod && (
                    <div className="text-xs text-muted-foreground">
                      Retrieved via{' '}
                      <Badge variant="secondary">{memoMethod}</Badge> over{' '}
                      <code>ops.rm_notes</code> · {memoNotes.length} note(s)
                    </div>
                  )}
                  {memoNotes.length > 0 && (
                    <div className="space-y-1">
                      {memoNotes.map((n) => (
                        <div key={n.note_id} className="text-xs rounded border p-2 bg-muted/40">
                          <span className="text-muted-foreground">
                            note {n.note_id}
                            {n.author ? ` · ${n.author}` : ''} · {n.methods.join('+')}
                          </span>
                          <div>{n.note_text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {memo && (
                    <div className="text-sm whitespace-pre-wrap rounded-md border p-3 bg-card">
                      {memo}
                    </div>
                  )}
                </div>
              </section>

            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
