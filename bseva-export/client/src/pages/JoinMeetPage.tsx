import { useEffect, useState } from "react";
import { useParams } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiBase } from "@/lib/api";
import { formatDisplaySlot } from "@/lib/formatDate";
import { Loader2, Video } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { PujaTitle } from "@/components/PujaTitle";

type InvitePayload = {
  booking_number?: string;
  service_name?: string;
  booking_date?: string;
  start_time?: string;
  meeting_url?: string | null;
  public_invite_url?: string;
  ready?: boolean;
  message?: string | null;
};

export default function JoinMeetPage() {
  const { t } = useI18n();
  const params = useParams();
  const token = String(params.token || "");
  const [data, setData] = useState<InvitePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError(t("web.meeting.invalidInvite"));
      setLoading(false);
      return;
    }
    const base = apiBase();
    fetch(`${base}/api/v1/meetings/invite/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof body?.detail === "string" ? body.detail : t("web.meeting.inviteNotFound"));
        }
        setData(body as InvitePayload);
      })
      .catch((e: Error) => setError(e.message || t("web.meeting.loadFailed")))
      .finally(() => setLoading(false));
  }, [token, t]);

  return (
    <Layout>
      <div className="container max-w-lg py-12">
        <Card className="border-2 border-primary/30 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Video className="text-primary" size={22} />
              {t("booking.meetingLink")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <>
                <div className="text-sm space-y-1 text-muted-foreground">
                  {data?.service_name ? (
                    <p className="text-base">
                      <PujaTitle name={data.service_name} />
                    </p>
                  ) : null}
                  {data?.booking_number ? <p>{t("web.booking.numberValue", { number: data.booking_number })}</p> : null}
                  <p>
                    {formatDisplaySlot(data?.booking_date, data?.start_time)}
                  </p>
                </div>
                {data?.ready && data.meeting_url ? (
                  <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">{t("web.meeting.ready")}</p>
                    <Button asChild className="w-full" size="lg">
                      <a href={data.meeting_url} target="_blank" rel="noopener noreferrer">
                        {t("web.meeting.join")}
                      </a>
                    </Button>
                    <p className="text-xs text-muted-foreground break-all">{data.meeting_url}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {data?.message || t("web.meeting.pending")}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
