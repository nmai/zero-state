import { DOM_CLASSES, ICONS } from '../core/constants';
import { LinkNode, LinkNodeFlat } from '../core/types';
import { add, a, div, img, li, span, ul } from '../core/van';
import { CommandService } from '../services/command.service';
import { FaviconService } from '../services/favicon.service';
import { TreeService } from '../services/tree.service';
import { DataState } from '../state/data.state';
import { UIState } from '../state/ui.state';

export class TreeComponent {

  static renderDeleteButton(node: LinkNodeFlat) {
    return a({ href: "#", onclick: (e: Event) => {
      e.preventDefault();
      CommandService.deleteNode(node);
    }}, ICONS.MINUS);
  }

  static renderMoveUpButton(node: LinkNode, siblings: LinkNode[], index: number) {
    if (index <= 0) return null;

    return a({
      href: "#",
      class: "move-btn move-up",
      onclick: (e: Event) => {
        e.preventDefault();
        CommandService.moveNode(node, siblings[index - 1]);
      }
    }, ICONS.UP);
  }

  static renderMoveDownButton(node: LinkNode, siblings: LinkNode[], index: number) {
    if (index >= siblings.length - 1) return null;

    return a({
      href: "#",
      class: "move-btn move-down",
      onclick: (e: Event) => {
        e.preventDefault();
        CommandService.moveNode(node, siblings[index + 1]);
      }
    }, ICONS.DOWN);
  }

  static renderNodeContent(node: LinkNode) {
    const contentClasses = [];
    if (node.taskComplete) contentClasses.push(DOM_CLASSES.TEXT_LINETHROUGH);
    if (UIState.editMode.val) contentClasses.push('editable-node');

    const handleNodeClick = (e: Event) => {
      if (UIState.editMode.val) {
        e.preventDefault();
        e.stopPropagation();
        UIState.editingNode.val = node;
      }
    };

    const faviconClasses = (node: LinkNodeFlat) =>
      node.border == 1 ? "favicon border-effect" : "favicon";

    if (node.url) {
      return span({ class: contentClasses.join(' ') },
        a({
          href: node.url,
          onclick: handleNodeClick
        },
          () => FaviconService.displayIcon(node) ?
          img({ src: FaviconService.getIcon(node.url || '', node.icon), class: faviconClasses(node) }) : null,
          node.name
        )
      );
    } else {
      return span({
        class: contentClasses.join(' '),
        onclick: handleNodeClick,
        style: UIState.editMode.val ? "cursor: pointer;" : ""
      }, node.name);
    }
  }

  static renderNode(node: LinkNode, siblings?: LinkNode[], index?: number) {
    const nodeClass = TreeService.hasChildren(node)
      ? `${DOM_CLASSES.TREE_ITEM} ${DOM_CLASSES.TEXT_PARENT}`
      : `${DOM_CLASSES.TREE_ITEM} ${DOM_CLASSES.TEXT_CHILD}`;

    const children: any[] = [];

    if (UIState.editMode.val && siblings && siblings.length > 1) {
      const moveControls = div({ class: "move-controls" });
      const upButton = this.renderMoveUpButton(node, siblings, index || 0);
      const downButton = this.renderMoveDownButton(node, siblings, index || 0);

      if (upButton) add(moveControls, upButton);
      if (downButton) add(moveControls, downButton);

      children.push(moveControls);
    }

    children.push(this.renderNodeContent(node));

    if (UIState.editMode.val && !TreeService.hasChildren(node)) {
      children.push(this.renderDeleteButton(node));
    }

    if (TreeService.hasChildren(node) && node.children) {
      children.push(this.renderChildList(node.children));
    }

    const liProps: Record<string, any> = {
      id: 'listchild-' + node.name,
      class: nodeClass
    };

    if (DataState.settings.val.enableRightClickComplete) {
      liProps.oncontextmenu = (e: Event) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        CommandService.toggleTaskComplete(node);
      };
    }

    return li(liProps, ...children);
  }

  static renderChildList(children: LinkNode[]) {
    return ul({ class: DOM_CLASSES.TREE_LIST },
      ...children.map((child, index) => this.renderNode(child, children, index))
    );
  }

  static renderTree() {
    const tree = DataState.root.val;
    if (!tree.children || tree.children.length === 0) {
      return div({ id: "lists-container", class: "row main-content" });
    }

    const listGroups: any[] = [];
    let treeIndex = 0;

    for (const node of tree.children) {
      const rootChildren = tree.children;
      listGroups.push(
        ul({
          id: `list-group-${treeIndex}`,
          class: `${DOM_CLASSES.TREE_LIST} col`
        }, this.renderNode(node, rootChildren, treeIndex))
      );
      treeIndex++;
    }

    return div({ id: "lists-container", class: "row main-content" }, ...listGroups);
  }
}
