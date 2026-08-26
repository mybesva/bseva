import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { policyBySlug, useLegalPolicies } from "@/hooks/useLegalPolicies";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function PrivacyPage() {
  const { policies, loading } = useLegalPolicies(["privacy"]);
  const privacy = policyBySlug(policies, "privacy");

  return (
    <Layout>
      <div className="container py-12 max-w-3xl">
        <Button variant="ghost" size="sm" className="mb-6 -ml-2" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="font-heading text-3xl font-bold mb-2">{privacy?.title || "Privacy Policy"}</h1>
        {privacy?.version && (
          <p className="text-sm text-muted-foreground mb-8">Version {privacy.version}</p>
        )}
        {loading && <Skeleton className="h-40 w-full mb-6" />}
        <div className="space-y-6 text-muted-foreground leading-relaxed">
          {(privacy?.points || []).map((s, i) => (
            <section key={i}>
              {s.title ? <h2 className="font-heading text-lg text-foreground mb-2">{s.title}</h2> : null}
              <p>{s.body}</p>
            </section>
          ))}
        </div>
        <p className="mt-12 text-xs text-muted-foreground">© BSeva. All rights reserved.</p>
      </div>
    </Layout>
  );
}
