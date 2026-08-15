# B-Seva Quick Start Guide

Get B-Seva running on your local machine in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- PostgreSQL or MySQL installed and running
- Git (optional)

## Quick Start (5 minutes)

### 1. Install Dependencies

```bash
cd bseva-website
pnpm install
```

### 2. Create Database

```bash
# PostgreSQL
createdb bseva

# MySQL
mysql -u root -p -e "CREATE DATABASE bseva;"
```

### 3. Configure Environment

```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local with your database credentials
# Update DATABASE_URL to match your setup
```

### 4. Run Migrations

```bash
pnpm db:push
```

### 5. Start Development Server

```bash
pnpm dev
```

Open **http://localhost:3000** in your browser!

## Default Login

The application uses OAuth authentication. For local development:

1. Click "Login" in the top navigation
2. You'll be redirected to the Manus OAuth portal
3. Sign in with your credentials

## Accessing Admin Dashboard

Once logged in as an admin user:

1. Navigate to `/admin` or click "Admin Dashboard" in the menu
2. You'll see all admin features:
   - Dashboard with analytics
   - Pujari management
   - Customer management
   - Booking management
   - Reports and analytics
   - Settings

## Common Commands

```bash
# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build

# Format code
pnpm format

# Push database migrations
pnpm db:push
```

## Troubleshooting

### Port 3000 in use?
```bash
PORT=3001 pnpm dev
```

### Database connection error?
Check your `.env.local` DATABASE_URL matches your actual database setup.

### Dependencies not found?
```bash
rm -rf node_modules
pnpm install
```

## Next Steps

1. **Explore the UI** - Browse through the customer-facing pages
2. **Create Test Bookings** - Try the booking workflow
3. **Access Admin Panel** - Manage pujaris, customers, and bookings
4. **Review Analytics** - Check the Reports dashboard
5. **Customize** - Update branding, services, and settings

## Full Documentation

For detailed setup instructions, see **LOCAL_SETUP_GUIDE.md**

## Need Help?

- Check `LOCAL_SETUP_GUIDE.md` for detailed instructions
- Review `todo.md` for known issues
- Check test files in `server/__tests__/` for code examples
- Review database schema in `DATABASE_SCHEMA.sql`

---

**Happy coding! 🙏**
