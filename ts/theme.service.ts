
// Helper function to apply theme
export function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  const html = document.documentElement;
  
  // Remove any explicit theme class first
  html.classList.remove('theme-light', 'theme-dark');
  
  if (theme === 'system') {
    // Let the browser handle system preferences automatically
    // This will work with the light-dark() CSS function
    html.style.colorScheme = 'light dark';
    
    // Remove data-theme attribute to let system preferences take over
    if (html.hasAttribute('data-theme')) {
      html.removeAttribute('data-theme');
    }
  } else {
    // Set explicit theme
    html.style.colorScheme = theme;
    // Add theme class for any legacy styling
    html.classList.add(`theme-${theme}`);
    html.dataset.theme = theme;
  }
}
