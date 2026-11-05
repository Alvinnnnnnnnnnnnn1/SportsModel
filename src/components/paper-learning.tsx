'use client';
import { useEffect, useState } from 'react';
import { useApp } from './app-provider';
import { useHistory } from './history-provider';
import { Button } from './ui/button';
import { CalibrationChart } from './charts';
import { buildPaperDataset, paperEvaluation, type PaperDataset } from '@/lib/learning/evaluation';
import { offlineObservationSchema, reviewOfflineModel } from '@/lib/learning/models';
import { money, percent } from '@/lib/utils';
import { z } from 'zod';
export function PaperLearning() {
  const { data, mode, user, loading, error } = useApp(); const history = useHistory();
  return <PaperLearningBody key={mode === 'demo' ? 'demo' : user?.id ?? 'signed-out'} data={data} history={history.history} unavailable={loading || history.loading || !!error || !!history.error} />;
}
function PaperLearningBody({ data, history, unavailable }: { data: Parameters<typeof buildPaperDataset>[0]; history: Parameters<typeof buildPaperDataset>[1]; unavailable: boolean }) {
  const [state, setState] = useState<{ data: typeof data; history: typeof history; dataset: PaperDataset }>();
  const dataset = state?.data === data && state.history === history && !unavailable ? state.dataset : undefined;
  const [error, setError] = useState(''); const [manifestText, setManifestText] = useState(''); const [modelReview, setModelReview] = useState<ReturnType<typeof reviewOfflineModel>>();
  useEffect(() => { let active = true; if (!unavailable) void buildPaperDataset(data, history).then(dataset => { if (active) setState({ data, history, dataset }); }).catch(() => { if (active) setError('Paper evaluation could not be prepared.'); }); return () => { active = false; }; }, [data, history, unavailable]);
  const m = dataset ? paperEvaluation(dataset.rows) : undefined;
  const download = () => {
    if (!dataset || !m) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...dataset, evaluation: m }, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'edgelab-paper-evaluation.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const review = () => {
    setError(''); setModelReview(undefined);
    try {
      if (!dataset || new TextEncoder().encode(manifestText).byteLength > 1048576) throw new Error('Use a local model review of at most 1 MiB.');
      const value = z.object({ manifest: z.unknown(), observations: z.array(offlineObservationSchema).max(10000) }).strict().parse(JSON.parse(manifestText));
      setModelReview(reviewOfflineModel(value.manifest, value.observations, dataset.datasetHash));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Model review failed.'); }
  };
  return <section className="panel p-5" aria-label="Paper evaluation laboratory"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-medium">Paper evaluation laboratory</h2><Button size="sm" variant="outline" disabled={!dataset} onClick={download}>Export evaluation dataset</Button></div>
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Only attributable pre-event registrations and audited final outcomes qualify. Historical review evidence, actual wagers and unsupported model estimates stay separate. No trained or validated profitable model exists. Closing-price comparison is unavailable without identical market evidence.</p>
    {dataset?.containsSynthetic && <p className="mt-3 text-xs text-amber-200">SYNTHETIC observations included — this is a Demo evaluation, not real forecasting evidence.</p>}
    {!m ? <p className="mt-4 text-xs">{unavailable ? 'Private storage is unavailable.' : 'Preparing evaluation…'}</p> : <><div className="mt-4 grid gap-4 text-xs sm:grid-cols-3"><p>Qualifying settled sample: {m.settledCount}<br />Excluded registrations: {dataset!.rows.filter(r => !r.eligible).length}<br />Hit rate: {percent(m.hitRate === null ? null : m.hitRate * 100)}</p><p>Scored forecasts: {m.scoredCount}<br />Brier: {m.brier?.toFixed(4) ?? 'Insufficient data'}<br />Log loss: {m.infiniteLogLossCount ? `Infinite (${m.infiniteLogLossCount} contradictory certainty forecasts)` : m.logLoss?.toFixed(4) ?? 'Insufficient data'}</p><p>Bookmaker baseline Brier: {m.bookmakerBrier?.toFixed(4) ?? 'Insufficient data'}<br />Hypothetical P/L: {money(m.hypotheticalProfitCents)}<br />Hypothetical ROI: {percent(m.hypotheticalRoi === null ? null : m.hypotheticalRoi * 100)}</p></div><p className="mt-3 text-[11px] text-amber-200">{m.warning} Bookmaker baselines use original implied probabilities, without de-vigging.</p>
      <CalibrationChart data={m.calibration.filter(b => b.count > 0).map(b => ({ bucket: `${Math.round(b.lower * 100)}–${Math.round(b.upper * 100)}%`, predicted: b.meanForecast! * 100, actual: b.hitRate! * 100, count: b.count }))} />
      <details className="mt-4 rounded border border-border p-3"><summary className="cursor-pointer text-xs">Dataset eligibility and grouped performance</summary><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[10px]">{JSON.stringify({ datasetHash: dataset!.datasetHash, exclusions: dataset!.rows.filter(r => !r.eligible).map(r => ({ id: r.id, reasons: r.exclusions })), bySport: m.bySport, byMarket: m.byMarket, byStrategy: m.byStrategy, byModelVersion: m.byModelVersion }, null, 2)}</pre></details>
    </>}
    <details className="mt-4 rounded border border-border p-3"><summary className="cursor-pointer text-xs">Offline model review · no activation</summary><p className="mt-3 text-[11px] text-muted-foreground">Optional externally prepared manifest and observations. Validates chronological splits, frozen inputs, independent fixture counts and dataset hash. No automatic training or promotion. Owner approval and rollback require separate reviewed implementation before activation.</p><textarea aria-label="Offline model review JSON" className="input mt-3 min-h-28 font-mono text-[11px]" value={manifestText} onChange={e => { setManifestText(e.target.value); setModelReview(undefined); }} /><Button size="sm" variant="outline" className="mt-3" disabled={!dataset || !manifestText.trim()} onClick={review}>Validate offline model review</Button>{modelReview && <p className="mt-3 text-xs">Train {modelReview.counts.train} / validation {modelReview.counts.validation} / test {modelReview.counts.test} fixtures. {modelReview.reason} Promotion ready: no.</p>}</details>
    {error && <p role="alert" className="mt-3 text-xs text-amber-200">{error}</p>}
  </section>;
}
