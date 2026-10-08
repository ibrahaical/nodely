export type Node = { id: string; text: string; parentId: string | null; collapsed?: boolean }
export type Note = { id: string; groupId: string; title: string; nodes: Node[]; updatedAt: number }
export type Group = { id: string; name: string; color: string; createdAt: number }
export type Workspace = { groups: Group[]; notes: Note[] }
