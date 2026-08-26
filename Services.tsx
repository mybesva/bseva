import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import ServiceCard from "@/components/ServiceCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flame, Flower, Home, Sparkles, Heart, Star, Sun, Moon } from "lucide-react";

export default function Services() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative py-20 bg-sidebar text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10 text-center">
          <h1 className="font-heading font-bold text-4xl md:text-6xl mb-6">Our Spiritual Services</h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
            Comprehensive Vedic rituals performed by verified priests to bring peace, prosperity, and divine blessings to your life.
          </p>
        </div>
      </section>

      {/* Services Tabs */}
      <section className="py-16">
        <div className="container">
          <Tabs defaultValue="all" className="w-full">
            <div className="flex justify-center mb-12">
              <TabsList className="bg-secondary/30 p-1 h-auto flex-wrap justify-center gap-2">
                <TabsTrigger value="all" className="px-6 py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-white">All Services</TabsTrigger>
                <TabsTrigger value="puja" className="px-6 py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-white">Pujas</TabsTrigger>
                <TabsTrigger value="havan" className="px-6 py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-white">Havans</TabsTrigger>
                <TabsTrigger value="ceremony" className="px-6 py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-white">Ceremonies</TabsTrigger>
                <TabsTrigger value="dosha" className="px-6 py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-white">Dosha Parihara</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div onClick={() => window.location.href = "/book/satyanarayan-puja"} className="cursor-pointer">
                  <ServiceCard 
                    title="Satyanarayan Puja" 
                    description="Invoke blessings of Lord Vishnu for peace and prosperity. Includes Katha, Havan, and Prasad distribution."
                    image="/images/puja-thali.png"
                    icon={<Flower size={24} />}
                  />
                </div>
                <div onClick={() => window.location.href = "/book/griha-pravesh"} className="cursor-pointer">
                  <ServiceCard 
                    title="Griha Pravesh" 
                    description="Sanctify your new home with traditional House Warming ceremony. Includes Vastu Shanti and Navagraha Havan."
                    image="/images/hero-bg.png"
                    icon={<Home size={24} />}
                  />
                </div>
                <div onClick={() => window.location.href = "/book/ganapati-havan"} className="cursor-pointer">
                  <ServiceCard 
                    title="Ganapati Havan" 
                    description="Powerful fire ritual dedicated to Lord Ganesh to remove obstacles and ensure success in new ventures."
                    image="/images/temple-ritual.png"
                    icon={<Flame size={24} />}
                  />
                </div>
                <div onClick={() => window.location.href = "/book/marriage-ceremony"} className="cursor-pointer">
                  <ServiceCard 
                    title="Marriage Ceremony" 
                    description="Complete Vedic wedding rituals including Kanyadaan, Panigrahana, and Saptapadi performed by senior priests."
                    image="/images/hero-bg.png"
                    icon={<Heart size={24} />}
                  />
                </div>
                <div onClick={() => window.location.href = "/book/navagraha-shanti"} className="cursor-pointer">
                  <ServiceCard 
                    title="Navagraha Shanti" 
                    description="Ritual to appease the nine planetary deities and reduce malefic effects for overall well-being."
                    image="/images/meditation.png"
                    icon={<Sun size={24} />}
                  />
                </div>
                <div onClick={() => window.location.href = "/book/namkaran"} className="cursor-pointer">
                  <ServiceCard 
                    title="Namkaran" 
                    description="Traditional naming ceremony for newborns to bless the child with a long, healthy, and prosperous life."
                    image="/images/puja-thali.png"
                    icon={<Star size={24} />}
                  />
                </div>
                <div onClick={() => window.location.href = "/book/rudra-abhishekam"} className="cursor-pointer">
                  <ServiceCard 
                    title="Rudra Abhishekam" 
                    description="Sacred bathing ritual of Shiva Linga with Panchamrit to seek Lord Shiva's blessings for health and protection."
                    image="/images/temple-ritual.png"
                    icon={<Moon size={24} />}
                  />
                </div>
                <div onClick={() => window.location.href = "/book/kaal-sarp-dosh"} className="cursor-pointer">
                  <ServiceCard 
                    title="Kaal Sarp Dosh Nivarana" 
                    description="Specialized puja to nullify the effects of Kaal Sarp Dosh and bring stability in career and personal life."
                    image="/images/meditation.png"
                    icon={<Sparkles size={24} />}
                  />
                </div>
                <div onClick={() => window.location.href = "/book/office-opening"} className="cursor-pointer">
                  <ServiceCard 
                    title="Office Opening" 
                    description="Auspicious beginning for your new business premises with Ganesh Puja and Lakshmi Puja for wealth."
                    image="/images/hero-bg.png"
                    icon={<Home size={24} />}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="puja" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div onClick={() => window.location.href = "/book/satyanarayan-puja"} className="cursor-pointer">
                  <ServiceCard 
                    title="Satyanarayan Puja" 
                    description="Invoke blessings of Lord Vishnu for peace and prosperity. Includes Katha, Havan, and Prasad distribution."
                    image="/images/puja-thali.png"
                    icon={<Flower size={24} />}
                  />
                </div>
                <div onClick={() => window.location.href = "/book/rudra-abhishekam"} className="cursor-pointer">
                  <ServiceCard 
                    title="Rudra Abhishekam" 
                    description="Sacred bathing ritual of Shiva Linga with Panchamrit to seek Lord Shiva's blessings for health and protection."
                    image="/images/temple-ritual.png"
                    icon={<Moon size={24} />}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="havan" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div onClick={() => window.location.href = "/book/ganapati-havan"} className="cursor-pointer">
                  <ServiceCard 
                    title="Ganapati Havan" 
                    description="Powerful fire ritual dedicated to Lord Ganesh to remove obstacles and ensure success in new ventures."
                    image="/images/temple-ritual.png"
                    icon={<Flame size={24} />}
                  />
                </div>
                <div onClick={() => window.location.href = "/book/navagraha-shanti"} className="cursor-pointer">
                  <ServiceCard 
                    title="Navagraha Shanti" 
                    description="Ritual to appease the nine planetary deities and reduce malefic effects for overall well-being."
                    image="/images/meditation.png"
                    icon={<Sun size={24} />}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="ceremony" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div onClick={() => window.location.href = "/book/griha-pravesh"} className="cursor-pointer">
                  <ServiceCard 
                    title="Griha Pravesh" 
                    description="Sanctify your new home with traditional House Warming ceremony. Includes Vastu Shanti and Navagraha Havan."
                    image="/images/hero-bg.png"
                    icon={<Home size={24} />}
                  />
                </div>
                <div onClick={() => window.location.href = "/book/marriage-ceremony"} className="cursor-pointer">
                  <ServiceCard 
                    title="Marriage Ceremony" 
                    description="Complete Vedic wedding rituals including Kanyadaan, Panigrahana, and Saptapadi performed by senior priests."
                    image="/images/hero-bg.png"
                    icon={<Heart size={24} />}
                  />
                </div>
                <div onClick={() => window.location.href = "/book/namkaran"} className="cursor-pointer">
                  <ServiceCard 
                    title="Namkaran" 
                    description="Traditional naming ceremony for newborns to bless the child with a long, healthy, and prosperous life."
                    image="/images/puja-thali.png"
                    icon={<Star size={24} />}
                  />
                </div>
                <div onClick={() => window.location.href = "/book/office-opening"} className="cursor-pointer">
                  <ServiceCard 
                    title="Office Opening" 
                    description="Auspicious beginning for your new business premises with Ganesh Puja and Lakshmi Puja for wealth."
                    image="/images/hero-bg.png"
                    icon={<Home size={24} />}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="dosha" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div onClick={() => window.location.href = "/book/kaal-sarp-dosh"} className="cursor-pointer">
                  <ServiceCard 
                    title="Kaal Sarp Dosh Nivarana" 
                    description="Specialized puja to nullify the effects of Kaal Sarp Dosh and bring stability in career and personal life."
                    image="/images/meditation.png"
                    icon={<Sparkles size={24} />}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Custom Request CTA */}
      <section className="py-20 bg-secondary/20">
        <div className="container text-center">
          <SectionHeader 
            title="Can't find what you're looking for?" 
            description="We offer customized puja packages tailored to your specific family traditions and requirements."
          />
          <Button 
            size="lg" 
            className="bg-primary text-white hover:bg-primary/90 px-8 h-12 text-lg font-bold shadow-lg"
            onClick={() => window.location.href = "/contact"}
          >
            Request Custom Puja
          </Button>
        </div>
      </section>
    </Layout>
  );
}
