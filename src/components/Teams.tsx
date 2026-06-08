import { useState } from 'react';
import { useStore } from '../store';
import type { Team } from '../types';
import { formatWon, parseAmount, uid } from '../utils/format';

const BLANK: Omit<Team, 'id'> = {
  name: '',
  leader: '',
  memberCount: 1,
  totalBudget: 0,
  note: '',
};

export default function Teams() {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState<Omit<Team, 'id'>>(BLANK);

  function startNew() {
    setEditing(null);
    setForm(BLANK);
  }
  function startEdit(team: Team) {
    setEditing(team);
    setForm({ ...team });
  }
  function save() {
    if (!form.name.trim()) {
      alert('팀명을 입력하세요.');
      return;
    }
    const team: Team = { id: editing?.id ?? uid('team'), ...form };
    dispatch({ type: 'UPSERT_TEAM', team });
    startNew();
  }
  function remove(team: Team) {
    if (confirm(`'${team.name}' 팀과 해당 팀의 모든 지출내역을 삭제할까요?`)) {
      dispatch({ type: 'DELETE_TEAM', id: team.id });
      if (editing?.id === team.id) startNew();
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>팀 관리</h2>
          <p>지원금을 배정받은 참여 팀과 배정 금액을 등록합니다.</p>
        </div>
      </div>

      <div className="card">
        <h3>{editing ? '팀 정보 수정' : '새 팀 등록'}</h3>
        <div className="form-row">
          <label className="field">
            팀명
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: A팀 - 우리동네 기록단"
            />
          </label>
          <label className="field">
            팀장
            <input
              value={form.leader}
              onChange={(e) => setForm({ ...form, leader: e.target.value })}
            />
          </label>
          <label className="field">
            참여 인원
            <input
              type="number"
              min={1}
              value={form.memberCount}
              onChange={(e) =>
                setForm({ ...form, memberCount: Number(e.target.value) || 1 })
              }
            />
          </label>
          <label className="field">
            총 배정 지원금(원)
            <input
              inputMode="numeric"
              value={form.totalBudget ? form.totalBudget.toLocaleString('ko-KR') : ''}
              onChange={(e) =>
                setForm({ ...form, totalBudget: parseAmount(e.target.value) })
              }
              placeholder="2,000,000"
            />
          </label>
        </div>
        <div className="form-row">
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            비고
            <input
              value={form.note ?? ''}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="활동 주제 등"
            />
          </label>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={save}>
            {editing ? '수정 저장' : '팀 추가'}
          </button>
          {editing && (
            <button className="btn" onClick={startNew}>
              취소
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h3>등록된 팀 ({state.teams.length})</h3>
        {state.teams.length === 0 ? (
          <div className="empty">등록된 팀이 없습니다.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>팀명</th>
                  <th>팀장</th>
                  <th className="num">인원</th>
                  <th className="num">배정 지원금</th>
                  <th className="num">지출 건수</th>
                  <th>비고</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.teams.map((t) => {
                  const count = state.expenses.filter((e) => e.teamId === t.id).length;
                  return (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>{t.leader || '-'}</td>
                      <td className="num">{t.memberCount}</td>
                      <td className="num">{formatWon(t.totalBudget)}</td>
                      <td className="num">{count}</td>
                      <td className="muted">{t.note || '-'}</td>
                      <td>
                        <div className="btn-row">
                          <button className="btn btn-sm" onClick={() => startEdit(t)}>
                            수정
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => remove(t)}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
