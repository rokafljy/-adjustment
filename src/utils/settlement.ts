// 정산 검토 핵심 로직: 항목 한도 검증 · 팀별 집계 · 증빙 점검
import type {
  AppState,
  CategorySummary,
  Expense,
  ExpenseCategory,
  Team,
  TeamSettlement,
  ValidationIssue,
} from '../types';

/** 항목 한도를 실제 금액(원)으로 환산. 한도 없음/단가한도는 누적한도 대상 아님 → null */
export function resolveCategoryLimit(
  category: ExpenseCategory,
  totalBudget: number
): number | null {
  switch (category.limitType) {
    case 'absolute':
      return Math.max(0, category.limitValue);
    case 'ratio':
      return Math.round((totalBudget * Math.max(0, category.limitValue)) / 100);
    default:
      return null; // none, perUnit 은 누적 한도 아님
  }
}

/** 한 팀의 지출들에 대해 항목별 집계 산출 */
function summarizeCategories(
  team: Team,
  categories: ExpenseCategory[],
  teamExpenses: Expense[]
): CategorySummary[] {
  return categories
    .map((category) => {
      const items = teamExpenses.filter((e) => e.categoryId === category.id);
      const used = items.reduce((sum, e) => sum + e.amount, 0);
      const limit = resolveCategoryLimit(category, team.totalBudget);
      const over = limit !== null ? Math.max(0, used - limit) : 0;
      return {
        category,
        used,
        count: items.length,
        limit,
        over,
        isOver: over > 0,
      };
    })
    .filter((s) => s.count > 0 || s.limit !== null);
}

/** 지출 1건에 대한 검증 이슈 산출 */
function validateExpense(
  expense: Expense,
  category: ExpenseCategory | undefined
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const label = category?.name ?? '미지정 항목';

  if (expense.amount <= 0) {
    issues.push({
      type: 'INVALID_AMOUNT',
      severity: 'error',
      message: `금액이 0원 이하입니다 (${label})`,
      expenseId: expense.id,
      categoryId: expense.categoryId,
    });
  }

  if (!expense.hasReceipt) {
    issues.push({
      type: 'MISSING_RECEIPT',
      severity: 'error',
      message: `증빙(영수증/계산서) 누락 (${label}, ${expense.vendor || '사용처 미기재'})`,
      expenseId: expense.id,
      categoryId: expense.categoryId,
    });
  }

  if (!expense.vendor.trim()) {
    issues.push({
      type: 'MISSING_VENDOR',
      severity: 'warning',
      message: `사용처가 기재되지 않았습니다 (${label})`,
      expenseId: expense.id,
      categoryId: expense.categoryId,
    });
  }

  if (
    category &&
    category.limitType === 'perUnit' &&
    expense.amount > category.limitValue
  ) {
    issues.push({
      type: 'OVER_UNIT_LIMIT',
      severity: 'warning',
      message: `건당 한도 초과: ${formatWon(expense.amount)} > 한도 ${formatWon(
        category.limitValue
      )} (${label})`,
      expenseId: expense.id,
      categoryId: expense.categoryId,
    });
  }

  return issues;
}

/** error 가 있는 지출은 불인정액으로 처리 */
function expenseHasError(
  expense: Expense,
  category: ExpenseCategory | undefined
): boolean {
  return validateExpense(expense, category).some((i) => i.severity === 'error');
}

/** 한 팀의 정산 결과 산출 */
export function computeTeamSettlement(
  team: Team,
  categories: ExpenseCategory[],
  allExpenses: Expense[]
): TeamSettlement {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const teamExpenses = allExpenses.filter((e) => e.teamId === team.id);

  const totalUsed = teamExpenses.reduce((sum, e) => sum + e.amount, 0);

  let recognizedAmount = 0;
  let rejectedAmount = 0;
  const issues: ValidationIssue[] = [];

  for (const expense of teamExpenses) {
    const category = categoryById.get(expense.categoryId);
    const expIssues = validateExpense(expense, category);
    issues.push(...expIssues);
    if (expenseHasError(expense, category)) {
      rejectedAmount += expense.amount;
    } else {
      recognizedAmount += expense.amount;
    }
  }

  const categorySummaries = summarizeCategories(team, categories, teamExpenses);

  // 항목 한도 초과 이슈
  for (const summary of categorySummaries) {
    if (summary.isOver && summary.limit !== null) {
      issues.push({
        type: 'OVER_CATEGORY_LIMIT',
        severity: 'error',
        message: `${summary.category.name} 한도 초과: 사용 ${formatWon(
          summary.used
        )} / 한도 ${formatWon(summary.limit)} (초과 ${formatWon(summary.over)})`,
        categoryId: summary.category.id,
      });
    }
  }

  // 총 지원금 초과
  if (totalUsed > team.totalBudget) {
    issues.push({
      type: 'OVER_BUDGET',
      severity: 'error',
      message: `총 지원금 초과: 사용 ${formatWon(totalUsed)} / 지원금 ${formatWon(
        team.totalBudget
      )} (초과 ${formatWon(totalUsed - team.totalBudget)})`,
    });
  }

  const remaining = team.totalBudget - totalUsed;
  const returnAmount = Math.max(0, team.totalBudget - recognizedAmount);
  const executionRate =
    team.totalBudget > 0 ? (totalUsed / team.totalBudget) * 100 : 0;

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const missingReceiptCount = issues.filter(
    (i) => i.type === 'MISSING_RECEIPT'
  ).length;

  return {
    team,
    totalBudget: team.totalBudget,
    totalUsed,
    recognizedAmount,
    rejectedAmount,
    remaining,
    returnAmount,
    executionRate,
    categorySummaries,
    issues,
    errorCount,
    warningCount,
    missingReceiptCount,
  };
}

/** 전체 팀 정산 결과 */
export function computeAllSettlements(state: AppState): TeamSettlement[] {
  return state.teams.map((team) =>
    computeTeamSettlement(team, state.categories, state.expenses)
  );
}

/** 천 단위 콤마 + 원 표기 */
export function formatWon(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}
