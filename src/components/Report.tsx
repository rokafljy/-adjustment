import { useStore } from '../store';
import type { TeamSettlement } from '../types';
import { formatWon, formatPercent } from '../utils/format';
import { exportSettlementReport } from '../utils/excel';

interface Props {
  settlements: TeamSettlement[];
}

export default function Report({ settlements }: Props) {
  const { state, dispatch } = useStore();

  const totalBudget = settlements.reduce((n, s) => n + s.totalBudget, 0);
  const totalUsed = settlements.reduce((n, s) => n + s.totalUsed, 0);
  const totalRecognized = settlements.reduce((n, s) => n + s.recognizedAmount, 0);
  const totalReturn = settlements.reduce((n, s) => n + s.returnAmount, 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <h2>정산 보고서</h2>
          <p>전체 팀 정산 결과를 보고서로 확인·출력·내보내기 합니다.</p>
        </div>
        <div className="btn-row">
          <button className="btn" onClick={() => window.print()}>
            🖨️ 인쇄 / PDF 저장
          </button>
          <button
            className="btn btn-primary"
            onClick={() => exportSettlementReport(state, settlements)}
          >
            💾 엑셀 보고서 내보내기
          </button>
        </div>
      </div>

      <div className="card">
        <div className="toolbar no-print">
          <label className="field" style={{ flex: 1, maxWidth: 400 }}>
            사업명 (보고서 제목)
            <input
              value={state.projectName}
              onChange={(e) =>
                dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })
              }
            />
          </label>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: '8px 0', fontSize: 24 }}>{state.projectName}</h1>
          <div style={{ fontSize: 16, fontWeight: 600 }}>팀지원금 정산 결과 보고서</div>
          <div className="muted" style={{ marginTop: 6 }}>출력일: {today}</div>
        </div>

        <h3>1. 총괄 현황</h3>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <th style={{ width: '25%' }}>참여 팀 수</th>
                <td>{settlements.length}곳</td>
                <th style={{ width: '25%' }}>총 배정 지원금</th>
                <td className="num">{formatWon(totalBudget)}</td>
              </tr>
              <tr>
                <th>총 사용액</th>
                <td className="num">{formatWon(totalUsed)}</td>
                <th>총 인정액</th>
                <td className="num">{formatWon(totalRecognized)}</td>
              </tr>
              <tr>
                <th>전체 집행률</th>
                <td>{formatPercent(totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0)}</td>
                <th>총 반납 예정액</th>
                <td className="num">{formatWon(totalReturn)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>2. 팀별 정산 내역</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>팀명</th>
                <th>팀장</th>
                <th className="num">지원금</th>
                <th className="num">사용액</th>
                <th className="num">인정액</th>
                <th className="num">반납액</th>
                <th className="num">집행률</th>
                <th>검토결과</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.team.id}>
                  <td>{s.team.name}</td>
                  <td>{s.team.leader || '-'}</td>
                  <td className="num">{formatWon(s.totalBudget)}</td>
                  <td className="num">{formatWon(s.totalUsed)}</td>
                  <td className="num">{formatWon(s.recognizedAmount)}</td>
                  <td className="num">{formatWon(s.returnAmount)}</td>
                  <td className="num">{formatPercent(s.executionRate)}</td>
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
              ))}
              {settlements.length > 0 && (
                <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                  <td colSpan={2}>합계</td>
                  <td className="num">{formatWon(totalBudget)}</td>
                  <td className="num">{formatWon(totalUsed)}</td>
                  <td className="num">{formatWon(totalRecognized)}</td>
                  <td className="num">{formatWon(totalReturn)}</td>
                  <td className="num">
                    {formatPercent(totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0)}
                  </td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>3. 팀별 상세 및 지적사항</h3>
        {settlements.map((s) => (
          <div key={s.team.id} className="team-block" style={{ marginBottom: 24 }}>
            <h4 style={{ margin: '12px 0 8px' }}>
              {s.team.name}{' '}
              {s.errorCount === 0 && s.warningCount === 0 ? (
                <span className="badge badge-ok">적정</span>
              ) : (
                <span className="badge badge-error">조치 필요</span>
              )}
            </h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>항목</th>
                    <th className="num">건수</th>
                    <th className="num">사용액</th>
                    <th className="num">한도</th>
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
                      <td>
                        {cs.isOver ? (
                          <span className="badge badge-error">초과</span>
                        ) : (
                          <span className="badge badge-ok">정상</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {s.issues.length > 0 && (
              <ul className="issue-list" style={{ marginTop: 8 }}>
                {s.issues.map((issue, i) => (
                  <li key={i} className={issue.severity}>
                    [{issue.severity === 'error' ? '오류' : '경고'}] {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="card no-print">
        <h3>데이터 관리</h3>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() => {
              if (confirm('샘플 데이터로 초기화할까요? 현재 입력한 내용은 사라집니다.')) {
                dispatch({ type: 'RESET_SAMPLE' });
              }
            }}
          >
            샘플 데이터로 초기화
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (confirm('모든 데이터를 비울까요? (항목 기본값은 유지)')) {
                dispatch({ type: 'RESET_EMPTY' });
              }
            }}
          >
            전체 비우기
          </button>
        </div>
      </div>
    </div>
  );
}
