# B-Seva macOS Quick Start (5 Minutes)

Get B-Seva running on your Mac in just 5 minutes!

## Prerequisites

- macOS 10.15 or newer
- Homebrew installed (if not: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`)

## Quick Start

### 1. Install Node.js & pnpm (2 minutes)

```bash
brew install node
npm install -g pnpm
```

### 2. Install PostgreSQL (1 minute)

```bash
brew install postgresql@15
brew services start postgresql@15
```

### 3. Extract & Setup Project (1 minute)

```bash
cd ~/Projects  # or your preferred directory
unzip ~/Downloads/bseva-project.zip
cd bseva-export
pnpm install
```

### 4. Create Database (1 minute)

```bash
psql postgres
```

Then paste this:

```sql
CREATE DATABASE bseva;
CREATE USER bseva_user WITH PASSWORD 'password123';
GRANT ALL PRIVILEGES ON DATABASE bseva TO bseva_user;
\q
```

### 5. Configure & Run (1 minute)

```bash
cp .env.example .env.local
```

Edit `.env.local` and update:

```env
DATABASE_URL=postgresql://bseva_user:password123@localhost:5432/bseva
JWT_SECRET=your-secret-key-here
```

Then:

```bash
pnpm db:push
pnpm dev
```

## Done! 🎉

Open **http://localhost:3000** in your browser!

## Admin Access

1. Click Login
2. Sign in with your credentials
3. Navigate to `/admin` for the admin dashboard

## Useful Commands

```bash
pnpm dev        # Start dev server
pnpm test       # Run tests
pnpm build      # Build for production
pnpm db:push    # Run migrations
```

## Troubleshooting

**Port 3000 in use?**
```bash
PORT=3001 pnpm dev
```

**PostgreSQL not running?**
```bash
brew services start postgresql@15
```

**Database connection error?**
```bash
# Test connection
psql -U bseva_user -d bseva
```

## Need More Help?

See **MACOS_SETUP_GUIDE.md** for detailed instructions and troubleshooting.

---

**Version:** 1.0.0  
**Happy coding! 🍎**
