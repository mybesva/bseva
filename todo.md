# B-Seva Website TODO

## Completed ✅
- [x] Design and implement MySQL database schema (20 tables)
- [x] Create database helper functions
- [x] Implement tRPC API routers
- [x] Seed database with initial data
- [x] Basic website structure and pages

## In Progress 🚧
- [ ] Integrate frontend with backend APIs
  - [ ] Home page: Fetch services from API
  - [ ] Services page: Dynamic service listing
  - [ ] Pujari Profiles page: Fetch priests from database
  - [ ] Service detail pages: Load puja data from API
  - [ ] Contact form: Save to database

## Pending 📋
- [ ] Implement booking flow
  - [ ] Booking form with date/time selection
  - [ ] Payment integration
  - [ ] Booking confirmation page
- [ ] User authentication integration
  - [ ] Login/Signup flow
  - [ ] User dashboard
  - [ ] My Bookings page
- [ ] Admin panel
  - [ ] Manage bookings
  - [ ] Manage priests
  - [ ] Analytics dashboard
- [ ] Testing and QA
  - [ ] Write vitest tests for API endpoints
  - [ ] Cross-browser testing
  - [ ] Mobile responsiveness testing


## New Feature: Complete Booking Flow 🎯
- [x] Create multi-step booking wizard component
- [x] Step 1: Service and package selection
- [x] Step 2: Date, time, and location input
- [x] Step 3: Priest selection from available priests
- [x] Step 4: Review booking details
- [x] Step 5: Payment integration
- [x] Booking confirmation page with booking number
- [x] User dashboard to view bookings
- [x] My Bookings page with status tracking
- [ ] Email/SMS notifications for booking updates


## New Feature: Admin Interfaces & Database Management 🔧
- [x] Create database views for reporting and analytics
- [ ] Implement stored procedures for complex operations
- [ ] Add audit logging table and triggers
- [x] Create admin dashboard layout with sidebar navigation
- [x] Implement role-based access control middleware
- [x] Build admin dashboard with key metrics
- [x] Add admin API router with dashboard stats
- [x] Add admin CRUD API procedures for all entities
- [x] Implement database helper functions for customers
- [x] Implement database helper functions for priests
- [x] Implement database helper functions for temples
- [x] Implement database helper functions for services
- [ ] Build Customer Management interface with data table
- [ ] Add customer create/edit dialog with form validation
- [ ] Implement customer search and filtering
- [ ] Build Priest/Pujari Management interface with data table
- [ ] Add priest create/edit dialog with verification status
- [ ] Implement priest search and filtering
- [ ] Build Temple Management interface with data table
- [ ] Add temple create/edit dialog with location mapping
- [ ] Implement temple search and filtering
- [ ] Build Service/Puja Management interface with data table
- [ ] Add service create/edit dialog with pricing tiers
- [ ] Implement service search and filtering
- [ ] Build Samagri Inventory Management interface (CRUD)
- [ ] Add data validation and error handling
- [ ] Implement search and filtering for all entities
- [ ] Create audit log viewer for admins
- [ ] Add bulk operations support
- [ ] Write unit tests for admin APIs


## New Feature: Comprehensive Admin Interfaces & Bulk Management 🏢

### Application Interfaces
- [x] Customer Management page with data table, search, filters
- [x] Customer create/edit dialog with form validation
- [x] Pujari Management page with verification workflow
- [x] Pujari create/edit dialog with qualifications and availability
- [x] Temple Management page with location mapping
- [x] Temple create/edit dialog with operating hours
- [x] Service/Puja Management page with pricing tiers
- [x] Service create/edit dialog with rituals and samagri
- [ ] Samagri Inventory Management page
- [ ] Samagri create/edit dialog with units and thresholds

### Audit Logging
- [ ] Create audit_logs database table
- [ ] Implement audit logging middleware
- [ ] Add audit log viewer page for admins

### Bulk Data Management
- [x] Create Bulk Upload page with drag-drop CSV support
- [x] Implement CSV parsing and validation
- [x] Add pre-upload validation with error reporting
- [ ] Implement staging table for bulk imports
- [ ] Add rollback capabilities for failed imports
- [x] Create bulk upload templates for each entity type

### Database Interfaces
- [ ] Create stored procedures for customer CRUD
- [ ] Create stored procedures for pujari CRUD
- [ ] Create stored procedures for temple CRUD
- [ ] Create stored procedures for service CRUD
- [ ] Create stored procedures for samagri CRUD
- [ ] Implement bulk processing procedures with transaction management



