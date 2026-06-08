// 관리시스템/통장 내역 CSV 파서
// 표준 칼럼: 작성일, 회차, 유형, 수량, 금액, 내용, 상세, 영수증, 초과
import { uid } from './format';

export interface LedgerRow {
  id: string;
  date: string; // 작성일
  round: string; // 회차
  type: string; // 유형 (다과비, 식대(내부) 등)
  qty: number; // 수량
  amount: number; // 금액(원)
  content: string; // 내용
  detail: string; // 상세
  hasReceipt: boolean; // 영수증 첨부(O/X)
  over: string; // 초과
  /** 원본 행 번호(디버그/표시용) */
  line: number;
}

/** 따옴표/콤마를 처리하는 간단한 CSV 파서 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  // BOM 제거
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function num(v: string): number {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function isReceipt(v: string): boolean {
  const s = String(v ?? '').trim().toUpperCase();
  return ['O', 'Y', 'YES', '있음', 'TRUE', '1', '예', '첨부'].includes(s);
}

/** 헤더명을 인덱스로 매핑 (칼럼 순서가 달라도 대응) */
function headerIndex(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  header.forEach((h, i) => {
    const key = h.trim();
    idx[key] = i;
  });
  return idx;
}

export function parseLedgerCsv(text: string): LedgerRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  const h = headerIndex(header);

  const col = (names: string[]): number => {
    for (const n of names) if (h[n] !== undefined) return h[n];
    return -1;
  };
  const cDate = col(['작성일', '지출일', '날짜', '사용일']);
  const cRound = col(['회차']);
  const cType = col(['유형', '항목', '구분']);
  const cQty = col(['수량']);
  const cAmount = col(['금액', '지출액', '사용액']);
  const cContent = col(['내용', '품명']);
  const cDetail = col(['상세', '상세내역', '사용처']);
  const cReceipt = col(['영수증', '증빙', '증빙여부']);
  const cOver = col(['초과']);

  const out: LedgerRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (c: number) => (c >= 0 ? (r[c] ?? '').trim() : '');
    const amount = num(get(cAmount));
    // 완전 빈 행 skip
    if (!amount && !get(cType) && !get(cDetail) && !get(cContent)) continue;
    out.push({
      id: uid('row'),
      date: get(cDate),
      round: get(cRound),
      type: get(cType),
      qty: num(get(cQty)),
      amount,
      content: get(cContent),
      detail: get(cDetail),
      hasReceipt: isReceipt(get(cReceipt)),
      over: get(cOver),
      line: i + 1,
    });
  }
  return out;
}

export async function parseLedgerFile(file: File): Promise<LedgerRow[]> {
  const text = await file.text();
  return parseLedgerCsv(text);
}
