'use client';
import { useEffect, useRef, useState } from 'react';
import { FolderPlus, X, Check, LoaderCircle } from 'lucide-react';
import { colors, statuses, type Project, type ProjectInput } from '@/lib/project';
import { UNCATEGORIZED, type Category } from '@/lib/category';

export default function ProjectDialog({ project, categories, initialCategoryId = null, onClose, onSave }: { project: Project | null; categories: Category[]; initialCategoryId?: string | null; onClose: () => void; onSave: (input: ProjectInput, id?: string) => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<ProjectInput>(project || { name: '', path: '', description: '', tags: [], status: '진행 중', color: 'sage', favorite: false, categoryId: initialCategoryId === UNCATEGORIZED ? null : initialCategoryId });
  const [tags, setTags] = useState(project?.tags.join(', ') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const update = (value: Partial<ProjectInput>) => setForm(prev => ({ ...prev, ...value }));
  return <dialog ref={dialog} className="project-dialog" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }} aria-labelledby="dialog-title">
    <form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { await onSave({ ...form, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }, project?.id); onClose(); } catch (e) { setError(e instanceof Error ? e.message : '저장에 실패했습니다.'); } finally { setBusy(false); } }}>
      <div className="dialog-heading"><span className="icon-box sage"><FolderPlus size={23}/></span><button type="button" className="icon-button" aria-label="닫기" onClick={onClose} disabled={busy}><X size={20}/></button></div>
      <h2 id="dialog-title">{project ? '프로젝트 수정' : '새로운 프로젝트 등록'}</h2><p className="muted">내 컴퓨터의 프로젝트를 작업공간에 모아보세요.</p>
      <label>프로젝트 이름 <span>*</span><input autoFocus required maxLength={80} placeholder="예: 나의 포트폴리오" value={form.name} onChange={e => update({ name: e.target.value })}/></label>
      <label>카테고리<select value={form.categoryId || UNCATEGORIZED} onChange={e => update({ categoryId: e.target.value === UNCATEGORIZED ? null : e.target.value })}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select><small>등록하면 선택한 카테고리의 메뉴에 바로 표시됩니다.</small></label>
      <label>로컬 폴더 경로 <span>*</span><input required maxLength={2048} placeholder="C:\Users\me\projects\my-project" value={form.path} onChange={e => update({ path: e.target.value })}/><small>탐색기에서 폴더의 전체 경로를 복사해 붙여넣어 주세요.</small></label>
      <label>프로젝트 설명<textarea rows={3} maxLength={500} placeholder="어떤 프로젝트인가요?" value={form.description} onChange={e => update({ description: e.target.value })}/></label>
      <div className="form-columns"><label>진행 상태<select value={form.status} onChange={e => update({ status: e.target.value as ProjectInput['status'] })}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label><label>태그<input placeholder="Next.js, React, 개인 작업" value={tags} onChange={e => setTags(e.target.value)}/><small>쉼표로 구분 · 최대 8개</small></label></div>
      <div className="color-field">프로젝트 색상<div className="flex gap-2 mt-2">{colors.map(color => <button type="button" key={color} className={`color-choice ${color}`} aria-label={`${color} 색상`} aria-pressed={form.color === color} onClick={() => update({ color })}>{form.color === color && <Check size={16}/>}</button>)}</div></div>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="dialog-footer"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>취소</button><button type="submit" className="primary-button" disabled={busy}>{busy ? <LoaderCircle size={16} className="animate-spin"/> : <Check size={16}/>} {project ? '변경사항 저장' : '프로젝트 등록'}</button></div>
    </form>
  </dialog>;
}
