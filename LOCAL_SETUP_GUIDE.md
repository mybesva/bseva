# B-Seva Local Setup Guide

Welcome to B-Seva! This guide will help you set up and run the B-Seva puja booking platform on your local machine.

## System Requirements

Before you begin, ensure your machine meets the following requirements:

| Component | Requirement |
|-----------|-------------|
| **Node.js** | Version 18.0 or higher |
| **npm/pnpm** | Latest version (pnpm 8+ recommended) |
| **Database** | PostgreSQL 12+ or MySQL 8+ |
| **RAM** | Minimum 4GB |
| **Disk Space** | At least 2GB free space |
| **OS** | Windows, macOS, or Linux |

## Installation Steps

### Step 1: Extract the Project

Extract the downloaded project archive to your desired location:

```bash
unzip bseva-project.zip
cd bseva-website
```

### Step 2: Install Dependencies

Install all required npm packages using pnpm (recommended) or npm:

```bash
# Using pnpm (recommended)
pnpm install

# OR using npm
npm install
```

### Step 3: Set Up Environment Variables

Create a `.env.local` file in the project root with the following configuration:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/bseva
# OR for MySQL: mysql://username:password@localhost:3306/bseva

# Authentication
JWT_SECRET=your-secret-key-here-min-32-chars
VITE_APP_ID=your-manus-app-id
OAUTH_SERVER_URL=https://oauth.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im

# Owner Information
OWNER_NAME=Your Name
OWNER_OPEN_ID=your-open-id

# API Configuration
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-api-key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY=your-frontend-api-key

# Application Settings
VITE_APP_TITLE=B-Seva
VITE_APP_LOGO=/logo.png

# Analytics (Optional)
VITE_ANALYTICS_ENDPOINT=https://analytics.manus.im
VITE_ANALYTICS_WEBSITE_ID=your-website-id

# SMS Gateway (Optional - for OTP and notifications)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Email Configuration (Optional - for booking confirmations)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@bseva.com
```

**Note:** For local development without external services, you can use placeholder values. The application will work with limited functionality (no SMS/email notifications).

### Step 4: Set Up the Database

Create your PostgreSQL or MySQL database:

```bash
# PostgreSQL
createdb bseva

# MySQL
mysql -u root -p -e "CREATE DATABASE bseva;"
```

Then run database migrations:

```bash
pnpm db:push
```

This command will:
- Generate migration files from your schema
- Apply all pending migrations to your database
- Sync your database with the schema defined in `drizzle/schema.ts`

### Step 5: Start the Development Server

Launch the application in development mode:

```bash
pnpm dev
```

The application will start on `http://localhost:3000`. Open this URL in your browser to access B-Seva.

## Project Structure

Understanding the project layout will help you navigate and customize the application:

```
bseva-website/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── pages/         # Page components (Home, Pujaris, Bookings, etc.)
│   │   ├── components/    # Reusable UI components
│   │   ├── _core/         # Core hooks (useAuth, etc.)
│   │   ├── lib/           # Utilities and helpers
│   │   └── App.tsx        # Main app component with routing
│   ├── public/            # Static assets (images, logos)
│   └── index.html         # HTML entry point
├── server/                # Express backend server
│   ├── routers.ts         # tRPC API procedures
│   ├── db.ts              # Database query helpers
│   ├── storage.ts         # S3 file storage helpers
│   ├── services/          # Business logic services
│   │   ├── email.service.ts
│   │   ├── sms.service.ts
│   │   └── pujari-assignment.ts
│   └── _core/             # Core server infrastructure
├── drizzle/               # Database schema and migrations
│   ├── schema.ts          # Table definitions
│   └── migrations/        # Migration files
├── shared/                # Shared types and constants
├── package.json           # Dependencies and scripts
├── vite.config.ts         # Vite build configuration
├── vitest.config.ts       # Test configuration
└── DATABASE_SCHEMA.sql    # SQL schema reference
```

## Key Features

### Booking Workflow

The B-Seva platform provides a streamlined 4-step booking process:

1. **Package Selection** - Choose from available puja services
2. **Booking Details** - Enter customer information and booking preferences
3. **Review & Confirm** - Review booking details and automatic Pujari assignment
4. **Payment** - Complete payment (login required)

### Automatic Pujari Assignment

The system automatically assigns the best-matching Pujari based on:
- Location proximity (40 points)
- Area match (20 points)
- Pujari rating (20 points)
- Years of experience (20 points)

### Admin Dashboard

Access the admin panel at `/admin` with the following sections:

- **Dashboard** - Overview of bookings, revenue, and key metrics
- **Pujaris** - Manage priest profiles and assignments
- **Customers** - View and manage customer information
- **Bookings** - Track and manage all bookings
- **Payments** - Monitor payment transactions
- **Reports** - Comprehensive analytics with 7 dashboard tabs
- **Settings** - Configure email/SMS templates and system settings

