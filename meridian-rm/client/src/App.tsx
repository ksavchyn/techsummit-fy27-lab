import { QueuePage } from './pages/QueuePage';

function Header() {
  return (
    <header className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold tracking-tight">Meridian Bank</div>
          <div className="text-xs text-muted-foreground">Relationship Manager · Retention Cockpit</div>
        </div>
        <div className="text-xs text-muted-foreground text-right hidden sm:block">
          Surface → Prescribe → Approve → Act
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <QueuePage />
      </main>
    </div>
  );
}
