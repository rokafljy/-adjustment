import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { parseLedgerFileFull, type LedgerRow, type ParsedLedger } from '../utils/ledgerCsv';
import { matchByAmount, type MatchStatus } from '../utils/match';
import { formatWon, formatPercent, parseAmount } from '../utils/format';

interface BankFile {
  fileName: string;
  label: string;
  parsed: ParsedLedger;
}

export default function Verify() {
  // 1단계: 영메이커스 지출결의서
  const [decision, setDecision] = useState<LedgerRow[]>([]);
  const [decisionName, setDecisionName] = useState('');
  const [budget, setBudget] = useState(1800000);
  // 2단계: 통장 입출금 내역(여러 통장)
  const [banks, setBanks] = useState<BankFile[]>([]);

  async function onDecision(file: File) {
    try {
      const p = await parseLedgerFileFull(file);
      setDecision(p.expenses);
      setDecisionName(file.name);
    } catch (e) {
      alert('지출결의서 파일 읽기 실패: ' + (e as Error).message);
    }
  }

  async function onBanks(files: FileList) {
    try {
      const added: BankFile[] = [];
      for (const file of Array.from(files)) {
        const parsed = await parseLedgerFileFull(file);
        added.push({
          fileName: file.name,
          label: parsed.sourceName || file.name,
          parsed,
        });
      }
      setBanks((prev) => [...prev, ...added]);
    } catch (e) {
      alert('통장 파일 읽기 실패: ' + (e as Error).message);
    }
  }

  // ── 집계 ──
  const decisionTotal = useMemo(() => decision.reduce((n, r) => n + r.amount, 0), [decision]);
  const decisionRemain = budget - decisionTotal;

  const bankExpenses = useMemo(() => banks.flatMap((b) => b.parsed.expenses), [banks]);
  const bankDeposits = useMemo(() => banks.flatMap((b) => b.parsed.deposits), [banks]);
  const bankOut = useMemo(() => bankExpenses.reduce((n, r) => n + r.amount, 0), [bankExpenses]);
  const bankIn = useMemo(() => bankDeposits.reduce((n, r) => n + r.amount, 0), [bankDeposits]);
  const bankBalance = useMemo(
    () => banks.reduce((n, b) => n + (b.parsed.endingBalance || 0), 0),
    [banks]
  );

  // ── 3단계: 매핑 ──
  const match = useMemo(
    () => (decision.length || bankExpenses.length ? matchByAmount(decision, bankExpenses) : null),
    [decision, bankExpenses]
  );
  const [filter, setFilter] = useState<MatchStatus | 'all'>('all');
  const matchRows = useMemo(() => {
    if (!match) return [];
    return filter === 'all' ? match.rows : match.rows.filter((r) => r.status === filter);
  }, [match, filter]);

  function exportMatch() {
    if (!match) return;
    const rows = match.rows.map((r) => ({
      판정:
        r.status === 'matched' ? '일치' : r.status === 'a_only' ? '결의서만(통장미확인)' : '통장만(결의서미등록)',
      금액: r.amount,
      '결의서 회차': r.a?.round ?? '',
      '결의서 유형': r.a?.type ?? '',
      '결의서 내용': r.a ? r.a.detail || r.a.content : '',
      '통장 거래일': r.b?.date ?? '',
      '통장 내용': r.b ? r.b.content || r.b.detail : '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '매핑결과');
    XLSX.writeFile(wb, '지출결의서_통장_매핑.xlsx');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>정산 검증</h2>
          <p>① 지출결의서 → ② 통장 입출금 → ③ 매핑(일치/불일치) 순서로 확인합니다.</p>
        </div>
      </div>

      {/* ───────── 1단계 ───────── */}
      <div className="card">
        <h3>1단계 · 영메이커스 지출결의서 업로드</h3>
        <div className="form-row">
          <label className="field">
            지출결의서 파일 (CSV/엑셀)
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls,.xlsm"
              onChange={(e) => e.target.files?.[0] && onDecision(e.target.files[0])}
            />
            <span className="muted">{decisionName ? `${decisionName} · ${decision.length}건` : '미선택'}</span>
          </label>
          <label className="field">
            팀 지원금 총액
            <input
              inputMode="numeric"
              value={budget ? budget.toLocaleString('ko-KR') : ''}
              onChange={(e) => setBudget(parseAmount(e.target.value))}
            />
          </label>
        </div>

        {decision.length > 0 && (
          <>
            <div className="grid grid-stats" style={{ marginTop: 8 }}>
              <Stat label="등록 건수" value={`${decision.length}건`} />
              <Stat label="총 사용금액" value={formatWon(decisionTotal)} />
              <Stat
                label="잔액 (지원금 − 사용)"
                value={formatWon(decisionRemain)}
                tone={decisionRemain < 0 ? 'danger' : 'success'}
              />
              <Stat label="집행률" value={formatPercent(budget ? (decisionTotal / budget) * 100 : 0)} />
            </div>
            <details style={{ marginTop: 12 }}>
              <summary className="muted" style={{ cursor: 'pointer' }}>
                지출결의서 내역 보기 ({decision.length}건)
              </summary>
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>작성일</th>
                      <th>회차</th>
                      <th>유형</th>
                      <th className="num">금액</th>
                      <th>내용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decision.map((r) => (
                      <tr key={r.id}>
                        <td>{r.date}</td>
                        <td>{r.round || '-'}</td>
                        <td>{r.type || '-'}</td>
                        <td className="num">{formatWon(r.amount)}</td>
                        <td className="muted">{r.detail || r.content || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>

      {/* ───────── 2단계 ───────── */}
      <div className="card">
        <h3>2단계 · 통장 입출금 내역 업로드 (카카오뱅크 · 토스뱅크)</h3>
        <div className="form-row">
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            통장 파일 (CSV/엑셀 · 여러 개 가능)
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls,.xlsm"
              multiple
              onChange={(e) => e.target.files?.length && onBanks(e.target.files)}
            />
          </label>
        </div>

        {banks.length > 0 && (
          <>
            <div className="btn-row" style={{ marginBottom: 12 }}>
              {banks.map((b, i) => (
                <span key={i} className="badge badge-muted">
                  {b.label} · 출금 {b.parsed.expenses.length} / 입금 {b.parsed.deposits.length}
                  <button
                    className="btn btn-sm"
                    style={{ marginLeft: 6, padding: '0 6px' }}
                    onClick={() => setBanks((prev) => prev.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="grid grid-stats">
              <Stat label="총 사용금액 (출금 합계)" value={formatWon(bankOut)} />
              <Stat label="총 입금" value={formatWon(bankIn)} />
              <Stat label="통장 현재 잔액" value={formatWon(bankBalance)} tone="success" />
              <Stat label="거래 건수" value={`출금 ${bankExpenses.length} / 입금 ${bankDeposits.length}`} />
            </div>
            <details style={{ marginTop: 12 }}>
              <summary className="muted" style={{ cursor: 'pointer' }}>
                통장 출금 내역 보기 ({bankExpenses.length}건)
              </summary>
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>거래일</th>
                      <th>유형</th>
                      <th className="num">금액</th>
                      <th>내용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...bankExpenses]
                      .sort((a, b) => (a.date < b.date ? 1 : -1))
                      .map((r) => (
                        <tr key={r.id}>
                          <td>{r.date}</td>
                          <td>{r.type || '-'}</td>
                          <td className="num">{formatWon(r.amount)}</td>
                          <td className="muted">{r.content || r.detail || '-'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </div>

      {/* ───────── 3단계 ───────── */}
      <div className="card">
        <div className="toolbar">
          <h3 style={{ margin: 0 }}>3단계 · 매핑 (지출결의서 ↔ 통장 출금)</h3>
          <div className="spacer" />
          {match && (
            <button className="btn" onClick={exportMatch}>
              💾 매핑결과 엑셀
            </button>
          )}
        </div>

        {!match ? (
          <div className="empty">1단계와 2단계 파일을 올리면 금액 기준으로 자동 매핑합니다.</div>
        ) : (
          <>
            <div className="grid grid-stats" style={{ marginBottom: 12 }}>
              <Stat
                label="일치"
                value={`${match.matchedCount}건`}
                sub={formatWon(match.matchedAmount)}
                tone="success"
              />
              <Stat
                label="결의서만 (통장 미확인)"
                value={`${match.aOnlyCount}건`}
                sub={formatWon(match.aOnlyAmount)}
                tone={match.aOnlyCount ? 'danger' : 'success'}
              />
              <Stat
                label="통장만 (결의서 미등록)"
                value={`${match.bOnlyCount}건`}
                sub={formatWon(match.bOnlyAmount)}
                tone={match.bOnlyCount ? 'danger' : 'success'}
              />
            </div>

            <div className="toolbar">
              <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                <option value="all">전체</option>
                <option value="matched">일치</option>
                <option value="a_only">결의서만(통장 미확인)</option>
                <option value="b_only">통장만(결의서 미등록)</option>
              </select>
              <span className="muted">{matchRows.length}건 표시</span>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>판정</th>
                    <th className="num">금액</th>
                    <th>지출결의서 (회차/유형/내용)</th>
                    <th>통장 (거래일/내용)</th>
                  </tr>
                </thead>
                <tbody>
                  {matchRows.map((r) => (
                    <tr key={r.key}>
                      <td>
                        {r.status === 'matched' ? (
                          <span className="badge badge-ok">일치</span>
                        ) : r.status === 'a_only' ? (
                          <span className="badge badge-error">결의서만</span>
                        ) : (
                          <span className="badge badge-warning">통장만</span>
                        )}
                      </td>
                      <td className="num">{formatWon(r.amount)}</td>
                      <td className="muted">
                        {r.a
                          ? `${r.a.round ? r.a.round + '회 · ' : ''}${r.a.type || ''} · ${r.a.detail || r.a.content || ''}`
                          : '-'}
                      </td>
                      <td className="muted">
                        {r.b ? `${r.b.date} · ${r.b.content || r.b.detail || ''}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'danger' | 'success' | 'warning';
}) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value ${tone ?? ''}`} style={{ fontSize: 20 }}>
        {value}
      </div>
      {sub && (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
