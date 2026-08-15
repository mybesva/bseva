import { useParams } from "wouter";
import Layout from "@/components/Layout";
import BookingWizard from "@/components/BookingWizard";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

export default function Book() {
  const params = useParams();
  const pujaSlug = params.slug as string;

  const { data: pujaType, isLoading } = trpc.services.getPujaBySlug.useQuery({ slug: pujaSlug });

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#F7931E]" />
        </div>
      </Layout>
    );
  }

  if (!pujaType) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Service Not Found</h1>
            <p className="text-gray-600">The requested puja service could not be found.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="bg-sidebar text-sidebar-foreground py-10">
        <div className="container">
          <h1 className="font-heading text-3xl font-bold">{pujaType.name}</h1>
          <p className="text-sidebar-foreground/80 mt-1">Book Standard or Premium · In-person or Virtual</p>
        </div>
      </section>
      <div className="container pb-12">
        <BookingWizard
          pujaTypeId={pujaType.id}
          pujaName={pujaType.name}
          basePrices={{
            standard: pujaType.basePriceStandard,
            premium: pujaType.basePricePremium,
          }}
        />
      </div>
    </Layout>
  );
}