## Update: Social Media Handles
- [x] Add more social media links to header (LinkedIn, Pinterest, WhatsApp, Telegram)
- [x] Add more social media links to footer
- [x] Add WhatsApp chat button in footer
- [x] Add social links to mobile menu
- [x] Republish site with updated content


## New Feature: Complete Admin Frontend Sections
- [x] Create Bookings Management page
- [x] Create Payments Management page
- [x] Create Reviews Management page
- [x] Create Samagri Inventory Management page
- [x] Create Notifications Management page
- [x] Create Settings page
- [x] Update admin navigation with all sections
- [x] Add routes for all admin pages
- [x] Add Admin link to main site navigation


## Fix: Link Quick Actions on Admin Dashboard
- [x] Link Add Customer button to /admin/customers
- [x] Link Add Priest button to /admin/pujaris
- [x] Link View Bookings button to /admin/bookings
- [x] Link View Payments button to /admin/payments


## Feature: Complete Booking Flow Integration
- [x] Review existing booking API endpoints
- [x] Update booking API to save bookings to database
- [x] Connect frontend booking wizard to backend API
- [x] Update admin dashboard to fetch real bookings
- [x] Update admin bookings page to fetch from database
- [x] Test complete booking flow end-to-end
- [x] Fix booking confirmation page route (query param instead of path param)
- [x] Seed sample priests in database
- [x] Verify booking shows in admin bookings page


## Feature: My Bookings Page for Customers
- [x] Review existing MyBookings page structure
- [x] Add customer bookings API endpoint (already exists)
- [x] Update MyBookings page with real API data (already working)
- [x] Add booking status tracking UI (already implemented)
- [x] Add booking details view (View Details button exists)
- [x] Test My Bookings page functionality (verified - shows real bookings)
- [x] Add My Bookings link to main navigation


## Update: New B-Seva Logo with Ganesha Design
- [x] Copy new logo to public folder
- [x] Update header/navigation with new logo
- [x] Update footer with new logo
- [x] Test logo display across pages


## Fix: Remove Duplicate B-SEVA Text
- [x] Remove B-SEVA text from header (logo already has it)
- [x] Remove B-SEVA text from footer (logo already has it)


## Update: Logo Background and Size
- [x] Remove white background from logo (make transparent)
- [x] Increase logo size in header
- [x] Increase logo size in footer


## Feature: Make All Tabs and Links Live
- [x] Audit all navigation links
- [x] Fix header navigation links
- [x] Fix footer links (Quick Links, Our Services)
- [x] Fix homepage CTAs and buttons
- [x] Connect service cards to booking flow
- [x] Test all links end-to-end


## Enhancement: Front-End Data Capture for Pujari & Customer 📍
### Database Schema Updates
- [x] Create category_master table for configurable dropdown values
- [x] Add location fields to priest_profiles table (city, area, full_address, pincode)
- [x] Add location fields to customer_profiles table (city, area, full_address, pincode)
- [x] Add category_id foreign key to both profile tables
- [x] Create email_templates table
- [x] Create sms_templates table
- [x] Create otp_verifications table
- [x] Create tithi_calendar table
- [x] Create location_master table
### Pujari Profile Page
- [x] Add Location (City / Area) field with autocomplete
- [x] Add Full Address field (Street, Locality, Landmark)
- [x] Add Category dropdown (from category_master)
- [x] Add Pincode / ZIP Code field
- [x] Add field validation (mandatory vs optional)dation (mandatory vs optional)
- [ ] Connect to backend API for data persistence

### Customer Profile Page
- [x] Add Location (City / Area) field with autocomplete
- [x] Add Full Address field (Street, Locality, Landmark)
- [x] Add Category dropdown (from category_master)
- [x] Add Pincode / ZIP Code field (already exists)
- [x] Add field validation (mandatory vs optional)
- [x] Connect to backend API for data persistence

### Admin Category Master Management
- [ ] Create Category Master admin page
- [ ] Add CRUD operations for categories
- [ ] Implement category activation/deactivation


