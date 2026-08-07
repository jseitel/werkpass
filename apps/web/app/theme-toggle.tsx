"use client";

import { useEffect, useState } from "react";
import { Button } from "@werkpass/ui";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
    setTheme(next);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={toggleTheme}>
      {theme === "dark" ? "Light" : "Dark"}
    </Button>
  );
}
