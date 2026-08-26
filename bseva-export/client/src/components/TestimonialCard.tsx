import { Card, CardContent } from "@/components/ui/card";
import { Quote, Star } from "lucide-react";

interface TestimonialCardProps {
  name: string;
  location: string;
  text: string;
  rating?: number;
  image?: string;
}

export default function TestimonialCard({ name, location, text, rating = 5, image }: TestimonialCardProps) {
  return (
    <Card className="border-none shadow-sm bg-secondary/30 relative overflow-visible mt-8">
      <div className="absolute -top-6 left-8 bg-primary text-white p-3 rounded-full shadow-md">
        <Quote size={20} fill="currentColor" />
      </div>
      
      <CardContent className="pt-12 pb-8 px-8">
        <div className="flex gap-1 mb-4 text-accent">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={16} fill={i < rating ? "currentColor" : "none"} className={i < rating ? "" : "text-muted-foreground/30"} />
          ))}
        </div>
        
        <p className="text-sidebar/80 italic mb-6 leading-relaxed">
          "{text}"
        </p>
        
        <div className="flex items-center gap-4">
          {image ? (
            <img src={image} alt={name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-sidebar/10 flex items-center justify-center text-sidebar font-bold text-lg">
              {name.charAt(0)}
            </div>
          )}
          <div>
            <h4 className="font-heading font-bold text-sidebar">{name}</h4>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{location}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
