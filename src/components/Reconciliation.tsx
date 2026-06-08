import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { parseLedgerFileFull, type LedgerRow } from '../utils/ledgerCsv';
import {
  reconcile,
  computeRoundBalances,
  type ProofIndex,
  type ReconRow,
  type MatchStatus,
} from '../utils/reconcile';
import { auditBank } from '../utils/bankAudit';
import {
  ocrProofFiles,
  expandProofFiles,
  type ProofFileResult,
  type OcrProgress,
} from '../utils/ocr';
import { formatWon, parseAmount } from '../utils/format';

const STATUS_LABEL: Record<MatchStatus, { text: string; cls: string }> = {
  matched: { text: '일치', cls: 'badge-ok' },
  matched_amount: { text: '금액만 일치', cls: 'badge-warning' },
  bank_only: { text: '시스템 미등록', cls: 'badge-error' },
  system_only: { text: '통장 미확인', cls: 'badge-error' },
};

export default function Reconciliation() {
  const [bank, setBank] = useState<LedgerRow[]>([]);
  const [bankDeposits, setBankDeposits] = useState<LedgerRow[]>([]);
  const [system, setSystem] = useState<LedgerRow[]>([]);
  const [budget, setBudget] = useState<number>(1800000);
  const [subsidyFirst, setSubsidyFirst] = useState<number>(900000);
  const [proofIndex, setProofIndex] = useState<ProofIndex | undefined>();
  const [proofResults, setProofResults] = useState<ProofFileResult[]>([]);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [filter, setFilter] = useState<MatchStatus | 'all' | 'issue'>('all');

  const bankRef = useRef<HTMLInputElement>(null);
  const systemRef = useRef<HTMLInputElement>(null);
  const proofRef = useRef<HTMLInputElement>(null);

  const result = useMemo(
    () => (bank.length || system.length ? reconcile(bank, system, proofIndex) : null),
    [bank, system, proofIndex]
  );
  const balances = useMemo(
    () => computeRoundBalances(bank, budget),
    [bank, budget]
  );
  const audit = useMemo(
    () =>
      auditBank(bank, bankDeposits, {
        subsidyThreshold: subsidyFirst,
        proof: proofIndex,
      }),
    [bank, bankDeposits, subsidyFirst, proofIndex]
  );

  async function onBank(file: File) {
    try {
      const parsed = await parseLedgerFileFull(file);
      setBank(parsed.expenses);
      setBankDeposits(parsed.deposits);
    } catch (e) {
      alert('통장내역 파일 읽기 실패: ' + (e as Error).message);
    }
  }
  async function onSystem(file: File) {
    try {
      const parsed = await parseLedgerFileFull(file);
      setSystem(parsed.expenses);
    } catch (e) {
      alert('관리시스템 파일 읽기 실패: ' + (e as Error).message);
    }
  }
  async function onProofs(files: FileList) {
    setOcrRunning(true);
    setOcrProgress(null);
    try {
      const expanded = await expandProofFiles(Array.from(files));
      if (expanded.length === 0) {
        alert('압축파일/선택한 파일에서 PDF·이미지 증빙을 찾지 못했습니다.');
        return;
      }
      const { results, index } = await ocrProofFiles(expanded, (p) =>
        setOcrProgress(p)
      );
      setProofResults(results);
      setProofIndex(index);
    } catch (e) {
      alert('증빙 처리 중 오류: ' + (e as Error).message);
    } finally {
      setOcrRunning(false);
      setOcrProgress(null);
    }
  }

  const filteredRows: ReconRow[] = useMemo(() => {
    if (!result) return [];
    if (filter === 'all') return result.rows;
    if (filter === 'issue')
      return result.rows.filter((r) => r.status !== 'matched');
    return result.rows.filter((r) => r.status === filter);
  }, [result, filter]);

  function exportExcel() {
    if (!result) return;
    const wb = XLSX.utils.book_new();
    const rows = result.rows.map((r) => ({
      판정: STATUS_LABEL[r.status].text,
      회차: r.round,
      유형: r.type,
      금액: r.amount,
      상세: r.detail,
      통장: r.bank ? 'O' : '-',
      관리시스템: r.system ? 'O' : '-',
      증빙: r.proof === 'confirmed' ? '확인' : r.proof === 'not_found' ? '미확인' : '-',
      비고: r.note,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '대조결과');
    const bal = balances.map((b) => ({
      회차: b.round,
      회차소계: b.subtotal,
      누계지출: b.cumulative,
      잔액: b.remaining,
      상태: b.over ? '지원금초과' : '정상',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bal), '회차별잔액');
    XLSX.writeFile(wb, '정산대조결과.xlsx');
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>정산 검증 (3-way 대조)</h2>
          <p>통장내역 ↔ 관리시스템 ↔ 증빙을 대조해 미등록·금액차이·증빙누락을 점검합니다.</p>
        </div>
        {result && (
          <button className="btn btn-primary" onClick={exportExcel}>
            💾 대조결과 엑셀
          </button>
        )}
      </div>

      <div className="hint">
        ① <strong>통장내역</strong>(실제 지출)과 ② <strong>관리시스템</strong> 파일을 올리면 자동
        대조합니다. <strong>CSV·엑셀(.xlsx/.xls)</strong> 모두 지원합니다. 카카오뱅크 등{' '}
        <strong>통장 거래내역 엑셀</strong>도 자동 인식하며(머리말 건너뛰고 <strong>출금만</strong>{' '}
        추출, 입금·이자·캐시백 제외), 관리시스템 양식은{' '}
        <code>작성일·회차·유형·수량·금액·내용·상세·영수증·초과</code> 칼럼을 사용합니다.
        ③ <strong>증빙</strong>(ZIP 압축파일 또는 PDF/이미지)을 올리면 OCR로 금액을 읽어 매칭합니다.
      </div>

      {/* 업로드 영역 */}
      <div className="card">
        <h3>1. 파일 업로드</h3>
        <div className="form-row">
          <label className="field">
            ① 통장내역 CSV/엑셀 (실제 지출)
            <input
              ref={bankRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls,.xlsm"
              onChange={(e) => e.target.files?.[0] && onBank(e.target.files[0])}
            />
            <span className="muted">
              {bank.length
                ? `지출 ${bank.length}건${bankDeposits.length ? ` · 입금 ${bankDeposits.length}건` : ''}`
                : '미선택'}
            </span>
          </label>
          <label className="field">
            ② 관리시스템 CSV/엑셀 (등록 내역)
            <input
              ref={systemRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls,.xlsm"
              onChange={(e) => e.target.files?.[0] && onSystem(e.target.files[0])}
            />
            <span className="muted">{system.length ? `${system.length}건 로드됨` : '미선택'}</span>
          </label>
          <label className="field">
            실행비 총액(지원금)
            <input
              inputMode="numeric"
              value={budget ? budget.toLocaleString('ko-KR') : ''}
              onChange={(e) => setBudget(parseAmount(e.target.value))}
            />
          </label>
          <label className="field">
            1차 지원금 입금액(기준)
            <input
              inputMode="numeric"
              value={subsidyFirst ? subsidyFirst.toLocaleString('ko-KR') : ''}
              onChange={(e) => setSubsidyFirst(parseAmount(e.target.value))}
            />
          </label>
        </div>
        <div className="form-row">
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            ③ 증빙 파일 (ZIP 압축파일 또는 PDF/이미지 여러 개 · 파일명에 "N회차" 포함 시 회차별 매칭)
            <input
              ref={proofRef}
              type="file"
              accept=".zip,.pdf,image/*"
              multiple
              disabled={ocrRunning}
              onChange={(e) => e.target.files?.length && onProofs(e.target.files)}
            />
          </label>
        </div>
        {ocrRunning && (
          <div className="hint" style={{ marginBottom: 0 }}>
            ⏳ OCR 처리 중…{' '}
            {ocrProgress &&
              `(${ocrProgress.fileIndex + 1}/${ocrProgress.fileCount}) ${ocrProgress.fileName} — ${ocrProgress.phase}`}
            <br />
            <span className="muted">
              한글 인식 데이터를 처음 한 번 내려받습니다. 파일 수에 따라 수십 초~수 분 걸릴 수 있어요.
            </span>
          </div>
        )}
      </div>

      {result && (
        <>
          {/* 요약 통계 */}
          <div className="grid grid-stats">
            <div className="stat">
              <div className="label">통장 합계 / 시스템 합계</div>
              <div className="value">{formatWon(result.bankTotal)}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                시스템 {formatWon(result.systemTotal)}
              </div>
            </div>
            <div className="stat">
              <div className="label">일치 / 금액만 일치</div>
              <div className="value success">{result.matchedCount}</div>
              <div className="warning" style={{ fontSize: 12, marginTop: 4 }}>
                금액만 일치 {result.amountDiffCount}건
              </div>
            </div>
            <div className="stat">
              <div className="label">시스템 미등록 / 통장 미확인</div>
              <div className={`value ${result.bankOnlyCount + result.systemOnlyCount > 0 ? 'danger' : 'success'}`}>
                {result.bankOnlyCount} / {result.systemOnlyCount}
              </div>
            </div>
            <div className="stat">
              <div className="label">증빙 확인 / 미확인</div>
              <div className="value">
                {proofIndex ? `${result.proofConfirmed}` : '-'}
                {proofIndex && (
                  <span className="danger" style={{ fontSize: 14 }}>
                    {' '}
                    / {result.proofMissing}
                  </span>
                )}
              </div>
              {!proofIndex && (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  증빙 미업로드
                </div>
              )}
            </div>
          </div>

          {/* 통장 점검 (체크카드/이체 분류, 교통비 이체 증빙, 지원금 입금 시점) */}
          {audit.isBank && (
            <div className="card">
              <h3>통장 점검 — 출금 분류 · 이체 점검</h3>
              <div className="grid grid-stats" style={{ marginBottom: 16 }}>
                <div className="stat">
                  <div className="label">체크카드 결제</div>
                  <div className="value">{formatWon(audit.cardTotal)}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {audit.cardCount}건
                  </div>
                </div>
                <div className="stat">
                  <div className="label">이체 합계</div>
                  <div className="value">{formatWon(audit.transferTotal)}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {audit.transferCount}건 (교통비 {audit.transportCount}건)
                  </div>
                </div>
                <div className="stat">
                  <div className="label">교통비 이체 · 증빙 미확인</div>
                  <div className={`value ${audit.transportNoProofTotal > 0 ? 'danger' : 'success'}`}>
                    {formatWon(audit.transportNoProofTotal)}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    지출결과서 필요
                  </div>
                </div>
                <div className="stat">
                  <div className="label">1차 지원금 입금일</div>
                  <div className="value" style={{ fontSize: 18 }}>
                    {audit.firstSubsidyDate ?? '미확인'}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    지원금 입금 {audit.subsidyDeposits.length}건
                  </div>
                </div>
              </div>

              <div className="hint" style={{ marginBottom: 14 }}>
                규칙 ① <strong>교통비 이체는 지출결과서 필수</strong> — 증빙을 올리면 자동 확인됩니다.
                규칙 ② <strong>이체는 1차 지원금({formatWon(subsidyFirst)}) 입금 전 사용분 정산일 때 적정</strong>.
                {audit.firstSubsidyDate && ` (기준일: ${audit.firstSubsidyDate})`}
              </div>

              <h4 style={{ margin: '4px 0 8px' }}>이체 내역 점검 ({audit.transfers.length})</h4>
              {audit.transfers.length === 0 ? (
                <div className="empty">이체 내역이 없습니다.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>거래일</th>
                        <th>내용/메모</th>
                        <th className="num">금액</th>
                        <th>분류</th>
                        <th>입금 기준</th>
                        <th>증빙</th>
                        <th>점검</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.transfers.map((t) => (
                        <tr key={t.row.id}>
                          <td>{t.row.date}</td>
                          <td className="muted">
                            {[t.row.content, t.row.detail].filter(Boolean).join(' / ') || '-'}
                          </td>
                          <td className="num">{formatWon(t.row.amount)}</td>
                          <td>
                            {t.isTransport ? (
                              <span className="badge badge-warning">교통비 이체</span>
                            ) : (
                              <span className="badge badge-muted">일반 이체</span>
                            )}
                          </td>
                          <td>
                            {t.beforeSubsidy ? (
                              <span className="badge badge-ok">입금 전</span>
                            ) : (
                              <span className="badge badge-muted">입금 후</span>
                            )}
                          </td>
                          <td>
                            {t.proof === 'confirmed' ? (
                              <span className="badge badge-ok">확인</span>
                            ) : t.proof === 'not_found' ? (
                              <span className="badge badge-error">필요</span>
                            ) : t.isTransport ? (
                              <span className="badge badge-warning">필요</span>
                            ) : (
                              <span className="muted">-</span>
                            )}
                          </td>
                          <td className="muted">{t.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {audit.subsidyDeposits.length > 0 && (
                <>
                  <h4 style={{ margin: '16px 0 8px' }}>지원금 입금 내역</h4>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>입금일</th>
                          <th>내용</th>
                          <th className="num">금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.subsidyDeposits.map((d) => (
                          <tr key={d.id}>
                            <td>{d.date}</td>
                            <td>{d.content || d.detail || '-'}</td>
                            <td className="num">{formatWon(d.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 대조 결과 테이블 */}
          <div className="card">
            <div className="toolbar">
              <h3 style={{ margin: 0 }}>대조 결과 ({filteredRows.length})</h3>
              <div className="spacer" />
              <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                <option value="all">전체</option>
                <option value="issue">문제 항목만</option>
                <option value="matched">일치</option>
                <option value="matched_amount">금액만 일치</option>
                <option value="bank_only">시스템 미등록</option>
                <option value="system_only">통장 미확인</option>
              </select>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>판정</th>
                    <th>회차</th>
                    <th>유형</th>
                    <th className="num">금액</th>
                    <th>상세</th>
                    <th>통장</th>
                    <th>시스템</th>
                    <th>증빙</th>
                    <th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => (
                    <tr key={r.key}>
                      <td>
                        <span className={`badge ${STATUS_LABEL[r.status].cls}`}>
                          {STATUS_LABEL[r.status].text}
                        </span>
                      </td>
                      <td>{r.round || '-'}</td>
                      <td>{r.type || '-'}</td>
                      <td className="num">{formatWon(r.amount)}</td>
                      <td className="muted">{r.detail || '-'}</td>
                      <td>{r.bank ? 'O' : <span className="muted">-</span>}</td>
                      <td>{r.system ? 'O' : <span className="muted">-</span>}</td>
                      <td>
                        {r.proof === 'confirmed' ? (
                          <span className="badge badge-ok">확인</span>
                        ) : r.proof === 'not_found' ? (
                          <span className="badge badge-error">미확인</span>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td className="muted">{r.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 회차별 잔액 검증 */}
          {balances.length > 0 && (
            <div className="card">
              <h3>회차별 잔액 검증 (통장 기준)</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>회차</th>
                      <th className="num">회차 소계</th>
                      <th className="num">누계 지출</th>
                      <th className="num">잔액</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((b) => (
                      <tr key={b.round}>
                        <td>{b.round}</td>
                        <td className="num">{formatWon(b.subtotal)}</td>
                        <td className="num">{formatWon(b.cumulative)}</td>
                        <td className="num">{formatWon(b.remaining)}</td>
                        <td>
                          {b.over ? (
                            <span className="badge badge-error">지원금 초과</span>
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
          )}
        </>
      )}

      {/* 증빙 OCR 결과 */}
      {proofResults.length > 0 && (
        <div className="card">
          <h3>증빙 OCR 추출 결과 ({proofResults.length}개 파일)</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>파일</th>
                  <th>회차</th>
                  <th>추출된 금액 후보</th>
                </tr>
              </thead>
              <tbody>
                {proofResults.map((p) => (
                  <tr key={p.fileName}>
                    <td>{p.fileName}</td>
                    <td>{p.round || '-'}</td>
                    <td className="muted">
                      {p.amounts.length
                        ? p.amounts.map((a) => a.toLocaleString('ko-KR')).join(', ')
                        : '추출 없음'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
            ⚠️ OCR은 보조 수단입니다. 인식 정확도에 따라 금액이 누락될 수 있으니 "증빙 미확인" 항목은
            원본 영수증으로 직접 확인하세요.
          </div>
        </div>
      )}

      {!result && (
        <div className="card">
          <div className="empty">
            통장내역과 관리시스템 파일(CSV·엑셀)을 업로드하면 대조 결과가 표시됩니다.
          </div>
        </div>
      )}
    </div>
  );
}
