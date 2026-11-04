import { MyReportsPanel } from "@/components/MyReportsPanel";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Screen } from "@/components/ui";
import { text } from "@/content/compliance";

export default function MyReportsScreen() {
  return (
    <Screen>
      <ScreenHeader title={text.myReports} back />
      <MyReportsPanel />
    </Screen>
  );
}
