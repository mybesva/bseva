# B-Seva Project Download Package

Thank you for downloading B-Seva! This package contains the complete source code for the B-Seva puja booking platform.

## What's Included

This package includes:

- ✅ Complete React frontend with TypeScript
- ✅ Express backend with tRPC API
- ✅ PostgreSQL/MySQL database schema
- ✅ Admin dashboard with 12 management sections
- ✅ Booking workflow with automatic Pujari assignment
- ✅ Analytics and reporting module
- ✅ Email and SMS integration templates
- ✅ Comprehensive test suite (17 tests)
- ✅ Full setup and deployment documentation

## Getting Started

### Quick Start (5 minutes)

1. **Extract the archive**
   ```bash
   unzip bseva-project.zip
   cd bseva-export
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your database credentials
   ```

4. **Create database and run migrations**
   ```bash
   createdb bseva  # PostgreSQL
   pnpm db:push
   ```

5. **Start development server**
   ```bash
   pnpm dev
   ```

6. **Open in browser**
   - Navigate to http://localhost:3000
   - Login with your credentials
   - Access admin dashboard at /admin

### Detailed Setup

For comprehensive setup instructions, see **LOCAL_SETUP_GUIDE.md** in the project directory.

## Project Structure

```
bseva-website/
├── client/              # React frontend
├── server/              # Express backend & tRPC API
├── drizzle/             # Database schema & migrations
├── shared/              # Shared types & constants
├── package.json         # Dependencies
├── vite.config.ts       # Build configuration
└── LOCAL_SETUP_GUIDE.md # Detailed setup guide
```

## Key Features

### For Customers
- Browse available puja services
- Find and book qualified priests
- Track booking status
- View booking history
- Receive email/SMS confirmations

### For Admins
- Manage priests and their profiles
- View customer information
- Track all bookings and payments
- Generate comprehensive reports
- Configure email/SMS templates
- View analytics dashboards

### Technical Features
- Automatic Pujari assignment based on location and rating
- Email and SMS notifications
- OTP verification for bookings
- Role-based access control
- Real-time analytics
- Responsive design

## System Requirements

- Node.js 18+
- PostgreSQL 12+ or MySQL 8+
- 4GB RAM minimum
- 2GB disk space

## Support & Documentation

- **Quick Start**: See QUICK_START.md
- **Detailed Setup**: See LOCAL_SETUP_GUIDE.md
- **Database Schema**: See DATABASE_SCHEMA.sql
- **Project Status**: See todo.md
- **Test Examples**: See server/__tests__/

## Common Commands

```bash
pnpm dev        # Start development server
pnpm test       # Run tests
pnpm build      # Build for production
pnpm format     # Format code
pnpm db:push    # Run database migrations
```

## Environment Setup

Before running the project, you'll need to configure:

1. **Database** - PostgreSQL or MySQL connection
2. **Authentication** - OAuth credentials (optional for local dev)
3. **Email** - SMTP configuration (optional)
4. **SMS** - Twilio or MSG91 credentials (optional)

All configuration goes in `.env.local` file. See `.env.example` for template.

## Deployment

The project can be deployed to:
- Local machine (development)
- Docker containers
- Cloud platforms (AWS, Heroku, Railway, etc.)
- Traditional servers

See LOCAL_SETUP_GUIDE.md for deployment instructions.

## Testing

Run the comprehensive test suite:

```bash
pnpm test
```

All 17 tests should pass, covering:
- Booking creation and management
- Automatic Pujari assignment
- OTP verification
- Authentication flows

## Troubleshooting

### Port 3000 in use?
```bash
PORT=3001 pnpm dev
```

### Database connection error?
Verify DATABASE_URL in .env.local matches your database setup.

### Missing dependencies?
```bash
rm -rf node_modules
pnpm install
```

## License

This project is provided as-is for your use and customization.

## Next Steps

1. Extract and install dependencies
2. Follow LOCAL_SETUP_GUIDE.md for detailed setup
3. Run tests to verify installation
4. Start the development server
5. Explore the admin dashboard
6. Customize for your needs

---

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Status:** Production Ready

For questions or issues, refer to the documentation files included in the project.
