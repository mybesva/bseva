import { useAuth } from "@/_core/hooks/useAuth";
import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import ServiceCard from "@/components/ServiceCard";
import TestimonialCard from "@/components/TestimonialCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Flame, Flower, Heart, Home as HomeIcon, Search, Sparkles, UserCheck } from "lucide-react";

export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/hero-bg.png" 
            alt="Temple Atmosphere" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-sidebar/60 via-sidebar/40 to-background" />
        </div>

        {/* Content */}
        <div className="container relative z-10 pt-20 pb-12 text-center">
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <span className="inline-block py-1 px-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-bold tracking-[0.2em] uppercase mb-6">
              Authentic Vedic Rituals
            </span>
            <h1 className="font-heading font-bold text-4xl md:text-6xl lg:text-7xl text-white mb-6 leading-tight drop-shadow-lg">
              Experience Divine <br />
              <span className="text-gradient-gold">Spiritual Connection</span>
            </h1>
            <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
              Connect with verified pujaris for authentic pujas, havans, and temple rituals. 
              Bring the sanctity of the temple to your home.
            </p>
            
            {/* Search/Booking Widget */}
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl p-2 md:p-4 flex flex-col md:flex-row gap-3 items-center">
              <div className="flex-1 w-full">
                <Select>
                  <SelectTrigger className="h-12 border-none bg-secondary/30 focus:ring-0 text-base">
                    <SelectValue placeholder="Select Puja Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="satyanarayan">
                    <a href="/services/satyanarayan-puja" className="block w-full h-full">Satyanarayan Puja</a>
                  </SelectItem>
                    <SelectItem value="ganesh">Ganesh Puja</SelectItem>
                    <SelectItem value="grihapravesh">
                    <a href="/services/griha-pravesh-puja" className="block w-full h-full">Griha Pravesh</a>
                  </SelectItem>
                    <SelectItem value="marriage">Marriage Ceremony</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-px h-8 bg-border hidden md:block" />
              <div className="flex-1 w-full">
                <Select>
                  <SelectTrigger className="h-12 border-none bg-secondary/30 focus:ring-0 text-base">
                    <SelectValue placeholder="Select Location" />
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
                <Input 
                  type="date" 
                  className="h-12 border-none bg-secondary/30 focus-visible:ring-0 text-base" 
                />
              </div>
              <Button 
                size="lg" 
                className="w-full md:w-auto h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base shadow-lg"
                onClick={() => window.location.href = "/pujaris"}
              >
                <Search className="mr-2 h-5 w-5" /> Find Pujari
              </Button>
            </div>
          </div>
        </div>
        
        {/* Decorative Bottom Curve */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-background" style={{ clipPath: "ellipse(60% 100% at 50% 100%)" }} />
      </section>

      {/* Features Section */}
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
              <h3 className="font-heading font-bold text-xl text-sidebar mb-3">Verified Pujaris</h3>
              <p className="text-muted-foreground">
                Every priest is background-checked and verified for their Vedic knowledge and experience.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/50 border border-white/60 shadow-sm hover:shadow-md transition-all">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
                <Sparkles size={32} />
              </div>
              <h3 className="font-heading font-bold text-xl text-sidebar mb-3">Authentic Rituals</h3>
              <p className="text-muted-foreground">
                Services performed strictly according to Vedic scriptures with high-quality samagri.
              </p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/50 border border-white/60 shadow-sm hover:shadow-md transition-all">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-6">
                <Calendar size={32} />
              </div>
              <h3 className="font-heading font-bold text-xl text-sidebar mb-3">Auspicious Timing</h3>
              <p className="text-muted-foreground">
                We help you select the most auspicious Muhurat for your puja based on Vedic astrology.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Services Section */}
      <section className="py-20 bg-secondary/20">
        <div className="container">
          <SectionHeader 
            subtitle="Our Offerings"
            title="Sacred Services for Every Occasion"
            description="From daily rituals to grand ceremonies, we provide a comprehensive range of spiritual services tailored to your needs."
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div onClick={() => window.location.href = "/services/satyanarayan-puja"} className="cursor-pointer">
              <ServiceCard 
                title="Satyanarayan Puja" 
                description="Invoke blessings of Lord Vishnu for peace and prosperity. Includes Katha, Havan, and Prasad distribution."
                image="/images/puja-thali.png"
                icon={<Flower size={24} />}
              />
            </div>
            <div onClick={() => window.location.href = "/services"} className="cursor-pointer">
              <ServiceCard 
                title="Havan & Yagna" 
                description="Sacred fire rituals like Ganapati Havan, Navagraha Havan, and Sudarshana Havan for purification and blessings."
                image="/images/temple-ritual.png"
                icon={<Flame size={24} />}
              />
            </div>
            <div onClick={() => window.location.href = "/services/griha-pravesh-puja"} className="cursor-pointer">
              <ServiceCard 
                title="Griha Pravesh" 
                description="Sanctify your new home with traditional House Warming ceremony. Includes Vastu Shanti and Navagraha Havan."
                image="/images/hero-bg.png"
                icon={<HomeIcon size={24} />}
              />
            </div>
            <div onClick={() => window.location.href = "/services"} className="cursor-pointer">
              <ServiceCard 
                title="Dosha Parihara" 
                description="Remedial pujas for planetary doshas including Kaal Sarp Dosh, Mangal Dosh, and Shani Shanti."
                image="/images/meditation.png"
                icon={<Sparkles size={24} />}
              />
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Button 
              variant="outline" 
              size="lg" 
              className="border-primary text-primary hover:bg-primary hover:text-white font-bold px-8"
              onClick={() => window.location.href = "/services"}
            >
              View All Services
            </Button>
          </div>
        </div>
      </section>

      {/* About/Mission Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute -top-4 -left-4 w-24 h-24 border-t-4 border-l-4 border-primary rounded-tl-3xl" />
              <div className="absolute -bottom-4 -right-4 w-24 h-24 border-b-4 border-r-4 border-primary rounded-br-3xl" />
              <img 
                src="/images/temple-ritual.png" 
                alt="Priest performing aarti" 
                className="rounded-2xl shadow-2xl w-full object-cover aspect-[4/3]"
              />
              <div className="absolute -bottom-8 -left-8 bg-white p-6 rounded-xl shadow-xl max-w-xs hidden md:block">
                <div className="flex items-center gap-4 mb-2">
                  <div className="text-4xl font-heading font-bold text-primary">500+</div>
                  <div className="text-sm text-muted-foreground font-bold uppercase tracking-wider">Verified<br/>Pujaris</div>
                </div>
                <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-primary" />
                </div>
              </div>
            </div>
            
            <div>
              <span className="text-sm font-bold tracking-[0.2em] uppercase text-primary mb-2 block">Our Mission</span>
              <h2 className="font-heading font-bold text-4xl lg:text-5xl text-sidebar mb-6 leading-tight">
                Preserving Tradition in the Digital Age
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                B-Seva was born from a desire to make authentic spiritual services accessible to everyone, everywhere. We bridge the gap between ancient Vedic traditions and modern convenience.
              </p>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Our platform connects you with knowledgeable priests who perform rituals with devotion and precision, ensuring the sanctity of your prayers is maintained.
              </p>
              
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-primary"><Heart size={20} /></div>
                  <div>
                    <h4 className="font-bold text-sidebar">Devotional Service</h4>
                    <p className="text-sm text-muted-foreground">Performed with Bhakti</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 text-primary"><Sparkles size={20} /></div>
                  <div>
                    <h4 className="font-bold text-sidebar">Vedic Accuracy</h4>
                    <p className="text-sm text-muted-foreground">Strict scriptural adherence</p>
                  </div>
                </div>
              </div>
              
              <Button 
                className="bg-sidebar text-white hover:bg-sidebar/90 px-8 h-12"
                onClick={() => window.location.href = "/about"}
              >
                Learn More About Us
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-sidebar text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
        </div>
        
        <div className="container relative z-10">
          <SectionHeader 
            subtitle="Devotee Experiences"
            title="What Our Community Says"
            description="Read stories from families who have experienced the divine connection through B-Seva services."
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

      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="container">
          <div className="bg-gradient-to-r from-primary to-accent rounded-3xl p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none mix-blend-overlay">
              <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
            </div>
            
            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="font-heading font-bold text-3xl md:text-5xl text-sidebar mb-6">
                Ready to Invite Divine Blessings?
              </h2>
              <p className="text-xl text-sidebar/80 mb-10 font-medium">
                Book your puja today and experience the peace and prosperity of authentic Vedic rituals.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="bg-sidebar text-white hover:bg-sidebar/90 h-14 px-10 text-lg shadow-lg"
                  onClick={() => window.location.href = "/services"}
                >
                  Book a Puja Now
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="bg-transparent border-2 border-sidebar text-sidebar hover:bg-sidebar/10 h-14 px-10 text-lg font-bold"
                  onClick={() => window.location.href = "/contact"}
                >
                  Contact Support
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
