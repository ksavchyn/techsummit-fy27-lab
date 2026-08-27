import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent, GenieChat } from '@databricks/appkit-ui/react';
import { QueuePage } from './pages/QueuePage';
import { DetailSheet } from './pages/DetailSheet';

function Header() {
  const steps = ['Surface', 'Prescribe', 'Approve', 'Act'];
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-sky-500 font-black text-slate-900 shadow-md">
            M
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight leading-tight">Meridian Bank</div>
            <div className="text-xs text-indigo-200/80">Relationship Manager · Retention Cockpit</div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          {steps.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-indigo-100 ring-1 ring-inset ring-white/15">
                {s}
              </span>
              {i < steps.length - 1 && <span className="text-indigo-300/60 text-xs">→</span>}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const [selected, setSelected] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [queueRefresh, setQueueRefresh] = useState(0);

  const openCustomer = (id: string) => {
    setSelected(id);
    setSheetOpen(true);
  };

  return (
    <div className="relative min-h-screen text-foreground bg-slate-50 dark:bg-slate-950">
      {/* Decorative background — soft gradient mesh + glows */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60rem 40rem at 12% -10%, rgba(99,102,241,0.18), transparent 60%),' +
            'radial-gradient(55rem 38rem at 100% 0%, rgba(14,165,233,0.16), transparent 55%),' +
            'radial-gradient(50rem 40rem at 50% 120%, rgba(16,185,129,0.10), transparent 60%)',
        }}
      />
      {/* Customer-360 "risk radar" — concentric rings sweeping from the top-right */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.5] dark:opacity-[0.35]"
        style={{
          background:
            'repeating-radial-gradient(circle at 88% 8%, transparent 0 62px, rgba(99,102,241,0.10) 62px 63px)',
          maskImage: 'radial-gradient(ellipse 90% 80% at 88% 8%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 88% 8%, black 30%, transparent 75%)',
        }}
      />
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="queue" className="space-y-6">
          <TabsList>
            <TabsTrigger value="queue">Retention Queue</TabsTrigger>
            <TabsTrigger value="genie">Ask Genie</TabsTrigger>
          </TabsList>

          <TabsContent value="queue">
            <QueuePage onSelect={openCustomer} selectedId={selected} refreshKey={queueRefresh} />
          </TabsContent>

          <TabsContent value="genie">
            <div className="space-y-3">
              <div>
                <h2 className="text-2xl font-bold">Ask Genie</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Free-form natural-language Q&amp;A and what-if over the retention data
                  (&ldquo;Customer Attrition Risk and Retention&rdquo; space).
                </p>
              </div>
              <div className="h-[min(640px,72vh)] border rounded-lg overflow-hidden">
                <GenieChat alias="default" />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <DetailSheet
        customerId={selected}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCommitted={() => setQueueRefresh((k) => k + 1)}
      />
    </div>
  );
}
