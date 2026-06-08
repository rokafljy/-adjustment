// 표시용 포맷 유틸
export function formatWon(value: number): string {
  return `${Math.round(value || 0).toLocaleString('ko-KR')}원`;
}

export function formatNumber(value: number): string {
  return Math.round(value || 0).toLocaleString('ko-KR');
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value || 0).toFixed(digits)}%`;
}

/** 입력 문자열에서 숫자만 추출 (콤마/원 제거) */
export function parseAmount(input: string): number {
  const n = Number(String(input).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
