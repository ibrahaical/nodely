import { createEffect, createMemo, createSignal, For, Show, onCleanup, onMount } from 'solid-js'
import { Menu, Plus, Search, Trash2, ChevronDown, ChevronRight, PanelLeft, FileText, Folder, Undo2, Redo2, X, Command, CornerDownLeft, AlertTriangle, GripVertical } from 'lucide-solid'
import { db, saveWorkspace, seedIfEmpty, uid } from './lib/db'
import { children, flattenVisible, previousSibling } from './lib/hierarchy'
import type { Group, Note, Node, Workspace } from './lib/types'
import './App.css'

const blankNode = (parentId: string | null = null): Node => ({ id: uid(), text: '', parentId })
function App() {
  const [groups, setGroups] = createSignal<Group[]>([]), [notes, setNotes] = createSignal<Note[]>([])
  const [activeGroup, setActiveGroup] = createSignal(''), [activeNote, setActiveNote] = createSignal('')
  const [selectedNode, setSelectedNode] = createSignal(''), [query, setQuery] = createSignal('')
  const [drawer, setDrawer] = createSignal(false), [saving, setSaving] = createSignal(false), [saveError, setSaveError] = createSignal(false), [menu, setMenu] = createSignal<{x:number,y:number,id:string}|null>(null)
  const [hydrated, setHydrated] = createSignal(false)
  const [deleteModal, setDeleteModal] = createSignal<{title:string; description:string; confirm: () => void} | null>(null)
  const [shortcutModal, setShortcutModal] = createSignal(false)
  const [draggedNode, setDraggedNode] = createSignal<string | null>(null)
  const [history, setHistory] = createSignal<Workspace[]>([]), [future, setFuture] = createSignal<Workspace[]>([])
  const note = createMemo(() => notes().find(n => n.id === activeNote()))
  const groupNotes = createMemo(() => notes().filter(n => n.groupId === activeGroup()))
  const visibleNodes = createMemo(() => note() ? flattenVisible(note()!.nodes) : [])
  const visibleNodeIds = createMemo(() => visibleNodes().map(node => node.id))
  const searchResults = createMemo(() => {
    const q = query().trim().toLowerCase(); if (!q) return []
    const groupNames = new Map(groups().map(group => [group.id, group.name.toLowerCase()]))
    return notes().flatMap(n => {
      const groupName = groupNames.get(n.groupId) || ''
      const noteMatch = n.title.toLowerCase().includes(q) || groupName.includes(q)
      return n.nodes.filter(x => noteMatch || x.text.toLowerCase().includes(q)).map(x => ({note:n,node:x}))
    })
  })
  const snapshot = (): Workspace => ({ groups: groups().map(g => ({...g})), notes: notes().map(n => ({...n, nodes:n.nodes.map(x=>({...x}))})) })
  const pushHistory = () => { setHistory(h => [...h.slice(-39), snapshot()]); setFuture([]) }
  const restore = (w: Workspace) => { setGroups(w.groups); setNotes(w.notes); setActiveGroup(w.groups[0]?.id || ''); setActiveNote(w.notes[0]?.id || '') }
  const mutateNote = (fn: (n: Note) => Note) => { if (!note()) return; pushHistory(); setNotes(all => all.map(n => n.id === activeNote() ? fn(n) : n)); setSaving(true) }
  let saveQueue = Promise.resolve()
  const save = () => {
    if (!hydrated()) return
    const workspace = snapshot()
    setSaving(true)
    setSaveError(false)
    saveQueue = saveQueue.then(() => saveWorkspace(workspace)).catch(error => {
      console.error('Unable to save workspace', error)
      setSaveError(true)
    }).finally(() => setSaving(false))
  }
  let saveTimer: number | undefined
  createEffect(() => {
    notes()
    groups()
    if (!hydrated()) return
    if (saveTimer) window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(save, 500)
  })
  onCleanup(() => saveTimer && window.clearTimeout(saveTimer))
  onMount(async () => {
    const closeModal = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (deleteModal()) setDeleteModal(null)
      else if (shortcutModal()) setShortcutModal(false)
    }
    window.addEventListener('keydown', closeModal)
    onCleanup(() => window.removeEventListener('keydown', closeModal))
    try {
      await seedIfEmpty()
      const [g,n] = await Promise.all([db.groups.toArray(), db.notes.toArray()])
      setGroups(g); setNotes(n); setActiveGroup(g[0]?.id || ''); setActiveNote(n[0]?.id || '')
      setHydrated(true)
    } catch (error) {
      console.error('Unable to load workspace', error)
      setSaveError(true)
    }
  })

  let editingNode = ''
  let editHistoryTimer: number | undefined
  const addGroup = () => { const g:Group = {id:uid(),name:'New group',color:'#9b8cdf',createdAt:Date.now()}; setGroups(x=>[...x,g]); setActiveGroup(g.id); setDrawer(false) }
  const removeGroup = () => {
    const g = groups().find(x => x.id === activeGroup())
    if (!g) return
    const noteCount = notes().filter(n => n.groupId === g.id).length
    setDeleteModal({
      title: `Delete “${g.name}”?`,
      description: `This will permanently delete the group and ${noteCount} ${noteCount === 1 ? 'note' : 'notes'} inside it.`,
      confirm: () => {
        pushHistory()
        const remaining = groups().filter(x => x.id !== g.id)
        const remainingNotes = notes().filter(x => x.groupId !== g.id)
        setGroups(remaining)
        setNotes(remainingNotes)
        setActiveGroup(remaining[0]?.id || '')
        setActiveNote(remainingNotes.find(n => n.groupId === remaining[0]?.id)?.id || '')
      },
    })
  }
  const addNote = () => { const n:Note={id:uid(),groupId:activeGroup(),title:'Untitled note',updatedAt:Date.now(),nodes:[blankNode()]}; setNotes(x=>[...x,n]); setActiveNote(n.id); setSelectedNode(n.nodes[0].id); setDrawer(false) }
  const removeNote = () => {
    const n = note()
    if (!n) return
    setDeleteModal({
      title: `Delete “${n.title}”?`,
      description: 'This note and all of its ideas will be permanently removed.',
      confirm: () => {
        pushHistory()
        const rest = notes().filter(x => x.id !== n.id)
        setNotes(rest)
        setActiveNote(rest.find(x => x.groupId === activeGroup())?.id || '')
      },
    })
  }
  const renameGroup = (group: Group) => { const name = prompt('Group name', group.name)?.trim(); if (!name || name === group.name) return; setGroups(all => all.map(item => item.id === group.id ? { ...item, name } : item)) }
  const renameNote = (item: Note) => { const title = prompt('Note name', item.title)?.trim(); if (!title || title === item.title) return; setNotes(all => all.map(noteItem => noteItem.id === item.id ? { ...noteItem, title, updatedAt: Date.now() } : noteItem)) }
  const removeNode = (id: string) => mutateNote(n => {
    const target = n.nodes.find(item => item.id === id)
    if (!target) return n
    return { ...n, updatedAt: Date.now(), nodes: n.nodes.filter(item => item.id !== id).map(item => item.parentId === id ? { ...item, parentId: target.parentId } : item) }
  })
  const addSibling = (node: Node) => {
    if (!note()?.nodes.some(item => item.id === node.id)) return
    const newNode = blankNode(node.parentId)
    mutateNote(current => {
      const index = current.nodes.findIndex(item => item.id === node.id)
      return { ...current, nodes: [...current.nodes.slice(0, index + 1), newNode, ...current.nodes.slice(index + 1)] }
    })
    setSelectedNode(newNode.id)
    window.setTimeout(() => document.getElementById(`node-${newNode.id}`)?.focus(), 0)
  }
  const addRootNode = () => {
    if (!note()) return
    const newNode = blankNode(null)
    mutateNote(current => ({ ...current, nodes: [...current.nodes, newNode] }))
    setSelectedNode(newNode.id)
    window.setTimeout(() => document.getElementById(`node-${newNode.id}`)?.focus(), 0)
  }
  const resizeNodeInput = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }
  const requestNodeDelete = (id: string) => {
    const target = note()?.nodes.find(item => item.id === id)
    if (!target) return
    const childCount = children(note()!.nodes, id).length
    setDeleteModal({
      title: 'Delete this idea?',
      description: childCount
        ? `Its ${childCount} ${childCount === 1 ? 'child will' : 'children will'} move up one level.`
        : 'This idea will be permanently removed from the note.',
      confirm: () => removeNode(id),
    })
  }
  const updateNode = (id:string,text:string) => {
    if (!note()) return
    if (editingNode !== id) {
      pushHistory()
      editingNode = id
    }
    if (editHistoryTimer) window.clearTimeout(editHistoryTimer)
    editHistoryTimer = window.setTimeout(() => { editingNode = '' }, 700)
    setNotes(all => all.map(item => {
      if (item.id !== activeNote()) return item
      return { ...item, updatedAt: Date.now(), nodes: item.nodes.map(node => node.id === id ? { ...node, text } : node) }
    }))
    setSaving(true)
  }
  const setNodeParent = (id:string,parentId:string|null) => mutateNote(n=>({...n,updatedAt:Date.now(),nodes:n.nodes.map(x=>x.id===id?{...x,parentId}:x)}))
  const subtreeIds = (nodes: Node[], rootId: string) => {
    const ids = new Set([rootId])
    let changed = true
    while (changed) {
      changed = false
      for (const item of nodes) {
        if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
          ids.add(item.id)
          changed = true
        }
      }
    }
    return ids
  }
  const moveNodeBefore = (sourceId: string, targetId: string) => {
    if (sourceId === targetId || !note()) return
    const source = note()!.nodes.find(item => item.id === sourceId)
    const target = note()!.nodes.find(item => item.id === targetId)
    if (!source || !target || subtreeIds(note()!.nodes, sourceId).has(targetId)) return
    mutateNote(current => {
      const movingIds = subtreeIds(current.nodes, sourceId)
      const moving = current.nodes.filter(item => movingIds.has(item.id))
      const remaining = current.nodes.filter(item => !movingIds.has(item.id))
      const targetIndex = remaining.findIndex(item => item.id === targetId)
      if (targetIndex < 0) return current
      const adjustedMoving = moving.map(item => item.id === sourceId ? { ...item, parentId: target.parentId } : item)
      remaining.splice(targetIndex, 0, ...adjustedMoving)
      return { ...current, updatedAt: Date.now(), nodes: remaining }
    })
  }
  const handleKey = (e:KeyboardEvent, node:Node) => {
    const visible=visibleNodes(), index=visible.findIndex(x=>x.id===node.id)
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); addSibling(node) }
    else if (e.key==='Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        if (node.parentId) {
          const parent = note()!.nodes.find(item => item.id === node.parentId)
          if (parent) setNodeParent(node.id, parent.parentId)
        }
      } else {
        const prev = previousSibling(note()!.nodes, node)
        if (prev) setNodeParent(node.id, prev.id)
      }
    }
    else if (e.key==='ArrowUp' && visible[index-1]) { e.preventDefault(); setSelectedNode(visible[index-1].id); document.getElementById(`node-${visible[index-1].id}`)?.focus() }
    else if (e.key==='ArrowDown' && visible[index+1]) { e.preventDefault(); setSelectedNode(visible[index+1].id); document.getElementById(`node-${visible[index+1].id}`)?.focus() }
    else if (e.key==='ArrowLeft') { e.preventDefault(); if (children(note()!.nodes,node.id).length && !node.collapsed) mutateNote(n=>({...n,nodes:n.nodes.map(x=>x.id===node.id?{...x,collapsed:true}:x)})); else if(node.parentId) { setSelectedNode(node.parentId); document.getElementById(`node-${node.parentId}`)?.focus() } }
    else if (e.key==='ArrowRight') { e.preventDefault(); const kids=children(note()!.nodes,node.id); if(kids.length && node.collapsed) mutateNote(n=>({...n,nodes:n.nodes.map(x=>x.id===node.id?{...x,collapsed:false}:x)})); else if(kids[0]) {setSelectedNode(kids[0].id);document.getElementById(`node-${kids[0].id}`)?.focus()} }
    else if (e.key==='Backspace' && !node.text) { e.preventDefault(); const prev=previousSibling(note()!.nodes,node); removeNode(node.id); if(prev) setSelectedNode(prev.id) }
    else if (e.key==='Delete' && !node.text) { e.preventDefault(); removeNode(node.id) }
  }
  const undo = () => { const h=history(); if(!h.length)return; setFuture(f=>[snapshot(),...f]); restore(h[h.length-1]); setHistory(h.slice(0,-1)) }
  const redo = () => { const f=future(); if(!f.length)return; setHistory(h=>[...h,snapshot()]); restore(f[0]); setFuture(f.slice(1)) }
  const openSearchResult = (result: { note: Note }) => {
    setActiveGroup(result.note.groupId)
    setActiveNote(result.note.id)
    setSelectedNode(result.note.nodes[0]?.id || '')
    setQuery('')
  }
  onCleanup(() => { if (editHistoryTimer) window.clearTimeout(editHistoryTimer) })

  return <div class="app" onClick={() => setMenu(null)}>
    <aside classList={{sidebar:true,open:drawer()}}>
      <div class="brand"><img class="brand-logo" src="/brand/nodely-logo.png" alt="Nodely" /><button class="icon-btn mobile-only" aria-label="Close sidebar" onClick={()=>setDrawer(false)}><X size={18}/></button></div>
      <div class="sidebar-label">Workspace <button class="icon-btn" onClick={addGroup} title="New group"><Plus size={16}/></button></div>
      <div class="groups"><For each={groups()}>{g=><div classList={{'group-row':true,active:g.id===activeGroup()}}><button class="row-main" onClick={()=>{setActiveGroup(g.id);setActiveNote(groupNotes()[0]?.id||'');setDrawer(false)}} onDblClick={()=>renameGroup(g)}><span class="dot" style={{'background-color':g.color}}/><span>{g.name}</span></button><button class="row-action" onClick={()=>{setActiveGroup(g.id);removeGroup()}} aria-label={`Delete ${g.name}`}><Trash2 size={14}/></button></div>}</For></div>
      <div class="sidebar-label notes-label">Notes <button class="icon-btn" onClick={addNote} title="New note"><Plus size={16}/></button></div>
      <div class="notes-list"><For each={groupNotes()} fallback={<div class="mini-empty">No notes yet.<br/><button onClick={addNote}>Create one</button></div>}>{n=><button classList={{'note-row':true,active:n.id===activeNote()}} onClick={()=>{setActiveNote(n.id);setDrawer(false)}} onDblClick={()=>renameNote(n)}><FileText size={15}/><span>{n.title || 'Untitled note'}</span></button>}</For></div>
      <div class="sidebar-footer"><button class="shortcut-link" onClick={() => setShortcutModal(true)}><Command size={12}/> Keyboard guide <kbd>?</kbd></button><a class="creator-credit" href="https://falachul-ibrahaical.pages.dev/" target="_blank" rel="noreferrer">Made by Falachul Akhadihima Ibrahaical</a></div>
    </aside>
    <main class="main">
      <header class="topbar"><button class="icon-btn" onClick={()=>setDrawer(!drawer())} aria-label="Toggle sidebar"><PanelLeft size={19}/></button><div class="crumb"><span>{groups().find(g=>g.id===activeGroup())?.name||'Workspace'}</span><ChevronRight size={14}/><strong>{note()?.title||'Select a note'}</strong></div><div class="top-actions"><button class="icon-btn" onClick={undo} disabled={!history().length} title="Undo"><Undo2 size={17}/></button><button class="icon-btn" onClick={redo} disabled={!future().length} title="Redo"><Redo2 size={17}/></button><button classList={{'save-status':true,error:saveError()}} onClick={save} title={saveError() ? 'Retry saving' : undefined}><span classList={{saving:saving(),error:saveError()}}/>{saving()?'Saving':saveError()?'Retry save':'Saved'}</button></div></header>
      <div class="searchbar"><Search size={16}/><input value={query()} onInput={e=>setQuery(e.currentTarget.value)} placeholder="Search groups, notes, and ideas" /><Show when={query()}><button class="clear-search" onClick={()=>setQuery('')}><X size={15}/></button></Show><kbd><Command size={12}/> K</kbd></div>
      <Show when={query()} fallback={<Show when={note()} fallback={<div class="empty"><div class="empty-icon"><Folder size={22}/></div><h1>Choose a note to begin</h1><p>Create a note from the sidebar, then build your thoughts one line at a time.</p><button class="primary" onClick={addNote}><Plus size={16}/> New note</button></div>}><section class="editor"><div class="editor-heading"><div class="title-wrap"><input class="title-input" value={note()!.title} onInput={e=>{const value=e.currentTarget.value; mutateNote(n=>({...n,title:value,updatedAt:Date.now()}))}}/><div class="meta"><span>{note()!.nodes.length} ideas</span><span>•</span><span>Edited just now</span></div></div><button class="icon-btn danger" onClick={removeNote} title="Delete note"><Trash2 size={17}/></button></div><div class="hint"><CornerDownLeft size={14}/> Enter to add <span>•</span> Shift + Enter for a new line <span>•</span> Tab to nest <span>•</span> Drag the six dots to reorder</div><Show when={visibleNodeIds().length} fallback={<div class="empty-note"><div class="empty-note-icon"><Plus size={18}/></div><h2>Start this note</h2><p>Add your first idea to begin building the outline.</p><button class="primary" onClick={addRootNode}><Plus size={16}/> Add first idea</button><span class="empty-note-hint">You can also use Enter after focusing an idea.</span></div>}><div class="tree"><For each={visibleNodeIds()}>{id=>{const current=()=>note()?.nodes.find(node=>node.id===id);return <Show when={current()}>{n=><div classList={{'node-row':true,selected:selectedNode()===id,dragging:draggedNode()===id}} style={{'--depth':(depth(note()!.nodes,id))}} onContextMenu={e=>{e.preventDefault();setMenu({x:e.clientX,y:e.clientY,id})}} onDragOver={e=>{if(draggedNode() && draggedNode() !== id) e.preventDefault()}} onDrop={e=>{e.preventDefault();const source=draggedNode();if(source) moveNodeBefore(source,id);setDraggedNode(null)}}><Show when={children(note()!.nodes,id).length} fallback={<span class="node-bullet"/>}><button class="collapse" onClick={()=>mutateNote(x=>({...x,nodes:x.nodes.map(y=>y.id===id?{...y,collapsed:!y.collapsed}:y)}))} aria-label={n().collapsed ? 'Expand node' : 'Collapse node'}>{n().collapsed?<ChevronRight size={14}/>:<ChevronDown size={14}/>}</button></Show><button class="drag-handle" draggable="true" onDragStart={e=>{e.stopPropagation();setDraggedNode(id);if(e.dataTransfer)e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDraggedNode(null)} aria-label="Drag to reorder node" title="Drag to reorder"><GripVertical size={14}/></button><div class="node-content"><textarea id={`node-${id}`} value={n().text} rows="1" placeholder="Start an idea…" onFocus={e=>{setSelectedNode(id);resizeNodeInput(e.currentTarget)}} onBlur={() => setSelectedNode('')} onInput={e=>{resizeNodeInput(e.currentTarget);updateNode(id,e.currentTarget.value)}} onKeyDown={e=>handleKey(e,n())}/><div class="node-actions"><button class="add-node-button" onClick={()=>addSibling(n())}><Plus size={12}/> Add node</button><button class="delete-node-button" onClick={()=>requestNodeDelete(id)} title="Delete node" aria-label="Delete node"><Trash2 size={12}/> Delete</button></div></div><Show when={children(note()!.nodes,id).length}><span class="child-count">{children(note()!.nodes,id).length}</span></Show></div>}</Show>}}</For></div></Show></section></Show>}><div class="search-results"><div class="results-head"><h1>Search results</h1><span>{searchResults().length} matches</span></div><Show when={searchResults().length} fallback={<div class="empty small"><div class="empty-icon"><Search size={21}/></div><h2>No matches found</h2><p>Try another word or search for an idea.</p></div>}><For each={searchResults()}>{r=><button class="result" onClick={()=>openSearchResult(r)}><FileText size={16}/><span><strong>{r.note.title}</strong><small>{r.node.text}</small></span><ChevronRight size={16}/></button>}</For></Show></div></Show>
    </main>
    <Show when={menu()}>{m=><div class="context-menu" style={{left:`${m().x}px`,top:`${m().y}px`}} onClick={e=>e.stopPropagation()}><button onClick={()=>{mutateNote(n=>({...n,nodes:n.nodes.map(x=>x.id===m().id?{...x,collapsed:!x.collapsed}:x)}));setMenu(null)}}><Menu size={15}/> Toggle children</button><button class="delete-item" onClick={()=>{requestNodeDelete(m().id);setMenu(null)}}><Trash2 size={15}/> Delete node</button></div>}</Show>
    <Show when={deleteModal()}>{modal => <div class="modal-backdrop" role="presentation" onClick={() => setDeleteModal(null)}><section class="delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" onClick={e => e.stopPropagation()}><div class="modal-icon"><AlertTriangle size={20}/></div><div class="modal-copy"><h2 id="delete-title">{modal().title}</h2><p>{modal().description}</p></div><div class="modal-actions"><button class="modal-cancel" onClick={() => setDeleteModal(null)}>Cancel</button><button class="modal-delete" onClick={() => { modal().confirm(); setDeleteModal(null) }}>Delete permanently</button></div></section></div>}</Show>
    <Show when={shortcutModal()}><div class="modal-backdrop" role="presentation" onClick={() => setShortcutModal(false)}><section class="shortcut-modal" role="dialog" aria-modal="true" aria-labelledby="shortcut-title" onClick={e => e.stopPropagation()}><div class="shortcut-modal-header"><div><span class="modal-eyebrow">Nodely</span><h2 id="shortcut-title">Keyboard guide</h2></div><button class="icon-btn" onClick={() => setShortcutModal(false)} aria-label="Close keyboard guide"><X size={17}/></button></div><div class="shortcut-list"><div><span>Enter</span><small>Add a sibling node</small></div><div><span>Shift + Enter</span><small>Add a new line in the current idea</small></div><div><span>Tab</span><small>Indent under the previous node</small></div><div><span>Shift + Tab</span><small>Outdent one level</small></div><div><span>Arrow keys</span><small>Move through visible nodes</small></div><div><span>Backspace</span><small>Remove an empty node</small></div></div><button class="modal-cancel shortcut-close" onClick={() => setShortcutModal(false)}>Close</button></section></div></Show>
  </div>
}
function depth(nodes:Node[], id:string) { let d=0, n=nodes.find(x=>x.id===id); while(n?.parentId){d++;n=nodes.find(x=>x.id===n!.parentId)} return d }
export default App
