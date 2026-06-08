import { useState } from 'react';
import type { TeamSettlement } from '../types';
import { formatWon, formatPercent } from '../utils/format';

interface Props {
  settlements: TeamSettlement[];
}

export default function Settlement({ settlements }: Props) {
  const [selected, setSelected] = useState<string>(settlements[0]?.team.id ?? '');
  const current = settlements.find((s) => s.team.id === selected) ?? settlements[0];

  if (settlements.length === 0) {
    return (
      <div>
        <div className="page-header">
          <h2>정산 검토</h2>
        </div>
        <div className="card">
          <div className="empty">검토할 팀이 없습니다. 먼저 팀과 지출내역을 등록하세요.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>정산 검토</h2>
          <p>팀별 지출을 한도·증빙·예산 기준으로 자동 검증한 결과입니다.</p>
        </div>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {settlements.map((s) => (
            <option key={s.team.id} value={s.team.id}>
              {s.team.name}
              {s.errorCount > 0 ? ` (오류 ${s.errorCount})` : ''}
            </option>
          ))}
        </select>
      </div>

      {current && <TeamDetail s={current} />}
    </div>
  );
}

function TeamDetail({ s }: { s: TeamSettlement }) {
  const overBudget = s.totalUsed > s.totalBudget;
  return (
    <>
      <div className="grid grid-stats">
        <div className="stat">
          <div className="label">총 지원금</div>
          <div className="value">{formatWon(s.totalBudget)}</div>
        </div>
        <div className="stat">
          <div className="label">총 사용액 (집행률)</div>
          <div className={`value ${overBudget ? 'danger' : ''}`}>{formatWon(s.totalUsed)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {formatPercent(s.executionRate)}
          </div>
        </div>
        <div className="stat">
          <div className="label">인정액 / 불인정액</div>
          <div className="value">{formatWon(s.recognizedAmount)}</div>
          <div className="danger" style={{ fontSize: 12, marginTop: 4 }}>
            불인정 {formatWon(s.rejectedAmount)}
          </div>
        </div>
        <div className="stat">
          <div className="label">반납 예정액</div>
          <div className="value success">{formatWon(s.returnAmount)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            지원금 − 인정액
          </div>
        </div>
      </div>

      <div className="card">
        <h3>검토 결과 요약</h3>
        <div className="btn-row" style={{ marginBottom: 4 }}>
          {s.errorCount === 0 && s.warningCount === 0 ? (
            <span className="badge badge-ok">✓ 지적사항 없음 (적정)</span>
          ) : (
            <>
              {s.errorCount > 0 && (
                <span className="badge badge-error">오류 {s.errorCount}건 (정산 불가)</span>
              )}
              {s.warningCount > 0 && (
                <span className="badge badge-warning">경고 {s.warningCount}건 (확인 필요)</span>
              )}
              {s.missingReceiptCount > 0 && (
                <span className="badge badge-error">증빙 누락 {s.missingReceiptCount}건</span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card">
        <h3>항목별 한도 검증</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>항목</th>
                <th className="num">건수</th>
                <th className="num">사용액</th>
                <th className="num">한도</th>
                <th className="num">초과액</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {s.categorySummaries.map((cs) => (
                <tr key={cs.category.id}>
                  <td>{cs.category.name}</td>
                  <td className="num">{cs.count}</td>
                  <td className="num">{formatWon(cs.used)}</td>
                  <td className="num">{cs.limit === null ? '-' : formatWon(cs.limit)}</td>
                  <td className="num">{cs.over > 0 ? formatWon(cs.over) : '-'}</td>
                  <td>
                    {cs.limit === null ? (
                      <span className="badge badge-muted">한도 없음</span>
                    ) : cs.isOver ? (
                      <span className="badge badge-error">한도 초과</span>
                    ) : (
                      <span className="badge badge-ok">정상</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>지적사항 ({s.issues.length})</h3>
        {s.issues.length === 0 ? (
          <div className="empty">발견된 지적사항이 없습니다. ✓</div>
        ) : (
          <ul className="issue-list">
            {s.issues.map((issue, i) => (
              <li key={i} className={issue.severity}>
                <span className="badge badge-muted">
                  {issue.severity === 'error' ? '오류' : '경고'}
                </span>
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
