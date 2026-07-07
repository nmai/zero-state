import { updateSettings } from '../actions';
import { ICONS } from '../constants';
import { settings, settingsMode } from '../state';
import { a, div, h2, h3, input, label, p } from '../van';

function ThemeRadio(value: 'light' | 'dark' | 'system', text: string) {
  const id = `theme-${value}`;
  return label({ for: id },
    input({
      type: 'radio',
      id,
      name: 'theme',
      value,
      checked: () => settings.val.theme === value,
      onchange: () => void updateSettings({ theme: value }),
    }),
    text,
  );
}

export function SettingsModal() {
  return div({
    class: 'modal',
    onclick: (e: Event) => {
      // Close when clicking the backdrop outside the settings page
      if ((e.target as HTMLElement).classList.contains('modal')) {
        settingsMode.val = false;
      }
    },
  },
    div({ class: 'settings-page' },
      div({ class: 'settings-header' },
        h2({}, 'Settings'),
        a({
          href: '#',
          class: 'close-settings-btn',
          innerHTML: ICONS.CLOSE,
          onclick: (e: Event) => {
            e.preventDefault();
            settingsMode.val = false;
          },
        }),
      ),

      div({ class: 'settings-group' },
        h3({}, 'Task Completion'),
        div({ class: 'setting-item' },
          label({ for: 'right-click-toggle' },
            input({
              type: 'checkbox',
              id: 'right-click-toggle',
              checked: () => settings.val.enableRightClickComplete,
              onchange: (e: Event) =>
                void updateSettings({ enableRightClickComplete: (e.target as HTMLInputElement).checked }),
            }),
            'Right-click to Mark as Done',
          ),
          p({ class: 'setting-description' },
            'When enabled, right-clicking on an item will apply a strike-through style to the text.',
          ),
        ),
      ),

      div({ class: 'settings-group' },
        h3({}, 'Theme'),
        div({ class: 'setting-item' },
          div({ class: 'radio-group' },
            ThemeRadio('light', 'Light'),
            ThemeRadio('dark', 'Dark'),
            ThemeRadio('system', 'System (Default)'),
          ),
          p({ class: 'setting-description' },
            "Choose your preferred theme or use your system's setting.",
          ),
        ),
      ),

      div({ class: 'settings-group' },
        div({ class: 'setting-description' }, `Version ${chrome.runtime.getManifest().version}`),
      ),
    ),
  );
}
