import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useI18n } from "@/i18n/I18nProvider";
import { api, rupees } from "@/lib/api";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { sevaErrorMessage } from "@/lib/sevaErrors";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { FamilyMember, SevaEvent, ServicePackage } from "@bseva/types";
import { PujaTitle } from "@/components/PujaTitle";

function participationOptions(event: SevaEvent): Array<"offline" | "online"> {
  const mode = event.participation_mode || "offline";
  if (mode === "hybrid") return ["offline", "online"];
  if (mode === "online") return ["online"];
  return ["offline"];
}

export default function SevaEventDetail() {
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const eventId = params.id || "";
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [event, setEvent] = useState<SevaEvent | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  const [participationMode, setParticipationMode] = useState<"offline" | "online">("offline");
  const [packageId, setPackageId] = useState<string>("");
  const [primaryName, setPrimaryName] = useState("");
  const [gotra, setGotra] = useState("");
  const [gotraUnknown, setGotraUnknown] = useState(false);
  const [sankalpText, setSankalpText] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const packages = useMemo(() => (event?.packages || []) as ServicePackage[], [event]);
  const modes = useMemo(() => (event ? participationOptions(event) : ["offline"]), [event]);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    api<SevaEvent>(`/seva/events/${encodeURIComponent(eventId)}`)
      .then((ev) => {
        setEvent(ev);
        const opts = participationOptions(ev);
        setParticipationMode(opts[0]);
        const pkgs = (ev.packages || []) as ServicePackage[];
        if (pkgs.length === 1) setPackageId(pkgs[0].id);
      })
      .catch((e: Error) => {
        toast.error(e.message || t("errors.generic"));
        setEvent(null);
      })
      .finally(() => setLoading(false));
  }, [eventId, t]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "customer") return;
    setPrimaryName((prev) => prev || user.name || "");
    api<FamilyMember[]>("/customer/family-members")
      .then((rows) => setFamilyMembers(Array.isArray(rows) ? rows : []))
      .catch(() => setFamilyMembers([]));
  }, [isAuthenticated, user]);

  function toggleMember(id: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function submitRegistration(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    if (!isAuthenticated) {
      setLocation(getLoginUrl({ returnPath: `/seva/events/${eventId}` }));
      return;
    }
    if (packages.length > 0 && !packageId) {
      toast.error(t("seva.selectPackage"));
      return;
    }
    if (!primaryName.trim()) {
      toast.error(t("auth.name"));
      return;
    }

    const selectedMembers = familyMembers
      .filter((m) => m.id && selectedMemberIds.includes(m.id))
      .map((m) => ({
        name: m.name,
        gotra: m.gotra_unknown ? null : m.gotra || null,
        gotra_unknown: Boolean(m.gotra_unknown),
        relationship: m.relationship || "other",
        date_of_birth: m.date_of_birth || null,
      }));

    setSubmitting(true);
    try {
      await api(`/seva/events/${encodeURIComponent(event.id)}/register`, {
        method: "POST",
        body: JSON.stringify({
          participation_mode: participationMode,
          package_id: packageId || null,
          primary_name: primaryName.trim(),
          gotra: gotraUnknown ? null : gotra.trim() || null,
          gotra_unknown: gotraUnknown,
          sankalp_text: sankalpText.trim() || null,
          family_members: selectedMembers.length ? selectedMembers : null,
          idempotency_key: crypto.randomUUID(),
        }),
      });
      setRegistered(true);
      toast.success(t("seva.registrationConfirmed"));
      setLocation("/customer/my-seva");
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      toast.error(sevaErrorMessage(t, e.code, e.message));
    } finally {
      setSubmitting(false);
    }
  }

  const canRegister =
    event &&
    event.registration_open !== false &&
    !event.sold_out &&
    event.status !== "cancelled" &&
    event.status !== "completed";

  return (
    <Layout>
      <div className="container max-w-3xl py-8 md:py-12 space-y-6">
        <Button type="button" variant="ghost" className="gap-2 px-0" onClick={() => window.history.back()}>
          <ArrowLeft size={16} />
          {t("common.back")}
        </Button>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : !event ? (
          <p className="text-muted-foreground text-center py-16">{t("errors.generic")}</p>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {event.service_type === "chadhava"
                    ? t("seva.chadhava")
                    : event.service_type === "pravachan"
                      ? t("seva.pravachan")
                      : t("seva.puja")}
                </Badge>
                <Badge variant="outline">
                  {event.participation_mode === "online"
                    ? t("seva.online")
                    : event.participation_mode === "hybrid"
                      ? t("seva.hybrid")
                      : t("seva.offline")}
                </Badge>
                <Badge className={event.is_free ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}>
                  {event.is_free ? t("seva.free") : t("seva.paid")}
                </Badge>
              </div>
              <h1 className="text-h2 text-foreground">
                <PujaTitle name={event.title || event.service_name || ""} />
              </h1>
              {event.service_name && event.title ? (
                <p className="text-muted-foreground">
                  <PujaTitle name={event.service_name} />
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">{formatDisplayDateTime(event.start_at)}</p>
              {[event.temple_name, event.temple_city].filter(Boolean).length ? (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin size={16} className="shrink-0 mt-0.5 text-primary" />
                  {[event.temple_name, event.temple_address, event.temple_city].filter(Boolean).join(", ")}
                </p>
              ) : null}
              {event.description ? (
                <p className="text-muted-foreground whitespace-pre-line leading-relaxed">{event.description}</p>
              ) : null}
              {!event.is_free && event.price_paise != null ? (
                <p className="font-semibold text-lg">{rupees(event.price_paise)}</p>
              ) : null}
              {event.sold_out ? (
                <p className="text-destructive font-medium">{t("seva.soldOut")}</p>
              ) : event.registration_open === false ? (
                <p className="font-medium">{t("seva.registrationClosed")}</p>
              ) : event.seats_remaining != null ? (
                <p className="text-sm text-muted-foreground">
                  {t("seva.seatsRemaining", { count: event.seats_remaining })}
                </p>
              ) : null}
            </div>

            {canRegister && !registered ? (
              <Card>
                <CardHeader>
                  <CardTitle>{t("seva.register")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {!authLoading && !isAuthenticated ? (
                    <div className="space-y-4">
                      <p className="text-muted-foreground">{t("auth.loginRequiredDesc")}</p>
                      <Button type="button" onClick={() => setLocation(getLoginUrl())}>
                        {t("auth.signIn")}
                      </Button>
                    </div>
                  ) : (
                    <form className="space-y-6" onSubmit={submitRegistration}>
                      {packages.length > 0 ? (
                        <div className="space-y-3">
                          <Label>{t("seva.selectPackage")}</Label>
                          <RadioGroup value={packageId} onValueChange={setPackageId}>
                            {packages.map((pkg) => (
                              <label
                                key={pkg.id}
                                className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:border-primary/40"
                              >
                                <RadioGroupItem value={pkg.id} className="mt-1" />
                                <div className="space-y-1 min-w-0">
                                  <p className="font-medium">{pkg.name}</p>
                                  <p className="text-sm text-muted-foreground">{rupees(pkg.price_paise)}</p>
                                  {pkg.inclusions ? (
                                    <p className="text-xs text-muted-foreground whitespace-pre-line">{pkg.inclusions}</p>
                                  ) : null}
                                </div>
                              </label>
                            ))}
                          </RadioGroup>
                        </div>
                      ) : null}

                      {modes.length > 1 ? (
                        <div className="space-y-3">
                          <Label>{t("seva.participationMode")}</Label>
                          <RadioGroup
                            value={participationMode}
                            onValueChange={(v) => setParticipationMode(v as "offline" | "online")}
                          >
                            {modes.map((mode) => (
                              <label key={mode} className="flex items-center gap-2 cursor-pointer">
                                <RadioGroupItem value={mode} />
                                <span>{mode === "online" ? t("seva.online") : t("seva.offline")}</span>
                              </label>
                            ))}
                          </RadioGroup>
                        </div>
                      ) : null}

                      <div className="space-y-4 rounded-lg border border-border p-4">
                        <p className="font-semibold">{t("seva.familySankalp")}</p>
                        <div className="space-y-2">
                          <Label htmlFor="primary-name">{t("auth.name")}</Label>
                          <Input
                            id="primary-name"
                            value={primaryName}
                            onChange={(e) => setPrimaryName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gotra">{t("seva.gotra")}</Label>
                          <Input
                            id="gotra"
                            value={gotra}
                            onChange={(e) => setGotra(e.target.value)}
                            disabled={gotraUnknown}
                          />
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                              checked={gotraUnknown}
                              onCheckedChange={(v) => setGotraUnknown(v === true)}
                            />
                            {t("seva.gotraUnknown")}
                          </label>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sankalp">{t("seva.sankalp")}</Label>
                          <Textarea
                            id="sankalp"
                            value={sankalpText}
                            onChange={(e) => setSankalpText(e.target.value)}
                            rows={3}
                          />
                        </div>
                        {familyMembers.length > 0 ? (
                          <div className="space-y-2">
                            <Label>{t("seva.familyMembers")}</Label>
                            <div className="space-y-2">
                              {familyMembers.map((member) => (
                                <label
                                  key={member.id}
                                  className="flex items-start gap-3 rounded-md border border-border/80 p-3 cursor-pointer"
                                >
                                  <Checkbox
                                    checked={member.id ? selectedMemberIds.includes(member.id) : false}
                                    onCheckedChange={() => member.id && toggleMember(member.id)}
                                  />
                                  <div className="min-w-0">
                                    <p className="font-medium">{member.name}</p>
                                    {member.gotra && !member.gotra_unknown ? (
                                      <p className="text-xs text-muted-foreground">
                                        {t("seva.gotra")}: {member.gotra}
                                      </p>
                                    ) : member.gotra_unknown ? (
                                      <p className="text-xs text-muted-foreground">{t("seva.gotraUnknown")}</p>
                                    ) : null}
                                  </div>
                                </label>
                              ))}
                            </div>
                            <Button type="button" variant="link" className="px-0 h-auto" asChild>
                              <Link href="/customer/family-sankalp">{t("seva.addMember")}</Link>
                            </Button>
                          </div>
                        ) : (
                          <Button type="button" variant="outline" size="sm" asChild>
                            <Link href="/customer/family-sankalp">{t("seva.addMember")}</Link>
                          </Button>
                        )}
                      </div>

                      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                        {submitting ? t("common.loading") : t("seva.register")}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </Layout>
  );
}
