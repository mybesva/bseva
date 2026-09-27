import AboutPageContent from "@/components/AboutPageContent";
import AdminLayout from "@/components/AdminLayout";
import CustomerLayout from "@/components/CustomerLayout";
import Layout from "@/components/Layout";
import PujariLayout from "@/components/PujariLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/_core/hooks/useAuth";
import type { ReactNode } from "react";

function AboutShell({ children }: { children: ReactNode }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Layout>{children}</Layout>;
  }

  if (user.role === "customer") {
    return <CustomerLayout>{children}</CustomerLayout>;
  }

  if (user.role === "priest") {
    return <PujariLayout>{children}</PujariLayout>;
  }

  if (user.role === "admin" || user.role === "super_admin") {
    return <AdminLayout>{children}</AdminLayout>;
  }

  return <Layout>{children}</Layout>;
}

export default function About() {
  return (
    <AboutShell>
      <AboutPageContent />
    </AboutShell>
  );
}
