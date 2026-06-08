// 청년일경험 팀지원금 정산 시스템 - 도메인 타입 정의

/** 한도 적용 방식 */
export type LimitType =
  | 'none' // 한도 없음
  | 'absolute' // 절대 금액 한도 (해당 항목 누적 사용액 ≤ limitValue 원)
  | 'ratio' // 총 지원금 대비 비율 한도 (≤ 총지원금 × limitValue%)
  | 'perUnit'; // 단가 한도 (지출 1건당 금액 ≤ limitValue 원)

/** 지출 항목 (식비, 재료비 등) */
export interface ExpenseCategory {
  id: string;
  name: string;
  /** 한도 적용 방식 */
  limitType: LimitType;
  /** 한도 값 (limitType 에 따라 원 또는 % 로 해석) */
  limitValue: number;
  /** 항목 설명/비고 */
  note?: string;
}

/** 팀 (지원금을 배정받은 참여 팀) */
export interface Team {
  id: string;
  name: string;
  leader: string;
  memberCount: number;
  /** 총 배정 지원금 (원) */
  totalBudget: number;
  note?: string;
}

/** 지출 내역 1건 */
export interface Expense {
  id: string;
  teamId: string;
  categoryId: string;
  /** 사용일 (YYYY-MM-DD) */
  date: string;
  /** 사용처/거래처 */
  vendor: string;
  /** 금액 (원) */
  amount: number;
  /** 적요/사용 내용 */
  description: string;
  /** 증빙(영수증/세금계산서) 첨부 여부 */
  hasReceipt: boolean;
  /** 결제 수단 */
  paymentMethod: PaymentMethod;
}

export type PaymentMethod = '카드' | '계좌이체' | '현금' | '기타';

/** 전체 애플리케이션 상태 (localStorage 에 저장) */
export interface AppState {
  teams: Team[];
  categories: ExpenseCategory[];
  expenses: Expense[];
  /** 사업명 (보고서 표기용) */
  projectName: string;
}

// ---- 정산 검토 결과 타입 ----

export type IssueSeverity = 'error' | 'warning';

export type IssueType =
  | 'MISSING_RECEIPT' // 증빙 누락
  | 'OVER_CATEGORY_LIMIT' // 항목 한도 초과
  | 'OVER_UNIT_LIMIT' // 건당 단가 한도 초과
  | 'OVER_BUDGET' // 총 지원금 초과
  | 'INVALID_AMOUNT' // 금액 오류 (0 이하)
  | 'MISSING_VENDOR'; // 사용처 미기재

export interface ValidationIssue {
  type: IssueType;
  severity: IssueSeverity;
  message: string;
  /** 관련 지출 id (항목/예산 단위 이슈는 비어있을 수 있음) */
  expenseId?: string;
  /** 관련 항목 id */
  categoryId?: string;
}

/** 항목별 집계 */
export interface CategorySummary {
  category: ExpenseCategory;
  used: number; // 사용액 합계
  count: number; // 건수
  limit: number | null; // 적용 한도(원), 없으면 null
  over: number; // 한도 초과액 (0 이상)
  isOver: boolean;
}

/** 팀별 정산 결과 */
export interface TeamSettlement {
  team: Team;
  totalBudget: number; // 총 지원금
  totalUsed: number; // 총 사용액 (전체 지출 합계)
  recognizedAmount: number; // 인정액 (error 없는 지출 합계)
  rejectedAmount: number; // 불인정액 (error 가 있는 지출 합계)
  remaining: number; // 잔액 (지원금 - 사용액)
  returnAmount: number; // 반납액 (지원금 - 인정액, 음수면 0)
  executionRate: number; // 집행률 (%)
  categorySummaries: CategorySummary[];
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  missingReceiptCount: number;
}
