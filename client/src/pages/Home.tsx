import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import ServiceCard from "@/components/ServiceCard";
import TestimonialCard from "@/components/TestimonialCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Flame, Flower, Heart, Home as HomeIcon, Search, Sparkles, UserCheck } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

export default function Home() {
  let { user, loading, error, isAuthenticated, logout } = useAuth();
  const { t } = useI18n();

  return (
    <Layout>
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/images/hero-bg.png" alt="Temple Atmosphere" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-sidebar/60 via-sidebar/40 to-background" />
        </div>

        <div className="container relative z-10 pt-20 pb-12 text-center">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-bold tracking-[0.2em] uppercase mb-6">
              {t("home.badge")}
            </span>
            <h1 className="font-heading font-bold text-4xl md:text-6xl lg:text-7xl text-white mb-6 leading-tight drop-shadow-lg">
              {t("home.heroTitle1")} <br />
              <span className="text-gradient-gold">{t("home.heroTitle2")}</span>
            </h1>
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
              {t("home.heroDesc")}
            </p>

            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl p-2 md:p-4 flex flex-col md:flex-row gap-3 items-center">
              <div className="flex-1 w-full">
                <Select>
                  <SelectTrigger className="h-12 border-none bg-secondary/30 focus:ring-0 text-base">
                    <SelectValue placeholder={t("home.selectPuja")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="satyanarayan">
                      <a href="/services/satyanarayan-puja" className="block w-full h-full">{t("svc.satyanarayan.title")}</a>
                    </SelectItem>
                    <SelectItem value="ganesh">{t("svc.ganapati.title")}</SelectItem>
                    <SelectItem value="grihapravesh">
                      <a href="/services/griha-pravesh-puja" className="block w-full h-full">{t("svc.grihapravesh.title")}</a>
                    </SelectItem>
                    <SelectItem value="marriage">{t("svc.marriage.title")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-px h-8 bg-border hidden md:block" />
              <div className="flex-1 w-full">
                <Select>
                  <SelectTrigger className="h-12 border-none bg-secondary/30 focus:ring-0 text-base">
                    <SelectValue placeholder={t("home.selectLocation")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bangalore">Bangalore</SelectItem>
                    <SelectItem value="mumbai">Mumbai</SelectItem>
                    <SelectItem value="delhi">Delhi</SelectItem>
                    <SelectItem value="chennai">Chennai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-px h-8 bg-border hidden md:block" />
              <div className="flex-1 w-full">
                <Input type="date" className="h-12 border-none bg-secondary/30 focus-visible:ring-0 text-base" />
              </div>
              <Button
                size="lg"
                className="w-full md:w-auto h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base shadow-lg"
                onClick={() => (window.location.href = "/pujaris")}
              >
                <Search className="mr-2 h-5 w-5" /> {t("home.findPujari")}
              </Button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-background" style={{ clipPath: "ellipse(60% 100% at 50% 100%)" }} />
      </section>

      <section className="py-20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
        </div>

        <div className="container relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/50 border border-white/60 shadow-sm hover:shadow-md transition-all">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
                <UserCheck size={32} />
              </div>
              <h3 className="font-heading font-bold text-xl text-sidebar mb-3">{t("home.feat1Title")}</h3>
              <p className="text-muted-foreground">{t("home.feat1Desc")}</p>
            </div>

            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/50 border border-white/60 shadow-sm hover:shadow-md transition-all">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
                <Sparkles size={32} />
              </div>
              <h3 className="font-heading font-bold text-xl text-sidebar mb-3">{t("home.feat2Title")}</h3>
              <p className="text-muted-foreground">{t("home.feat2Desc")}</p>
            </div>

            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/50 border border-white/60 shadow-sm hover:shadow-md transition-all">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
                <Calendar size={32} />
              </div>
              <h3 className="font-heading font-bold text-xl text-sidebar mb-3">{t("home.feat3Title")}</h3>
              <p className="text-muted-foreground">{t("home.feat3Desc")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-secondary/20">
        <div className="container">
          <SectionHeader
            subtitle={t("home.offerings")}
            title={t("home.servicesTitle")}
            description={t("home.servicesDesc")}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div onClick={() => (window.location.href = "/services/satyanarayan-puja")} className="cursor-pointer">
              <ServiceCard title={t("svc.satyanarayan.title")} description={t("svc.satyanarayan.desc")} image="/images/puja-thali.png" icon={<Flower size={24} />} />
            </div>
            <div onClick={() => (window.location.href = "/services")} className="cursor-pointer">
              <ServiceCard title={t("svc.havan.title")} description={t("svc.havan.desc")} image="/images/temple-ritual.png" icon={<Flame size={24} />} />
            </div>
            <div onClick={() => (window.location.href = "/services/griha-pravesh-puja")} className="cursor-pointer">
              <ServiceCard title={t("svc.grihapravesh.title")} description={t("svc.grihapravesh.desc")} image="/images/hero-bg.png" icon={<HomeIcon size={24} />} />
            </div>
            <div onClick={() => (window.location.href = "/services")} className="cursor-pointer">
              <ServiceCard title={t("svc.dosha.title")} description={t("svc.dosha.desc")} image="/images/meditation.png" icon={<Sparkles size={24} />} />
            </div>
          </div>

          <div className="text-center mt-12">
            <Button
              variant="outline"
              size="lg"
              className="border-primary text-primary hover:bg-primary hover:text-white font-bold px-8"
              onClick={() => (window.location.href = "/services")}
            >
              {t("home.viewAllServices")}
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
              <div className="absolute -bottom-8 -left-8 bg-white p-6 rounded-xl shadow-xl max-w-xs hidden md:block">
                <div className="flex items-center gap-4 mb-2">
                  <div className="text-4xl font-heading font-bold text-primary">500+</div>
                  <div className="text-sm text-muted-foreground font-bold uppercase tracking-wider">{t("home.verifiedCount")}</div>
                </div>
                <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-primary" />
                </div>
              </div>
            </div>

            <div>
              <span className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-2 block">{t("home.missionLabel")}</span>
              <h2 className="font-heading font-bold text-4xl lg:text-5xl text-sidebar mb-6 leading-tight">{t("home.missionTitle")}</h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">{t("home.missionP1")}</p>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{t("home.missionP2")}</p>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-primary">
                    <Heart size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sidebar">{t("home.devotional")}</h4>
                    <p className="text-sm text-muted-foreground">{t("home.devotionalSub")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-primary">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sidebar">{t("home.vedic")}</h4>
                    <p className="text-sm text-muted-foreground">{t("home.vedicSub")}</p>
                  </div>
                </div>
              </div>

              <Button className="bg-sidebar text-white hover:bg-sidebar/90 px-8 h-12" onClick={() => (window.location.href = "/about")}>
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
              <h2 className="font-heading font-bold text-3xl md:text-5xl text-sidebar mb-6">{t("home.ctaTitle")}</h2>
              <p className="text-xl text-sidebar/80 mb-10 font-medium">{t("home.ctaDesc")}</p>
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
                  className="bg-transparent border-2 border-sidebar text-sidebar hover:bg-sidebar/10 h-14 px-10 text-lg font-bold"
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
