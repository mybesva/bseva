import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import ServiceCard from "@/components/ServiceCard";
import TestimonialCard from "@/components/TestimonialCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar, Flame, Flower, Heart, Home as HomeIcon, Search, Sparkles, UserCheck, Users, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { api, dashboardPath } from "@/lib/api";
import { useEffect, useState } from "react";
import { serviceImageUrl } from "@/lib/serviceImage";

const ICONS = [Flower, Flame, HomeIcon, Sparkles, Heart, Calendar, Users, UserCheck, Search, StarIcon];

function StarIcon(props: { size?: number }) {
  return <Sparkles {...props} />;
}

export default function Home() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [popular, setPopular] = useState<any[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [heroQ, setHeroQ] = useState("");
  const [heroCity, setHeroCity] = useState("");

  useEffect(() => {
    api<any[]>("/services?featured=1")
      .then((rows) => setPopular((rows || []).slice(0, 10)))
      .catch(() => setPopular([]))
      .finally(() => setLoadingPopular(false));
  }, []);

  function goSearch() {
    const q = heroQ.trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (heroCity) params.set("city", heroCity);
    const s = params.toString();
    setLocation(s ? `/services?${s}` : "/services");
  }

  return (
    <Layout>
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/images/hero-bg.png" alt="Temple Atmosphere" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-sidebar/60 via-sidebar/40 to-background" />
        </div>

        <div className="container relative z-10 pt-20 pb-12 text-center">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-eyebrow mb-6">
              {t("home.badge")}
            </span>
            <h1 className="text-display text-primary mb-6 drop-shadow-lg">
              {t("home.heroTitle1")} <br />
              <span className="text-gradient-gold">{t("home.heroTitle2")}</span>
            </h1>
            <p className="text-body-lg text-white/90 max-w-2xl mx-auto mb-10">
              {t("home.heroDesc")}
            </p>

            <div className="max-w-2xl mx-auto bg-card rounded-xl shadow-2xl p-2 md:p-3 flex flex-col md:flex-row gap-2 items-center">
              <div className="w-full md:w-44">
                <select
                  className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={heroCity}
                  onChange={(e) => setHeroCity(e.target.value)}
                  aria-label={t("home.selectLocation")}
                >
                  <option value="">All cities</option>
                  <option value="Bangalore">Bangalore</option>
                  <option value="Hyderabad">Hyderabad</option>
                  <option value="Mumbai">Mumbai</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Chennai">Chennai</option>
                </select>
              </div>
              <div className="flex-1 w-full relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  value={heroQ}
                  onChange={(e) => setHeroQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && goSearch()}
                  placeholder="Search Pujas, Homams, Vrathams..."
                  className="h-12 pl-10 border-none bg-secondary/30 focus-visible:ring-0"
                />
              </div>
              <Button className="h-12 px-8 w-full md:w-auto bg-primary text-white font-bold" onClick={goSearch}>
                Search
              </Button>
            </div>
          </div>
        </div>
      </section>

      {!user && (
      <section className="py-16 bg-secondary/10">
        <div className="container">
          <SectionHeader
            subtitle="Get started"
            title="Choose your BSeva portal"
            description="Customers book pujas and Pujaris manage services through their portals."
          />
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              { role: "customer", title: "Customer", desc: "Book pujas, manage wallet, and track bookings.", icon: Users, href: "/customer" },
              { role: "pujari", title: "Pujari", desc: "Complete your profile, upload documents, and receive bookings.", icon: UserCheck, href: "/pujari" },
            ].map((card) => (
              <Card key={card.role} className="border-border shadow-sm hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                    <card.icon size={24} />
                  </div>
                  <CardTitle className="">{card.title}</CardTitle>
                  <CardDescription>{card.desc}</CardDescription>
                </CardHeader>
                <CardContent>
                  {user?.role === card.role ? (
                    <Link href={dashboardPath(card.role)}><Button className="w-full">Go to dashboard</Button></Link>
                  ) : user ? (
                    <Button className="w-full" variant="outline" disabled>Signed in as {user.role}</Button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Link href={card.href}><Button className="w-full">Sign in</Button></Link>
                      <Link href={`/register?role=${card.role}`}><Button variant="outline" className="w-full">Register</Button></Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      )}

      <section className="py-20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
        </div>

        <div className="container relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-card/50 border border-border/60 shadow-sm hover:shadow-md transition-all">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
                <UserCheck size={32} />
              </div>
              <h3 className="text-h3 text-foreground mb-3">{t("home.feat1Title")}</h3>
              <p className="text-muted-foreground">{t("home.feat1Desc")}</p>
            </div>

            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-card/50 border border-border/60 shadow-sm hover:shadow-md transition-all">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
                <Sparkles size={32} />
              </div>
              <h3 className="text-h3 text-foreground mb-3">{t("home.feat2Title")}</h3>
              <p className="text-muted-foreground">{t("home.feat2Desc")}</p>
            </div>

            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-card/50 border border-border/60 shadow-sm hover:shadow-md transition-all">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
                <Calendar size={32} />
              </div>
              <h3 className="text-h3 text-foreground mb-3">{t("home.feat3Title")}</h3>
              <p className="text-muted-foreground">{t("home.feat3Desc")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-secondary/20">
        <div className="container">
          <SectionHeader
            subtitle={t("home.offerings")}
            title="Popular Pujas"
            description={t("home.servicesDesc")}
          />

          {loadingPopular ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {popular.map((s, i) => {
                const Icon = ICONS[i % ICONS.length];
                const img = serviceImageUrl(s);
                const desc =
                  s.short_description ||
                  s.description ||
                  (s.bookable && s.standard_price_paise != null
                    ? `From ₹${(s.standard_price_paise / 100).toLocaleString("en-IN")}`
                    : "Available soon");
                return (
                  <div
                    key={s.id}
                    onClick={() => setLocation(`/services/${s.slug}`)}
                    className="cursor-pointer"
                  >
                    <ServiceCard
                      title={s.name}
                      description={desc}
                      image={img}
                      icon={<Icon size={24} />}
                      comingSoon={!s.bookable}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center mt-12">
            <Button
              variant="outline"
              size="lg"
              className="border-primary text-primary hover:bg-primary hover:text-white font-bold px-8"
              onClick={() => setLocation("/services")}
            >
              View More Pujas
            </Button>
          </div>
        </div>
      </section>

      <section className="py-24 relative overflow-hidden">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-24 h-24 border-t-4 border-l-4 border-primary rounded-tl-3xl" />
              <div className="absolute -bottom-4 -right-4 w-24 h-24 border-b-4 border-r-4 border-primary rounded-br-3xl" />
              <img src="/images/temple-ritual.png" alt="Priest performing aarti" className="rounded-2xl shadow-2xl w-full object-cover aspect-[4/3]" />
              <div className="absolute -bottom-8 -left-8 bg-card p-6 rounded-xl shadow-xl max-w-xs hidden md:block">
                <div className="flex items-center gap-4 mb-2">
                  <div className="text-price text-primary">500+</div>
                  <div className="text-sm text-muted-foreground font-bold uppercase tracking-wider">{t("home.verifiedCount")}</div>
                </div>
                <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-primary" />
                </div>
              </div>
            </div>

            <div>
              <span className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-2 block">{t("home.missionLabel")}</span>
              <h2 className="text-h2 text-3xl md:text-4xl text-primary mb-6">{t("home.missionTitle")}</h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">{t("home.missionP1")}</p>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{t("home.missionP2")}</p>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-primary">
                    <Heart size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">{t("home.devotional")}</h4>
                    <p className="text-sm text-muted-foreground">{t("home.devotionalSub")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-primary">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">{t("home.vedic")}</h4>
                    <p className="text-sm text-muted-foreground">{t("home.vedicSub")}</p>
                  </div>
                </div>
              </div>

              <Button className="bg-sidebar text-white hover:bg-sidebar/90 px-8 h-12" onClick={() => (window.location.href ="/about")}>
                {t("home.learnMore")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-sidebar text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
        </div>

        <div className="container relative z-10">
          <SectionHeader
            subtitle={t("home.testimonialsSub")}
            title={t("home.testimonialsTitle")}
            description={t("home.testimonialsDesc")}
            light={true}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TestimonialCard
              name="Rajesh Kumar"
              location="Bangalore"
              text="The Griha Pravesh puja was conducted beautifully. The priest was very knowledgeable and explained the significance of each ritual. Highly recommended!"
              rating={5}
            />
            <TestimonialCard
              name="Priya Sharma"
              location="Mumbai"
              text="I booked a Satyanarayan Puja through B-Seva. The entire process from booking to the actual puja was seamless. The samagri provided was of high quality."
              rating={5}
            />
            <TestimonialCard
              name="Anand Patel"
              location="Ahmedabad"
              text="Living abroad, I wanted to perform a Shanti puja for my parents in India. B-Seva made it possible with their excellent coordination and live streaming service."
              rating={5}
            />
          </div>
        </div>
      </section>

      <section className="py-24 relative">
        <div className="container">
          <div className="bg-gradient-to-r from-primary to-accent rounded-3xl p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none mix-blend-overlay">
              <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
            </div>

            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-h2 text-3xl md:text-4xl text-foreground mb-6">{t("home.ctaTitle")}</h2>
              <p className="text-xl text-foreground/80 mb-10 font-medium">{t("home.ctaDesc")}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-sidebar text-white hover:bg-sidebar/90 h-14 px-10 text-lg shadow-lg"
                  onClick={() => (window.location.href = "/services")}
                >
                  {t("home.bookNow")}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-2 border-sidebar text-foreground hover:bg-sidebar/10 h-14 px-10 text-lg font-bold"
                  onClick={() => (window.location.href = "/contact")}
                >
                  {t("home.contactSupport")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
