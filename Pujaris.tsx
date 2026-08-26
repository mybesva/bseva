import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Languages, Award, Search, Filter, CheckCircle2 } from "lucide-react";
import { useState } from "react";

// Mock Data for Pujaris
const PUJARIS = [
  {
    id: 1,
    name: "Pandit Sharma Ji",
    image: "/images/temple-ritual.png",
    location: "Bangalore (South)",
    experience: "15+ Years",
    rating: 4.9,
    reviews: 124,
    languages: ["Hindi", "Sanskrit", "English"],
    specializations: ["Satyanarayan Puja", "Griha Pravesh", "Wedding"],
    verified: true,
    available: true
  },
  {
    id: 2,
    name: "Acharya Venkatesh",
    image: "/images/puja-thali.png",
    location: "Bangalore (North)",
    experience: "22+ Years",
    rating: 5.0,
    reviews: 89,
    languages: ["Kannada", "Telugu", "Sanskrit"],
    specializations: ["Vastu Shanti", "Havan", "Upanayana"],
    verified: true,
    available: true
  },
  {
    id: 3,
    name: "Shastri Iyer",
    image: "/images/hero-bg.png",
    location: "Chennai",
    experience: "18+ Years",
    rating: 4.8,
    reviews: 210,
    languages: ["Tamil", "English", "Sanskrit"],
    specializations: ["Wedding", "Ganapati Havan", "Ancestral Rituals"],
    verified: true,
    available: false
  },
  {
    id: 4,
    name: "Pandit Mishra",
    image: "/images/meditation.png",
    location: "Mumbai",
    experience: "12+ Years",
    rating: 4.7,
    reviews: 56,
    languages: ["Hindi", "Marathi", "Gujarati"],
    specializations: ["Satyanarayan Puja", "Laxmi Puja", "Office Opening"],
    verified: true,
    available: true
  },
  {
    id: 5,
    name: "Purohit Rao",
    image: "/images/temple-ritual.png",
    location: "Hyderabad",
    experience: "25+ Years",
    rating: 4.9,
    reviews: 145,
    languages: ["Telugu", "Hindi", "English"],
    specializations: ["Griha Pravesh", "Namkaran", "Engagement"],
    verified: true,
    available: true
  },
  {
    id: 6,
    name: "Acharya Joshi",
    image: "/images/puja-thali.png",
    location: "Pune",
    experience: "10+ Years",
    rating: 4.6,
    reviews: 42,
    languages: ["Marathi", "Hindi", "Sanskrit"],
    specializations: ["Ganesh Puja", "Vehicle Puja", "Birthday Puja"],
    verified: true,
    available: true
  }
];

export default function Pujaris() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>("all");

  // Filter Logic
  const filteredPujaris = PUJARIS.filter(pujari => {
    const matchesSearch = pujari.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          pujari.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLang = selectedLanguage === "all" || pujari.languages.includes(selectedLanguage);
    const matchesSpec = selectedSpecialization === "all" || pujari.specializations.includes(selectedSpecialization);
    
    return matchesSearch && matchesLang && matchesSpec;
  });

  return (
    <Layout>
      {/* Header */}
      <section className="bg-sidebar text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10 text-center">
          <h1 className="font-heading font-bold text-4xl md:text-5xl mb-4">Find a Verified Pujari</h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto">
            Connect with experienced and knowledgeable priests who perform rituals with devotion and strict adherence to Vedic traditions.
          </p>
        </div>
      </section>

      {/* Search & Filter Bar */}
      <section className="py-8 border-b border-border sticky top-20 bg-background/95 backdrop-blur z-40 shadow-sm">
        <div className="container">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input 
                placeholder="Search by name or location..." 
                className="pl-10 h-12"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-4 w-full md:w-auto">
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-full md:w-[180px] h-12">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  <SelectItem value="Hindi">Hindi</SelectItem>
                  <SelectItem value="Sanskrit">Sanskrit</SelectItem>
                  <SelectItem value="Kannada">Kannada</SelectItem>
                  <SelectItem value="Tamil">Tamil</SelectItem>
                  <SelectItem value="Telugu">Telugu</SelectItem>
                  <SelectItem value="Marathi">Marathi</SelectItem>
                  <SelectItem value="English">English</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedSpecialization} onValueChange={setSelectedSpecialization}>
                <SelectTrigger className="w-full md:w-[200px] h-12">
                  <SelectValue placeholder="Specialization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Specializations</SelectItem>
                  <SelectItem value="Satyanarayan Puja">Satyanarayan Puja</SelectItem>
                  <SelectItem value="Griha Pravesh">Griha Pravesh</SelectItem>
                  <SelectItem value="Wedding">Wedding</SelectItem>
                  <SelectItem value="Havan">Havan</SelectItem>
                  <SelectItem value="Vastu Shanti">Vastu Shanti</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Results Grid */}
      <section className="py-12 bg-secondary/10 min-h-[60vh]">
        <div className="container">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-heading font-bold text-2xl text-sidebar">
              {filteredPujaris.length} Priests Available
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 size={16} className="text-primary" />
              <span>All profiles are background verified</span>
            </div>
          </div>

          {filteredPujaris.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPujaris.map((pujari) => (
                <Card key={pujari.id} className="overflow-hidden hover:shadow-lg transition-all border-none shadow-sm group">
                  <div className="relative h-48 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                    <img 
                      src={pujari.image} 
                      alt={pujari.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute bottom-4 left-4 z-20 text-white">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="font-bold text-lg">{pujari.name}</span>
                        {pujari.verified && <CheckCircle2 size={16} className="text-primary fill-white" />}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-white/80">
                        <MapPin size={12} /> {pujari.location}
                      </div>
                    </div>
                    <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur text-sidebar px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 shadow-sm">
                      <Star size={12} className="fill-primary text-primary" /> {pujari.rating} ({pujari.reviews})
                    </div>
                  </div>
                  
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                      <Award size={16} className="text-primary" />
                      <span>Experience: <span className="text-sidebar font-medium">{pujari.experience}</span></span>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Languages</span>
                        <div className="flex flex-wrap gap-1">
                          {pujari.languages.map((lang, i) => (
                            <Badge key={i} variant="secondary" className="bg-secondary text-sidebar-foreground hover:bg-secondary/80 font-normal">
                              {lang}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">Specializes In</span>
                        <div className="flex flex-wrap gap-1">
                          {pujari.specializations.slice(0, 3).map((spec, i) => (
                            <Badge key={i} variant="outline" className="border-primary/30 text-sidebar font-normal">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter className="pt-2 pb-6">
                    <Button className={`w-full font-bold ${pujari.available ? 'bg-primary hover:bg-primary/90' : 'bg-muted text-muted-foreground'}`} disabled={!pujari.available}>
                      {pujari.available ? 'Book Now' : 'Not Available'}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-border">
              <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                <Search size={32} />
              </div>
              <h3 className="font-heading font-bold text-xl text-sidebar mb-2">No Pujaris Found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                We couldn't find any priests matching your current filters. Try adjusting your search criteria or clearing filters.
              </p>
              <Button 
                variant="link" 
                className="text-primary font-bold mt-4"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedLanguage("all");
                  setSelectedSpecialization("all");
                }}
              >
                Clear All Filters
              </Button>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
