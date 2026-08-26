import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Check, ChevronLeft, ChevronRight, Star, Loader2, UserCheck, MapPin, LogIn } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

// Tithi calculation helper (simplified - in production use a proper Panchang API)
const getTithiForDate = (date: Date): { tithi: string; paksha: string; nakshatra: string } => {
  const tithis = [
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
    "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
    "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima/Amavasya"
  ];
  const nakshatras = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira",
    "Ardra", "Punarvasu", "Pushya", "Ashlesha", "Magha",
    "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati",
    "Vishakha", "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha",
    "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
    "Uttara Bhadrapada", "Revati"
  ];
  
  // Simplified calculation based on lunar cycle (29.5 days)
  const lunarDay = Math.floor((date.getTime() / (1000 * 60 * 60 * 24)) % 30);
  const tithiIndex = lunarDay % 15;
  const paksha = lunarDay < 15 ? "Shukla Paksha" : "Krishna Paksha";
  const nakshatraIndex = Math.floor((date.getTime() / (1000 * 60 * 60 * 24)) % 27);
  
  return {
    tithi: tithis[tithiIndex],
    paksha,
    nakshatra: nakshatras[nakshatraIndex]
  };
};

interface BookingWizardProps {
  pujaTypeId: number;
  pujaName: string;
  basePrices: {
    essential: number;
    standard: number;
    premium: number;
  };
}

// Updated steps: 1=Package, 2=Details, 3=Review, 4=Payment (removed priest selection)
type BookingStep = 1 | 2 | 3 | 4;
type Tier = "essential" | "standard" | "premium";

interface BookingData {
  tier: Tier;
  bookingDate: Date | undefined;
  bookingTime: string;
  location: string;
  city: string;
  numberOfPeople: number;
  specialInstructions: string;
  selectedPriestId?: number;
  autoAssignedPriest?: {
    priestId: number;
    priestName: string;
    matchScore: number;
    matchReason: string;
  };
  // Guest checkout fields
  isGuestCheckout: boolean;
  guestEmail: string;
  guestPhone: string;
  guestName: string;
}

