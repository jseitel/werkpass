import Script from "next/script";

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

  return (
    <Script id="theme-initializer" strategy="beforeInteractive">
      {script}
    </Script>
  );
}
