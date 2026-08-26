import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Users, Heart, Shield, Globe } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

export default function About() {
  const { t } = useI18n();

  const values = [
    { icon: <Shield size={32} />, title: t("about.v1"), desc: t("about.v1d") },
    { icon: <Users size={32} />, title: t("about.v2"), desc: t("about.v2d") },
    { icon: <Heart size={32} />, title: t("about.v3"), desc: t("about.v3d") },
    { icon: <Globe size={32} />, title: t("about.v4"), desc: t("about.v4d") },
  ];

  return (
    <Layout>
      <section className="relative py-24 bg-sidebar text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10">
          <div className="max-w-3xl">
            <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-primary text-xs font-bold tracking-[0.2em] uppercase mb-6">
              {t("about.badge")}
            </span>
            <h1 className="font-heading font-bold text-4xl md:text-6xl mb-6 leading-tight">{t("about.title")}</h1>
            <p className="text-lg text-white/80 mb-8 leading-relaxed">{t("about.heroDesc")}</p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <div className="absolute -top-4 -left-4 w-24 h-24 border-t-4 border-l-4 border-primary rounded-tl-3xl" />
            <div className="absolute -bottom-4 -right-4 w-24 h-24 border-b-4 border-r-4 border-primary rounded-br-3xl" />
            <img src="/images/temple-ritual.png" alt="Our Mission" className="rounded-2xl shadow-2xl w-full object-cover aspect-[4/3]" />
          </div>

          <div>
            <SectionHeader title={t("about.mission")} align="left" className="mb-6" />
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">{t("about.missionP1")}</p>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{t("about.missionP2")}</p>

            <div className="space-y-4">
              {[t("about.point1"), t("about.point2"), t("about.point3"), t("about.point4")].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sidebar font-medium">
                  <CheckCircle2 className="text-primary" size={20} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-secondary/20">
        <div className="container">
          <SectionHeader title={t("about.valuesTitle")} description={t("about.valuesDesc")} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, i) => (
              <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all text-center h-full">
                <CardContent className="pt-8 pb-8">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">{value.icon}</div>
                  <h3 className="font-heading font-bold text-xl text-sidebar mb-3">{value.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{value.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-sidebar text-white">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-heading font-bold text-primary mb-2">500+</div>
              <div className="text-sm text-white/70 uppercase tracking-wider">{t("about.statPriests")}</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-heading font-bold text-primary mb-2">10k+</div>
              <div className="text-sm text-white/70 uppercase tracking-wider">{t("about.statPujas")}</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-heading font-bold text-primary mb-2">15+</div>
              <div className="text-sm text-white/70 uppercase tracking-wider">{t("about.statCities")}</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-heading font-bold text-primary mb-2">4.9</div>
              <div className="text-sm text-white/70 uppercase tracking-wider">{t("about.statRating")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 text-center">
        <div className="container">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-sidebar mb-6">{t("about.ctaTitle")}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">{t("about.ctaDesc")}</p>
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
