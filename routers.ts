import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { nanoid } from "nanoid";
import { createOTP, verifyOTP, resendOTP, isBookingOTPVerified } from "./services/otpService";
import { sendBookingConfirmationEmail, sendOTPEmail } from "./services/emailService";

/**
 * ============================================================================
 * SERVICES & PUJAS ROUTER
 * ============================================================================
 */

const servicesRouter = router({
  // Get all service categories
  getCategories: publicProcedure.query(async () => {
    return await db.getAllServiceCategories();
  }),

  // Get pujas by category
  getPujasByCategory: publicProcedure
    .input(z.object({ categoryId: z.number() }))
    .query(async ({ input }) => {
      return await db.getPujaTypesByCategory(input.categoryId);
    }),

  // Get puja details by slug
  getPujaBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      return await db.getPujaTypeBySlug(input.slug);
    }),

  // Search pujas
  searchPujas: publicProcedure
    .input(z.object({ searchTerm: z.string() }))
    .query(async ({ input }) => {
      return await db.searchPujas(input.searchTerm);
    }),

  // Get samagri for a puja
  getSamagri: publicProcedure
    .input(z.object({
      pujaTypeId: z.number(),
      tier: z.enum(["essential", "standard", "premium"]),
    }))
    .query(async ({ input }) => {
      return await db.getSamagriForPuja(input.pujaTypeId, input.tier);
    }),
});

/**
 * ============================================================================
 * PRIESTS ROUTER
 * ============================================================================
 */

const priestsRouter = router({
  // Get all priests
  getAll: publicProcedure
    .input(z.object({
      isVerified: z.boolean().optional(),
      availabilityStatus: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return await db.getAllPriests(input);
    }),

  // Get priest profile
  getProfile: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const user = await db.getUserById(input.userId);
      const profile = await db.getPriestProfile(input.userId);
      return { user, profile };
    }),

  // Get priest reviews
  getReviews: publicProcedure
    .input(z.object({ priestId: z.number() }))
    .query(async ({ input }) => {
      return await db.getReviewsByPriest(input.priestId);
    }),
});

/**
 * ============================================================================
 * BOOKINGS ROUTER
 * ============================================================================
 */

