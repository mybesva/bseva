import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, Clock, Users, Star, ArrowRight, Download } from "lucide-react";
import { useLocation } from "wouter";

export default function SatyanarayanPuja() {
  const [, setLocation] = useLocation();
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/temple-ritual.png" 
            alt="Satyanarayan Puja" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-sidebar/80 via-sidebar/60 to-background" />
        </div>
        
        <div className="container relative z-10 text-center pt-12">
          <span className="inline-block py-1 px-3 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/40 text-primary-foreground text-xs font-bold tracking-[0.2em] uppercase mb-6">
            Most Popular Service
          </span>
          <h1 className="font-heading font-bold text-4xl md:text-6xl text-white mb-6 drop-shadow-lg">
            Satyanarayan Puja
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-8 leading-relaxed font-light">
            Invoke the blessings of Lord Vishnu for peace, prosperity, and auspicious beginnings. 
            Performed with strict adherence to Vedic traditions.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-white/80 text-sm font-medium">
            <span className="flex items-center gap-2"><Clock size={18} className="text-primary" /> 2.5 - 3 Hours</span>
            <span className="flex items-center gap-2"><Users size={18} className="text-primary" /> 1 Main Priest + 1 Assistant</span>
            <span className="flex items-center gap-2"><Star size={18} className="text-primary" /> 4.9/5 (120+ Reviews)</span>
          </div>
        </div>
      </section>

      {/* Overview & Significance */}
      <section className="py-20">
        <div className="container grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <SectionHeader 
              title="Significance of the Puja" 
              align="left"
              className="mb-6"
            />
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              The Satyanarayan Puja is a religious worship of the Hindu god Vishnu. Satya means "Truth" and Narayana means, "The highest being" so Satyanarayan means "The highest being who is an embodiment of Truth".
            </p>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              This puja is performed to ensure abundance in one's life. Many people carry out this puja immediately after or on an auspicious occasion like a marriage or moving into a new house. It can also be performed on any day for any reason.
            </p>
            
            <h3 className="font-heading font-bold text-xl text-sidebar mb-4">Ideal Occasions</h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {["Griha Pravesh (House Warming)", "Before Marriage Ceremonies", "Namkaran (Naming Ceremony)", "Starting New Business", "Full Moon Days (Purnima)", "Ekadashi Tithi"].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sidebar/80">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 bg-primary/10 rounded-3xl transform rotate-3" />
            <img 
              src="/images/puja-thali.png" 
              alt="Puja Samagri" 
              className="relative rounded-2xl shadow-xl w-full object-cover aspect-square"
            />
          </div>
        </div>
      </section>

      {/* Rituals Breakdown */}
      <section className="py-20 bg-secondary/20">
        <div className="container">
          <SectionHeader 
            subtitle="The Process"
            title="Key Rituals Performed"
            description="Our verified priests follow the traditional paddhati ensuring every step is performed with devotion."
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Ganesh Puja", desc: "Invoking Lord Ganesh to remove obstacles before starting the main ritual." },
              { title: "Navagraha Puja", desc: "Worship of the nine planetary deities to reduce malefic effects." },
              { title: "Kalash Sthapana", desc: "Invoking the deity into the Kalash (sacred pot) with Vedic mantras." },
              { title: "Katha Recitation", desc: "Reading the 5 chapters of Satyanarayan Katha explaining the glory of Truth." },
              { title: "Havan (Homam)", desc: "Offering oblations into the sacred fire (optional based on package)." },
              { title: "Maha Aarti", desc: "Final offering of light to the deity accompanied by singing hymns." },
              { title: "Prasad Distribution", desc: "Offering sacred food (Sheera/Halwa) to the deity and distributing to devotees." },
              { title: "Ashirvad", desc: "Seeking blessings from the priest and elders for prosperity." }
            ].map((ritual, i) => (
              <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all">
                <CardHeader className="pb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold mb-3">
                    {i + 1}
                  </div>
                  <h3 className="font-heading font-bold text-lg text-sidebar">{ritual.title}</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{ritual.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="py-24">
        <div className="container">
          <SectionHeader 
            subtitle="Packages"
            title="Choose Your Package"
            description="Transparent pricing with no hidden costs. Select the package that best suits your needs."
          />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Essential Package */}
            <Card className="border border-border shadow-sm hover:shadow-lg transition-all relative">
              <CardHeader className="text-center pb-2">
                <h3 className="font-heading font-bold text-2xl text-sidebar">Essential</h3>
                <div className="text-4xl font-bold text-primary mt-4">₹2,100</div>
                <p className="text-sm text-muted-foreground mt-2">For small family gatherings</p>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-4">
                  {[
                    "1 Experienced Priest",
                    "Duration: 1.5 - 2 Hours",
                    "Basic Samagri Included",
                    "Ganesh & Kalash Puja",
                    "Katha Recitation",
                    "Aarti & Prasad",
                    "No Havan"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-sidebar/80">
                      <Check size={16} className="text-primary mt-1 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full bg-sidebar text-white hover:bg-sidebar/90"
                  onClick={() => setLocation('/book/satyanarayan-puja')}
                >
                  Select Package
                </Button>
              </CardFooter>
            </Card>
            
            {/* Standard Package */}
            <Card className="border-2 border-primary shadow-xl relative transform md:-translate-y-4 bg-white">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
                Recommended
              </div>
              <CardHeader className="text-center pb-2 pt-8">
                <h3 className="font-heading font-bold text-2xl text-sidebar">Standard</h3>
                <div className="text-4xl font-bold text-primary mt-4">₹5,100</div>
                <p className="text-sm text-muted-foreground mt-2">Complete ritual experience</p>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-4">
                  {[
                    "1 Senior Priest + 1 Assistant",
                    "Duration: 2.5 - 3 Hours",
                    "Complete Samagri Kit Included",
                    "Ganesh, Navagraha & Kalash Puja",
                    "Detailed Katha Recitation",
                    "Small Havan (Homam)",
                    "Flower Decoration (Basic)",
                    "Prasad Preparation Assistance"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-sidebar/80 font-medium">
                      <Check size={16} className="text-primary mt-1 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full bg-primary text-white hover:bg-primary/90 h-12 font-bold shadow-md"
                  onClick={() => setLocation('/book/satyanarayan-puja')}
                >
                  Select Package
                </Button>
              </CardFooter>
            </Card>
            
            {/* Premium Package */}
            <Card className="border border-border shadow-sm hover:shadow-lg transition-all relative">
              <CardHeader className="text-center pb-2">
                <h3 className="font-heading font-bold text-2xl text-sidebar">Premium</h3>
                <div className="text-4xl font-bold text-primary mt-4">₹11,000</div>
                <p className="text-sm text-muted-foreground mt-2">Grand celebration scale</p>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-4">
                  {[
                    "2 Senior Priests + 2 Assistants",
                    "Duration: 3 - 4 Hours",
                    "Premium Samagri & Fruits Included",
                    "Elaborate Havan & Purnahuti",
                    "Grand Flower Decoration",
                    "Live Nadaswaram/Music",
                    "Professional Photography (Digital)",
                    "Customized Prasad Boxes (25 pcs)"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-sidebar/80">
                      <Check size={16} className="text-primary mt-1 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full bg-sidebar text-white hover:bg-sidebar/90"
                  onClick={() => setLocation('/book/satyanarayan-puja')}
                >
                  Select Package
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Samagri List Accordion */}
      <section className="py-20 bg-secondary/20">
        <div className="container max-w-4xl">
          <SectionHeader 
            title="Samagri List (Puja Materials)" 
            description="We provide high-quality samagri in our Standard and Premium packages. Here is the checklist if you wish to arrange it yourself."
          />
          
          <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
            <div className="flex justify-end mb-6">
              <Button variant="outline" size="sm" className="gap-2 text-primary border-primary hover:bg-primary/5">
                <Download size={16} /> Download PDF Checklist
              </Button>
            </div>
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="font-heading font-bold text-lg text-sidebar">Essential Items (Must Have)</AccordionTrigger>
                <AccordionContent>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {["Turmeric Powder (Haldi)", "Kumkum", "Sandalwood Paste (Chandan)", "Incense Sticks (Agarbatti)", "Camphor (Kapur)", "Betel Leaves & Nuts", "Coconuts (3 pcs)", "Rice (2 kg)", "Flowers & Garlands", "Fruits (5 types)", "Milk, Curd, Ghee, Honey, Sugar (Panchamrit)"].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60" /> {item}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="font-heading font-bold text-lg text-sidebar">Havan Samagri</AccordionTrigger>
                <AccordionContent>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {["Havan Kund (Copper/Clay)", "Wood for Havan (Samidha)", "Ghee (500g)", "Havan Samagri Mix", "Black Sesame Seeds", "Dry Coconut (Kopra)", "Navagraha Samidha sticks"].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60" /> {item}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="font-heading font-bold text-lg text-sidebar">Household Items to Keep Ready</AccordionTrigger>
                <AccordionContent>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {["Low wooden stools (Chowki/Peeta)", "Clean cloth pieces (Red & White)", "Steel/Copper plates & bowls", "Spoons & Tumblers", "Oil Lamps (Diya)", "Matchbox", "Paper Napkins", "Scissors"].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60" /> {item}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container text-center">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-sidebar mb-6">
            Have specific requirements?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            We can customize the puja based on your family traditions and specific needs. Talk to our head priest for guidance.
          </p>
          <Button size="lg" className="bg-primary text-white hover:bg-primary/90 px-8 h-12 text-lg font-bold shadow-lg">
            Request Callback
          </Button>
        </div>
      </section>
    </Layout>
  );
}
