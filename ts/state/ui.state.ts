import { FooterMessage, LinkNodeFlat } from '../core/types';
import { state } from '../core/van';

export class UIState {
  static editMode = state(false);
  static settingsMode = state(false);
  static editingNode = state<LinkNodeFlat | null>(null);
  static footerMessages = state<Set<FooterMessage>>(new Set());

  static addFooterMessage(message: FooterMessage) {
    if (!this.footerMessages.val.has(message)) {
      this.footerMessages.val = new Set([...this.footerMessages.val, message]);
    }
  }

  static removeFooterMessage(message: FooterMessage) {
    if (this.footerMessages.val.has(message)) {
      this.footerMessages.val.delete(message);
      this.footerMessages.val = new Set([...this.footerMessages.val]);
    }
  }
}
