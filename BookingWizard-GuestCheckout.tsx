/**
 * GUEST CHECKOUT IMPLEMENTATION GUIDE
 * 
 * This file shows the changes needed to support guest checkout in BookingWizard.tsx
 * 
 * Key Changes:
 * 1. Add guest fields to BookingData interface
 * 2. Add guest checkout mutation (trpc.bookings.createGuest)
 * 3. Update payment step to show guest checkout option
 * 4. Add guest information form (email, phone, name)
 * 5. Update handleSubmitBooking to support both authenticated and guest checkout
 */

// ============================================================================
// 1. UPDATE BookingData INTERFACE (add these fields)
// ============================================================================

interface BookingData {
  // ... existing fields ...
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
  
  // NEW: Guest checkout fields
  isGuestCheckout: boolean;
  guestEmail: string;
  guestPhone: string;
  guestName: string;
}

// ============================================================================
// 2. ADD GUEST CHECKOUT MUTATION (in the component)
// ============================================================================

// Inside BookingWizard component, add:
const createBooking = trpc.bookings.create.useMutation();
const createGuestBooking = trpc.bookings.createGuest.useMutation(); // NEW

// ============================================================================
// 3. UPDATE INITIAL STATE (in useState)
// ============================================================================

const [bookingData, setBookingData] = useState<BookingData>({
  tier: "standard",
  bookingDate: undefined,
  bookingTime: "",
  location: "",
  city: "",
  numberOfPeople: 1,
  specialInstructions: "",
  // NEW: Initialize guest fields
  isGuestCheckout: false,
  guestEmail: "",
  guestPhone: "",
  guestName: "",
});

// ============================================================================
// 4. UPDATE PAYMENT STEP (replace the existing Step 4 section)
// ============================================================================

