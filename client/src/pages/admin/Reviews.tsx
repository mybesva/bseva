import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useState } from "react";

// Sample reviews data
const sampleReviews = [
  {
    id: 1,
    customerName: "Rajesh Kumar",
    priestName: "Pandit Sharma",
    pujaType: "Satyanarayan Puja",
    rating: 5,
    review: "Excellent service! Pandit ji conducted the puja with great devotion and explained every ritual beautifully. Highly recommended for anyone looking for authentic puja services.",
    date: "2024-12-15",
    status: "approved",
  },
  {
    id: 2,
    customerName: "Priya Patel",
    priestName: "Pandit Verma",
    pujaType: "Griha Pravesh",
    rating: 4,
    review: "Good experience overall. The puja was conducted properly. Only minor issue was the timing delay, but everything else was perfect.",
    date: "2024-12-14",
    status: "pending",
  },
  {
    id: 3,
    customerName: "Amit Singh",
    priestName: "Pandit Mishra",
    pujaType: "Navagraha Shanti",
    rating: 5,
    review: "Very knowledgeable pandit. He explained the significance of each graha and the mantras. The whole family felt blessed after the puja.",
    date: "2024-12-10",
    status: "approved",
  },
  {
    id: 4,
    customerName: "Sunita Devi",
    priestName: "Pandit Joshi",
    pujaType: "Lakshmi Puja",
    rating: 3,
    review: "Average experience. The puja was okay but I expected more detailed rituals for the price paid.",
    date: "2024-12-08",
    status: "pending",
  },
  {
    id: 5,
    customerName: "Vikram Reddy",
    priestName: "Pandit Rao",
    pujaType: "Vastu Shanti",
    rating: 5,
    review: "Outstanding! Pandit Rao is very experienced and his knowledge of Vastu is exceptional. Our new home feels blessed now.",
    date: "2024-12-05",
    status: "approved",
  },
];

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function Reviews() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [selectedReview, setSelectedReview] = useState<typeof sampleReviews[0] | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const filteredReviews = sampleReviews.filter((review) => {
    const matchesSearch =
      review.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.priestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.pujaType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || review.status === statusFilter;
    const matchesRating = ratingFilter === "all" || review.rating === parseInt(ratingFilter);
    return matchesSearch && matchesStatus && matchesRating;
  });

  const averageRating = (sampleReviews.reduce((sum, r) => sum + r.rating, 0) / sampleReviews.length).toFixed(1);

  const handleViewReview = (review: typeof sampleReviews[0]) => {
    setSelectedReview(review);
    setIsViewDialogOpen(true);
  };

  const renderStars = (rating: number) => {
    return (
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
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reviews Management</h1>
            <p className="text-muted-foreground">Moderate and manage customer reviews</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MessageSquare size={16} /> Total Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sampleReviews.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Star size={16} /> Average Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {averageRating}
                <Star size={20} className="fill-yellow-400 text-yellow-400" />
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
              <div className="text-2xl font-bold text-green-600">
                {sampleReviews.filter(r => r.status === "approved").length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ThumbsUp size={16} /> Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {sampleReviews.filter(r => r.status === "pending").length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search by customer, priest, or puja type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={ratingFilter} onValueChange={setRatingFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Rating" />
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

        {/* Reviews Table */}
        <Card>
          <CardContent className="p-0">
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-medium">{review.customerName}</TableCell>
                    <TableCell>{review.priestName}</TableCell>
                    <TableCell>{review.pujaType}</TableCell>
                    <TableCell>{renderStars(review.rating)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{review.review}</TableCell>
                    <TableCell>{review.date}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[review.status]}>
                        {review.status.charAt(0).toUpperCase() + review.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewReview(review)}
                        >
                          <Eye size={16} />
                        </Button>
                        {review.status === "pending" && (
                          <>
                            <Button variant="ghost" size="icon" className="text-green-600">
                              <CheckCircle size={16} />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-red-600">
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
          </CardContent>
        </Card>

        {/* View Review Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Review Details</DialogTitle>
            </DialogHeader>
            {selectedReview && (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-lg">{selectedReview.customerName}</div>
                    <div className="text-sm text-muted-foreground">{selectedReview.date}</div>
                  </div>
                  <Badge className={statusColors[selectedReview.status]}>
                    {selectedReview.status.charAt(0).toUpperCase() + selectedReview.status.slice(1)}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  {renderStars(selectedReview.rating)}
                  <span className="font-medium">{selectedReview.rating}/5</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Priest:</span>
                    <div className="font-medium">{selectedReview.priestName}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Puja Type:</span>
                    <div className="font-medium">{selectedReview.pujaType}</div>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground text-sm">Review:</span>
                  <p className="mt-1 text-foreground">{selectedReview.review}</p>
                </div>

                {selectedReview.status === "pending" && (
                  <div className="flex gap-2 pt-4">
                    <Button className="flex-1 bg-green-600 hover:bg-green-700">
                      <CheckCircle size={16} className="mr-2" />
                      Approve
                    </Button>
                    <Button variant="destructive" className="flex-1">
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
