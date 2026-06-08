// 정산 3-way 대조 로직: 통장내역 ↔ 관리시스템 ↔ 증빙(OCR 금액)
import type { LedgerRow } from './ledgerCsv';

export type MatchStatus =
  | 'matched' // 통장·시스템 모두 존재(금액/유형/회차 일치)
  | 'matched_amount' // 금액은 같으나 유형/회차 등 차이 → 확인 필요
  | 'bank_only' // 통장에만 있음 → 관리시스템 미등록
  | 'system_only'; // 관리시스템에만 있음 → 통장 미확인

export type ProofStatus = 'confirmed' | 'not_found' | 'unchecked';

export interface ReconRow {
  key: string;
  status: MatchStatus;
  /** 대표 표시용 (통장 우선, 없으면 시스템) */
  date: string;
  round: string;
  type: string;
  amount: number;
  detail: string;
  bank?: LedgerRow;
  system?: LedgerRow;
  /** 증빙(영수증/결과서) 금액 확인 결과 */
  proof: ProofStatus;
  note: string;
}

export interface ReconResult {
  rows: ReconRow[];
  bankTotal: number;
  systemTotal: number;
  matchedCount: number;
  bankOnlyCount: number;
  systemOnlyCount: number;
  amountDiffCount: number;
  proofConfirmed: number;
  proofMissing: number;
}

function norm(s: string): string {
  return (s ?? '').replace(/\s+/g, '').toLowerCase();
}

/**
 * 통장내역(bank)과 관리시스템(system)을 금액 기준 다중집합 매칭.
 * 1순위: 금액+유형+회차, 2순위: 금액+유형, 3순위: 금액.
 */
export function reconcile(
  bank: LedgerRow[],
  system: LedgerRow[],
  proofAmounts?: ProofIndex
): ReconResult {
  const systemPool = system.map((s) => ({ row: s, used: false }));
  const rows: ReconRow[] = [];

  const findMatch = (
    b: LedgerRow,
    predicate: (s: LedgerRow) => boolean
  ): (typeof systemPool)[number] | undefined =>
    systemPool.find((p) => !p.used && p.row.amount === b.amount && predicate(p.row));

  for (const b of bank) {
    let m =
      findMatch(b, (s) => norm(s.type) === norm(b.type) && s.round === b.round) ||
      findMatch(b, (s) => norm(s.type) === norm(b.type)) ||
      findMatch(b, () => true);

    let status: MatchStatus;
    let note = '';
    if (m) {
      m.used = true;
      const sameType = norm(m.row.type) === norm(b.type);
      const sameRound = m.row.round === b.round;
      if (sameType && sameRound) {
        status = 'matched';
      } else {
        status = 'matched_amount';
        const diffs: string[] = [];
        if (!sameType) diffs.push(`유형(통장:${b.type}/시스템:${m.row.type})`);
        if (!sameRound) diffs.push(`회차(통장:${b.round}/시스템:${m.row.round})`);
        note = `금액 일치, ${diffs.join(', ')} 불일치`;
      }
    } else {
      status = 'bank_only';
      note = '관리시스템 미등록';
    }

    rows.push({
      key: b.id,
      status,
      date: b.date,
      round: b.round,
      type: b.type,
      amount: b.amount,
      detail: b.detail || b.content,
      bank: b,
      system: m?.row,
      proof: checkProof(b, proofAmounts),
      note,
    });
  }

  // 관리시스템 단독 행
  for (const p of systemPool) {
    if (p.used) continue;
    rows.push({
      key: p.row.id,
      status: 'system_only',
      date: p.row.date,
      round: p.row.round,
      type: p.row.type,
      amount: p.row.amount,
      detail: p.row.detail || p.row.content,
      system: p.row,
      proof: 'unchecked',
      note: '통장내역에 없음(시스템 단독)',
    });
  }

  const bankTotal = bank.reduce((n, r) => n + r.amount, 0);
  const systemTotal = system.reduce((n, r) => n + r.amount, 0);

  return {
    rows,
    bankTotal,
    systemTotal,
    matchedCount: rows.filter((r) => r.status === 'matched').length,
    amountDiffCount: rows.filter((r) => r.status === 'matched_amount').length,
    bankOnlyCount: rows.filter((r) => r.status === 'bank_only').length,
    systemOnlyCount: rows.filter((r) => r.status === 'system_only').length,
    proofConfirmed: rows.filter((r) => r.proof === 'confirmed').length,
    proofMissing: rows.filter((r) => r.proof === 'not_found').length,
  };
}

// ── 증빙(OCR) 금액 인덱스 ────────────────────────────────────────────
export interface ProofIndex {
  /** 회차(문자열) → 그 회차 증빙에서 추출된 금액 집합 */
  byRound: Map<string, Set<number>>;
  /** 회차 구분 없이 모든 증빙에서 추출된 금액 집합 */
  all: Set<number>;
}

function checkProof(b: LedgerRow, idx?: ProofIndex): ProofStatus {
  if (!idx) return 'unchecked';
  // 회차별 증빙이 있으면 해당 회차에서 우선 확인
  if (b.round && idx.byRound.has(b.round)) {
    return idx.byRound.get(b.round)!.has(b.amount) ? 'confirmed' : 'not_found';
  }
  return idx.all.has(b.amount) ? 'confirmed' : 'not_found';
}

/** 회차별 잔액 검증: 총액 - 누계지출 = 정상잔액. (지원금 초과 여부 포함) */
export interface RoundBalance {
  round: string;
  subtotal: number;
  cumulative: number;
  remaining: number;
  over: boolean;
}

export function computeRoundBalances(
  bank: LedgerRow[],
  totalBudget: number
): RoundBalance[] {
  const byRound = new Map<string, number>();
  const order: string[] = [];
  for (const r of bank) {
    const key = r.round || '(미지정)';
    if (!byRound.has(key)) order.push(key);
    byRound.set(key, (byRound.get(key) ?? 0) + r.amount);
  }
  order.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  let cum = 0;
  return order.map((round) => {
    const subtotal = byRound.get(round)!;
    cum += subtotal;
    const remaining = totalBudget - cum;
    return { round, subtotal, cumulative: cum, remaining, over: remaining < 0 };
  });
}
