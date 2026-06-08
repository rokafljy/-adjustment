import { useRef, useState } from 'react';
import { useStore } from '../store';
import type { Expense, PaymentMethod } from '../types';
import { formatWon, parseAmount, today, uid } from '../utils/format';
import {
  downloadExpenseTemplate,
  exportExpenses,
  importExpensesFromFile,
} from '../utils/excel';

const PAYMENTS: PaymentMethod[] = ['카드', '계좌이체', '현금', '기타'];

function blank(teamId: string, categoryId: string): Omit<Expense, 'id'> {
  return {
    teamId,
    categoryId,
    date: today(),
    vendor: '',
    amount: 0,
    description: '',
    hasReceipt: true,
    paymentMethod: '카드',
  };
}

export default function Expenses() {
  const { state, dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Omit<Expense, 'id'>>(
    blank(state.teams[0]?.id ?? '', state.categories[0]?.id ?? '')
  );

  const teamById = new Map(state.teams.map((t) => [t.id, t]));
  const catById = new Map(state.categories.map((c) => [c.id, c]));

  const noBasics = state.teams.length === 0 || state.categories.length === 0;

  function resetForm() {
    setEditing(null);
    setForm(blank(state.teams[0]?.id ?? '', state.categories[0]?.id ?? ''));
  }
  function startEdit(e: Expense) {
    setEditing(e);
    setForm({ ...e });
  }
  function save() {
    if (!form.teamId || !form.categoryId) {
      alert('팀과 항목을 선택하세요.');
      return;
    }
    if (form.amount <= 0) {
      alert('금액을 올바르게 입력하세요.');
      return;
    }
    const expense: Expense = { id: editing?.id ?? uid('exp'), ...form };
    dispatch({ type: 'UPSERT_EXPENSE', expense });
    resetForm();
  }
  function remove(e: Expense) {
    if (confirm('이 지출내역을 삭제할까요?')) {
      dispatch({ type: 'DELETE_EXPENSE', id: e.id });
      if (editing?.id === e.id) resetForm();
    }
  }

  async function onUpload(file: File) {
    try {
      const { expenses, errors } = await importExpensesFromFile(
        file,
        state.teams,
        state.categories
      );
      if (expenses.length === 0 && errors.length === 0) {
        alert('가져올 지출내역이 없습니다.');
        return;
      }
      const ok = confirm(
        `${expenses.length}건을 가져옵니다.` +
          (errors.length ? `\n\n무시된 행 ${errors.length}건:\n- ${errors.slice(0, 8).join('\n- ')}` : '')
      );
      if (ok && expenses.length) {
        dispatch({ type: 'ADD_EXPENSES', expenses });
      }
    } catch (err) {
      alert('엑셀 파일을 읽는 중 오류가 발생했습니다: ' + (err as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const filtered = state.expenses
    .filter((e) => filterTeam === 'all' || e.teamId === filterTeam)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>지출 내역</h2>
          <p>팀별 지출을 입력하거나 엑셀로 일괄 등록합니다.</p>
        </div>
        <div className="btn-row no-print">
          <button
            className="btn"
            onClick={() => downloadExpenseTemplate(state.teams, state.categories)}
          >
            📥 양식 다운로드
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            📤 엑셀 가져오기
          </button>
          <button
            className="btn"
            onClick={() => exportExpenses(state.expenses, state.teams, state.categories)}
          >
            💾 엑셀 내보내기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
        </div>
      </div>

      {noBasics ? (
        <div className="card">
          <div className="empty">
            먼저 <strong>팀 관리</strong>와 <strong>지출 항목 설정</strong>에서 팀과 항목을 등록하세요.
          </div>
        </div>
      ) : (
        <div className="card">
          <h3>{editing ? '지출내역 수정' : '지출내역 입력'}</h3>
          <div className="form-row">
            <label className="field">
              팀
              <select
                value={form.teamId}
                onChange={(e) => setForm({ ...form, teamId: e.target.value })}
              >
                {state.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              항목
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                {state.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              사용일
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label className="field">
              금액(원)
              <input
                inputMode="numeric"
                value={form.amount ? form.amount.toLocaleString('ko-KR') : ''}
                onChange={(e) => setForm({ ...form, amount: parseAmount(e.target.value) })}
                placeholder="10,000"
              />
            </label>
          </div>
          <div className="form-row">
            <label className="field">
              사용처
              <input
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                placeholder="○○상회"
              />
            </label>
            <label className="field">
              결제수단
              <select
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })
                }
              >
                {PAYMENTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              사용 내용
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </label>
            <label className="field checkbox-field" style={{ alignSelf: 'end', paddingBottom: 8 }}>
              <input
                type="checkbox"
                checked={form.hasReceipt}
                onChange={(e) => setForm({ ...form, hasReceipt: e.target.checked })}
              />
              증빙(영수증/계산서) 첨부
            </label>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>
              {editing ? '수정 저장' : '지출 추가'}
            </button>
            {editing && (
              <button className="btn" onClick={resetForm}>
                취소
              </button>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="toolbar">
          <h3 style={{ margin: 0 }}>지출 목록 ({filtered.length})</h3>
          <div className="spacer" />
          <select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}>
            <option value="all">전체 팀</option>
            {state.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {filtered.length === 0 ? (
          <div className="empty">등록된 지출내역이 없습니다.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>사용일</th>
                  <th>팀</th>
                  <th>항목</th>
                  <th>사용처</th>
                  <th className="num">금액</th>
                  <th>내용</th>
                  <th>결제</th>
                  <th>증빙</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{teamById.get(e.teamId)?.name ?? '(삭제됨)'}</td>
                    <td>{catById.get(e.categoryId)?.name ?? '(삭제됨)'}</td>
                    <td>{e.vendor || <span className="muted">미기재</span>}</td>
                    <td className="num">{formatWon(e.amount)}</td>
                    <td className="muted">{e.description || '-'}</td>
                    <td>{e.paymentMethod}</td>
                    <td>
                      {e.hasReceipt ? (
                        <span className="badge badge-ok">O</span>
                      ) : (
                        <span className="badge badge-error">누락</span>
                      )}
                    </td>
                    <td>
                      <div className="btn-row">
                        <button className="btn btn-sm" onClick={() => startEdit(e)}>
                          수정
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => remove(e)}>
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
