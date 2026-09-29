import { AboutEssenceCards } from "@/components/AboutEssenceCards";
import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";
import { BookOpen, Globe, Heart, Layers, Shield, Sparkles, Users } from "lucide-react";

export default function About() {
  const { t } = useI18n();

  const values = [
    { icon: <BookOpen size={32} />, title: t("about.v1"), desc: t("about.v1d") },
    { icon: <Users size={32} />, title: t("about.v2"), desc: t("about.v2d") },
    { icon: <Sparkles size={32} />, title: t("about.v3"), desc: t("about.v3d") },
    { icon: <Shield size={32} />, title: t("about.v4"), desc: t("about.v4d") },
    { icon: <Globe size={32} />, title: t("about.v5"), desc: t("about.v5d") },
    { icon: <Heart size={32} />, title: t("about.v6"), desc: t("about.v6d") },
  ];

  return (
    <Layout>
      <AboutEssenceCards />

      <section className="relative py-10 md:py-12 bg-sidebar text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10">
          <div className="max-w-3xl">
            <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-primary text-xs font-bold tracking-[0.2em] uppercase mb-3">
              {t("about.badge")}
            </span>
            <h1 className="text-h1 md:text-display text-primary mb-3">{t("about.title")}</h1>
            <p className="text-base text-on-dark leading-relaxed mb-4">{t("about.heroDesc")}</p>
            <p className="text-base text-on-dark leading-relaxed">{t("about.heroIntro")}</p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <div className="absolute -top-4 -left-4 w-24 h-24 border-t-4 border-l-4 border-primary rounded-tl-3xl" />
            <div className="absolute -bottom-4 -right-4 w-24 h-24 border-b-4 border-r-4 border-primary rounded-br-3xl" />
            <img src="/images/temple-ritual.png" alt="" className="rounded-2xl shadow-2xl w-full object-cover aspect-[4/3]" />
          </div>

          <div>
            <SectionHeader title={t("about.mission")} align="left" className="mb-6" />
            <div className="space-y-5 text-lg text-muted-foreground leading-relaxed">
              <p>{t("about.missionP1")}</p>
              <p>{t("about.missionP2")}</p>
              <p>{t("about.missionP3")}</p>
              <p>{t("about.missionP4")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary/20">
        <div className="container max-w-4xl">
          <SectionHeader title={t("about.pujariCommitTitle")} className="mb-8" />
          <div className="space-y-5 text-lg text-muted-foreground leading-relaxed mb-8">
            <p>{t("about.pujariCommitP1")}</p>
            <p>{t("about.pujariCommitP2")}</p>
            <p>{t("about.pujariCommitP3")}</p>
            <p>{t("about.pujariCommitP4")}</p>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 md:p-8 text-center">
            <Layers className="mx-auto text-primary mb-3" size={28} aria-hidden />
            <p className="text-foreground font-medium leading-relaxed">{t("about.pujariCommitHighlight")}</p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container">
          <SectionHeader title={t("about.valuesTitle")} description={t("about.valuesDesc") || undefined} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {values.map((value, i) => (
              <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all h-full">
                <CardContent className="pt-8 pb-8">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
                    {value.icon}
                  </div>
                  <h3 className="font-bold text-xl text-foreground mb-3">{value.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{value.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-secondary/20">
        <div className="container max-w-3xl">
          <SectionHeader title={t("about.onboardingTitle")} className="mb-8" />
          <div className="space-y-5 text-lg text-muted-foreground leading-relaxed">
            <p>{t("about.onboardingP1")}</p>
            <p>{t("about.onboardingP2")}</p>
            <p>{t("about.onboardingP3")}</p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-sidebar text-white">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-price text-primary mb-2">500+</div>
              <div className="text-sm text-[#FFFFFF] uppercase tracking-wider font-medium">{t("about.statPriests")}</div>
            </div>
            <div>
              <div className="text-price text-primary mb-2">10k+</div>
              <div className="text-sm text-[#FFFFFF] uppercase tracking-wider font-medium">{t("about.statPujas")}</div>
            </div>
            <div>
              <div className="text-price text-primary mb-2">15+</div>
              <div className="text-sm text-[#FFFFFF] uppercase tracking-wider font-medium">{t("about.statCities")}</div>
            </div>
            <div>
              <div className="text-price text-primary mb-2">4.9</div>
              <div className="text-sm text-[#FFFFFF] uppercase tracking-wider font-medium">{t("about.statRating")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 text-center">
        <div className="container max-w-2xl">
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{t("about.combinedStatement")}</p>
          <Button
            size="lg"
            className="bg-primary text-white hover:bg-primary/90 px-8 h-12 text-lg font-bold shadow-lg"
            onClick={() => (window.location.href = "/contact")}
          >
            {t("about.contactToday")}
          </Button>
        </div>
      </section>
    </Layout>
  );
}
