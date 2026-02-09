import { SVG_ICONS } from '../core/constants';
import { Settings } from '../core/types';
import { a, br, div, h2, h3, input, label, p, select, option } from '../core/van';
import { CommandService } from '../services/command.service';
import { DataState } from '../state/data.state';
import { UIState } from '../state/ui.state';

export class SettingsComponent {
  renderSettingsPage() {
    const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
      CommandService.updateSetting(key, value);
    };

    return div({
      class: `modal`,
      onclick: (e: Event) => {
        if ((e.target as HTMLElement).classList.contains('modal')) {
          UIState.settingsMode.val = false;
        }
      }
    },
      div({ class: "settings-page" },
        div({ class: "settings-header" },
          h2({}, "Settings"),
          a({
            href: "#",
            class: "close-settings-btn",
            onclick: (e: Event) => {
              e.preventDefault();
              UIState.settingsMode.val = false;
            },
            innerHTML: SVG_ICONS['close']
          })
        ),

        // Right-click Complete Setting
        div({ class: "settings-group" },
          h3({}, "Task Completion"),
          div({ class: "setting-item" },
            label({ for: "right-click-toggle" },
              input({
                type: "checkbox",
                id: "right-click-toggle",
                checked: DataState.settings.val.enableRightClickComplete,
                onchange: (e: Event) => {
                  updateSetting('enableRightClickComplete', (e.target as HTMLInputElement).checked);
                }
              }),
              "Right-click to Mark as Done"
            ),
            p({ class: "setting-description" },
              "When enabled, right-clicking on an item will apply a strike-through style to the text."
            )
          )
        ),

        // Theme Setting
        div({ class: "settings-group" },
          h3({}, "Theme"),
          div({ class: "setting-item" },
            div({ class: "radio-group" },
              label({ for: "theme-light" },
                input({
                  type: "radio",
                  id: "theme-light",
                  name: "theme",
                  value: "light",
                  checked: DataState.settings.val.theme === 'light',
                  onchange: () => updateSetting('theme', 'light')
                }),
                "Light"
              ),
              label({ for: "theme-dark" },
                input({
                  type: "radio",
                  id: "theme-dark",
                  name: "theme",
                  value: "dark",
                  checked: DataState.settings.val.theme === 'dark',
                  onchange: () => updateSetting('theme', 'dark')
                }),
                "Dark"
              ),
              label({ for: "theme-system" },
                input({
                  type: "radio",
                  id: "theme-system",
                  name: "theme",
                  value: "system",
                  checked: DataState.settings.val.theme === 'system',
                  onchange: () => updateSetting('theme', 'system')
                }),
                "System (Default)"
              )
            ),
            p({ class: "setting-description" },
              "Choose your preferred theme or use your system's setting."
            )
          )
        ),

        br({}),

        div({ class: "settings-group" },
          div({ class: "setting-description" }, () => {
            const manifest = chrome.runtime.getManifest();
            return `Version ${manifest.version}`;
          })
        )
      )
    );
  }
}
