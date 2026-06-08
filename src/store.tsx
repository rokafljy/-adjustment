// 전역 상태 관리: Context + useReducer + localStorage 영속화
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { AppState, Expense, ExpenseCategory, Team } from './types';
import { createSeedState, createEmptyState } from './seed';

const STORAGE_KEY = 'youth-settlement-state-v1';

type Action =
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'UPSERT_TEAM'; team: Team }
  | { type: 'DELETE_TEAM'; id: string }
  | { type: 'UPSERT_CATEGORY'; category: ExpenseCategory }
  | { type: 'DELETE_CATEGORY'; id: string }
  | { type: 'UPSERT_EXPENSE'; expense: Expense }
  | { type: 'DELETE_EXPENSE'; id: string }
  | { type: 'ADD_EXPENSES'; expenses: Expense[] }
  | { type: 'REPLACE_STATE'; state: AppState }
  | { type: 'RESET_SAMPLE' }
  | { type: 'RESET_EMPTY' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PROJECT_NAME':
      return { ...state, projectName: action.name };

    case 'UPSERT_TEAM': {
      const exists = state.teams.some((t) => t.id === action.team.id);
      return {
        ...state,
        teams: exists
          ? state.teams.map((t) => (t.id === action.team.id ? action.team : t))
          : [...state.teams, action.team],
      };
    }
    case 'DELETE_TEAM':
      return {
        ...state,
        teams: state.teams.filter((t) => t.id !== action.id),
        expenses: state.expenses.filter((e) => e.teamId !== action.id),
      };

    case 'UPSERT_CATEGORY': {
      const exists = state.categories.some((c) => c.id === action.category.id);
      return {
        ...state,
        categories: exists
          ? state.categories.map((c) =>
              c.id === action.category.id ? action.category : c
            )
          : [...state.categories, action.category],
      };
    }
    case 'DELETE_CATEGORY':
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
      };

    case 'UPSERT_EXPENSE': {
      const exists = state.expenses.some((e) => e.id === action.expense.id);
      return {
        ...state,
        expenses: exists
          ? state.expenses.map((e) =>
              e.id === action.expense.id ? action.expense : e
            )
          : [...state.expenses, action.expense],
      };
    }
    case 'DELETE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.id),
      };
    case 'ADD_EXPENSES':
      return { ...state, expenses: [...state.expenses, ...action.expenses] };

    case 'REPLACE_STATE':
      return action.state;
    case 'RESET_SAMPLE':
      return createSeedState();
    case 'RESET_EMPTY':
      return createEmptyState();

    default:
      return state;
  }
}

function loadInitialState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      // 최소 형태 검증
      if (parsed && Array.isArray(parsed.teams) && Array.isArray(parsed.expenses)) {
        return parsed;
      }
    }
  } catch {
    // 무시하고 샘플 데이터로 시작
  }
  return createSeedState();
}

interface StoreValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 저장 실패는 무시 (용량 초과 등)
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
