import {
  filterHeadRatingHistory,
  resolveHeadRatingPujariName,
  validateHeadRatingSubmission,
  type HeadRatingPujari,
  type HeadRatingRecord,
  type HeadRatingSort,
} from "@bseva/config";
import { ChevronDown, Loader2, Search, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminLayout from "@/components/AdminLayout";
import { PujariPortal } from "@/components/RolePortals";
import { PujariSearchSelect, SelectedPujariCard } from "@/components/PujariSearchSelect";
import { StarRatingInput } from "@/components/StarRatingInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatDisplayDateTime } from "@/lib/formatDate";
import { cn } from "@/lib/utils";

function RatingHistoryStars({ stars }: { stars: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-primary" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn("size-3.5", i < stars ? "fill-current" : "opacity-25")} strokeWidth={1.5} />
      ))}
    </span>
  );
}

function RatingsForm() {
  const [pujaris, setPujaris] = useState<HeadRatingPujari[]>([]);
  const [pujarisLoading, setPujarisLoading] = useState(true);
  const [pujariId, setPujariId] = useState("");
  const [manualId, setManualId] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [comments, setComments] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ pujari?: string; stars?: string; comments?: string }>({});
  const [rows, setRows] = useState<HeadRatingRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [starsFilter, setStarsFilter] = useState<number | "all">("all");
  const [historySort, setHistorySort] = useState<HeadRatingSort>("newest");

  const selectedPujari = pujaris.find((p) => p.id === pujariId);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      setRows(await api<HeadRatingRecord[]>("/head/ratings"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load rating history");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
    setPujarisLoading(true);
    api<HeadRatingPujari[]>("/head/pujaris")
      .then((items) =>
        setPujaris(
          items.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
          })),
        ),
      )
      .catch(() => toast.error("Could not load pujaris"))
      .finally(() => setPujarisLoading(false));
  }, []);

  const filteredHistory = useMemo(
    () => filterHeadRatingHistory(rows, { search: historySearch, starsFilter, sort: historySort }, pujaris),
    [rows, historySearch, starsFilter, historySort, pujaris],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateHeadRatingSubmission({ pujariId, manualId, stars, comments });
    if (!validation.ok) {
      setFieldErrors({ [validation.field || "comments"]: validation.message });
      if (validation.field !== "comments" && validation.field !== "pujari" && validation.field !== "stars") {
        toast.error(validation.message);
      }
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      await api("/head/ratings", {
        method: "POST",
        body: JSON.stringify({ pujari_id: validation.targetId, stars, comments: comments.trim() }),
      });
      toast.success("Rating saved");
      setComments("");
      setStars(5);
      setPujariId("");
      setManualId("");
      await loadHistory();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg text-[#1A2B4A]">Rate a Pujari</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="pujari-select">Select Pujari</Label>
              {selectedPujari ? (
                <SelectedPujariCard
                  pujari={selectedPujari}
                  onChange={() => {
                    setPujariId("");
                    setManualId("");
                  }}
                />
              ) : (
                <PujariSearchSelect
                  pujaris={pujaris}
                  value={pujariId}
                  onChange={(v) => {
                    setPujariId(v);
                    setManualId("");
                    setFieldErrors((prev) => ({ ...prev, pujari: undefined }));
                  }}
                  loading={pujarisLoading}
                />
              )}
              {fieldErrors.pujari ? <p className="text-sm text-destructive">{fieldErrors.pujari}</p> : null}
            </div>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40"
                >
                  Advanced / Enter identifier manually
                  <ChevronDown className={cn("size-4 transition-transform", advancedOpen && "rotate-180")} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-2">
                <Input
                  value={manualId}
                  onChange={(e) => {
                    setManualId(e.target.value);
                    setPujariId("");
                    setFieldErrors((prev) => ({ ...prev, pujari: undefined }));
                  }}
                  placeholder="UUID, email, or phone"
                />
                <p className="text-xs text-muted-foreground">
                  Use only when search selection is unavailable. Numeric display IDs are not supported.
                </p>
              </CollapsibleContent>
            </Collapsible>

            <div className="space-y-2">
              <Label htmlFor="rating-stars">Rating</Label>
              <StarRatingInput
                id="rating-stars"
                value={stars}
                onChange={(v) => {
                  setStars(v);
                  setFieldErrors((prev) => ({ ...prev, stars: undefined }));
                }}
                disabled={saving}
              />
              {fieldErrors.stars ? <p className="text-sm text-destructive">{fieldErrors.stars}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rating-comment">
                Comment <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rating-comment"
                value={comments}
                onChange={(e) => {
                  setComments(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, comments: undefined }));
                }}
                placeholder="Add a comment about this pujari..."
                rows={4}
                className="min-h-[100px] resize-y"
              />
              {fieldErrors.comments ? <p className="text-sm text-destructive">{fieldErrors.comments}</p> : null}
            </div>

            <Button type="submit" disabled={saving} className="h-11 w-full sm:w-auto">
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit Rating"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader className="space-y-4 pb-4">
          <CardTitle className="text-lg text-[#1A2B4A]">Rating History</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history..."
                className="h-10 pl-9"
              />
            </div>
            <Select
              value={starsFilter === "all" ? "all" : String(starsFilter)}
              onValueChange={(v) => setStarsFilter(v === "all" ? "all" : Number(v))}
            >
              <SelectTrigger className="h-10 w-full sm:w-[130px]">
                <SelectValue placeholder="Rating" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                {[5, 4, 3, 2, 1].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} stars
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={historySort} onValueChange={(v) => setHistorySort(v as HeadRatingSort)}>
              <SelectTrigger className="h-10 w-full sm:w-[150px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="max-h-[min(70vh,720px)] space-y-3 overflow-y-auto pr-1">
          {historyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-4">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : filteredHistory.length === 0 ? (
            <Empty className="border-none py-10">
              <EmptyTitle>{rows.length === 0 ? "No ratings yet." : "No matching ratings."}</EmptyTitle>
              <EmptyDescription>
                {rows.length === 0
                  ? "Ratings submitted by Admin will appear here."
                  : "Try adjusting your search or filters."}
              </EmptyDescription>
            </Empty>
          ) : (
            filteredHistory.map((r) => {
              const name = resolveHeadRatingPujariName(r.pujari_id, pujaris, r.pujari_name);
              const starCount = Number(r.stars || 0);
              return (
                <div key={String(r.id)} className="rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-[#1A2B4A]">{name}</p>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <RatingHistoryStars stars={starCount} />
                      <span>{starCount.toFixed(1)}</span>
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">&ldquo;{r.comments}&rdquo;</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDisplayDateTime(r.created_at)}</p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function HeadRatingsPage() {
  const { user } = useAuth();
  if (user?.role === "admin" || user?.role === "super_admin") {
    return (
      <AdminLayout>
        <h1 className="text-h1 mb-6">Pujari Ratings</h1>
        <RatingsForm />
      </AdminLayout>
    );
  }
  return (
    <PujariPortal>
      <h1 className="text-h1 mb-6">Rate Pujari</h1>
      <RatingsForm />
    </PujariPortal>
  );
}
