import Dexie, { type Table } from 'dexie'
import type { Group, Note, Workspace } from './types'

class NodelyDB extends Dexie {
  groups!: Table<Group, string>
  notes!: Table<Note, string>
  constructor() {
    super('nodely')
    this.version(1).stores({ groups: 'id, createdAt', notes: 'id, groupId, updatedAt' })
  }
}
export const db = new NodelyDB()
export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
export async function saveWorkspace(workspace: Workspace) {
  await db.transaction('rw', db.groups, db.notes, async () => {
    const groupIds = new Set(workspace.groups.map(group => group.id))
    const noteIds = new Set(workspace.notes.map(note => note.id))
    await db.groups.bulkPut(workspace.groups)
    await db.notes.bulkPut(workspace.notes)
    await db.groups.filter(group => !groupIds.has(group.id)).delete()
    await db.notes.filter(note => !noteIds.has(note.id)).delete()
  })
}
export async function seedIfEmpty() {
  if (await db.groups.count()) return
  const g1: Group = { id: uid(), name: 'Getting started', color: '#8b79d9', createdAt: Date.now() }
  const g2: Group = { id: uid(), name: 'Personal', color: '#d28baa', createdAt: Date.now() }
  const now = Date.now()
  const n1: Note = { id: uid(), groupId: g1.id, title: 'A calmer way to think', updatedAt: now, nodes: [
    { id: uid(), text: 'Capture the thought first. Organize it later.', parentId: null },
    { id: uid(), text: 'Use Enter for a sibling node', parentId: null },
    { id: uid(), text: 'Use Tab to nest an idea under the previous one', parentId: null },
    { id: uid(), text: 'Small, visible steps make big ideas easier.', parentId: null },
  ]}
  const n2: Note = { id: uid(), groupId: g2.id, title: 'Weekend plans', updatedAt: now, nodes: [
    { id: uid(), text: 'Walk somewhere new', parentId: null },
    { id: uid(), text: 'Read a chapter', parentId: null },
  ]}
  await db.groups.bulkAdd([g1, g2]); await db.notes.bulkAdd([n1, n2])
}
