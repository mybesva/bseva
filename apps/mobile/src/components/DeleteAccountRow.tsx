import { useRouter } from "expo-router";
import { MoreMenuRow } from "@/components/MoreMenuRow";
import { Card } from "@/components/ui";
import { text } from "@/content/compliance";

/** Profile → Delete Account (moved here from the More menu). Opens the existing deletion flow. */
export function DeleteAccountRow() {
  const router = useRouter();
  return (
    <Card>
      <MoreMenuRow icon="trash-outline" label={text.deleteAccount} destructive chevron onPress={() => router.push("/account/delete" as never)} />
    </Card>
  );
}
