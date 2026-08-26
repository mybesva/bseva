import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Users, Heart, Shield, Globe } from "lucide-react";

export default function About() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative py-24 bg-sidebar text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10">
          <div className="max-w-3xl">
            <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-primary text-xs font-bold tracking-[0.2em] uppercase mb-6">
              Our Story
            </span>
            <h1 className="font-heading font-bold text-4xl md:text-6xl mb-6 leading-tight">
              Bridging Tradition with Modern Convenience
            </h1>
            <p className="text-lg text-white/80 mb-8 leading-relaxed">
              B-Seva is dedicated to preserving ancient Vedic traditions while making spiritual services accessible to the modern devotee. We connect you with the divine through authentic rituals and verified priests.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20">
        <div className="container grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <div className="absolute -top-4 -left-4 w-24 h-24 border-t-4 border-l-4 border-primary rounded-tl-3xl" />
            <div className="absolute -bottom-4 -right-4 w-24 h-24 border-b-4 border-r-4 border-primary rounded-br-3xl" />
            <img 
              src="/images/temple-ritual.png" 
              alt="Our Mission" 
              className="rounded-2xl shadow-2xl w-full object-cover aspect-[4/3]"
            />
          </div>
          
          <div>
            <SectionHeader 
              title="Our Mission" 
              align="left"
              className="mb-6"
            />
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              In today's fast-paced world, finding a knowledgeable priest and arranging for authentic rituals can be challenging. B-Seva was founded to solve this problem by creating a trusted platform for spiritual services.
            </p>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              We strive to uphold the sanctity of Sanatana Dharma by ensuring that every ritual performed through our platform adheres strictly to Vedic scriptures. Our mission is to bring peace, prosperity, and spiritual fulfillment to every home.
            </p>
            
            <div className="space-y-4">
              {[
                "Preserving Vedic authenticity",
                "Empowering knowledgeable priests",
                "Simplifying the booking process",
                "Ensuring transparency in services"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sidebar font-medium">
                  <CheckCircle2 className="text-primary" size={20} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-20 bg-secondary/20">
        <div className="container">
          <SectionHeader 
            title="Our Core Values" 
            description="The principles that guide every service we offer."
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { 
                icon: <Shield size={32} />, 
                title: "Authenticity", 
                desc: "We never compromise on the traditional methods and procedures prescribed in the Vedas." 
              },
              { 
                icon: <Users size={32} />, 
                title: "Trust", 
                desc: "Every priest on our platform is background-verified and vetted for their knowledge." 
              },
              { 
                icon: <Heart size={32} />, 
                title: "Devotion", 
                desc: "We believe that rituals must be performed with Bhakti (devotion) to be truly effective." 
              },
              { 
                icon: <Globe size={32} />, 
                title: "Accessibility", 
                desc: "Making spiritual services available to everyone, regardless of location or language." 
              }
            ].map((value, i) => (
              <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all text-center h-full">
                <CardContent className="pt-8 pb-8">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
                    {value.icon}
                  </div>
                  <h3 className="font-heading font-bold text-xl text-sidebar mb-3">{value.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {value.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 bg-sidebar text-white">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-heading font-bold text-primary mb-2">500+</div>
              <div className="text-sm text-white/70 uppercase tracking-wider">Verified Priests</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-heading font-bold text-primary mb-2">10k+</div>
              <div className="text-sm text-white/70 uppercase tracking-wider">Pujas Performed</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-heading font-bold text-primary mb-2">15+</div>
              <div className="text-sm text-white/70 uppercase tracking-wider">Cities Covered</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-heading font-bold text-primary mb-2">4.9</div>
              <div className="text-sm text-white/70 uppercase tracking-wider">Customer Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 text-center">
        <div className="container">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-sidebar mb-6">
            Join our Spiritual Community
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Whether you need a priest for a ceremony or want to learn more about Vedic traditions, we are here for you.
          </p>
          <Button size="lg" className="bg-primary text-white hover:bg-primary/90 px-8 h-12 text-lg font-bold shadow-lg">
            Contact Us Today
          </Button>
        </div>
      </section>
    </Layout>
  );
}
