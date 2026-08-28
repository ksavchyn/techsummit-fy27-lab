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
import { Sparkles, FlaskConical, FileText, CheckCircle2, XCircle, Send } from 'lucide-react';
import { usd, pct, apy } from '../lib/format';

interface CommittedAction {
  action_id: number;
  customer_id: string;
  proposed_action: string;
  offer_product_id: string | null;
  offer_rate_apy: string | null;
  rationale: string | null;
  approval_status: string;
  approver: string | null;
  created_at: string;
  committed_at: string | null;
}

export interface CustomerDetail {
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
  onCommitted,
}: {
  customerId: string | null;
  open: boolean;
  onClose: () => void;
  onCommitted?: () => void;
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

  // Act state — propose -> (edit/correct) -> approve/reject, human in the loop.
  const [actAction, setActAction] = useState('');
  const [actOffer, setActOffer] = useState('');
  const [actRate, setActRate] = useState('');
  const [actRationale, setActRationale] = useState('');
  const [approver, setApprover] = useState('Alan Silva (RM)');
  const [proposal, setProposal] = useState<CommittedAction | null>(null);
  const [committed, setCommitted] = useState<CommittedAction | null>(null);
  const [actLoading, setActLoading] = useState(false);

  const reset = () => {
    setDetail(null);
    setExplanation(null);
    setScenario('');
    setWhatif(null);
    setMemo(null);
    setMemoNotes([]);
    setMemoMethod(null);
    setErr(null);
    setProposal(null);
    setCommitted(null);
    setActAction('');
    setActOffer('');
    setActRate('');
    setActRationale('');
  };

  const loadDetail = useCallback(
    (id: string) =>
      fetch(`/api/retention/customer/${encodeURIComponent(id)}`)
        .then((r) => {
          if (!r.ok) throw new Error(`Lookup failed: ${r.status}`);
          return r.json() as Promise<CustomerDetail>;
        }),
    [],
  );

  useEffect(() => {
    if (!open || !customerId) return;
    reset();
    setLoading(true);
    loadDetail(customerId)
      .then((d) => {
        setDetail(d);
        // Pre-fill the action from the model's next-best action (RM can correct before commit).
        setActAction(d.recommended_action ?? 'match_competitor_rate');
        setActOffer(d.recommended_offer_product_id ?? d.atrisk_product_id ?? '');
        setActRate(d.recommended_rate_apy ?? '');
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load customer'))
      .finally(() => setLoading(false));
  }, [open, customerId, loadDetail]);

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

  // ── ACT ──────────────────────────────────────────────────────────────────
  const rateNum = () => {
    const n = parseFloat(actRate);
    return Number.isFinite(n) ? n : null;
  };

  const runPropose = async () => {
    if (!customerId || !actAction.trim()) return;
    setActLoading(true);
    setErr(null);
    try {
      const d = (await post('/api/retention/propose', {
        customer_id: customerId,
        proposed_action: actAction.trim(),
        offer_product_id: actOffer.trim() || undefined,
        offer_rate_apy: rateNum(),
        rationale: actRationale.trim() || undefined,
      })) as CommittedAction;
      setProposal(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Propose failed');
    } finally {
      setActLoading(false);
    }
  };

  const runApprove = async () => {
    if (!proposal || !approver.trim()) return;
    // Corrected if the RM edited any field away from what was proposed.
    const corrected =
      actAction.trim() !== proposal.proposed_action ||
      (actOffer.trim() || null) !== (proposal.offer_product_id ?? null) ||
      rateNum() !== (proposal.offer_rate_apy != null ? Number(proposal.offer_rate_apy) : null) ||
      (actRationale.trim() || null) !== (proposal.rationale ?? null);
    setActLoading(true);
    setErr(null);
    try {
      const d = (await post('/api/retention/approve', {
        action_id: proposal.action_id,
        approver: approver.trim(),
        corrected,
        proposed_action: actAction.trim(),
        offer_product_id: actOffer.trim() || undefined,
        offer_rate_apy: rateNum(),
        rationale: actRationale.trim() || undefined,
      })) as CommittedAction;
      setCommitted(d);
      setProposal(null);
      if (customerId) setDetail(await loadDetail(customerId)); // closed loop: refresh case state
      onCommitted?.(); // refresh the queue behind the sheet
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setActLoading(false);
    }
  };

  const runReject = async () => {
    if (!proposal || !approver.trim()) return;
    setActLoading(true);
    setErr(null);
    try {
      const d = (await post('/api/retention/reject', {
        action_id: proposal.action_id,
        approver: approver.trim(),
      })) as CommittedAction;
      setCommitted(d);
      setProposal(null);
      onCommitted?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setActLoading(false);
    }
  };

  const field =
    'w-full rounded-md border bg-background px-2 py-1 text-sm';

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

              <Separator />

              {/* ACT */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Send className="h-4 w-4" /> Act — approve a retention action
                </h3>

                {committed ? (
                  <div
                    className={`rounded-md border p-3 text-sm ${
                      committed.approval_status === 'rejected'
                        ? 'bg-destructive/10'
                        : 'bg-emerald-500/10'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      {committed.approval_status === 'rejected' ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Action #{committed.action_id} {committed.approval_status} by {committed.approver}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {committed.proposed_action}
                      {committed.offer_product_id ? ` · ${committed.offer_product_id}` : ''}
                      {committed.offer_rate_apy ? ` @ ${apy(committed.offer_rate_apy)}` : ''}
                      {committed.committed_at ? ` · committed ${committed.committed_at}` : ''}
                    </div>
                    <div className="text-xs mt-1">
                      Case is now <Badge variant="default">{detail.case_status ?? 'working'}</Badge> —
                      reflected on the next queue read (closed loop).
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs space-y-1">
                        <span className="text-muted-foreground">Action</span>
                        <input
                          className={field}
                          value={actAction}
                          onChange={(e) => setActAction(e.target.value)}
                          placeholder="match_competitor_rate"
                        />
                      </label>
                      <label className="text-xs space-y-1">
                        <span className="text-muted-foreground">Offer product</span>
                        <input
                          className={field}
                          value={actOffer}
                          onChange={(e) => setActOffer(e.target.value)}
                          placeholder="CD-12M"
                        />
                      </label>
                      <label className="text-xs space-y-1">
                        <span className="text-muted-foreground">Offer rate (APY, e.g. 0.045)</span>
                        <input
                          className={field}
                          value={actRate}
                          onChange={(e) => setActRate(e.target.value)}
                          placeholder="0.0450"
                          inputMode="decimal"
                        />
                      </label>
                      <label className="text-xs space-y-1">
                        <span className="text-muted-foreground">Approver</span>
                        <input
                          className={field}
                          value={approver}
                          onChange={(e) => setApprover(e.target.value)}
                        />
                      </label>
                    </div>
                    <Textarea
                      placeholder="Rationale (grounds the decision — from the explanation / what-if / memo)"
                      value={actRationale}
                      onChange={(e) => setActRationale(e.target.value)}
                      rows={2}
                    />

                    {!proposal ? (
                      <Button size="sm" onClick={runPropose} disabled={actLoading || !actAction.trim()}>
                        {actLoading ? <Spinner className="mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        Propose action
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                          Proposed action #{proposal.action_id} ({proposal.approval_status}) — review /
                          correct the fields above, then a person approves before it commits.
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={runApprove} disabled={actLoading || !approver.trim()}>
                            {actLoading ? <Spinner className="mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Approve &amp; commit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={runReject}
                            disabled={actLoading || !approver.trim()}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
