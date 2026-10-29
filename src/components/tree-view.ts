import { removeNode, swapNodes, toggleTaskComplete } from '../actions';
import { ICONS } from '../constants';
import { getFaviconUrl } from '../services/favicon';
import { buildTree, hasChildren } from '../services/tree';
import { editMode, editingNode, rawList, settings } from '../state';
import { FaviconProvider, LinkNode } from '../types';
import { a, div, img, li, span, ul } from '../van';

function DeleteButton(node: LinkNode) {
  return a({
    href: '#',
    onclick: (e: Event) => {
      e.preventDefault();
      void removeNode(node.name);
    },
  }, ICONS.MINUS);
}

function MoveButton(direction: 'up' | 'down', node: LinkNode, sibling: LinkNode) {
  return a({
    href: '#',
    class: `move-btn move-${direction}`,
    onclick: (e: Event) => {
      e.preventDefault();
      void swapNodes(node.name, sibling.name);
    },
  }, direction === 'up' ? ICONS.UP : ICONS.DOWN);
}

function MoveControls(node: LinkNode, siblings: LinkNode[], index: number) {
  const buttons = [];
  if (index > 0) buttons.push(MoveButton('up', node, siblings[index - 1]));
  if (index < siblings.length - 1) buttons.push(MoveButton('down', node, siblings[index + 1]));
  return div({ class: 'move-controls' }, ...buttons);
}

function showFavicon(node: LinkNode): boolean {
  return !!node.url && node.icon !== FaviconProvider.None && !editMode.val;
}

function faviconClasses(node: LinkNode): string {
  return node.border === 1 ? 'favicon border-effect' : 'favicon';
}

function NodeContent(node: LinkNode) {
  const contentClasses = [
    node.taskComplete ? 'text-linethrough' : '',
    editMode.val ? 'editable-node' : '',
  ].filter(Boolean).join(' ');

  const startEditing = (e: Event) => {
    if (!editMode.val) return;
    e.preventDefault();
    e.stopPropagation();
    editingNode.val = node;
  };

  if (node.url) {
    return span({ class: contentClasses },
      a({ href: node.url, onclick: startEditing },
        () => showFavicon(node)
          ? img({ src: getFaviconUrl(node.url!, node.icon ?? FaviconProvider.Chrome), class: faviconClasses(node) })
          : '',
        node.name,
      ),
    );
  }

  return span({
    class: contentClasses,
    onclick: startEditing,
    style: editMode.val ? 'cursor: pointer;' : '',
  }, node.name);
}

function TreeNode(node: LinkNode, siblings: LinkNode[], index: number) {
  const children: Element[] = [];

  if (editMode.val && siblings.length > 1) {
    children.push(MoveControls(node, siblings, index));
  }

  children.push(NodeContent(node));

  if (editMode.val && !hasChildren(node)) {
    children.push(DeleteButton(node));
  }

  if (hasChildren(node)) {
    children.push(ChildList(node.children!));
  }

  const markComplete = settings.val.enableRightClickComplete
    ? (e: Event) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        void toggleTaskComplete(node.name);
      }
    : undefined;

  return li({
    class: `tree-item ${hasChildren(node) ? 'text-parent' : 'text-child'}`,
    ...(markComplete ? { oncontextmenu: markComplete } : {}),
  }, ...children);
}

function ChildList(nodes: LinkNode[]) {
  return ul({ class: 'tree-list' },
    ...nodes.map((child, index) => TreeNode(child, nodes, index)),
  );
}

/**
 * The full tree of lists. Rendered inside a reactive binding, so it re-renders
 * whenever rawList, editMode, or settings change. The tree is built here rather
 * than in a van.derive: derived states update a task later, so the first render
 * would show an empty page before the tree.
 */
export function TreeView() {
  const tree = buildTree(rawList.val);
  const container = { id: 'lists-container', class: 'row main-content' };
  if (!tree.children?.length) return div(container);

  return div(container,
    ...tree.children.map((node, index) =>
      ul({ class: 'tree-list col' }, TreeNode(node, tree.children!, index)),
    ),
  );
}