## Enhancement: Booking Flow Updates 📅
### Pujari Booking Page Changes
- [x] Remove Pujari Name display from booking page (shows Pujari #1, #2 etc.)
- [x] Display Pujari Reviews prominently in booking flow
- [x] Add Tithi (Vedic calendar) display with selected booking date
- [x] Create Tithi calculation/lookup service

### Post-Booking Automation
- [x] Implement automated transactional email on booking creation
- [x] Implement OTP-based SMS verification for booking confirmation
- [x] Create OTP validation flow before "Confirmed" status
- [ ] Add email/SMS template configuration in admin settings

### Configurable Templates
- [ ] Create email_templates table in database
- [ ] Create sms_templates table in database
- [ ] Build Email Templates admin page
- [ ] Build SMS Templates admin page
- [ ] Implement template variable substitution


## Enhancement: Analytics & Reporting Module 📊
### Reports Tab in Admin
- [ ] Create Reports navigation item in admin sidebar
- [ ] Build Reports landing page with dashboard overview

### Pujari Analytics Dashboard
- [ ] Booking volume by priest
- [ ] Ratings distribution and trends
- [ ] Earnings analysis
- [ ] Availability trends

### Customer Analytics Dashboard
- [ ] Registration trends over time
- [ ] Booking frequency analysis
- [ ] Repeat customer rate
- [ ] Customer lifetime value

### Temple Analytics Dashboard
- [ ] Temple-wise booking distribution
- [ ] Service demand by temple
- [ ] Geographic analysis

### Service/Puja Analytics Dashboard
- [ ] Popular services ranking
- [ ] Seasonal demand patterns
- [ ] Duration analysis
- [ ] Price tier distribution

### Samagri Analytics Dashboard
- [ ] Inventory usage tracking
- [ ] Consumption trends
- [ ] Replenishment alerts
- [ ] Cost analysis

### Booking Analytics Dashboard
- [ ] Daily/monthly booking trends
- [ ] Cancellation analysis
- [ ] Confirmation rates
- [ ] Peak booking times

### Payment Analytics Dashboard
- [ ] GMV (Gross Merchandise Value) tracking
- [ ] Commission analysis
- [ ] Settlement status
- [ ] Payment method distribution

### Technical Requirements
- [ ] Implement date range filtering for all reports
- [ ] Add category filtering
- [ ] Add location filtering
- [ ] Add user type filtering
- [ ] Implement role-based access control for Reports
- [ ] Design for scalability and BI integration


## Enhancement: Connect Analytics to Real Database
- [x] Create database queries for Pujari analytics (bookings, ratings, earnings)
- [x] Create database queries for Customer analytics (registrations, booking frequency)
- [x] Create database queries for Temple analytics (temple-wise bookings)
- [x] Create database queries for Service analytics (popular services, revenue)
- [x] Create database queries for Samagri analytics (inventory, consumption)
- [x] Create database queries for Booking analytics (daily/monthly stats)
- [x] Create database queries for Payment analytics (GMV, commissions)
- [ ] Update Reports page to fetch real data via tRPC

## Enhancement: SMS Gateway Integration
- [x] Create SMS service with Twilio/MSG91 integration
- [x] Add SMS configuration in admin settings (via environment variables)
- [x] Connect OTP service to SMS gateway
- [x] Add SMS notification for booking confirmation
- [ ] Test SMS delivery

## Enhancement: Date Range Filtering for Reports
- [x] Add date range state management in Reports page
- [x] Create tRPC endpoints with date range parameters
- [x] Connect date selector to API calls
- [x] Update all analytics queries to use date range
- [x] Update Reports page to fetch real data via tRPCdata fetch
## Enhancement: Automatic Pujari Assignment
- [x] Create Pujari matching algorithm based on location
- [x] Remove manual Pujari selection step from booking wizard
- [x] Auto-assign Pujari when customer enters city
- [x] Display assigned Pujari on review screen
- [x] Redirect directly to Review & Confirmation after details details in review


## Bug Fix: Preview and Booking Issues
- [x] Fix dev server not responding (server running on port 3006)
- [x] Debug booking puja failure (changed autoAssignPujari to publicProcedure)
- [x] Test booking flow end-to-end (API tests passing)


## Bug Fix: Failed to Create Booking Error
- [x] Diagnose the booking creation error (booking.create requires authentication)
- [x] Fix the booking creation API (added login prompt on payment step)
- [x] Test booking flow end-to-end (all 17 tests passing)

## Feature: Guest Checkout Flow 🛒
- [x] Update bookings table to support guest bookings (nullable userId)
- [x] Create guest_bookings table for tracking guest email/phone
- [x] Update bookings.create to accept guest customer data
- [x] Modify booking wizard to collect guest email/phone
- [x] Update payment flow to work without authentication
- [ ] Create post-booking account linking flow
- [ ] Add email verification for guest bookings
- [ ] Update admin dashboard to show guest bookings
- [x] Write tests for guest checkout flow (22 tests passing)
- [ ] Test end-to-end guest booking creation
