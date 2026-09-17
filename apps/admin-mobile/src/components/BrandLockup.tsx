import { Image, Text, View } from "react-native";

const mark = require("../../assets/logo-mark.png");

export function BrandLockup({
  markSize = 44,
  light = false,
  afterWordmark,
}: {
  markSize?: number;
  light?: boolean;
  afterWordmark?: string;
}) {
  const hyphenColor = light ? "#FFF8E7" : "#1A2B4A";
  const mottoColor = light ? "rgba(255,248,231,0.85)" : "#1A2B4A";
  const wordSize = Math.round(markSize * 0.48);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
      <View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Image source={mark} resizeMode="contain" style={{ width: markSize, height: markSize }} />
          <Text style={{ color: hyphenColor, fontSize: wordSize, fontWeight: "800", lineHeight: markSize }}>
            -
            <Text style={{ color: "#FF9933", fontSize: wordSize, fontWeight: "800" }}>Seva</Text>
          </Text>
        </View>
        <Text
          style={{
            color: mottoColor,
            fontSize: Math.max(9, Math.round(markSize * 0.2)),
            fontStyle: "italic",
            marginTop: 2,
          }}
        >
          Book, Believe, Bless
        </Text>
      </View>
      {afterWordmark ? (
        <Text
          style={{
            color: light ? "rgba(255,248,231,0.9)" : "#1A2B4A",
            fontSize: Math.max(13, Math.round(markSize * 0.32)),
            fontWeight: "600",
            marginTop: Math.round(markSize * 0.22),
          }}
        >
          {afterWordmark}
        </Text>
      ) : null}
    </View>
  );
}
