// 두 목록을 금액 기준으로 단순 매핑 (일치 / A만 / B만)
import type { LedgerRow } from './ledgerCsv';

export type MatchStatus = 'matched' | 'a_only' | 'b_only';

export interface MatchRow {
  key: string;
  status: MatchStatus;
  amount: number;
  a?: LedgerRow; // 지출결의서
  b?: LedgerRow; // 통장 출금
}

export interface MatchResult {
  rows: MatchRow[];
  matchedCount: number;
  matchedAmount: number;
  aOnlyCount: number;
  aOnlyAmount: number;
  bOnlyCount: number;
  bOnlyAmount: number;
}

/** A(지출결의서)와 B(통장 출금)를 금액 기준 다중집합 매칭 */
export function matchByAmount(aRows: LedgerRow[], bRows: LedgerRow[]): MatchResult {
  const bPool = bRows.map((r) => ({ r, used: false }));
  const rows: MatchRow[] = [];

  for (const a of aRows) {
    const m = bPool.find((p) => !p.used && p.r.amount === a.amount);
    if (m) {
      m.used = true;
      rows.push({ key: a.id, status: 'matched', amount: a.amount, a, b: m.r });
    } else {
      rows.push({ key: a.id, status: 'a_only', amount: a.amount, a });
    }
  }
  for (const p of bPool) {
    if (!p.used) rows.push({ key: p.r.id, status: 'b_only', amount: p.r.amount, b: p.r });
  }

  const by = (s: MatchStatus) => rows.filter((r) => r.status === s);
  const sum = (rs: MatchRow[]) => rs.reduce((n, r) => n + r.amount, 0);
  const matched = by('matched');
  const aOnly = by('a_only');
  const bOnly = by('b_only');

  return {
    rows,
    matchedCount: matched.length,
    matchedAmount: sum(matched),
    aOnlyCount: aOnly.length,
    aOnlyAmount: sum(aOnly),
    bOnlyCount: bOnly.length,
    bOnlyAmount: sum(bOnly),
  };
}
