import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent, GenieChat } from '@databricks/appkit-ui/react';
import { QueuePage } from './pages/QueuePage';
import { DetailSheet } from './pages/DetailSheet';

function Header() {
  return (
    <header className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold tracking-tight">Meridian Bank</div>
          <div className="text-xs text-muted-foreground">
            Relationship Manager · Retention Cockpit
          </div>
        </div>
        <div className="text-xs text-muted-foreground text-right hidden sm:block">
          Surface → Prescribe → Approve → Act
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
    <div className="min-h-screen bg-background text-foreground">
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
