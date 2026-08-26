import Layout from "@/components/Layout";
import SectionHeader from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Phone, Mail, Clock, Send } from "lucide-react";

export default function Contact() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative py-20 bg-sidebar text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <img src="/images/mandala-pattern.png" alt="Pattern" className="w-full h-full object-cover" />
        </div>
        <div className="container relative z-10 text-center">
          <h1 className="font-heading font-bold text-4xl md:text-6xl mb-6">Get in Touch</h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-8">
            Have questions about our services or need help with a booking? Our support team is here to assist you.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Contact Info */}
            <div className="lg:col-span-1 space-y-8">
              <div>
                <h3 className="font-heading font-bold text-2xl text-sidebar mb-6">Contact Information</h3>
                <p className="text-muted-foreground mb-8">
                  Reach out to us through any of the following channels. We typically respond within 24 hours.
                </p>
              </div>

              <div className="space-y-6">
                <Card className="border-none shadow-sm bg-secondary/20">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sidebar mb-1">Our Office</h4>
                      <p className="text-sm text-muted-foreground">
                        123 Spiritual Avenue, Temple Road,<br />
                        Bangalore, Karnataka 560001
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-secondary/20">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Phone size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sidebar mb-1">Phone Support</h4>
                      <p className="text-sm text-muted-foreground">
                        +91 98765 43210<br />
                        +91 80 1234 5678
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-secondary/20">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Mail size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sidebar mb-1">Email Us</h4>
                      <p className="text-sm text-muted-foreground">
                        support@bseva.com<br />
                        bookings@bseva.com
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-secondary/20">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Clock size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sidebar mb-1">Working Hours</h4>
                      <p className="text-sm text-muted-foreground">
                        Mon - Sat: 9:00 AM - 8:00 PM<br />
                        Sun: 10:00 AM - 2:00 PM
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card className="border-none shadow-lg h-full">
                <CardContent className="p-8 md:p-12">
                  <h3 className="font-heading font-bold text-2xl text-sidebar mb-6">Send us a Message</h3>
                  
                  <form className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input id="name" placeholder="Enter your name" className="h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input id="email" type="email" placeholder="Enter your email" className="h-12" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input id="phone" placeholder="Enter your phone number" className="h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input id="subject" placeholder="How can we help you?" className="h-12" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea id="message" placeholder="Tell us more about your requirements..." className="min-h-[150px]" />
                    </div>
                    
                    <Button className="w-full md:w-auto bg-primary text-white hover:bg-primary/90 h-12 px-8 font-bold text-lg">
                      <Send className="mr-2 h-5 w-5" /> Send Message
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section (Placeholder) */}
      <section className="h-[400px] bg-secondary/10 relative flex items-center justify-center">
        <div className="text-center">
          <MapPin size={48} className="text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Map Integration Placeholder</p>
          <p className="text-sm text-muted-foreground/70">123 Spiritual Avenue, Bangalore</p>
        </div>
      </section>
    </Layout>
  );
}
