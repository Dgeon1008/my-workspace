'use client';

import { useState } from 'react';
import { ArrowRightLeft, ChartNoAxesCombined, ChevronRight, Folder, Gamepad2, Grid2X2, GripVertical, Home, LoaderCircle, Plus, Trash2, X } from 'lucide-react';
import { categoryOf, UNCATEGORIZED, type Category } from '@/lib/category';
import type { HarnessModule } from '@/lib/harness-modules';
import { ThemeToggle } from './theme-provider';

export function ModuleCategorySelect({ module, categories, onMove, disabled = false, compact = false }: {
  module: HarnessModule; categories: Category[]; onMove: (module: HarnessModule, categoryId: string) => void; disabled?: boolean; compact?: boolean;
}) {
  return <label className={`project-category-select ${compact ? 'compact' : ''}`} title="다른 카테고리로 이동">
    <ArrowRightLeft size={compact ? 12 : 13}/>
    <select aria-label={`${module.name} 카테고리 이동`} value={categoryOf(module)} disabled={disabled} onChange={event => onMove(module, event.target.value)}>
      {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
    </select>
  </label>;
}

export default function WorkspaceSidebar({ modules, categories, section, onNavigate, onToggle, onAdd, onMove, onDeleteModule, onDeleteCategory, busy }: {
  modules: HarnessModule[]; categories: Category[]; section: string;
  onNavigate: (section: string) => void;
  onToggle: (category: Category) => Promise<void>;
  onAdd: (name: string) => Promise<void>;
  onMove: (module: HarnessModule, categoryId: string) => void;
  onDeleteModule: (module: HarnessModule) => void;
  onDeleteCategory: (category: Category) => void;
  busy: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  return <aside className="sidebar category-sidebar">
    <a href="/" className="brand"><span className="brand-mark"><Grid2X2 size={23}/></span><span>모아<span className="brand-dot">.</span></span></a>
    <div className="sidebar-workspace-caption"><span>나의 프로젝트 작업실</span><small>PERSONAL WORKSPACE</small></div>
    <nav className="sidebar-quick-nav" aria-label="시작 화면">
      <button className={`nav-item ${section === 'all' ? 'active' : ''}`} onClick={() => onNavigate('all')}><Home size={17}/>시작 화면</button>
    </nav>

    <div className="category-tree-heading category-list-heading"><span>카테고리</span><button className="icon-button" aria-label="카테고리 추가" title="카테고리 추가" onClick={() => { setAdding(value => !value); setError(''); }}><Plus size={16}/></button></div>
    {adding && <form className="category-create-form" onSubmit={async event => {
      event.preventDefault(); setError('');
      try { await onAdd(name); setName(''); setAdding(false); }
      catch (reason) { setError(reason instanceof Error ? reason.message : '추가하지 못했습니다.'); }
    }}>
      <label className="sr-only" htmlFor="new-category-name">새 카테고리 이름</label>
      <input id="new-category-name" autoFocus value={name} maxLength={32} placeholder="예: 업무, 사이드 프로젝트" onChange={event => setName(event.target.value)} disabled={busy}/>
      <div><button type="button" onClick={() => { setAdding(false); setError(''); }} disabled={busy}><X size={12}/>취소</button><button type="submit" disabled={busy || !name.trim()}>{busy ? <LoaderCircle size={12} className="animate-spin"/> : <Plus size={12}/>}추가</button></div>
      {error && <p role="alert">{error}</p>}
    </form>}

    <nav className="category-tree" aria-label="프로젝트 메뉴">
      {categories.map(category => {
        const children = modules.filter(module => categoryOf(module) === category.id);
        const Icon = category.id === 'stocks' ? ChartNoAxesCombined : category.id === 'games' ? Gamepad2 : Folder;
        const selected = children.some(module => section === `module:${module.id}`);
        return <section key={category.id} className={`category-group ${selected ? 'selected' : ''} ${dropTarget === category.id ? 'drop-target' : ''}`}
          onDragOver={event => { if (!busy && event.dataTransfer.types.includes('application/x-moa-module')) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(category.id); } }}
          onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropTarget(null); }}
          onDrop={event => {
            event.preventDefault(); setDropTarget(null);
            const module = modules.find(item => item.id === event.dataTransfer.getData('application/x-moa-module'));
            if (!busy && module && categoryOf(module) !== category.id) onMove(module, category.id);
          }}>
          <div className="category-heading-row">
            <button type="button" className="category-heading" aria-expanded={!category.collapsed} aria-controls={`category-projects-${category.id}`} disabled={busy} onClick={() => void onToggle(category)}>
              <ChevronRight size={13} className={`category-chevron ${category.collapsed ? '' : 'expanded'}`}/><Icon size={17}/><strong title={category.name}>{category.name}</strong><span>{children.length}</span>
            </button>
            {category.id !== UNCATEGORIZED && <button type="button" className="category-delete-button" aria-label={`${category.name} 카테고리 삭제`} title={`${category.name} 카테고리 삭제`} disabled={busy} onClick={() => onDeleteCategory(category)}><Trash2 size={13}/></button>}
          </div>
          <div id={`category-projects-${category.id}`} className={`category-collapse ${category.collapsed ? 'collapsed' : ''}`} aria-hidden={category.collapsed} inert={category.collapsed}>
            <div className="category-collapse-inner"><div className="category-project-list">
              {children.map(module => <div key={module.id} className={`category-project-row ${section === `module:${module.id}` ? 'active' : ''}`} draggable={!busy} onDragStart={event => { event.dataTransfer.setData('application/x-moa-module', module.id); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDropTarget(null)}>
                <GripVertical size={11} className="project-drag-handle" aria-hidden="true"/>
                <button className="category-project-link" title={module.name} onClick={() => onNavigate(`module:${module.id}`)}><i className="project-tree-dot sage"/><span>{module.name}</span></button>
                <ModuleCategorySelect module={module} categories={categories} onMove={onMove} disabled={busy} compact/>
                <button type="button" className="category-project-delete" aria-label={`${module.name} 메뉴에서 삭제`} title="프로젝트 메뉴에서 삭제" disabled={busy} onClick={() => onDeleteModule(module)}><Trash2 size={12}/></button>
              </div>)}
            </div></div>
          </div>
        </section>;
      })}
    </nav>
    <ThemeToggle/>
  </aside>;
}