const bookingsRouter = router({
  // Create a new booking
  create: protectedProcedure
    .input(z.object({
      pujaTypeId: z.number(),
      priestId: z.number().optional(),
      tier: z.enum(["essential", "standard", "premium"]),
      bookingDate: z.date(),
      bookingTime: z.string().optional(),
      location: z.string(),
      city: z.string().optional(),
      specialInstructions: z.string().optional(),
      totalAmount: z.number(),
      platformFee: z.number(),
      priestAmount: z.number(),
      samagriIncluded: z.boolean().default(true),
      numberOfPeople: z.number().default(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const bookingNumber = `BSV-${nanoid(10)}`.toUpperCase();
      
      await db.createBooking({
        bookingNumber,
        customerId: ctx.user.id,
        priestId: input.priestId || null,
        pujaTypeId: input.pujaTypeId,
        tier: input.tier,
        bookingDate: input.bookingDate,
        bookingTime: input.bookingTime,
        location: input.location,
        city: input.city,
        specialInstructions: input.specialInstructions,
        status: "pending",
        totalAmount: input.totalAmount,
        platformFee: input.platformFee,
        priestAmount: input.priestAmount,
        samagriIncluded: input.samagriIncluded,
        numberOfPeople: input.numberOfPeople,
      });

      return { success: true, bookingNumber };
    }),

  // Create a guest booking (no authentication required)
  createGuest: publicProcedure
    .input(z.object({
      pujaTypeId: z.number(),
      priestId: z.number().optional(),
      tier: z.enum(["essential", "standard", "premium"]),
      bookingDate: z.date(),
      bookingTime: z.string().optional(),
      location: z.string(),
      city: z.string().optional(),
      specialInstructions: z.string().optional(),
      totalAmount: z.number(),
      platformFee: z.number(),
      priestAmount: z.number(),
      samagriIncluded: z.boolean().default(true),
      numberOfPeople: z.number().default(1),
      guestEmail: z.string().email(),
      guestPhone: z.string().min(10),
      guestName: z.string().min(2),
    }))
    .mutation(async ({ input }) => {
      const bookingNumber = `BSV-${nanoid(10)}`.toUpperCase();
      const verificationToken = nanoid(32);
      
      // Create booking without customerId (guest booking)
      const result = await db.createBooking({
        bookingNumber,
        customerId: null,
        priestId: input.priestId || null,
        pujaTypeId: input.pujaTypeId,
        tier: input.tier,
        bookingDate: input.bookingDate,
        bookingTime: input.bookingTime,
        location: input.location,
        city: input.city,
        specialInstructions: input.specialInstructions,
        status: "pending",
        totalAmount: input.totalAmount,
        platformFee: input.platformFee,
        priestAmount: input.priestAmount,
        samagriIncluded: input.samagriIncluded,
        numberOfPeople: input.numberOfPeople,
        guestEmail: input.guestEmail,
        guestPhone: input.guestPhone,
        guestName: input.guestName,
        isGuestBooking: true,
      });

      // Get the booking ID from the insert result
      const bookingId = (result as any).insertId || result[0];

      // Create guest booking tracking record
      await db.createGuestBooking(
        bookingId,
        input.guestEmail,
        input.guestPhone,
        input.guestName,
        verificationToken
      );

      // TODO: Send verification email with link to create account
      // await sendGuestVerificationEmail(input.guestEmail, verificationToken, bookingNumber);

      return { success: true, bookingNumber, isGuest: true };
    }),

  // Get customer's bookings
  getMyBookings: protectedProcedure.query(async ({ ctx }) => {
    return await db.getBookingsByCustomer(ctx.user.id);
  }),

  // Auto-assign best matching Pujari based on location (public - needed before login)
  autoAssignPujari: publicProcedure
    .input(z.object({
      city: z.string(),
      state: z.string().optional(),
      pujaTypeId: z.number().optional(),
      bookingDate: z.date().optional(),
    }))
    .query(async ({ input }) => {
      const match = await db.findBestMatchingPujari(
        input.city,
        input.state,
        input.pujaTypeId,
        input.bookingDate
      );
      return match;
    }),

  // Get Pujari suggestions for booking (public - needed before login)
  getPujariSuggestions: publicProcedure
    .input(z.object({
      city: z.string(),
      state: z.string().optional(),
      limit: z.number().default(3),
    }))
    .query(async ({ input }) => {
      return await db.getPujariSuggestions(input.city, input.state, input.limit);
    }),

  // Get booking details
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getBookingById(input.id);
    }),

  // Update booking status (admin/priest only)
  updateStatus: protectedProcedure
    .input(z.object({
      bookingId: z.number(),
      status: z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled", "refunded"]),
    }))
    .mutation(async ({ input }) => {
      await db.updateBookingStatus(input.bookingId, input.status);
      return { success: true };
    }),

  // Send OTP for booking confirmation
  sendOTP: protectedProcedure
    .input(z.object({
      bookingId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const booking = await db.getBookingById(input.bookingId);
      if (!booking) {
        throw new Error("Booking not found");
      }
      
      const phone = ctx.user.phone || "";
      const email = ctx.user.email || "";
      
      const { otp, expiresAt } = await createOTP(input.bookingId, phone);
      
      // Send OTP via email (in production, also send via SMS)
      if (email) {
        await sendOTPEmail(ctx.user.name || "Customer", email, otp);
      }
      
      console.log(`[OTP] Booking ${input.bookingId}: ${otp} (expires: ${expiresAt})`);
      
      return { 
        success: true, 
        message: "OTP sent to your registered email/phone",
        expiresAt 
      };
    }),

  // Verify OTP for booking confirmation
  verifyOTP: protectedProcedure
    .input(z.object({
      bookingId: z.number(),
      otp: z.string().length(6),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await verifyOTP(input.bookingId, input.otp);
      
      if (result.success) {
        // Update booking status to confirmed
        await db.updateBookingStatus(input.bookingId, "confirmed");
        
        // Send confirmation email
        const bookingData = await db.getBookingById(input.bookingId);
        if (bookingData && ctx.user.email) {
          const { booking, pujaType } = bookingData;
          
          await sendBookingConfirmationEmail({
            customerName: ctx.user.name || "Customer",
            customerEmail: ctx.user.email,
            bookingNumber: booking.bookingNumber,
            pujaName: pujaType?.name || "Puja",
            packageTier: booking.tier,
            bookingDate: booking.bookingDate?.toLocaleDateString() || "",
            bookingTime: booking.bookingTime || "",
            location: booking.location || "",
            city: booking.city || "",
            totalAmount: booking.totalAmount || 0,
          });
        }
      }
      
      return result;
    }),

  // Resend OTP
  resendOTP: protectedProcedure
    .input(z.object({
      bookingId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const phone = ctx.user.phone || "";
      const result = await resendOTP(input.bookingId, phone);
      
      if (result.success && result.otp && ctx.user.email) {
        await sendOTPEmail(ctx.user.name || "Customer", ctx.user.email, result.otp);
      }
      
      return { success: result.success, message: result.message };
    }),

  // Check if booking OTP is verified
  checkOTPStatus: protectedProcedure
    .input(z.object({
      bookingId: z.number(),
    }))
    .query(async ({ input }) => {
      const isVerified = await isBookingOTPVerified(input.bookingId);
      return { isVerified };
    }),
});

/**
 * ============================================================================
 * PAYMENTS ROUTER
 * ============================================================================
 */

const paymentsRouter = router({
  // Create payment record
  create: protectedProcedure
    .input(z.object({
      bookingId: z.number(),
      amount: z.number(),
      paymentMethod: z.string(),
      transactionId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.createPayment({
        bookingId: input.bookingId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        transactionId: input.transactionId,
        status: "pending",
      });

      return { success: true };
    }),

  // Get payment by booking
  getByBooking: protectedProcedure
    .input(z.object({ bookingId: z.number() }))
    .query(async ({ input }) => {
      return await db.getPaymentByBookingId(input.bookingId);
    }),

  // Update payment status
  updateStatus: protectedProcedure
    .input(z.object({
      paymentId: z.number(),
      status: z.enum(["pending", "processing", "completed", "failed", "refunded"]),
    }))
    .mutation(async ({ input }) => {
      await db.updatePaymentStatus(input.paymentId, input.status);
      return { success: true };
    }),
});

/**
 * ============================================================================
 * REVIEWS ROUTER
 * ============================================================================
 */

const reviewsRouter = router({
  // Create a review
  create: protectedProcedure
    .input(z.object({
      bookingId: z.number(),
      priestId: z.number(),
      rating: z.number().min(1).max(5),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.createReview({
        bookingId: input.bookingId,
        customerId: ctx.user.id,
        priestId: input.priestId,
        rating: input.rating,
        comment: input.comment,
        isVerified: true,
        isVisible: true,
      });

      return { success: true };
    }),

  // Get reviews for a priest
  getByPriest: publicProcedure
    .input(z.object({ priestId: z.number() }))
    .query(async ({ input }) => {
      return await db.getReviewsByPriest(input.priestId);
    }),
});

/**
 * ============================================================================
 * TEMPLES ROUTER
 * ============================================================================
 */

const templesRouter = router({
  // Get all temples
  getAll: publicProcedure
    .input(z.object({ city: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return await db.getAllTemples(input?.city);
    }),

  // Get temple by ID
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getTempleById(input.id);
    }),
});

/**
 * ============================================================================
 * AUSPICIOUS DATES ROUTER
 * ============================================================================
 */

const auspiciousDatesRouter = router({
  // Get auspicious dates in a range
  getInRange: publicProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ input }) => {
      return await db.getAuspiciousDates(input.startDate, input.endDate);
    }),
});

/**
 * ============================================================================
 * NOTIFICATIONS ROUTER
 * ============================================================================
 */

const notificationsRouter = router({
  // Get user notifications
  getMy: protectedProcedure
    .input(z.object({ unreadOnly: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      return await db.getUserNotifications(ctx.user.id, input.unreadOnly);
    }),

  // Mark notification as read
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ input }) => {
      await db.markNotificationAsRead(input.notificationId);
      return { success: true };
    }),
});

