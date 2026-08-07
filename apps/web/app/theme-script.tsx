export function ThemeScript() {
  const script = `
    (function() {
      try {
        var stored = localStorage.getItem("theme");
        var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        var theme = stored || (prefersDark ? "dark" : "light");
        document.documentElement.classList.toggle("dark", theme === "dark");
      } catch (_) {}
    })();
  `;

  // This is intentionally a native inline script. `next/script` with
  // beforeInteractive is meant to be declared by the layout itself and is
  // rendered as a React child here by Next 16, which triggers a warning and
  // does not reliably execute during client rendering.
  return (
    <script
      id="theme-initializer"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
