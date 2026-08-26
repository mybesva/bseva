import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, Clock, Users, Star, ArrowRight, Download, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function GrihaPraveshPuja() {
  const [, setLocation] = useLocation();
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/hero-bg.png" 
            alt="Griha Pravesh Puja" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-sidebar/80 via-sidebar/60 to-background" />
        </div>
        
        <div className="container relative z-10 text-center pt-12">
          <span className="inline-block py-1 px-3 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/40 text-primary-foreground text-xs font-bold tracking-[0.2em] uppercase mb-6">
            New Beginnings
          </span>
          <h1 className="font-heading font-bold text-4xl md:text-6xl text-white mb-6 drop-shadow-lg">
            Griha Pravesh Puja
          </h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto mb-8 leading-relaxed font-light">
            Sanctify your new home with divine blessings. Perform the traditional house warming ceremony to invite positive energy and prosperity.
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-white/80 text-sm font-medium">
            <span className="flex items-center gap-2"><Clock size={18} className="text-primary" /> 3 - 4 Hours</span>
            <span className="flex items-center gap-2"><Users size={18} className="text-primary" /> 2 Priests</span>
            <span className="flex items-center gap-2"><Star size={18} className="text-primary" /> 5.0/5 (85+ Reviews)</span>
          </div>
        </div>
      </section>

      {/* Overview & Significance */}
      <section className="py-20">
        <div className="container grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <SectionHeader 
              title="Significance of Griha Pravesh" 
              align="left"
              className="mb-6"
            />
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
              Griha Pravesh is a Hindu ceremony performed on the occasion of an individual's first entry into their new home. It is done to purify the environment and protect the house from negative energies.
            </p>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              The puja invokes the blessings of the Vastu Purusha (deity of directions) and the Navagrahas (nine planets) to ensure health, wealth, and harmony for the family residing in the new dwelling.
            </p>
            
            <h3 className="font-heading font-bold text-xl text-sidebar mb-4">Types of Griha Pravesh</h3>
            <ul className="space-y-4">
              {[
                { title: "Apoorva", desc: "First entry into a newly constructed home." },
                { title: "Sapoorva", desc: "Entry into an existing home after traveling abroad or migration." },
                { title: "Dwandwah", desc: "Entry into a home after reconstruction or renovation due to damage." }
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sidebar/80">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div>
                    <span className="font-bold text-sidebar">{item.title}:</span> {item.desc}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 bg-primary/10 rounded-3xl transform -rotate-3" />
            <img 
              src="/images/temple-ritual.png" 
              alt="Griha Pravesh Ritual" 
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
            description="A comprehensive set of rituals to purify every corner of your new abode."
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Dwar Puja", desc: "Worship of the main entrance door and threshold (Umbra) before entering." },
              { title: "Gau Puja", desc: "Worship of the Cow (Kamadhenu) to bring abundance (optional/symbolic)." },
              { title: "Vastu Shanti", desc: "Pacifying the Vastu Purusha to remove any architectural defects (doshas)." },
              { title: "Navagraha Havan", desc: "Fire ritual to appease the nine planets and seek their favorable influence." },
              { title: "Milk Boiling", desc: "Boiling milk until it overflows, symbolizing the overflow of prosperity." },
              { title: "Ganapati Puja", desc: "Invoking Lord Ganesh to remove obstacles in the new journey." },
              { title: "Punyahavachanam", desc: "Purification ceremony sprinkling sacred water throughout the house." },
              { title: "Maha Mangala Aarti", desc: "Final offering of light to bless the entire house and family." }
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
            description="Select the scale of ceremony that fits your needs and family traditions."
          />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Essential Package */}
            <Card className="border border-border shadow-sm hover:shadow-lg transition-all relative">
              <CardHeader className="text-center pb-2">
                <h3 className="font-heading font-bold text-2xl text-sidebar">Essential</h3>
                <div className="text-4xl font-bold text-primary mt-4">₹5,100</div>
                <p className="text-sm text-muted-foreground mt-2">Basic purification ceremony</p>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-4">
                  {[
                    "1 Experienced Priest",
                    "Duration: 2 - 2.5 Hours",
                    "Basic Samagri Included",
                    "Dwar Puja & Ganesh Puja",
                    "Punyahavachanam",
                    "Milk Boiling Ritual",
                    "Basic Vastu Puja",
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
                  onClick={() => setLocation('/book/griha-pravesh-puja')}
                >
                  Select Package
                </Button>
              </CardFooter>
            </Card>
            
            {/* Standard Package */}
            <Card className="border-2 border-primary shadow-xl relative transform md:-translate-y-4 bg-white">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
                Most Popular
              </div>
              <CardHeader className="text-center pb-2 pt-8">
                <h3 className="font-heading font-bold text-2xl text-sidebar">Standard</h3>
                <div className="text-4xl font-bold text-primary mt-4">₹11,000</div>
                <p className="text-sm text-muted-foreground mt-2">Complete traditional ceremony</p>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-4">
                  {[
                    "2 Priests (Main + Assistant)",
                    "Duration: 3 - 4 Hours",
                    "Complete Samagri Kit Included",
                    "Vastu Shanti Havan",
                    "Navagraha Havan",
                    "Gau Puja (Symbolic)",
                    "Satyanarayan Puja (Short)",
                    "Flower Decoration (Entrance)"
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
                  onClick={() => setLocation('/book/griha-pravesh-puja')}
                >
                  Select Package
                </Button>
              </CardFooter>
            </Card>
            
            {/* Premium Package */}
            <Card className="border border-border shadow-sm hover:shadow-lg transition-all relative">
              <CardHeader className="text-center pb-2">
                <h3 className="font-heading font-bold text-2xl text-sidebar">Premium</h3>
                <div className="text-4xl font-bold text-primary mt-4">₹21,000</div>
                <p className="text-sm text-muted-foreground mt-2">Grand celebration scale</p>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-4">
                  {[
                    "3 Senior Priests",
                    "Duration: 4 - 5 Hours",
                    "Premium Samagri & Fruits",
                    "Elaborate Vastu & Navagraha Havan",
                    "Full Satyanarayan Puja",
                    "Grand Flower Decoration (Full House)",
                    "Live Nadaswaram/Shehnai",
                    "Gau Puja with Live Cow (if permitted)"
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
                  onClick={() => setLocation('/book/griha-pravesh-puja')}
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
            description="We provide high-quality samagri in our Standard and Premium packages. Here is the checklist for your reference."
          />
          
          <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
            <div className="flex justify-end mb-6">
              <Button variant="outline" size="sm" className="gap-2 text-primary border-primary hover:bg-primary/5">
                <Download size={16} /> Download PDF Checklist
              </Button>
            </div>
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="font-heading font-bold text-lg text-sidebar">General Puja Items</AccordionTrigger>
                <AccordionContent>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {["Turmeric & Kumkum", "Sandalwood Paste", "Incense Sticks & Camphor", "Betel Leaves & Nuts", "Coconuts (5 pcs)", "Rice (5 kg)", "Flowers & Garlands (Mango leaves essential)", "Fruits (5 types)", "Milk (1 liter for boiling)", "New Vessel for boiling milk"].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60" /> {item}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="font-heading font-bold text-lg text-sidebar">Vastu & Havan Samagri</AccordionTrigger>
                <AccordionContent>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {["Havan Kund (Copper/Brick)", "Wood for Havan", "Ghee (1 kg)", "Havan Samagri Mix", "Navadhanya (9 Grains)", "White Pumpkin (Ash Gourd)", "Lemons", "Dry Coconut", "Vastu Yantra (optional)"].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60" /> {item}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="font-heading font-bold text-lg text-sidebar">Kitchen & Grocery Items</AccordionTrigger>
                <AccordionContent>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {["Jaggery", "Sugar", "Cardamom & Cloves", "Oil & Ghee", "Matchbox", "Plates & Bowls", "Tumblers & Spoons", "Napkins/Towels", "Rangoli Powder"].map((item, i) => (
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
            Planning your House Warming?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Consult with our Vastu experts to choose the most auspicious date and time (Muhurat) for your Griha Pravesh.
          </p>
          <Button size="lg" className="bg-primary text-white hover:bg-primary/90 px-8 h-12 text-lg font-bold shadow-lg">
            Check Auspicious Dates
          </Button>
        </div>
      </section>
    </Layout>
  );
}
