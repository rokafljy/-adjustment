// 초기 데이터 (예시) - 실제 사업 운영지침에 맞게 항목/한도를 수정해 사용하세요.
import type { AppState } from './types';

export const DEFAULT_CATEGORIES: AppState['categories'] = [
  {
    id: 'cat_material',
    name: '재료비/물품비',
    limitType: 'none',
    limitValue: 0,
    note: '활동에 필요한 재료·소모품 구입비',
  },
  {
    id: 'cat_meal',
    name: '식비/간식비',
    limitType: 'ratio',
    limitValue: 20,
    note: '예시: 총 지원금의 20% 이내',
  },
  {
    id: 'cat_transport',
    name: '교통비/운반비',
    limitType: 'ratio',
    limitValue: 15,
    note: '예시: 총 지원금의 15% 이내',
  },
  {
    id: 'cat_meeting',
    name: '회의비',
    limitType: 'perUnit',
    limitValue: 10000,
    note: '예시: 1인 1회 10,000원 이내(건당 한도)',
  },
  {
    id: 'cat_promo',
    name: '홍보비/인쇄비',
    limitType: 'none',
    limitValue: 0,
    note: '홍보물 제작·인쇄·광고비',
  },
  {
    id: 'cat_rental',
    name: '임차료/장소대여',
    limitType: 'none',
    limitValue: 0,
    note: '활동 공간·장비 대여비',
  },
  {
    id: 'cat_etc',
    name: '기타 운영비',
    limitType: 'ratio',
    limitValue: 10,
    note: '예시: 총 지원금의 10% 이내',
  },
];

/** 처음 실행 시 보여줄 샘플 데이터 (사용자가 초기화 가능) */
export function createSeedState(): AppState {
  return {
    projectName: '2026 청년일경험 사업',
    categories: DEFAULT_CATEGORIES,
    teams: [
      {
        id: 'team_a',
        name: 'A팀 - 우리동네 기록단',
        leader: '김청년',
        memberCount: 4,
        totalBudget: 2000000,
        note: '지역 기록 콘텐츠 제작',
      },
      {
        id: 'team_b',
        name: 'B팀 - 친환경 캠페인',
        leader: '이일경',
        memberCount: 3,
        totalBudget: 1500000,
        note: '제로웨이스트 캠페인 운영',
      },
    ],
    expenses: [
      {
        id: 'exp_1',
        teamId: 'team_a',
        categoryId: 'cat_material',
        date: '2026-03-12',
        vendor: '○○문구',
        amount: 350000,
        description: '촬영용 소품 및 인화지',
        hasReceipt: true,
        paymentMethod: '카드',
      },
      {
        id: 'exp_2',
        teamId: 'team_a',
        categoryId: 'cat_meal',
        date: '2026-03-20',
        vendor: '△△김밥',
        amount: 48000,
        description: '활동일 중식(4인)',
        hasReceipt: true,
        paymentMethod: '카드',
      },
      {
        id: 'exp_3',
        teamId: 'team_a',
        categoryId: 'cat_meeting',
        date: '2026-03-25',
        vendor: '□□카페',
        amount: 52000,
        description: '기획회의 음료(건당 한도 초과 예시)',
        hasReceipt: true,
        paymentMethod: '카드',
      },
      {
        id: 'exp_4',
        teamId: 'team_a',
        categoryId: 'cat_promo',
        date: '2026-04-02',
        vendor: '◇◇인쇄',
        amount: 180000,
        description: '홍보 포스터 인쇄(증빙 누락 예시)',
        hasReceipt: false,
        paymentMethod: '계좌이체',
      },
      {
        id: 'exp_5',
        teamId: 'team_b',
        categoryId: 'cat_material',
        date: '2026-03-15',
        vendor: '◎◎마트',
        amount: 220000,
        description: '캠페인 부스 물품',
        hasReceipt: true,
        paymentMethod: '카드',
      },
      {
        id: 'exp_6',
        teamId: 'team_b',
        categoryId: 'cat_transport',
        date: '2026-03-28',
        vendor: '운송업체',
        amount: 300000,
        description: '부스 자재 운반(한도 초과 예시)',
        hasReceipt: true,
        paymentMethod: '계좌이체',
      },
    ],
  };
}

export function createEmptyState(): AppState {
  return {
    projectName: '청년일경험 사업',
    categories: DEFAULT_CATEGORIES,
    teams: [],
    expenses: [],
  };
}