### Analytics & Reporting

The Reports module provides detailed analytics across:

- **Pujari Analytics** - Performance metrics and booking trends
- **Customer Analytics** - Booking patterns and demographics
- **Temple Analytics** - Temple-wise booking distribution
- **Service Analytics** - Popular services and revenue
- **Samagri Analytics** - Material usage and inventory
- **Booking Analytics** - Booking trends and conversion rates
- **Payment Analytics** - Revenue and transaction analysis

## Running Tests

Execute the test suite to verify everything is working correctly:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run specific test file
pnpm test -- server/__tests__/bookings.test.ts
```

The project includes 17 comprehensive tests covering:
- Booking creation and management
- Automatic Pujari assignment
- OTP verification
- Authentication flows

## Building for Production

Create an optimized production build:

```bash
pnpm build
```

This command will:
- Build the React frontend with Vite
- Bundle the Express server
- Generate optimized output in the `dist/` directory

## Deployment Options

### Option 1: Local Machine (Development)

For running on your local machine during development:

```bash
pnpm dev
```

### Option 2: Docker Deployment

Build and run using Docker:

```bash
# Build Docker image
docker build -t bseva:latest .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/bseva \
  -e JWT_SECRET=your-secret \
  bseva:latest
```

### Option 3: Production Server

For production deployment on a server:

1. Build the project: `pnpm build`
2. Set production environment variables
3. Start the server: `node dist/index.js`
4. Use a process manager like PM2 to keep the application running

## Troubleshooting

### Port 3000 Already in Use

If port 3000 is already in use, you can specify a different port:

```bash
PORT=3001 pnpm dev
```

### Database Connection Error

Verify your database connection string in `.env.local`:

```bash
# Test PostgreSQL connection
psql postgresql://username:password@localhost:5432/bseva

# Test MySQL connection
mysql -u username -p -h localhost bseva
```

### Missing Dependencies

If you encounter missing dependency errors, reinstall packages:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Build Errors

Clear the build cache and rebuild:

```bash
rm -rf dist
pnpm build
```

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | Database connection string | `postgresql://user:pass@localhost:5432/bseva` |
| `JWT_SECRET` | Session signing secret | `your-secret-key-min-32-chars` |
| `VITE_APP_ID` | OAuth application ID | `app-id-from-manus` |
| `TWILIO_ACCOUNT_SID` | Twilio SMS account | `AC1234567890abcdef` |
| `TWILIO_AUTH_TOKEN` | Twilio authentication token | `auth-token-here` |
| `SMTP_HOST` | Email server hostname | `smtp.gmail.com` |
| `SMTP_USER` | Email account username | `your-email@gmail.com` |

## API Documentation

The backend uses tRPC for type-safe API calls. Key procedures include:

### Booking Operations

```typescript
// Get all bookings (admin only)
trpc.bookings.getAll.useQuery()

// Create a new booking
trpc.bookings.create.useMutation()

// Get booking details
trpc.bookings.getById.useQuery(bookingId)

// Update booking status
trpc.bookings.updateStatus.useMutation()
```

### Pujari Operations

```typescript
// Get all pujaris
trpc.pujaris.getAll.useQuery()

// Auto-assign best pujari
trpc.pujaris.autoAssignPujari.useQuery(bookingData)

// Get pujari suggestions
trpc.pujaris.getPujariSuggestions.useQuery(location)
```

### Analytics

```typescript
// Get booking analytics
trpc.analytics.getBookingAnalytics.useQuery(dateRange)

// Get pujari performance
trpc.analytics.getPujariAnalytics.useQuery(dateRange)

// Get revenue reports
trpc.analytics.getPaymentAnalytics.useQuery(dateRange)
```

## Support and Resources

For issues or questions:

1. Check the `todo.md` file for known issues and planned features
2. Review test files in `server/__tests__/` for usage examples
3. Consult the database schema in `DATABASE_SCHEMA.sql`
4. Check application logs in the console for error messages

## Next Steps

After successful setup:

1. **Customize Branding** - Update logo, colors, and content in `client/src/index.css`
2. **Configure Services** - Add your puja services in the admin dashboard
3. **Add Pujaris** - Register priests with their details and expertise
4. **Set Up Notifications** - Configure email and SMS credentials for automated notifications
5. **Customize Templates** - Modify email and SMS templates in admin settings
6. **Deploy to Production** - Follow the deployment guide for your hosting platform

## License and Credits

B-Seva is built with modern web technologies including React, TypeScript, Express, PostgreSQL, and Tailwind CSS. All code is provided as-is for your use and customization.

---

**Last Updated:** January 2026  
**Version:** 1.0.0  
**Status:** Production Ready
