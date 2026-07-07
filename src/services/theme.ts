export function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const html = document.documentElement;

  html.classList.remove('theme-light', 'theme-dark');

  if (theme === 'system') {
    // Defer to system preference — works with the light-dark() CSS function
    html.style.colorScheme = 'light dark';
    html.removeAttribute('data-theme');
  } else {
    html.style.colorScheme = theme;
    html.classList.add(`theme-${theme}`);
    html.dataset.theme = theme;
  }
}
