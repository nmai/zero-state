import { DOM_CLASSES, ICONS } from './constants';
import { AppState } from './app.state';
import { StorageService } from './storage.service';
import { applyTheme } from './theme.service';
import { Settings } from './types';
import { a, div, h2, h3, input, label, p, select, option } from './van'

export class SettingsComponent {

  constructor(readonly state: AppState) {
    console.log("Instantiating settings component")
  }
  
  renderSettingsPage() {
    console.log("Rendering settings page");

    const updateSetting = (key: keyof Settings, value: any) => {
      const newSettings = { ...AppState.settings.val, [key]: value };
      AppState.settings.val = newSettings;
      
      // Apply theme immediately if it changes
      if (key === 'theme') {
        applyTheme(value);
      }
      
      // Save settings to storage
      StorageService.saveSettings(newSettings)
        .catch(error => {
          console.error('Failed to save settings:', error);
          alert('Failed to save settings. Please try again.');
        });
    };

    // Create the settings form
    return div({ class: DOM_CLASSES.SETTINGS_PAGE }, 
      div({ class: "settings-header" }, 
        h2({}, "Settings"),
        a({ 
          href: "#", 
          class: "close-settings-btn",
          onclick: (e: Event) => {
            e.preventDefault();
            AppState.settingsMode.val = false;
          },
          innerHTML: ICONS.CLOSE
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
              checked: AppState.settings.val.enableRightClickComplete,
              onchange: (e: Event) => {
                updateSetting('enableRightClickComplete', (e.target as HTMLInputElement).checked);
              }
            }),
            "Enable Right-click to Mark as Done"
          ),
          p({ class: "setting-description" }, 
            "When enabled, right-clicking on an item will toggle its completion status."
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
                checked: AppState.settings.val.theme === 'light',
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
                checked: AppState.settings.val.theme === 'dark',
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
                checked: AppState.settings.val.theme === 'system',
                onchange: () => updateSetting('theme', 'system')
              }),
              "System (Default)"
            )
          ),
          p({ class: "setting-description" }, 
            "Choose your preferred theme or use your system's setting."
          )
        )
      )
    );
  }

}