/**
 * ============================================================================
 * ADMIN ROUTER
 * ============================================================================
 */

const adminRouter = router({
  // Get dashboard statistics
  getDashboardStats: protectedProcedure.query(async () => {
    const totalCustomers = await db.getTotalCustomers();
    const activePriests = await db.getActivePriests();
    const totalBookings = await db.getTotalBookings();
    const monthlyRevenue = await db.getMonthlyRevenue();
    const recentBookings = await db.getRecentBookings(5);
    const topPriests = await db.getTopPriests(5);
    
    return {
      totalCustomers,
      activePriests,
      totalBookings,
      monthlyRevenue,
      recentBookings,
      topPriests,
    };
  }),

  // Customer Management
  getCustomers: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return await db.adminGetAllCustomers(input.search, input.status);
    }),

  createCustomer: protectedProcedure
    .input(z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string(),
      city: z.string(),
      state: z.string(),
      pincode: z.string(),
      gotra: z.string().optional(),
      nakshatra: z.string().optional(),
      rashi: z.string().optional(),
      preferredLanguage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await db.adminCreateCustomer(input);
    }),

  updateCustomer: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email(),
      phone: z.string(),
      city: z.string(),
      state: z.string(),
      pincode: z.string(),
      gotra: z.string().optional(),
      nakshatra: z.string().optional(),
      rashi: z.string().optional(),
      preferredLanguage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await db.adminUpdateCustomer(input.id, input);
    }),

  deleteCustomer: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await db.adminDeleteCustomer(input.id);
    }),

  // Priest Management
  getPriests: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      verified: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      return await db.adminGetAllPriests(input.search, input.verified);
    }),

  createPriest: protectedProcedure
    .input(z.object({
      name: z.string(),
      email: z.string().email(),
      phone: z.string(),
      city: z.string(),
      state: z.string(),
      experience: z.number(),
      languages: z.array(z.string()),
      specializations: z.array(z.string()),
      bio: z.string().optional(),
      basePrice: z.number(),
    }))
    .mutation(async ({ input }) => {
      return await db.adminCreatePriest(input);
    }),

  updatePriest: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email(),
      phone: z.string(),
      city: z.string(),
      state: z.string(),
      experience: z.number(),
      languages: z.array(z.string()),
      specializations: z.array(z.string()),
      bio: z.string().optional(),
      basePrice: z.number(),
      isVerified: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      return await db.adminUpdatePriest(input.id, input);
    }),

  deletePriest: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await db.adminDeletePriest(input.id);
    }),

  // Temple Management
  getTemples: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return await db.adminGetAllTemples(input.search);
    }),

  createTemple: protectedProcedure
    .input(z.object({
      name: z.string(),
      deity: z.string().optional(),
      address: z.string(),
      city: z.string(),
      state: z.string(),
      pincode: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().email().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await db.adminCreateTemple(input);
    }),

  updateTemple: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string(),
      deity: z.string().optional(),
      address: z.string(),
      city: z.string(),
      state: z.string(),
      pincode: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().email().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return await db.adminUpdateTemple(input.id, input);
    }),

  deleteTemple: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await db.adminDeleteTemple(input.id);
    }),

  // Service/Puja Management
  getServices: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      categoryId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return await db.adminGetAllServices(input.search, input.categoryId);
    }),

  createService: protectedProcedure
    .input(z.object({
      categoryId: z.number(),
      name: z.string(),
      slug: z.string(),
      shortDescription: z.string().optional(),
      fullDescription: z.string().optional(),
      estimatedDuration: z.number(),
      basePriceEssential: z.number(),
      basePriceStandard: z.number(),
      basePricePremium: z.number(),
    }))
    .mutation(async ({ input }) => {
      return await db.adminCreateService(input);
    }),

  updateService: protectedProcedure
    .input(z.object({
      id: z.number(),
      categoryId: z.number(),
      name: z.string(),
      slug: z.string(),
      shortDescription: z.string().optional(),
      fullDescription: z.string().optional(),
      estimatedDuration: z.number(),
      basePriceEssential: z.number(),
      basePriceStandard: z.number(),
      basePricePremium: z.number(),
    }))
    .mutation(async ({ input }) => {
      return await db.adminUpdateService(input.id, input);
    }),

  deleteService: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await db.adminDeleteService(input.id);
    }),

  // Booking Management
  getBookings: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return await db.adminGetAllBookings(input.search, input.status);
    }),

  updateBookingStatus: protectedProcedure
    .input(z.object({
      bookingId: z.number(),
      status: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await db.adminUpdateBookingStatus(input.bookingId, input.status);
    }),

  // Analytics Endpoints
  getPujariAnalytics: protectedProcedure
    .input(z.object({ dateRange: z.string().default('last_30_days') }))
    .query(async ({ input }) => {
      return await db.getPujariAnalytics(input.dateRange);
    }),

  getCustomerAnalytics: protectedProcedure
    .input(z.object({ dateRange: z.string().default('last_30_days') }))
    .query(async ({ input }) => {
      return await db.getCustomerAnalytics(input.dateRange);
    }),

  getTempleAnalytics: protectedProcedure
    .input(z.object({ dateRange: z.string().default('last_30_days') }))
    .query(async ({ input }) => {
      return await db.getTempleAnalytics(input.dateRange);
    }),

  getServiceAnalytics: protectedProcedure
    .input(z.object({ dateRange: z.string().default('last_30_days') }))
    .query(async ({ input }) => {
      return await db.getServiceAnalytics(input.dateRange);
    }),

  getSamagriAnalytics: protectedProcedure
    .query(async () => {
      return await db.getSamagriAnalytics();
    }),

  getBookingAnalytics: protectedProcedure
    .input(z.object({ dateRange: z.string().default('last_30_days') }))
    .query(async ({ input }) => {
      return await db.getBookingAnalytics(input.dateRange);
    }),

  getPaymentAnalytics: protectedProcedure
    .input(z.object({ dateRange: z.string().default('last_30_days') }))
    .query(async ({ input }) => {
      return await db.getPaymentAnalytics(input.dateRange);
    }),
});

