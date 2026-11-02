import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import type { CaptchaAnswer, CaptchaChallenge } from "@bseva/api-client";
import { AppText, Field } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export type CaptchaHandle = {
  /** Fetch a new image and retire the current one (after every send: each image works once). */
  refresh: () => void;
  values: () => CaptchaAnswer;
};

/**
 * The same 5-character image CAPTCHA as the website. The image and an opaque id come from the server; the
 * answer never reaches the app. Not case-sensitive.
 */
export const CaptchaField = forwardRef<CaptchaHandle, { purpose: "register" | "login"; disabled?: boolean }>(
  function CaptchaField({ purpose, disabled }, ref) {
    const { colors } = useAppTheme();
    const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const current = useRef<string | null>(null);
    const answerRef = useRef("");
    answerRef.current = answer;

    const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await apiClient.newCaptcha(purpose, current.current || undefined);
        current.current = next.captcha_id;
        setChallenge(next);
        setAnswer("");
      } catch (e: unknown) {
        setError(e instanceof Error && e.message ? e.message : "The security image could not load. Please try again.");
      } finally {
        setLoading(false);
      }
    }, [purpose]);

    useEffect(() => {
      void load();
    }, [load]);

    useImperativeHandle(
      ref,
      () => ({
        refresh: () => void load(),
        values: () => ({
          captcha_id: current.current || undefined,
          captcha_answer: answerRef.current.trim() || undefined,
        }),
      }),
      [load]
    );

    return (
      <View style={{ gap: 8 }}>
        <AppText style={{ fontWeight: "600", fontSize: 13 }} color={colors.mutedForeground}>
          Security check
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <View
            style={{
              width: 200,
              height: 60,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: "#FFFFFF",
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {challenge ? (
              <Image
                source={{ uri: challenge.image }}
                style={{ width: 200, height: 60 }}
                accessibilityLabel="Security check image with 5 letters and numbers. If you cannot read it, tap New image."
              />
            ) : loading ? (
              <ActivityIndicator color={colors.mutedForeground} />
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show a new security image"
            disabled={loading || disabled}
            onPress={() => void load()}
            hitSlop={8}
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              justifyContent: "center",
              opacity: loading || disabled ? 0.6 : 1,
            }}
          >
            <AppText style={{ fontWeight: "600" }}>{loading ? "Loading…" : "New image"}</AppText>
          </Pressable>
        </View>
        <Field
          label="Type the 5 characters"
          value={answer}
          onChangeText={(v) => setAnswer(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
          editable={!disabled && Boolean(challenge)}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          maxLength={5}
          placeholder="5 characters"
        />
        <AppText variant="small" color={colors.mutedForeground}>
          Not case-sensitive. Can't read it? Tap New image.
        </AppText>
        {error ? (
          <AppText variant="small" color={colors.destructive}>
            {error}
          </AppText>
        ) : null}
      </View>
    );
  }
);