export default function BookingWizard({ pujaTypeId, pujaName, basePrices }: BookingWizardProps) {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState<BookingStep>(1);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [bookingData, setBookingData] = useState<BookingData>({
    tier: "standard",
    bookingDate: undefined,
    bookingTime: "",
    location: "",
    city: "",
    numberOfPeople: 1,
    specialInstructions: "",
    isGuestCheckout: false,
    guestEmail: "",
    guestPhone: "",
    guestName: "",
  });

  const createBooking = trpc.bookings.create.useMutation();
  const createGuestBooking = trpc.bookings.createGuest.useMutation();
  
  // Auto-assign Pujari query
  const { data: autoAssignedPujari, refetch: refetchAutoAssign, isLoading: isAssigning } = 
    trpc.bookings.autoAssignPujari.useQuery(
      { 
        city: bookingData.city,
        pujaTypeId: pujaTypeId,
        bookingDate: bookingData.bookingDate,
      },
      { 
        enabled: false, // Only fetch when triggered
      }
    );

  // Auto-assign Pujari when moving from step 2 to step 3
  useEffect(() => {
    if (autoAssignedPujari && !bookingData.autoAssignedPriest) {
      setBookingData(prev => ({
        ...prev,
        autoAssignedPriest: autoAssignedPujari ?? undefined,
        selectedPriestId: autoAssignedPujari?.priestId,
      }));
      setIsAutoAssigning(false);
    }
  }, [autoAssignedPujari]);

  const updateBookingData = (field: keyof BookingData, value: any) => {
    setBookingData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = async () => {
    if (currentStep === 2 && bookingData.city) {
      // Auto-assign Pujari before moving to review step
      setIsAutoAssigning(true);
      try {
        const result = await refetchAutoAssign();
        if (result.data) {
          const assignedPriest = result.data;
          setBookingData(prev => ({
            ...prev,
            autoAssignedPriest: assignedPriest ?? undefined,
            selectedPriestId: assignedPriest?.priestId,
          }));
        }
      } catch (error) {
        console.error("Auto-assignment failed:", error);
        toast.error("Could not auto-assign Pujari. Please try again.");
      }
      setIsAutoAssigning(false);
    }
    
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as BookingStep);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as BookingStep);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return bookingData.tier !== undefined;
      case 2:
        return bookingData.bookingDate && bookingData.location && bookingData.city;
      case 3:
        return true; // Review step - always can proceed
      default:
        return false;
    }
  };

  const calculateTotal = () => {
    const basePrice = basePrices[bookingData.tier];
    const platformFee = Math.floor(basePrice * 0.15); // 15% platform fee
    const priestAmount = basePrice - platformFee;
    return { total: basePrice, platformFee, priestAmount };
  };

  const handleSubmitBooking = async () => {
    if (!bookingData.bookingDate) {
      toast.error("Please select a booking date");
      return;
    }

    const { total, platformFee, priestAmount } = calculateTotal();

    try {
      // Guest Checkout
      if (bookingData.isGuestCheckout) {
        if (!bookingData.guestEmail || !bookingData.guestPhone || !bookingData.guestName) {
          toast.error("Please fill in all guest information");
          return;
        }

        const result = await createGuestBooking.mutateAsync({
          pujaTypeId,
          priestId: bookingData.selectedPriestId,
          tier: bookingData.tier,
          bookingDate: bookingData.bookingDate,
          bookingTime: bookingData.bookingTime,
          location: bookingData.location,
          city: bookingData.city,
          numberOfPeople: bookingData.numberOfPeople,
          specialInstructions: bookingData.specialInstructions,
          totalAmount: total,
          platformFee,
          priestAmount,
          samagriIncluded: true,
          guestEmail: bookingData.guestEmail,
          guestPhone: bookingData.guestPhone,
          guestName: bookingData.guestName,
        });

        toast.success("Guest booking created! Check your email for confirmation.");
        setLocation(`/booking-confirmation?number=${result.bookingNumber}&guest=true`);
      } else {
        // Authenticated Checkout
        const result = await createBooking.mutateAsync({
          pujaTypeId,
          priestId: bookingData.selectedPriestId,
          tier: bookingData.tier,
          bookingDate: bookingData.bookingDate,
          bookingTime: bookingData.bookingTime,
          location: bookingData.location,
          city: bookingData.city,
          numberOfPeople: bookingData.numberOfPeople,
          specialInstructions: bookingData.specialInstructions,
          totalAmount: total,
          platformFee,
          priestAmount,
          samagriIncluded: true,
        });

        toast.success("Booking created successfully!");
        setLocation(`/booking-confirmation?number=${result.bookingNumber}`);
      }
    } catch (error) {
      toast.error("Failed to create booking. Please try again.");
      console.error(error);
    }
  };

  const tierDetails = {
    essential: {
      name: "Essential",
      description: "Basic puja with essential rituals",
      features: ["Core mantras & rituals", "Basic samagri included", "1-2 hour duration"],
    },
    standard: {
      name: "Standard",
      description: "Complete puja experience",
      features: ["All essential rituals", "Premium samagri kit", "2-3 hour duration", "Post-puja guidance"],
    },
    premium: {
      name: "Premium",
      description: "Elaborate ceremonial experience",
      features: ["Extended rituals", "Deluxe samagri kit", "3-4 hour duration", "Video recording", "Prasad delivery"],
    },
  };

  const steps = [
    { number: 1, title: "Package" },
    { number: 2, title: "Details" },
    { number: 3, title: "Review" },
    { number: 4, title: "Payment" },
  ];

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  currentStep >= step.number
                    ? "bg-[#F7931E] text-white"
                    : "bg-gray-200 text-gray-500"
                )}
              >
                {currentStep > step.number ? <Check className="w-5 h-5" /> : step.number}
              </div>
              <span className="text-xs mt-1 text-gray-600">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-16 sm:w-24 h-1 mx-2",
                  currentStep > step.number ? "bg-[#F7931E]" : "bg-gray-200"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Package Selection */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-[#1E3A5F]">Select Your Package</h3>
          <RadioGroup
            value={bookingData.tier}
            onValueChange={(value) => updateBookingData("tier", value as Tier)}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {(Object.keys(tierDetails) as Tier[]).map((tier) => (
              <Label
                key={tier}
                htmlFor={tier}
                className={cn(
                  "cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-[#F7931E]",
                  bookingData.tier === tier ? "border-[#F7931E] bg-orange-50" : "border-gray-200"
                )}
              >
                <RadioGroupItem value={tier} id={tier} className="sr-only" />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1E3A5F]">{tierDetails[tier].name}</span>
                    <span className="text-lg font-bold text-[#F7931E]">
                      ₹{(basePrices[tier] / 100).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{tierDetails[tier].description}</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    {tierDetails[tier].features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-1">
                        <Check className="w-3 h-3 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </Label>
            ))}
          </RadioGroup>
        </div>
      )}

      {/* Step 2: Booking Details */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-[#1E3A5F]">Booking Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !bookingData.bookingDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {bookingData.bookingDate ? (
                      format(bookingData.bookingDate, "PPP")
                    ) : (
                      "Select date"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={bookingData.bookingDate}
                    onSelect={(date) => updateBookingData("bookingDate", date)}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              {/* Tithi Display */}
              {bookingData.bookingDate && (
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-sm font-medium text-[#1E3A5F]">Vedic Calendar (Panchang)</p>
                  <div className="mt-1 text-sm text-gray-600">
                    {(() => {
                      const tithi = getTithiForDate(bookingData.bookingDate);
                      return (
                        <>
                          <p><span className="font-medium">Tithi:</span> {tithi.tithi} ({tithi.paksha})</p>
                          <p><span className="font-medium">Nakshatra:</span> {tithi.nakshatra}</p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Preferred Time</Label>
              <Input
                type="time"
                value={bookingData.bookingTime}
                onChange={(e) => updateBookingData("bookingTime", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address *</Label>
            <Textarea
              placeholder="Enter your complete address"
              value={bookingData.location}
              onChange={(e) => updateBookingData("location", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City *</Label>
              <Input
                placeholder="Enter city"
                value={bookingData.city}
                onChange={(e) => updateBookingData("city", e.target.value)}
              />
              <p className="text-xs text-gray-500">
                A Pujari will be automatically assigned based on your city
              </p>
            </div>

            <div className="space-y-2">
              <Label>Number of People</Label>
              <Input
                type="number"
                min={1}
                value={bookingData.numberOfPeople}
                onChange={(e) => updateBookingData("numberOfPeople", parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Special Instructions (Optional)</Label>
            <Textarea
              placeholder="Any specific requirements or preferences..."
              value={bookingData.specialInstructions}
              onChange={(e) => updateBookingData("specialInstructions", e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Step 3: Review & Confirmation */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-[#1E3A5F]">Review Your Booking</h3>
          
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-lg">{pujaName}</h4>
                  <Badge className="mt-1 bg-[#F7931E]">{tierDetails[bookingData.tier].name} Package</Badge>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#F7931E]">
                    ₹{(basePrices[bookingData.tier] / 100).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Date</p>
                  <p className="font-medium">
                    {bookingData.bookingDate ? format(bookingData.bookingDate, "PPP") : "Not selected"}
                  </p>
                  {bookingData.bookingDate && (
                    <p className="text-xs text-orange-600">
                      {getTithiForDate(bookingData.bookingDate).tithi} ({getTithiForDate(bookingData.bookingDate).paksha})
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-gray-500">Time</p>
                  <p className="font-medium">{bookingData.bookingTime || "Flexible"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Location</p>
                  <p className="font-medium">{bookingData.location}</p>
                  <p className="text-sm text-gray-600">{bookingData.city}</p>
                </div>
              </div>

              {/* Auto-Assigned Pujari */}
              <div className="border-t pt-4">
                <p className="text-gray-500 mb-2">Assigned Pujari</p>
                {isAutoAssigning || isAssigning ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Finding the best Pujari for your location...</span>
                  </div>
                ) : bookingData.autoAssignedPriest ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <UserCheck className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[#1E3A5F]">{bookingData.autoAssignedPriest.priestName}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="w-3 h-3" />
                        <span>{bookingData.autoAssignedPriest.matchReason}</span>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700">
                      {bookingData.autoAssignedPriest.matchScore}% Match
                    </Badge>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-700">
                      A Pujari will be assigned based on availability
                    </p>
                  </div>
                )}
              </div>

              {bookingData.specialInstructions && (
                <div className="border-t pt-4">
                  <p className="text-gray-500">Special Instructions</p>
                  <p className="font-medium">{bookingData.specialInstructions}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 4: Payment */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-[#1E3A5F]">Complete Payment</h3>
          
          {/* Login Required Message */}
          {!isAuthenticated && !authLoading && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-orange-100 rounded-full">
                    <LogIn className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-[#1E3A5F] mb-2">Login Required</h4>
                    <p className="text-gray-600 mb-4">
                      Please login to complete your booking. Your booking details will be saved and you can continue after logging in.
                    </p>
                    <Button 
                      onClick={() => {
                        // Save booking data to localStorage before redirecting
                        localStorage.setItem('pendingBooking', JSON.stringify({
                          pujaTypeId,
                          pujaName,
                          bookingData,
                          returnUrl: window.location.pathname
                        }));
                        window.location.href = getLoginUrl();
                      }}
                      className="bg-[#F7931E] hover:bg-[#e8850d]"
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Login to Continue
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Form - Only show when authenticated */}
          {isAuthenticated && (
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Package ({tierDetails[bookingData.tier].name})</span>
                    <span>₹{(basePrices[bookingData.tier] / 100).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Platform Fee (15%)</span>
                    <span>₹{(calculateTotal().platformFee / 100).toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-[#F7931E]">₹{(calculateTotal().total / 100).toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-700 flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Demo Mode: Click "Complete Payment" to create your booking
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>

        {currentStep < 4 ? (
          <Button
            onClick={nextStep}
            disabled={!canProceed() || isAutoAssigning}
            className="bg-[#F7931E] hover:bg-[#e8850d]"
          >
            {isAutoAssigning ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Assigning Pujari...
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        ) : (
          isAuthenticated ? (
            <Button
              onClick={handleSubmitBooking}
              disabled={createBooking.isPending}
              className="bg-[#F7931E] hover:bg-[#e8850d]"
            >
              {createBooking.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Processing...
                </>
              ) : (
                "Complete Payment"
              )}
            </Button>
          ) : (
            <Button
              onClick={() => {
                localStorage.setItem('pendingBooking', JSON.stringify({
                  pujaTypeId,
                  pujaName,
                  bookingData,
                  returnUrl: window.location.pathname
                }));
                window.location.href = getLoginUrl();
              }}
              className="bg-[#F7931E] hover:bg-[#e8850d]"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Login to Book
            </Button>
          )
        )}
      </div>
    </div>
  );
}
