import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import ServiceCard from "@/components/ServiceCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, Flower, Home, Sparkles, Heart, Star, Sun, Moon } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

export default function Services() {
  const { t } = useI18n();

  const card = (href: string, titleKey: string, descKey: string, image: string, icon: React.ReactNode) => (
    <div onClick={() => (window.location.href = href)} className="cursor-pointer">
      <ServiceCard title={t(titleKey)} description={t(descKey)} image={image} icon={icon} />
    </div>
  );

  return (
    <Layout>
      <section className="relative py-20 bg-sidebar text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10 text-center">
          <h1 className="font-heading font-bold text-4xl md:text-6xl mb-6">{t("services.title")}</h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">{t("services.subtitle")}</p>
        </div>
      </section>

      <section className="py-16">
        <div className="container">
          <Tabs defaultValue="all" className="w-full">
            <div className="flex justify-center mb-12">
              <TabsList className="bg-secondary/30 p-1 h-auto flex-wrap justify-center gap-2">
                <TabsTrigger value="all" className="px-6 py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-white">{t("services.all")}</TabsTrigger>
                <TabsTrigger value="puja" className="px-6 py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-white">{t("services.pujas")}</TabsTrigger>
                <TabsTrigger value="havan" className="px-6 py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-white">{t("services.havans")}</TabsTrigger>
                <TabsTrigger value="ceremony" className="px-6 py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-white">{t("services.ceremonies")}</TabsTrigger>
                <TabsTrigger value="dosha" className="px-6 py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-white">{t("services.dosha")}</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {card("/book/satyanarayan-puja", "svc.satyanarayan.title", "svc.satyanarayan.desc", "/images/puja-thali.png", <Flower size={24} />)}
                {card("/book/griha-pravesh", "svc.grihapravesh.title", "svc.grihapravesh.desc", "/images/hero-bg.png", <Home size={24} />)}
                {card("/book/ganapati-havan", "svc.ganapati.title", "svc.ganapati.desc", "/images/temple-ritual.png", <Flame size={24} />)}
                {card("/book/marriage-ceremony", "svc.marriage.title", "svc.marriage.desc", "/images/hero-bg.png", <Heart size={24} />)}
                {card("/book/navagraha-shanti", "svc.navagraha.title", "svc.navagraha.desc", "/images/meditation.png", <Sun size={24} />)}
                {card("/book/namkaran", "svc.namkaran.title", "svc.namkaran.desc", "/images/puja-thali.png", <Star size={24} />)}
                {card("/book/rudra-abhishekam", "svc.rudra.title", "svc.rudra.desc", "/images/temple-ritual.png", <Moon size={24} />)}
                {card("/book/kaal-sarp-dosh", "svc.kaalsarp.title", "svc.kaalsarp.desc", "/images/meditation.png", <Sparkles size={24} />)}
                {card("/book/office-opening", "svc.office.title", "svc.office.desc", "/images/hero-bg.png", <Home size={24} />)}
              </div>
            </TabsContent>

            <TabsContent value="puja" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {card("/book/satyanarayan-puja", "svc.satyanarayan.title", "svc.satyanarayan.desc", "/images/puja-thali.png", <Flower size={24} />)}
                {card("/book/rudra-abhishekam", "svc.rudra.title", "svc.rudra.desc", "/images/temple-ritual.png", <Moon size={24} />)}
              </div>
            </TabsContent>

            <TabsContent value="havan" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {card("/book/ganapati-havan", "svc.ganapati.title", "svc.ganapati.desc", "/images/temple-ritual.png", <Flame size={24} />)}
                {card("/book/navagraha-shanti", "svc.navagraha.title", "svc.navagraha.desc", "/images/meditation.png", <Sun size={24} />)}
              </div>
            </TabsContent>

            <TabsContent value="ceremony" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {card("/book/griha-pravesh", "svc.grihapravesh.title", "svc.grihapravesh.desc", "/images/hero-bg.png", <Home size={24} />)}
                {card("/book/marriage-ceremony", "svc.marriage.title", "svc.marriage.desc", "/images/hero-bg.png", <Heart size={24} />)}
                {card("/book/namkaran", "svc.namkaran.title", "svc.namkaran.desc", "/images/puja-thali.png", <Star size={24} />)}
                {card("/book/office-opening", "svc.office.title", "svc.office.desc", "/images/hero-bg.png", <Home size={24} />)}
              </div>
            </TabsContent>

            <TabsContent value="dosha" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {card("/book/kaal-sarp-dosh", "svc.kaalsarp.title", "svc.kaalsarp.desc", "/images/meditation.png", <Sparkles size={24} />)}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <section className="py-20 bg-secondary/20">
        <div className="container text-center">
          <SectionHeader title={t("services.customTitle")} description={t("services.customDesc")} />
          <Button
            size="lg"
            className="bg-primary text-white hover:bg-primary/90 px-8 h-12 text-lg font-bold shadow-lg"
            onClick={() => (window.location.href = "/contact")}
          >
            {t("services.requestCustom")}
          </Button>
        </div>
      </section>
    </Layout>
  );
}
