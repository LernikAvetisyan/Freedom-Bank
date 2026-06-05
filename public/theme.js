// /public/theme.js
(function () {
  const THEME_KEY = "fb_theme";

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem(THEME_KEY, theme);

    const btn = document.getElementById("themeToggle");
    if (btn) {
      // SVG icons for sun and moon
      const sunIcon  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M10 3a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 3zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM4.136 4.136a.75.75 0 011.06 0l1.061 1.06a.75.75 0 01-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zM14.707 14.707a.75.75 0 011.06 0l1.061 1.06a.75.75 0 11-1.06 1.06l-1.06-1.06a.75.75 0 010-1.06zM15.864 4.136a.75.75 0 010 1.06l-1.06 1.06a.75.75 0 01-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zM5.197 14.707a.75.75 0 010 1.06l-1.06 1.06a.75.75 0 11-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zM3 10a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 013 10zM15 10a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0115 10zM10 7a3 3 0 100 6 3 3 0 000-6z"/></svg>`;
      const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path fill-rule="evenodd" d="M7.455 2.164A8.969 8.969 0 005.334 2c-2.134 0-4.11.838-5.58 2.298a.75.75 0 00.37 1.289 7.493 7.493 0 014.01-1.93 7.493 7.493 0 015.632 5.632 7.493 7.493 0 01-1.93 4.01.75.75 0 001.289.37A8.963 8.963 0 0018 10.666a8.969 8.969 0 00-.164-2.121.75.75 0 00-1.319-.663 7.462 7.462 0 01-2.658 2.658.75.75 0 00-.663-1.319A8.969 8.969 0 007.455 2.164z" clip-rule="evenodd"/></svg>`;
      btn.innerHTML = isDark ? sunIcon : moonIcon;
      // size & shape are handled by button classes in HTML
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));
  }

  // Expose toggle for the button
  window.toggleTheme = function () {
    const isDark = document.documentElement.classList.contains("dark");
    applyTheme(isDark ? "light" : "dark");
  };

  document.addEventListener("DOMContentLoaded", initTheme);
})();
