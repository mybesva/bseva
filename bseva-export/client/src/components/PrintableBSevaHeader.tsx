import BSevaLogo from "@/components/BSevaLogo";

export default function PrintableBSevaHeader({
  documentTitle,
  reference,
}: {
  documentTitle: string;
  reference?: string | null;
}) {
  return (
    <header className="bseva-print-header hidden print:flex items-center justify-between gap-6 border-b-2 border-primary pb-4 mb-5">
      <div>
        <BSevaLogo size="lg" />
      </div>
      <div className="text-right">
        <h1 className="text-xl font-bold text-foreground">{documentTitle}</h1>
        {reference ? <p className="font-mono text-xs mt-1">{reference}</p> : null}
      </div>
    </header>
  );
}
