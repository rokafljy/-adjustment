import { useState } from 'react';
import { useStore } from './store';
import { computeAllSettlements } from './utils/settlement';
import Dashboard from './components/Dashboard';
import Teams from './components/Teams';
import Categories from './components/Categories';
import Expenses from './components/Expenses';
import Settlement from './components/Settlement';
import Report from './components/Report';
import Reconciliation from './components/Reconciliation';

type View =
  | 'dashboard'
  | 'teams'
  | 'categories'
  | 'expenses'
  | 'settlement'
  | 'reconciliation'
  | 'report';

const NAV: { key: View; label: string; icon: string }[] = [
  { key: 'dashboard', label: '대시보드', icon: '📊' },
  { key: 'teams', label: '팀 관리', icon: '👥' },
  { key: 'categories', label: '지출 항목 설정', icon: '🏷️' },
  { key: 'expenses', label: '지출 내역', icon: '🧾' },
  { key: 'settlement', label: '정산 검토', icon: '🔍' },
  { key: 'reconciliation', label: '정산 검증(대조)', icon: '🔀' },
  { key: 'report', label: '정산 보고서', icon: '📄' },
];

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const { state } = useStore();
  const settlements = computeAllSettlements(state);
  const totalErrors = settlements.reduce((n, s) => n + s.errorCount, 0);

  return (
    <div className="app">
      <aside className="sidebar no-print">
        <h1>청년일경험<br />정산 검토 시스템</h1>
        <div className="subtitle">팀지원금 정산·결산 관리</div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${view === item.key ? 'active' : ''}`}
              onClick={() => setView(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.key === 'settlement' && totalErrors > 0 && (
                <span className="badge badge-error" style={{ marginLeft: 'auto' }}>
                  {totalErrors}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          모든 데이터는 브라우저에만 저장됩니다.
          <br />v1.0
        </div>
      </aside>

      <main className="main">
        {view === 'dashboard' && <Dashboard settlements={settlements} onNavigate={setView} />}
        {view === 'teams' && <Teams />}
        {view === 'categories' && <Categories />}
        {view === 'expenses' && <Expenses />}
        {view === 'settlement' && <Settlement settlements={settlements} />}
        {view === 'reconciliation' && <Reconciliation />}
        {view === 'report' && <Report settlements={settlements} />}
      </main>
    </div>
  );
}
