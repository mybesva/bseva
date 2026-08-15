import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface ServiceCardProps {
  title: string;
  description: string;
  image: string;
  icon?: React.ReactNode;
}

export default function ServiceCard({ title, description, image, icon }: ServiceCardProps) {
  return (
    <Card className="group overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 bg-white h-full flex flex-col">
      <div className="relative h-48 overflow-hidden">
        <div className="absolute inset-0 bg-sidebar/20 group-hover:bg-sidebar/0 transition-colors z-10" />
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
        />
        {icon && (
          <div className="absolute -bottom-6 right-6 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-primary z-20 group-hover:scale-110 transition-transform">
            {icon}
          </div>
        )}
      </div>
      
      <CardHeader className="pt-10 pb-2">
        <h3 className="font-heading font-bold text-xl text-sidebar group-hover:text-primary transition-colors">
          {title}
        </h3>
      </CardHeader>
      
      <CardContent className="flex-1">
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </CardContent>
      
      <CardFooter className="pt-0 pb-6">
        <Button variant="link" className="p-0 h-auto text-primary font-bold group-hover:translate-x-1 transition-transform">
          Book Now <ArrowRight size={16} className="ml-1" />
        </Button>
      </CardFooter>
    </Card>
  );
}
