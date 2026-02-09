export function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const html = document.documentElement;

  html.classList.remove('theme-light', 'theme-dark');

  if (theme === 'system') {
    html.style.colorScheme = 'light dark';
    if (html.hasAttribute('data-theme')) {
      html.removeAttribute('data-theme');
    }
  } else {
    html.style.colorScheme = theme;
    html.classList.add(`theme-${theme}`);
    html.dataset.theme = theme;
  }
}
