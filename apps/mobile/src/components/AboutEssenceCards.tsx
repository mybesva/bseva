import { Text, useWindowDimensions, View } from "react-native";
import { AppText } from "@/components/ui";
import { aboutText } from "@/lib/aboutText";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/theme/ThemeContext";
import { PUJA_OM, PUJA_SWASTIKA } from "@bseva/locales";
function DevotionalHeading({ title }: { title: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "nowrap" }}>
      <Text style={{ color: colors.primary, fontSize: 15, marginRight: 6 }} aria-hidden>
        {PUJA_OM}
      </Text>
      <Text
        style={{
          color: colors.foreground,
          fontSize: 15,
          fontWeight: "600",
          flexShrink: 0,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text style={{ color: colors.primary, fontSize: 15, marginLeft: 6 }} aria-hidden>
        {PUJA_SWASTIKA}
      </Text>
    </View>
  );
}

function BrandEssenceTagline() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const parts = [
    { accent: aboutText(t, "brandEssenceBook"), rest: aboutText(t, "brandEssenceWithEase") },
    { accent: aboutText(t, "brandEssenceBelieve"), rest: aboutText(t, "brandEssenceWithFaith") },
    { accent: aboutText(t, "brandEssenceBless"), rest: aboutText(t, "brandEssenceThroughSeva") },
  ];

  return (
    <Text style={{ fontSize: 14, lineHeight: 21, color: colors.foreground }}>
      {parts.map((part, index) => (
        <Text key={part.accent}>
          {index > 0 ? " " : ""}
          <Text style={{ color: colors.primary, fontWeight: "700" }}>{part.accent}</Text>
          {part.rest}
        </Text>
      ))}
    </Text>
  );
}

function EssenceStatementCard({
  title,
  align,
  children,
}: {
  title: string;
  align: "left" | "right";
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const cardWidth = isDesktop ? "88%" : "100%";
  const alignSelf = isDesktop ? (align === "right" ? "flex-end" : "flex-start") : "stretch";

  if (!isDesktop) {
    return (
      <View
        style={{
          width: "100%",
          alignSelf,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: `${colors.primary}26`,
          backgroundColor: colors.card,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <View
          style={{
            position: "relative",
            paddingVertical: 14,
            paddingHorizontal: 20,
            backgroundColor: `${colors.primary}12`,
            borderBottomWidth: 1,
            borderBottomColor: `${colors.primary}1A`,
          }}
        >
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              backgroundColor: colors.primary,
              opacity: 0.75,
            }}
          />
          <DevotionalHeading title={title} />
        </View>
        <View style={{ paddingVertical: 14, paddingHorizontal: 20, backgroundColor: colors.card }}>{children}</View>
      </View>
    );
  }

  return (
    <View
      style={{
        width: cardWidth,
        alignSelf,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: `${colors.primary}26`,
        backgroundColor: colors.card,
        overflow: "hidden",
        flexDirection: "row",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View
        style={{
          position: "relative",
          width: 260,
          paddingVertical: 17,
          paddingHorizontal: 20,
          backgroundColor: `${colors.primary}12`,
          borderRightWidth: 1,
          borderRightColor: `${colors.primary}1A`,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: colors.primary,
            opacity: 0.75,
          }}
        />
        <DevotionalHeading title={title} />
      </View>
      <View
        style={{
          flex: 1,
          paddingVertical: 17,
          paddingHorizontal: 24,
          justifyContent: "center",
          backgroundColor: colors.card,
          minWidth: 0,
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function AboutEssenceCards() {
  const { t } = useI18n();
  const { colors } = useAppTheme();

  return (
    <View style={{ gap: 16, paddingTop: 40, paddingBottom: 48 }}>
      <EssenceStatementCard title={aboutText(t, "visionTitle")} align="left">
        <AppText color={colors.mutedForeground} style={{ fontSize: 14, lineHeight: 21 }}>
          {aboutText(t, "visionStatement")}
        </AppText>
      </EssenceStatementCard>

      <EssenceStatementCard title={aboutText(t, "missionTitle")} align="right">
        <AppText color={colors.mutedForeground} style={{ fontSize: 14, lineHeight: 21 }}>
          {aboutText(t, "missionStatement")}
        </AppText>
      </EssenceStatementCard>

      <EssenceStatementCard title={aboutText(t, "brandEssenceTitle")} align="left">
        <BrandEssenceTagline />
      </EssenceStatementCard>
    </View>
  );
}
