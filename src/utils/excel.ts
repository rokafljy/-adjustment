// 엑셀 입출력: 지출내역 가져오기/내보내기, 정산 보고서 내보내기
import * as XLSX from 'xlsx';
import type {
  AppState,
  Expense,
  ExpenseCategory,
  PaymentMethod,
  Team,
  TeamSettlement,
} from '../types';
import { uid, parseAmount } from './format';

const PAYMENT_METHODS: PaymentMethod[] = ['카드', '계좌이체', '현금', '기타'];

/** 지출내역 엑셀 업로드용 빈 템플릿 다운로드 */
export function downloadExpenseTemplate(teams: Team[], categories: ExpenseCategory[]) {
  const headerRow = {
    팀명: teams[0]?.name ?? '',
    항목: categories[0]?.name ?? '',
    사용일: '2026-03-01',
    사용처: '○○상회',
    금액: 10000,
    내용: '예시 내용',
    증빙여부: 'O',
    결제수단: '카드',
  };
  const ws = XLSX.utils.json_to_sheet([headerRow]);
  ws['!cols'] = [
    { wch: 22 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 },
    { wch: 24 },
    { wch: 10 },
    { wch: 10 },
  ];
  // 참고 시트: 사용 가능한 팀/항목 목록
  const refRows = Math.max(teams.length, categories.length);
  const ref = Array.from({ length: refRows }, (_, i) => ({
    '사용가능 팀명': teams[i]?.name ?? '',
    '사용가능 항목': categories[i]?.name ?? '',
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '지출내역');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ref), '입력참고');
  XLSX.writeFile(wb, '지출내역_업로드템플릿.xlsx');
}

export interface ImportResult {
  expenses: Expense[];
  errors: string[];
}

function normalizeReceipt(value: unknown): boolean {
  const s = String(value ?? '').trim().toUpperCase();
  return ['O', 'Y', 'YES', '있음', 'TRUE', '1', '예', '첨부'].includes(s);
}

function normalizePayment(value: unknown): PaymentMethod {
  const s = String(value ?? '').trim();
  return (PAYMENT_METHODS as string[]).includes(s) ? (s as PaymentMethod) : '기타';
}

/** 엑셀 파일에서 지출내역 파싱 (팀명/항목명 → id 매핑) */
export async function importExpensesFromFile(
  file: File,
  teams: Team[],
  categories: ExpenseCategory[]
): Promise<ImportResult> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  const teamByName = new Map(teams.map((t) => [t.name.trim(), t]));
  const catByName = new Map(categories.map((c) => [c.name.trim(), c]));

  const expenses: Expense[] = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const lineNo = idx + 2; // 헤더 다음 줄부터
    const teamName = String(row['팀명'] ?? '').trim();
    const catName = String(row['항목'] ?? '').trim();
    if (!teamName && !catName && !row['금액']) return; // 빈 줄 skip

    const team = teamByName.get(teamName);
    const category = catByName.get(catName);
    if (!team) {
      errors.push(`${lineNo}행: 알 수 없는 팀명 "${teamName}"`);
      return;
    }
    if (!category) {
      errors.push(`${lineNo}행: 알 수 없는 항목 "${catName}"`);
      return;
    }
    const amount = parseAmount(String(row['금액'] ?? '0'));
    if (amount <= 0) {
      errors.push(`${lineNo}행: 금액이 올바르지 않습니다 ("${row['금액']}")`);
    }

    expenses.push({
      id: uid('exp'),
      teamId: team.id,
      categoryId: category.id,
      date: normalizeDate(row['사용일']),
      vendor: String(row['사용처'] ?? '').trim(),
      amount,
      description: String(row['내용'] ?? '').trim(),
      hasReceipt: normalizeReceipt(row['증빙여부']),
      paymentMethod: normalizePayment(row['결제수단']),
    });
  });

  return { expenses, errors };
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // 엑셀 직렬 날짜(숫자) 처리
  const num = Number(s);
  if (Number.isFinite(num) && num > 30000 && num < 60000) {
    const d = XLSX.SSF.parse_date_code(num);
    if (d) {
      const mm = String(d.m).padStart(2, '0');
      const dd = String(d.d).padStart(2, '0');
      return `${d.y}-${mm}-${dd}`;
    }
  }
  return s;
}

/** 현재 지출내역 전체를 엑셀로 내보내기 */
export function exportExpenses(
  expenses: Expense[],
  teams: Team[],
  categories: ExpenseCategory[]
) {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const catById = new Map(categories.map((c) => [c.id, c]));
  const rows = expenses.map((e) => ({
    팀명: teamById.get(e.teamId)?.name ?? '(삭제됨)',
    항목: catById.get(e.categoryId)?.name ?? '(삭제됨)',
    사용일: e.date,
    사용처: e.vendor,
    금액: e.amount,
    내용: e.description,
    증빙여부: e.hasReceipt ? 'O' : 'X',
    결제수단: e.paymentMethod,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '지출내역');
  XLSX.writeFile(wb, `지출내역_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/** 정산 보고서를 엑셀로 내보내기 (팀별 요약 + 항목별 + 지적사항) */
export function exportSettlementReport(
  state: AppState,
  settlements: TeamSettlement[]
) {
  const wb = XLSX.utils.book_new();

  // 1) 팀별 정산 요약
  const summaryRows = settlements.map((s) => ({
    팀명: s.team.name,
    팀장: s.team.leader,
    인원: s.team.memberCount,
    총지원금: s.totalBudget,
    총사용액: s.totalUsed,
    인정액: s.recognizedAmount,
    불인정액: s.rejectedAmount,
    잔액: s.remaining,
    반납액: s.returnAmount,
    '집행률(%)': Number(s.executionRate.toFixed(1)),
    오류건수: s.errorCount,
    경고건수: s.warningCount,
    증빙누락: s.missingReceiptCount,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(summaryRows),
    '정산요약'
  );

  // 2) 항목별 집계
  const catRows: Record<string, unknown>[] = [];
  for (const s of settlements) {
    for (const cs of s.categorySummaries) {
      catRows.push({
        팀명: s.team.name,
        항목: cs.category.name,
        건수: cs.count,
        사용액: cs.used,
        한도: cs.limit ?? '-',
        한도초과액: cs.over,
        한도초과여부: cs.isOver ? '초과' : '정상',
      });
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(catRows.length ? catRows : [{ 안내: '데이터 없음' }]),
    '항목별집계'
  );

  // 3) 지적사항 (이슈)
  const issueRows: Record<string, unknown>[] = [];
  for (const s of settlements) {
    for (const issue of s.issues) {
      issueRows.push({
        팀명: s.team.name,
        구분: issue.severity === 'error' ? '오류' : '경고',
        유형: issue.type,
        내용: issue.message,
      });
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      issueRows.length ? issueRows : [{ 안내: '지적사항 없음' }]
    ),
    '지적사항'
  );

  const safeName = (state.projectName || '청년일경험').replace(/[\\/:*?"<>|]/g, '_');
  XLSX.writeFile(wb, `정산보고서_${safeName}.xlsx`);
}