// Replace this section in the JSX:
{/* Step 4: Payment */}
{currentStep === 4 && (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-[#1E3A5F]">Complete Payment</h3>
    
    {/* Option Selection: Login vs Guest Checkout */}
    {!isAuthenticated && !authLoading && (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <h4 className="font-semibold text-[#1E3A5F]">How would you like to proceed?</h4>
            
            {/* Option 1: Login */}
            <div
              onClick={() => {
                setBookingData(prev => ({ ...prev, isGuestCheckout: false }));
                localStorage.setItem('pendingBooking', JSON.stringify({
                  pujaTypeId,
                  pujaName,
                  bookingData,
                  returnUrl: window.location.pathname
                }));
                window.location.href = getLoginUrl();
              }}
              className="p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-[#F7931E] hover:bg-orange-50 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <LogIn className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#1E3A5F]">Login to Your Account</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Sign in to access your bookings, saved preferences, and account features
                  </p>
                </div>
              </div>
            </div>

            {/* Option 2: Guest Checkout */}
            <div
              onClick={() => setBookingData(prev => ({ ...prev, isGuestCheckout: true }))}
              className="p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-[#F7931E] hover:bg-orange-50 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#1E3A5F]">Continue as Guest</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Complete your booking without creating an account. You can link your account later
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )}

    {/* Guest Checkout Form */}
    {bookingData.isGuestCheckout && !isAuthenticated && (
      <Card>
        <CardHeader>
          <CardTitle>Guest Booking Details</CardTitle>
          <CardDescription>
            We'll use this information to confirm your booking and send updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guestName">Full Name *</Label>
            <Input
              id="guestName"
              placeholder="Your full name"
              value={bookingData.guestName}
              onChange={(e) => updateBookingData("guestName", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guestEmail">Email Address *</Label>
            <Input
              id="guestEmail"
              type="email"
              placeholder="your.email@example.com"
              value={bookingData.guestEmail}
              onChange={(e) => updateBookingData("guestEmail", e.target.value)}
              required
            />
            <p className="text-xs text-gray-500">
              We'll send your booking confirmation and updates to this email
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="guestPhone">Phone Number *</Label>
            <Input
              id="guestPhone"
              type="tel"
              placeholder="+91 98765 43210"
              value={bookingData.guestPhone}
              onChange={(e) => updateBookingData("guestPhone", e.target.value)}
              required
            />
            <p className="text-xs text-gray-500">
              We'll use this to confirm your booking and send reminders
            </p>
          </div>

          {/* Payment Summary */}
          <div className="space-y-2 pt-4 border-t">
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

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700 flex items-center gap-2">
              <Check className="w-4 h-4" />
              Demo Mode: Click "Complete Booking" to create your guest booking
            </p>
          </div>
        </CardContent>
      </Card>
    )}

    {/* Authenticated Payment Form */}
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

// ============================================================================
// 5. UPDATE handleSubmitBooking FUNCTION
// ============================================================================

// Replace the existing handleSubmitBooking function with:
const handleSubmitBooking = async () => {
  try {
    // Validate required fields
    if (!bookingData.bookingDate) {
      toast.error("Please select a booking date");
      return;
    }
    if (!bookingData.location || !bookingData.city) {
      toast.error("Please enter your location and city");
      return;
    }

    const totals = calculateTotal();

    // Guest Checkout
    if (bookingData.isGuestCheckout) {
      if (!bookingData.guestEmail || !bookingData.guestPhone || !bookingData.guestName) {
        toast.error("Please fill in all guest information");
        return;
      }

      const result = await createGuestBooking.mutateAsync({
        pujaTypeId,
        priestId: bookingData.autoAssignedPriest?.priestId,
        tier: bookingData.tier,
        bookingDate: bookingData.bookingDate,
        bookingTime: bookingData.bookingTime,
        location: bookingData.location,
        city: bookingData.city,
        specialInstructions: bookingData.specialInstructions,
        totalAmount: totals.total,
        platformFee: totals.platformFee,
        priestAmount: totals.priestAmount,
        samagriIncluded: true,
        numberOfPeople: bookingData.numberOfPeople,
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
        priestId: bookingData.autoAssignedPriest?.priestId,
        tier: bookingData.tier,
        bookingDate: bookingData.bookingDate,
        bookingTime: bookingData.bookingTime,
        location: bookingData.location,
        city: bookingData.city,
        specialInstructions: bookingData.specialInstructions,
        totalAmount: totals.total,
        platformFee: totals.platformFee,
        priestAmount: totals.priestAmount,
        samagriIncluded: true,
        numberOfPeople: bookingData.numberOfPeople,
      });

      toast.success("Booking created successfully!");
      setLocation(`/booking-confirmation?number=${result.bookingNumber}`);
    }
  } catch (error) {
    toast.error("Failed to create booking. Please try again.");
    console.error(error);
  }
};

// ============================================================================
// 6. UPDATE canProceed FUNCTION (if it exists)
// ============================================================================

// Make sure guest checkout fields are validated:
const canProceed = () => {
  if (currentStep === 1) return true;
  if (currentStep === 2) {
    return bookingData.bookingDate && bookingData.location && bookingData.city;
  }
  if (currentStep === 3) return true;
  if (currentStep === 4) {
    if (isAuthenticated) return true;
    if (bookingData.isGuestCheckout) {
      return bookingData.guestEmail && bookingData.guestPhone && bookingData.guestName;
    }
    return false;
  }
  return false;
};

// ============================================================================
// 7. UPDATE NAVIGATION BUTTONS (Complete Payment button)
// ============================================================================

// Replace the Complete Payment button section with:
{currentStep === 4 ? (
  <>
    {bookingData.isGuestCheckout && !isAuthenticated ? (
      <Button
        onClick={handleSubmitBooking}
        disabled={
          createGuestBooking.isPending ||
          !bookingData.guestEmail ||
          !bookingData.guestPhone ||
          !bookingData.guestName
        }
        className="bg-[#F7931E] hover:bg-[#e8850d]"
      >
        {createGuestBooking.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            Processing...
          </>
        ) : (
          "Complete Booking"
        )}
      </Button>
    ) : isAuthenticated ? (
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
    ) : null}
  </>
) : (
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
)}