/**
 * ============================================================================
 * CATEGORY MASTER ROUTER
 * ============================================================================
 */

const categoryRouter = router({
  // Get all categories
  getAll: publicProcedure
    .input(z.object({
      applicableTo: z.enum(["pujari", "customer", "both"]).optional(),
      activeOnly: z.boolean().default(true),
    }).optional())
    .query(async ({ input }) => {
      return await db.getAllCategories(input?.applicableTo, input?.activeOnly ?? true);
    }),

  // Get category by ID
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await db.getCategoryById(input.id);
    }),

  // Admin: Create category
  create: protectedProcedure
    .input(z.object({
      name: z.string(),
      code: z.string(),
      description: z.string().optional(),
      parentId: z.number().optional(),
      applicableTo: z.enum(["pujari", "customer", "both"]),
      displayOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      return await db.createCategory(input);
    }),

  // Admin: Update category
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      displayOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      return await db.updateCategory(input.id, input);
    }),
});

/**
 * ============================================================================
 * TITHI CALENDAR ROUTER
 * ============================================================================
 */

const tithiRouter = router({
  // Get tithi for a specific date
  getByDate: publicProcedure
    .input(z.object({ date: z.date() }))
    .query(async ({ input }) => {
      return await db.getTithiByDate(input.date);
    }),

  // Get tithi for date range
  getInRange: publicProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
    }))
    .query(async ({ input }) => {
      return await db.getTithiInRange(input.startDate, input.endDate);
    }),
});

