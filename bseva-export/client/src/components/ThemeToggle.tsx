import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/** Light / Dark mode toggle — uses ThemeContext (class on <html>). */
export default function ThemeToggle({
  className,
  variant = "ghost",
  size = "icon",
}: {
  className?: string;
  variant?: "ghost" | "outline" | "secondary";
  size?: "icon" | "sm" | "default";
}) {
  const { theme, toggleTheme, switchable } = useTheme();
  const { t } = useI18n();
  if (!switchable || !toggleTheme) return null;

  const isDark = theme === "dark";
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={toggleTheme}
      className={cn(
        "dark:text-primary dark:hover:bg-primary/20 dark:hover:text-primary",
        className
      )}
      aria-label={isDark ? t("theme.toLight") : t("theme.toDark")}
      title={isDark ? t("theme.toLight") : t("theme.toDark")}
    >
      {isDark ? <Sun size={18} className="text-primary" /> : <Moon size={18} />}
      {size !== "icon" && <span className="ml-1.5">{isDark ? "Light" : "Dark"}</span>}
    </Button>
  );
}
