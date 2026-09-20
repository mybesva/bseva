import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDisplayDate } from "@/lib/formatDate";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Star, Eye, CheckCircle, XCircle, ThumbsUp, MessageSquare } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type ReviewRow = {
  id: string;
  customer_name?: string | null;
  priest_name?: string | null;
  puja_type?: string | null;
  stars: number;
  comment?: string | null;
  booking_date?: string | null;
  created_at?: string | null;
  status: "pending" | "approved" | "rejected" | string;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function Reviews() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [selectedReview, setSelectedReview] = useState<ReviewRow | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setReviews(await api<ReviewRow[]>("/admin/reviews"));
    } catch (e: any) {
      toast.error(e.message || "Could not load reviews");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const hay = `${review.customer_name || ""} ${review.priest_name || ""} ${review.puja_type || ""} ${review.comment || ""}`.toLowerCase();
      const matchesSearch = hay.includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || review.status === statusFilter;
      const matchesRating = ratingFilter === "all" || Number(review.stars) === parseInt(ratingFilter, 10);
      return matchesSearch && matchesStatus && matchesRating;
    });
  }, [reviews, searchTerm, statusFilter, ratingFilter]);

  const averageRating =
    reviews.length === 0
      ? "0.0"
      : (reviews.reduce((sum, r) => sum + Number(r.stars || 0), 0) / reviews.length).toFixed(1);

  async function setStatus(review: ReviewRow, action: "approve" | "reject") {
    setBusyId(review.id);
    try {
      const res = await api<{ status: string }>(`/admin/reviews/${review.id}/${action}`, { method: "POST" });
      const next = res.status || (action === "approve" ? "approved" : "rejected");
      setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, status: next } : r)));
      setSelectedReview((cur) => (cur && cur.id === review.id ? { ...cur, status: next } : cur));
      toast.success(action === "approve" ? "Review approved" : "Review rejected");
    } catch (e: any) {
      toast.error(e.message || `Could not ${action} review`);
    } finally {
      setBusyId(null);
    }
  }

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={14}
          className={star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
        />
      ))}
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MessageSquare size={16} /> Total Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{reviews.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Star size={16} /> Average Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{averageRating}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ThumbsUp size={16} /> Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {reviews.filter((r) => r.status === "pending").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle size={16} /> Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {reviews.filter((r) => r.status === "approved").length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search by customer, priest, or puja type..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Ratings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                  <SelectItem value="4">4 Stars</SelectItem>
                  <SelectItem value="3">3 Stars</SelectItem>
                  <SelectItem value="2">2 Stars</SelectItem>
                  <SelectItem value="1">1 Star</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">Loading reviews…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Priest</TableHead>
                    <TableHead>Puja Type</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReviews.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No reviews match these filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredReviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell className="font-medium">{review.customer_name || "—"}</TableCell>
                      <TableCell>{review.priest_name || "—"}</TableCell>
                      <TableCell>{review.puja_type || "—"}</TableCell>
                      <TableCell>{renderStars(Number(review.stars || 0))}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{review.comment || "—"}</TableCell>
                      <TableCell>
                        {formatDisplayDate(review.booking_date || review.created_at || "")}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[review.status] || statusColors.pending}>
                          {String(review.status || "pending").charAt(0).toUpperCase() +
                            String(review.status || "pending").slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedReview(review);
                              setIsViewDialogOpen(true);
                            }}
                          >
                            <Eye size={16} />
                          </Button>
                          {review.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600"
                                disabled={busyId === review.id}
                                onClick={() => void setStatus(review, "approve")}
                              >
                                <CheckCircle size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600"
                                disabled={busyId === review.id}
                                onClick={() => void setStatus(review, "reject")}
                              >
                                <XCircle size={16} />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Review Details</DialogTitle>
            </DialogHeader>
            {selectedReview && (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-lg">{selectedReview.customer_name || "—"}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDisplayDate(selectedReview.booking_date || selectedReview.created_at || "")}
                    </div>
                  </div>
                  <Badge className={statusColors[selectedReview.status] || statusColors.pending}>
                    {String(selectedReview.status || "pending").charAt(0).toUpperCase() +
                      String(selectedReview.status || "pending").slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {renderStars(Number(selectedReview.stars || 0))}
                  <span className="font-medium">{selectedReview.stars}/5</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Priest:</span>
                    <div className="font-medium">{selectedReview.priest_name || "—"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Puja Type:</span>
                    <div className="font-medium">{selectedReview.puja_type || "—"}</div>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">Review:</span>
                  <p className="mt-1 text-foreground">{selectedReview.comment || "—"}</p>
                </div>
                {selectedReview.status === "pending" && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={busyId === selectedReview.id}
                      onClick={() => void setStatus(selectedReview, "approve")}
                    >
                      <CheckCircle size={16} className="mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      disabled={busyId === selectedReview.id}
                      onClick={() => void setStatus(selectedReview, "reject")}
                    >
                      <XCircle size={16} className="mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