/**
 * ============================================================================
 * USER PROFILE ROUTER
 * ============================================================================
 */

const profileRouter = router({
  // Get customer profile
  getCustomerProfile: protectedProcedure.query(async ({ ctx }) => {
    return await db.getCustomerProfile(ctx.user.id);
  }),

  // Get priest profile
  getPriestProfile: protectedProcedure.query(async ({ ctx }) => {
    return await db.getPriestProfile(ctx.user.id);
  }),

  // Update customer profile with location
  updateCustomerProfile: protectedProcedure
    .input(z.object({
      dateOfBirth: z.date().optional(),
      gotra: z.string().optional(),
      nakshatra: z.string().optional(),
      rashi: z.string().optional(),
      preferredLanguage: z.string().optional(),
      locationCity: z.string().optional(),
      locationArea: z.string().optional(),
      fullAddress: z.string().optional(),
      landmark: z.string().optional(),
      pincode: z.string().optional(),
      categoryId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await db.updateCustomerProfile(ctx.user.id, input);
    }),

  // Update priest profile with location
  updatePriestProfile: protectedProcedure
    .input(z.object({
      experience: z.number().optional(),
      languages: z.array(z.string()).optional(),
      specializations: z.array(z.string()).optional(),
      bio: z.string().optional(),
      basePrice: z.number().optional(),
      locationCity: z.string().optional(),
      locationArea: z.string().optional(),
      fullAddress: z.string().optional(),
      landmark: z.string().optional(),
      pincode: z.string().optional(),
      categoryId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await db.updatePriestProfile(ctx.user.id, input);
    }),
});

/**
 * ============================================================================
 * MAIN APP ROUTER
 * ============================================================================
 */

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  services: servicesRouter,
  priests: priestsRouter,
  bookings: bookingsRouter,
  payments: paymentsRouter,
  reviews: reviewsRouter,
  temples: templesRouter,
  auspiciousDates: auspiciousDatesRouter,
  notifications: notificationsRouter,
  profile: profileRouter,
  admin: adminRouter,
  categories: categoryRouter,
  tithi: tithiRouter,
});

export type AppRouter = typeof appRouter;
