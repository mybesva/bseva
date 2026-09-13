import { useEffect, useState } from "react";
import { useParams } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiBase } from "@/lib/api";
import { Loader2, Video } from "lucide-react";

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
  const params = useParams();
  const token = String(params.token || "");
  const [data, setData] = useState<InvitePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("Invalid invite link");
      setLoading(false);
      return;
    }
    const base = apiBase();
    fetch(`${base}/api/v1/meetings/invite/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof body?.detail === "string" ? body.detail : "Invite not found");
        }
        setData(body as InvitePayload);
      })
      .catch((e: Error) => setError(e.message || "Could not load invite"))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <Layout>
      <div className="container max-w-lg py-12">
        <Card className="border-2 border-primary/30 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Video className="text-primary" size={22} />
              Virtual Puja Meeting
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
                  {data?.service_name ? <p className="text-base font-medium text-foreground">{data.service_name}</p> : null}
                  {data?.booking_number ? <p>Booking #{data.booking_number}</p> : null}
                  <p>
                    {data?.booking_date || "—"} · {data?.start_time || "—"}
                  </p>
                </div>
                {data?.ready && data.meeting_url ? (
                  <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">Your Google Meet is ready</p>
                    <Button asChild className="w-full" size="lg">
                      <a href={data.meeting_url} target="_blank" rel="noopener noreferrer">
                        Join Google Meet
                      </a>
                    </Button>
                    <p className="text-xs text-muted-foreground break-all">{data.meeting_url}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {data?.message || "Meeting link will appear here when ready."}
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
