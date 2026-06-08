import { useStore } from '../store';
import type { TeamSettlement } from '../types';
import { formatWon, formatPercent } from '../utils/format';

interface Props {
  settlements: TeamSettlement[];
  onNavigate: (v: 'teams' | 'expenses' | 'settlement' | 'report') => void;
}

export default function Dashboard({ settlements, onNavigate }: Props) {
  const { state } = useStore();

  const totalBudget = settlements.reduce((n, s) => n + s.totalBudget, 0);
  const totalUsed = settlements.reduce((n, s) => n + s.totalUsed, 0);
  const totalReturn = settlements.reduce((n, s) => n + s.returnAmount, 0);
  const totalErrors = settlements.reduce((n, s) => n + s.errorCount, 0);
  const totalWarnings = settlements.reduce((n, s) => n + s.warningCount, 0);
  const totalMissing = settlements.reduce((n, s) => n + s.missingReceiptCount, 0);
  const execRate = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>대시보드</h2>
          <p>{state.projectName} · 팀 {state.teams.length}곳 · 지출 {state.expenses.length}건</p>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => onNavigate('expenses')}>
            지출 입력
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('settlement')}>
            정산 검토 보기
          </button>
        </div>
      </div>

      <div className="grid grid-stats">
        <div className="stat">
          <div className="label">총 배정 지원금</div>
          <div className="value">{formatWon(totalBudget)}</div>
        </div>
        <div className="stat">
          <div className="label">총 사용액 · 집행률</div>
          <div className="value">{formatWon(totalUsed)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {formatPercent(execRate)}
          </div>
        </div>
        <div className="stat">
          <div className="label">예상 반납액</div>
          <div className="value success">{formatWon(totalReturn)}</div>
        </div>
        <div className="stat">
          <div className="label">오류 / 경고</div>
          <div className={`value ${totalErrors > 0 ? 'danger' : 'success'}`}>
            {totalErrors} <span className="muted" style={{ fontSize: 14 }}>/ {totalWarnings}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            증빙 누락 {totalMissing}건
          </div>
        </div>
      </div>

      <div className="card">
        <h3>팀별 정산 현황</h3>
        {settlements.length === 0 ? (
          <div className="empty">
            등록된 팀이 없습니다.{' '}
            <button className="btn btn-sm btn-primary" onClick={() => onNavigate('teams')}>
              팀 등록하기
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>팀명</th>
                  <th className="num">지원금</th>
                  <th className="num">사용액</th>
                  <th style={{ width: 160 }}>집행률</th>
                  <th className="num">반납액</th>
                  <th>검토 상태</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => {
                  const rate = Math.min(100, s.executionRate);
                  const over = s.totalUsed > s.totalBudget;
                  return (
                    <tr key={s.team.id}>
                      <td>{s.team.name}</td>
                      <td className="num">{formatWon(s.totalBudget)}</td>
                      <td className="num">{formatWon(s.totalUsed)}</td>
                      <td>
                        <div className="progress">
                          <span
                            className={over ? 'over' : ''}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="muted" style={{ fontSize: 11 }}>
                          {formatPercent(s.executionRate)}
                        </span>
                      </td>
                      <td className="num">{formatWon(s.returnAmount)}</td>
                      <td>
                        {s.errorCount > 0 ? (
                          <span className="badge badge-error">오류 {s.errorCount}</span>
                        ) : s.warningCount > 0 ? (
                          <span className="badge badge-warning">경고 {s.warningCount}</span>
                        ) : (
                          <span className="badge badge-ok">적정</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalErrors > 0 && (
        <div className="card">
          <h3>⚠️ 조치가 필요한 항목</h3>
          <ul className="issue-list">
            {settlements
              .flatMap((s) =>
                s.issues
                  .filter((i) => i.severity === 'error')
                  .map((i, idx) => ({ team: s.team.name, msg: i.message, key: s.team.id + idx }))
              )
              .slice(0, 12)
              .map((item) => (
                <li key={item.key} className="error">
                  <strong>[{item.team}]</strong> {item.msg}
                </li>
              ))}
          </ul>
          <button className="btn btn-sm" onClick={() => onNavigate('settlement')}>
            정산 검토에서 전체 보기 →
          </button>
        </div>
      )}
    </div>
  );
}
