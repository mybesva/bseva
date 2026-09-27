import { Pressable, View } from "react-native";
import { AppText } from "@/components/ui";
import { useAppTheme } from "@/theme/ThemeContext";

export function AdminPagination({
  page,
  pages,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const { colors } = useAppTheme();
  const safePages = Math.max(pages, 1);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(page * pageSize, total);
  const canPrev = page > 1;
  const canNext = page < safePages;

  return (
    <View style={{ gap: 8, paddingVertical: 4 }}>
      <AppText variant="small" color={colors.mutedForeground} style={{ textAlign: "center" }}>
        Showing {start}–{end} of {total}
      </AppText>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable
          onPress={() => canPrev && onPage(page - 1)}
          disabled={!canPrev}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          style={{ opacity: canPrev ? 1 : 0.35, minWidth: 72, minHeight: 36, justifyContent: "center" }}
        >
          <AppText variant="small" color={colors.primary} style={{ fontWeight: "600" }}>
            ‹ Previous
          </AppText>
        </Pressable>
        <AppText variant="small" color={colors.mutedForeground}>
          {page} / {safePages}
        </AppText>
        <Pressable
          onPress={() => canNext && onPage(page + 1)}
          disabled={!canNext}
          accessibilityRole="button"
          accessibilityLabel="Next page"
          style={{ opacity: canNext ? 1 : 0.35, minWidth: 72, minHeight: 36, justifyContent: "center", alignItems: "flex-end" }}
        >
          <AppText variant="small" color={colors.primary} style={{ fontWeight: "600" }}>
            Next ›
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
