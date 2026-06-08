// 통장 거래 점검: 출금 분류(체크카드/이체), 교통비 이체 증빙 점검,
// 선금↔이체 환급 대조(입금자명 기준), 지원금 입금 시점
import type { LedgerRow } from './ledgerCsv';
import type { ProofIndex } from './reconcile';

export type TransferProof = 'confirmed' | 'not_found' | 'na';
/** 선금 환급 판정 (일반 이체) */
export type RefundStatus = 'ok' | 'over' | 'none' | 'na';

export interface TransferCheck {
  row: LedgerRow;
  isTransport: boolean; // 교통비 이체 여부
  beforeSubsidy: boolean; // 1차 지원금 입금 전 거래인지
  proof: TransferProof; // 교통비 이체의 증빙(지출결과서) 확인 결과
  recipient: string; // 이체 받는 사람(추정)
  prefund: number; // 그 사람의 선금 합계
  refund: RefundStatus; // 선금 환급 판정(일반 이체)
  note: string;
}

export interface PrefundEntry {
  name: string;
  amount: number;
}

export interface BankAudit {
  isBank: boolean;
  cardCount: number;
  cardTotal: number;
  transferCount: number;
  transferTotal: number;
  transportCount: number;
  transportTotal: number;
  transportNoProofTotal: number; // 교통비 이체 중 증빙 미확인 금액
  refundOkTotal: number; // 선금 환급 적정 합계
  refundFlaggedTotal: number; // 선금 초과/내역없음 합계
  subsidyDeposits: LedgerRow[]; // 지원금으로 추정되는 입금(기준액 이상)
  firstSubsidyDate?: string;
  prefunds: PrefundEntry[]; // 선금(지원금 입금 전 일반입금) 사람별 합계
  transfers: TransferCheck[];
}

const isTransfer = (r: LedgerRow) => r.type.includes('이체');
const isCard = (r: LedgerRow) => r.type.includes('체크카드');
const isTransport = (r: LedgerRow) =>
  `${r.detail} ${r.content}`.includes('교통비');

/** 이름 정규화: 부가어/공백 제거 */
function cleanName(s: string): string {
  return (s ?? '')
    .replace(/선금|환급|이체|교통비|메타광고비|광고비|입금|출금|실수/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export interface BankAuditOptions {
  /** 지원금으로 간주할 입금 최소액(원). 기본 900,000 */
  subsidyThreshold?: number;
  proof?: ProofIndex;
}

export function auditBank(
  expenses: LedgerRow[],
  deposits: LedgerRow[],
  opts: BankAuditOptions = {}
): BankAudit {
  const threshold = opts.subsidyThreshold ?? 900000;

  const isBank =
    expenses.some((r) => r.direction) ||
    deposits.length > 0 ||
    expenses.some((r) => isCard(r) || isTransfer(r));

  // 지원금 입금 추정: 기준액 이상 입금
  const subsidyDeposits = deposits
    .filter((d) => d.amount >= threshold)
    .sort((a, b) => a.date.localeCompare(b.date));
  const firstSubsidyDate = subsidyDeposits[0]?.date;

  // 선금: 1차 지원금 입금 전의 일반입금(개인이 넣은 돈), 사람별 합계
  const prefundByName = new Map<string, number>();
  for (const d of deposits) {
    if (d.amount >= threshold) continue; // 지원금 입금 제외
    if (firstSubsidyDate && d.date >= firstSubsidyDate) continue; // 입금 전만
    if (d.type && !d.type.includes('일반입금')) continue; // 이자·캐시백 등 제외
    const name = cleanName(d.content) || cleanName(d.detail);
    if (!name) continue;
    prefundByName.set(name, (prefundByName.get(name) ?? 0) + d.amount);
  }

  const cards = expenses.filter(isCard);
  const transfersRows = expenses.filter(isTransfer);
  const sum = (arr: LedgerRow[]) => arr.reduce((n, r) => n + r.amount, 0);

  // 선금 잔여(이체로 차감) — 환급 대조용
  const remaining = new Map(prefundByName);

  const transferChecks: TransferCheck[] = transfersRows.map((row) => {
    const transport = isTransport(row);
    const beforeSubsidy = firstSubsidyDate ? row.date < firstSubsidyDate : false;

    // 교통비 이체: 지출결과서(증빙) 필요
    if (transport) {
      const proof: TransferProof = opts.proof
        ? opts.proof.all.has(row.amount)
          ? 'confirmed'
          : 'not_found'
        : 'na';
      const note =
        proof === 'confirmed'
          ? '교통비 이체 · 지출결과서 확인됨'
          : proof === 'not_found'
            ? '교통비 이체 · 지출결과서 필요(미확인)'
            : '교통비 이체 · 지출결과서 필요(증빙 업로드 시 자동확인)';
      return {
        row, isTransport: true, beforeSubsidy, proof,
        recipient: cleanName(row.content) || cleanName(row.detail),
        prefund: 0, refund: 'na', note,
      };
    }

    // 일반 이체: 선금 환급 대조 (입금자명 기준)
    const c1 = cleanName(row.content);
    const c2 = cleanName(row.detail);
    const key = remaining.has(c1) ? c1 : remaining.has(c2) ? c2 : '';
    const recipient = key || c1 || c2;
    const prefund = key ? prefundByName.get(key) ?? 0 : 0;
    const avail = key ? remaining.get(key) ?? 0 : 0;

    let refund: RefundStatus;
    let note: string;
    if (key && avail >= row.amount) {
      refund = 'ok';
      remaining.set(key, avail - row.amount);
      note = `선금 환급 적정 (${recipient} 선금 ${prefund.toLocaleString('ko-KR')}원 범위 내)`;
    } else if (key && prefund > 0) {
      refund = 'over';
      note = `선금 초과 — ${recipient} 선금 ${prefund.toLocaleString('ko-KR')}원 (이체 누계가 선금 초과)`;
    } else {
      refund = 'none';
      note = `선금 내역 없음 — ${recipient || '수취인'} 의 입금 전 선금 없음, 확인 필요`;
    }
    return { row, isTransport: false, beforeSubsidy, proof: 'na', recipient, prefund, refund, note };
  });

  const transportRows = transfersRows.filter(isTransport);
  const transportNoProofTotal = transferChecks
    .filter((t) => t.isTransport && t.proof !== 'confirmed')
    .reduce((n, t) => n + t.row.amount, 0);
  const refundOkTotal = transferChecks
    .filter((t) => t.refund === 'ok')
    .reduce((n, t) => n + t.row.amount, 0);
  const refundFlaggedTotal = transferChecks
    .filter((t) => t.refund === 'over' || t.refund === 'none')
    .reduce((n, t) => n + t.row.amount, 0);

  return {
    isBank,
    cardCount: cards.length,
    cardTotal: sum(cards),
    transferCount: transfersRows.length,
    transferTotal: sum(transfersRows),
    transportCount: transportRows.length,
    transportTotal: sum(transportRows),
    transportNoProofTotal,
    refundOkTotal,
    refundFlaggedTotal,
    subsidyDeposits,
    firstSubsidyDate,
    prefunds: [...prefundByName.entries()].map(([name, amount]) => ({ name, amount })),
    transfers: transferChecks,
  };
}
