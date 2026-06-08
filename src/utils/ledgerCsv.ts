// 관리시스템/통장 내역 CSV·엑셀 파서
// 표준 칼럼: 작성일, 회차, 유형, 수량, 금액, 내용, 상세, 영수증, 초과
import * as XLSX from 'xlsx';
import { uid } from './format';

export interface LedgerRow {
  id: string;
  date: string; // 작성일
  round: string; // 회차
  type: string; // 유형 (다과비, 식대(내부), 거래구분: 체크카드결제/일반이체 등)
  qty: number; // 수량
  amount: number; // 금액(원) - 항상 양수
  content: string; // 내용
  detail: string; // 상세/메모
  hasReceipt: boolean; // 영수증 첨부(O/X)
  over: string; // 초과
  /** 입금/출금 (통장 거래내역). 관리양식은 '' */
  direction: string;
  /** 원본 행 번호(디버그/표시용) */
  line: number;
}

/** 파싱 결과 (통장은 출금=지출, 입금=수입으로 분리) */
export interface ParsedLedger {
  expenses: LedgerRow[]; // 지출(출금) — 관리양식은 전체
  deposits: LedgerRow[]; // 입금(통장만)
  isBankStatement: boolean;
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

/** 2차원 셀 배열(헤더 포함)을 LedgerRow[] 로 변환 (CSV·엑셀 공통) */
/** 날짜 정규화: "2026.04.16 19:52:55" / "2026/4/16" → "2026-04-16" */
function normDate(v: string): string {
  const s = String(v ?? '').trim();
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return s.slice(0, 10);
}

// 헤더 탐지에 쓰는 인식 가능한 칼럼명 모음
const KNOWN_HEADERS = [
  '작성일', '지출일', '지출날짜', '날짜', '사용일', '거래일시', '거래일자',
  '회차', '유형', '항목', '거래구분', '구분', '입출금',
  '수량', '금액', '지출액', '사용액', '거래금액', '출금액', '결제금액',
  '내용', '품명', '적요', '상세', '상세내역', '사용처', '거래처', '메모',
  '영수증', '증빙', '증빙여부', '초과', '거래 후 잔액',
];

/** 표 안에서 실제 헤더가 있는 행을 찾는다(계좌정보 머리말 등 건너뜀) */
function findHeaderRow(rows: string[][]): number {
  const limit = Math.min(rows.length, 40);
  for (let i = 0; i < limit; i++) {
    const hits = rows[i].filter((c) => KNOWN_HEADERS.includes(String(c).trim())).length;
    if (hits >= 2) return i;
  }
  return 0;
}

function rowsToLedger(rows: string[][]): ParsedLedger {
  if (rows.length === 0) return { expenses: [], deposits: [], isBankStatement: false };
  const headerRow = findHeaderRow(rows);
  const header = rows[headerRow];
  const h = headerIndex(header);

  const col = (names: string[]): number => {
    for (const n of names) if (h[n] !== undefined) return h[n];
    return -1;
  };
  const cDate = col(['작성일', '지출일', '지출날짜', '날짜', '사용일', '거래일시', '거래일자']);
  const cRound = col(['회차']);
  const cType = col(['유형', '항목', '거래구분']);
  const cQty = col(['수량']);
  // 거래금액(통장)을 금액보다 우선 인식
  const cAmount = col(['거래금액', '출금액', '결제금액', '금액', '지출액', '사용액']);
  const cContent = col(['내용', '품명', '적요']);
  const cDetail = col(['상세', '상세내역', '사용처', '거래처', '메모', '내용']);
  const cReceipt = col(['영수증', '증빙', '증빙여부']);
  const cOver = col(['초과']);
  // 입금/출금 구분 칼럼(카카오뱅크 등)
  const cDir = col(['구분', '입출금', '입출금구분']);

  const isBank =
    cDir >= 0 || header.some((c) => ['거래금액', '거래일시', '거래 후 잔액'].includes(c.trim()));

  const expenses: LedgerRow[] = [];
  const deposits: LedgerRow[] = [];

  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (c: number) => (c >= 0 ? (r[c] ?? '').trim() : '');
    const rawAmount = num(get(cAmount));
    const dir = get(cDir);
    const amount = Math.abs(rawAmount);

    // 완전 빈 행 skip
    if (!amount && !get(cType) && !get(cDetail) && !get(cContent)) continue;

    const row: LedgerRow = {
      id: uid('row'),
      date: normDate(get(cDate)),
      round: get(cRound),
      type: get(cType),
      qty: num(get(cQty)),
      amount,
      content: get(cContent),
      detail: get(cDetail),
      hasReceipt: isReceipt(get(cReceipt)),
      over: get(cOver),
      direction: dir,
      line: i + 1,
    };

    // 통장 입금(선금·이자·캐시백·환급 등)은 지출이 아님
    if (dir.includes('입금')) deposits.push(row);
    else expenses.push(row);
  }
  return { expenses, deposits, isBankStatement: isBank };
}

/** CSV 텍스트 파싱 (지출+입금 분리) */
export function parseLedgerCsvFull(text: string): ParsedLedger {
  return rowsToLedger(parseCsv(text));
}

/** CSV 텍스트 → 지출 행만 (back-compat) */
export function parseLedgerCsv(text: string): LedgerRow[] {
  return parseLedgerCsvFull(text).expenses;
}

function readSheetRows(buf: ArrayBuffer): string[][] {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false, // 날짜 등을 표시 문자열로
    blankrows: false,
  });
  return raw.map((r) => r.map((c) => String(c ?? '')));
}

/** 엑셀 파싱 (지출+입금 분리) */
export function parseLedgerExcelFull(buf: ArrayBuffer): ParsedLedger {
  return rowsToLedger(readSheetRows(buf));
}

/** 엑셀 → 지출 행만 (back-compat) */
export function parseLedgerExcel(buf: ArrayBuffer): LedgerRow[] {
  return parseLedgerExcelFull(buf).expenses;
}

function isExcel(file: File): boolean {
  return (
    /\.(xlsx|xls|xlsm)$/i.test(file.name) ||
    file.type.includes('spreadsheet') ||
    file.type.includes('excel')
  );
}

/** 파일 확장자/타입에 따라 CSV 또는 엑셀로 파싱 (지출+입금 분리) */
export async function parseLedgerFileFull(file: File): Promise<ParsedLedger> {
  if (isExcel(file)) {
    return parseLedgerExcelFull(await file.arrayBuffer());
  }
  return parseLedgerCsvFull(await file.text());
}

/** 파일 → 지출 행만 (back-compat) */
export async function parseLedgerFile(file: File): Promise<LedgerRow[]> {
  return (await parseLedgerFileFull(file)).expenses;
}
