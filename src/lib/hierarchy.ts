import type { Node } from './types'
export function children(nodes: Node[], parentId: string | null) { return nodes.filter(n => n.parentId === parentId) }
export function flattenVisible(nodes: Node[]) {
  const out: Node[] = []
  const byParent = new Map<string | null, Node[]>()
  for (const node of nodes) {
    const siblings = byParent.get(node.parentId)
    if (siblings) siblings.push(node)
    else byParent.set(node.parentId, [node])
  }
  const walk = (parent: string | null, ancestors = new Set<string>()) => (byParent.get(parent) ?? []).forEach(n => {
    if (ancestors.has(n.id)) return
    out.push(n)
    if (!n.collapsed) {
      const nextAncestors = new Set(ancestors)
      nextAncestors.add(n.id)
      walk(n.id, nextAncestors)
    }
  })
  walk(null); return out
}
export function previousSibling(nodes: Node[], node: Node) {
  const list = children(nodes, node.parentId); return list[list.findIndex(n => n.id === node.id) - 1]
}
export function nextSibling(nodes: Node[], node: Node) {
  const list = children(nodes, node.parentId); return list[list.findIndex(n => n.id === node.id) + 1]
}
