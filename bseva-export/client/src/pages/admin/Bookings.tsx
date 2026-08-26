import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, rupees } from "@/lib/api";
import { toast } from "sonner";

export default function Bookings() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    api<any[]>("/bookings").then(setRows).catch((e) => toast.error(e.message));
  }, []);

  return (
    <AdminLayout>
      <h1 className="text-2xl font-heading font-bold mb-4">Bookings</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Pujari</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => (
            <TableRow key={b.id}>
              <TableCell>{b.booking_number}</TableCell>
              <TableCell>{b.service_name}</TableCell>
              <TableCell>{b.customer_name}</TableCell>
              <TableCell>{b.pujari_name}</TableCell>
              <TableCell>{b.booking_date} {b.start_time}</TableCell>
              <TableCell>{rupees(b.total_paise)}</TableCell>
              <TableCell><Badge>{b.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminLayout>
  );
}
