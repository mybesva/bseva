import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { api, rupees } from "@/lib/api";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import PreparationChecklist, { type PreparationView } from "@/components/PreparationChecklist";
import { serviceImageUrl } from "@/lib/serviceImage";

type Svc = {
  id: string;
  name: string;
  slug: string;
  canonical_slug?: string;
  requested_slug?: string;
  local_name?: string;
  short_description?: string;
  full_description?: string;
  description?: string;
  benefits?: string;
  duration_minutes?: number;
  pujaris_required?: number;
  requires_muhurta?: boolean;
  samagri_available?: boolean;
  alankaram_available?: boolean;
  food_available?: boolean;
  standard_price_paise?: number | null;
  main_puja_price_paise?: number | null;
  samagri_price_paise?: number | null;
  alankaram_price_paise?: number | null;
  food_price_paise?: number | null;
  bookable?: boolean;
  image_url?: string | null;
  image_path?: string | null;
  categories?: { name: string; slug: string }[];
};

export default function ServiceDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || "";
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [svc, setSvc] = useState<Svc | null>(null);
  const [loading, setLoading] = useState(true);
  const [prep, setPrep] = useState<PreparationView | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setPrep(null);
    api<Svc>(`/services/${slug}`)
      .then((data) => {
        if (data.canonical_slug && data.canonical_slug !== slug) {
          window.history.replaceState(null, "", `/services/${data.canonical_slug}`);
          setLocation(`/services/${data.canonical_slug}`);
        }
        setSvc(data);
        if (data.id) {
          api<PreparationView>(`/services/${data.id}/preparation?lang=en`)
            .then(setPrep)
            .catch(() => setPrep(null));
        }
      })
      .catch((e) => {
        toast.error(e.message || "Service not found");
        setSvc(null);
      })
      .finally(() => setLoading(false));
  }, [slug, setLocation]);

  function book() {
    if (!svc?.bookable) return;
    const path = `/book/${svc.canonical_slug || svc.slug}`;
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== "customer") {
      setLocation(getLoginUrl({ role: "customer", returnPath: path }));
      return;
    }
    setLocation(path);
  }

  const img = serviceImageUrl(svc);

  return (
    <Layout>
      <section className="py-12 md:py-16">
        <div className="container max-w-4xl">
          {loading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : !svc ? (
            <div className="text-center py-20 space-y-4">
              <p className="text-muted-foreground">Puja not found.</p>
              <Link href="/services">
                <Button variant="outline">Browse all pujas</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="rounded-2xl overflow-hidden shadow-lg">
                <img src={img} alt={svc.name} className="w-full h-56 md:h-72 object-cover" />
              </div>
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(svc.categories || []).map((c) => (
                    <Badge key={c.slug} variant="secondary">
                      {c.name}
                    </Badge>
                  ))}
                  {!svc.bookable && (
                    <Badge className="bg-amber-500 text-white font-extrabold uppercase tracking-wider border-0 text-sm px-3 py-1">
                      Coming Soon
                    </Badge>
                  )}
                </div>
                {!svc.bookable && (
                  <p className="mb-3 text-sm font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                    This puja is not open for booking yet. Top available pujas can be booked from Services; Admin will mark this Available when ready.
                  </p>
                )}
                <h1 className="text-h1 text-foreground mb-2">{svc.name}</h1>
                {svc.local_name && <p className="text-muted-foreground mb-4">{svc.local_name}</p>}
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {svc.short_description || svc.description || "Authentic Vedic ritual through BSeva."}
                </p>
              </div>

              {(svc.full_description || svc.benefits) && (
                <div className="space-y-4 bg-secondary/20 rounded-xl p-6">
                  {svc.full_description && (
                    <div>
                      <h2 className="font-bold text-xl mb-2">About this puja</h2>
                      <p className="text-muted-foreground whitespace-pre-line">{svc.full_description}</p>
                    </div>
                  )}
                  {svc.benefits && (
                    <div>
                      <h2 className="font-bold text-xl mb-2">Benefits / purpose</h2>
                      <p className="text-muted-foreground whitespace-pre-line">{svc.benefits}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <Meta label="Duration" value={svc.duration_minutes ? `${svc.duration_minutes} min` : "—"} />
                <Meta label="Pujaris" value={String(svc.pujaris_required || 1)} />
                <Meta label="Muhurta" value={svc.requires_muhurta ? "Required" : "Optional"} />
                <Meta
                  label="Main price"
                  value={
                    svc.bookable && svc.standard_price_paise != null
                      ? rupees(svc.standard_price_paise)
                      : "Set by Admin"
                  }
                />
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                {svc.samagri_available && <span>Samagri available</span>}
                {svc.alankaram_available && <span>· Alankaram available</span>}
                {svc.food_available && <span>· Food / Prasadam available</span>}
              </div>

              {prep?.verified && (
                <div className="rounded-lg border bg-card">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-4 py-3 text-left font-semibold"
                    onClick={() => setPrepOpen((o) => !o)}
                  >
                    <span>Typical Samagri checklist</span>
                    {prepOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {prepOpen && (
                    <div className="px-4 pb-4">
                      <PreparationChecklist
                        preparation={prep}
                        title=""
                        interactive={false}
                        compact
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Exact list after booking depends on your package and preferred language.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="bg-primary text-white font-bold"
                  disabled={!svc.bookable}
                  onClick={book}
                >
                  {svc.bookable ? "Book this puja" : "Coming Soon"}
                </Button>
                <Link href="/services">
                  <Button size="lg" variant="outline">
                    View more pujas
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <div className="font-semibold text-foreground">{value}</div>
    </div>
  );
}
