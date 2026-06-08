import { useState } from 'react';
import { useStore } from '../store';
import type { ExpenseCategory, LimitType } from '../types';
import { formatWon, parseAmount, uid } from '../utils/format';

const LIMIT_LABELS: Record<LimitType, string> = {
  none: '한도 없음',
  absolute: '절대 금액 한도(원)',
  ratio: '지원금 대비 비율(%)',
  perUnit: '건당 단가 한도(원)',
};

const BLANK: Omit<ExpenseCategory, 'id'> = {
  name: '',
  limitType: 'none',
  limitValue: 0,
  note: '',
};

function describeLimit(c: ExpenseCategory): string {
  switch (c.limitType) {
    case 'absolute':
      return `누적 ${formatWon(c.limitValue)} 이내`;
    case 'ratio':
      return `지원금의 ${c.limitValue}% 이내`;
    case 'perUnit':
      return `1건당 ${formatWon(c.limitValue)} 이내`;
    default:
      return '제한 없음';
  }
}

export default function Categories() {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [form, setForm] = useState<Omit<ExpenseCategory, 'id'>>(BLANK);

  function startNew() {
    setEditing(null);
    setForm(BLANK);
  }
  function startEdit(c: ExpenseCategory) {
    setEditing(c);
    setForm({ ...c });
  }
  function save() {
    if (!form.name.trim()) {
      alert('항목명을 입력하세요.');
      return;
    }
    const category: ExpenseCategory = { id: editing?.id ?? uid('cat'), ...form };
    dispatch({ type: 'UPSERT_CATEGORY', category });
    startNew();
  }
  function remove(c: ExpenseCategory) {
    const used = state.expenses.some((e) => e.categoryId === c.id);
    if (used) {
      alert('이 항목으로 등록된 지출내역이 있어 삭제할 수 없습니다.');
      return;
    }
    if (confirm(`'${c.name}' 항목을 삭제할까요?`)) {
      dispatch({ type: 'DELETE_CATEGORY', id: c.id });
      if (editing?.id === c.id) startNew();
    }
  }

  const needsValue = form.limitType !== 'none';

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>지출 항목 설정</h2>
          <p>항목별 사용 한도 규칙을 정의합니다. 정산 검토 시 자동으로 한도 초과를 점검합니다.</p>
        </div>
      </div>

      <div className="hint">
        💡 한도 방식 — <strong>한도 없음</strong>: 제한 없음 · <strong>절대 금액</strong>: 항목
        누적 사용액 한도 · <strong>비율</strong>: 팀 지원금 대비 % · <strong>건당 단가</strong>: 지출
        1건당 금액 한도. 기본값은 <em>예시</em>이므로 실제 운영지침에 맞게 조정하세요.
      </div>

      <div className="card">
        <h3>{editing ? '항목 수정' : '새 항목 추가'}</h3>
        <div className="form-row">
          <label className="field">
            항목명
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 식비/간식비"
            />
          </label>
          <label className="field">
            한도 방식
            <select
              value={form.limitType}
              onChange={(e) =>
                setForm({ ...form, limitType: e.target.value as LimitType })
              }
            >
              {Object.entries(LIMIT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            한도 값
            <input
              inputMode="numeric"
              disabled={!needsValue}
              value={
                needsValue
                  ? form.limitType === 'ratio'
                    ? form.limitValue
                    : form.limitValue
                      ? form.limitValue.toLocaleString('ko-KR')
                      : ''
                  : ''
              }
              onChange={(e) =>
                setForm({ ...form, limitValue: parseAmount(e.target.value) })
              }
              placeholder={form.limitType === 'ratio' ? '20' : '100,000'}
            />
          </label>
        </div>
        <div className="form-row">
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            설명/비고
            <input
              value={form.note ?? ''}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={save}>
            {editing ? '수정 저장' : '항목 추가'}
          </button>
          {editing && (
            <button className="btn" onClick={startNew}>
              취소
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h3>지출 항목 ({state.categories.length})</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>항목명</th>
                <th>한도 규칙</th>
                <th>설명</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.categories.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>
                    {c.limitType === 'none' ? (
                      <span className="badge badge-muted">제한 없음</span>
                    ) : (
                      <span className="badge badge-warning">{describeLimit(c)}</span>
                    )}
                  </td>
                  <td className="muted">{c.note || '-'}</td>
                  <td>
                    <div className="btn-row">
                      <button className="btn btn-sm" onClick={() => startEdit(c)}>
                        수정
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(c)}>
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
