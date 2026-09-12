import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface ServiceCardProps {
  title: string;
  description: string;
  image: string;
  icon?: React.ReactNode;
  comingSoon?: boolean;
}

export default function ServiceCard({ title, description, image, icon, comingSoon }: ServiceCardProps) {
  return (
    <Card className="group border-none shadow-md hover:shadow-xl transition-all duration-300 bg-card h-full flex flex-col relative overflow-visible min-w-0 w-full">
      {comingSoon && (
        <div className="absolute top-0 right-0 z-30 max-w-[calc(100%-0.5rem)]">
          <div className="bg-amber-500 text-white font-extrabold text-[11px] sm:text-xs uppercase tracking-wider shadow-lg px-3 py-1.5 rounded-bl-lg">
            Coming Soon
          </div>
        </div>
      )}
      {/* Image crops separately; icon sits outside overflow so it is not clipped */}
      <div className="relative min-w-0">
        <div className="relative h-48 overflow-hidden rounded-t-xl">
          <div
            className={`absolute inset-0 transition-colors z-10 ${
              comingSoon ? "bg-amber-950/35" : "bg-sidebar/20 group-hover:bg-sidebar/0"
            }`}
          />
          <img
            src={image}
            alt={title}
            className={`w-full h-full object-cover transform transition-transform duration-700 ${
              comingSoon ? "grayscale-[40%] opacity-90" : "group-hover:scale-110"
            }`}
          />
        </div>
        {icon && (
          <div className="absolute -bottom-6 right-4 sm:right-6 z-20 w-12 h-12 bg-card rounded-full shadow-lg border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            {icon}
          </div>
        )}
      </div>

      <CardHeader className="pt-10 pb-2 px-4 sm:px-6 min-w-0 overflow-hidden">
        <h3
          className="text-base sm:text-lg font-bold leading-snug text-[#1A2B4A] dark:text-primary group-hover:text-primary transition-colors break-words [overflow-wrap:anywhere] hyphens-auto"
          title={title}
        >
          {title}
        </h3>
      </CardHeader>

      <CardContent className="flex-1 px-4 sm:px-6 min-w-0 overflow-hidden">
        <p className="text-muted-foreground text-sm leading-relaxed break-words [overflow-wrap:anywhere]">
          {description}
        </p>
        {comingSoon && (
          <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
            This puja will be available for booking soon.
          </p>
        )}
      </CardContent>

      <CardFooter className="pt-0 pb-6 px-4 sm:px-6">
        {comingSoon ? (
          <span className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            Coming Soon
          </span>
        ) : (
          <Button variant="link" className="p-0 h-auto text-primary font-bold group-hover:translate-x-1 transition-transform">
            Book Now <ArrowRight size={16} className="ml-1" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
