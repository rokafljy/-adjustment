// 통장 거래 점검: 출금 분류(체크카드/이체), 교통비 이체 증빙 점검, 지원금 입금 시점 기준
import type { LedgerRow } from './ledgerCsv';
import type { ProofIndex } from './reconcile';

export type TransferProof = 'confirmed' | 'not_found' | 'na';

export interface TransferCheck {
  row: LedgerRow;
  isTransport: boolean; // 교통비 이체 여부
  beforeSubsidy: boolean; // 1차 지원금 입금 전 거래인지
  proof: TransferProof; // 교통비 이체의 증빙(지출결과서) 확인 결과
  note: string;
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
  subsidyDeposits: LedgerRow[]; // 지원금으로 추정되는 입금(기준액 이상)
  firstSubsidyDate?: string;
  transfers: TransferCheck[];
}

const isTransfer = (r: LedgerRow) => r.type.includes('이체');
const isCard = (r: LedgerRow) => r.type.includes('체크카드');
const isTransport = (r: LedgerRow) =>
  `${r.detail} ${r.content}`.includes('교통비');

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

  const cards = expenses.filter(isCard);
  const transfersRows = expenses.filter(isTransfer);

  const sum = (arr: LedgerRow[]) => arr.reduce((n, r) => n + r.amount, 0);

  const transferChecks: TransferCheck[] = transfersRows.map((row) => {
    const transport = isTransport(row);
    const beforeSubsidy = firstSubsidyDate ? row.date < firstSubsidyDate : false;
    let proof: TransferProof = 'na';
    if (transport) {
      proof = opts.proof
        ? opts.proof.all.has(row.amount)
          ? 'confirmed'
          : 'not_found'
        : 'na';
    }

    let note = '';
    if (transport) {
      note =
        proof === 'confirmed'
          ? '교통비 이체 · 지출결과서 확인됨'
          : proof === 'not_found'
            ? '교통비 이체 · 지출결과서 필요(미확인)'
            : '교통비 이체 · 지출결과서 필요(증빙 업로드 시 자동확인)';
    } else if (beforeSubsidy) {
      note = '1차 지원금 입금 전 사용분 정산(이체) · 적정';
    } else {
      note = '이체 · 선금환급/사전사용분 정산 여부 확인';
    }
    return { row, isTransport: transport, beforeSubsidy, proof, note };
  });

  const transportRows = transfersRows.filter(isTransport);
  const transportNoProofTotal = transferChecks
    .filter((t) => t.isTransport && t.proof !== 'confirmed')
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
    subsidyDeposits,
    firstSubsidyDate,
    transfers: transferChecks,
  };
}
