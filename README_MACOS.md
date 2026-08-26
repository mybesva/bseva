# B-Seva for macOS

Welcome to B-Seva! This is your complete guide to running the B-Seva puja booking platform on your Apple Mac.

## 📦 What's Included

- ✅ Complete React frontend with TypeScript
- ✅ Express backend with tRPC API
- ✅ PostgreSQL database schema
- ✅ Admin dashboard with 12 management sections
- ✅ Booking workflow with automatic Pujari assignment
- ✅ Analytics and reporting module
- ✅ Email and SMS integration templates
- ✅ Comprehensive test suite (17 tests)
- ✅ macOS-specific setup documentation

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Homebrew (if needed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Step 2: Install Dependencies

```bash
brew install node postgresql@15
npm install -g pnpm
brew services start postgresql@15
```

### Step 3: Extract & Install

```bash
cd ~/Projects
unzip ~/Downloads/bseva-project.zip
cd bseva-export
pnpm install
```

### Step 4: Setup Database

```bash
psql postgres
```

Paste this:

```sql
CREATE DATABASE bseva;
CREATE USER bseva_user WITH PASSWORD 'password123';
GRANT ALL PRIVILEGES ON DATABASE bseva TO bseva_user;
\q
```

### Step 5: Configure & Run

```bash
cp .env.example .env.local
nano .env.local
```

Update these lines:

```env
DATABASE_URL=postgresql://bseva_user:password123@localhost:5432/bseva
JWT_SECRET=your-secret-key-here
```

Then:

```bash
pnpm db:push
pnpm dev
```

### Step 6: Open in Browser

Navigate to **http://localhost:3000**

## 📚 Documentation

| Guide | Purpose |
|-------|---------|
| **MACOS_QUICK_START.md** | 5-minute setup guide |
| **MACOS_SETUP_GUIDE.md** | Detailed macOS instructions |
| **LOCAL_SETUP_GUIDE.md** | General setup & features |
| **QUICK_START.md** | Generic quick start |
| **DATABASE_SCHEMA.sql** | Database structure |

## 🎯 Key Features

### For Customers
- Browse puja services
- Book qualified priests
- Track bookings
- Receive confirmations

### For Admins
- Manage priests
- View customers
- Track bookings & payments
- Generate reports
- Configure templates
- View analytics

### Technical
- Automatic Pujari assignment
- Email & SMS notifications
- OTP verification
- Role-based access
- Real-time analytics

## 💻 System Requirements

| Requirement | Minimum |
|-------------|---------|
| macOS | 10.15 (Catalina) |
| RAM | 8GB (16GB recommended) |
| Disk Space | 5GB free |
| Processor | Intel i5+ or Apple Silicon M1+ |

## 🔧 Common Commands

```bash
pnpm dev              # Start development server
pnpm test             # Run tests
pnpm build            # Build for production
pnpm format           # Format code
pnpm db:push          # Run migrations
```

## 🐘 PostgreSQL Management

```bash
# Start PostgreSQL
brew services start postgresql@15

# Stop PostgreSQL
brew services stop postgresql@15

# Connect to database
psql -U bseva_user -d bseva

# View databases
psql -l
```

## 🎨 Development Tools

### Recommended for macOS

1. **VS Code** - Code editor
   ```bash
   brew install visual-studio-code
   ```

2. **iTerm2** - Better terminal
   ```bash
   brew install iterm2
   ```

3. **Sequel Pro** - Database GUI (optional)
   ```bash
   brew install sequel-pro
   ```

## 🐛 Troubleshooting

### Port 3000 Already in Use

```bash
PORT=3001 pnpm dev
```

### PostgreSQL Connection Error

```bash
# Check if running
brew services list

# Start if not running
brew services start postgresql@15

# Test connection
psql -U bseva_user -d bseva
```

### M1/M2 Mac Issues

Ensure you're using native Node.js (not Rosetta):

```bash
uname -m  # Should show 'arm64'

# If showing 'x86_64', reinstall Node.js natively
brew uninstall node
arch -arm64 brew install node
```

### Clear Cache & Reinstall

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## 📊 Admin Dashboard

After logging in, access admin features at `/admin`:

- **Dashboard** - Overview & metrics
- **Pujaris** - Manage priests
- **Customers** - View customers
- **Bookings** - Track bookings
- **Payments** - Monitor transactions
- **Reports** - Analytics (7 tabs)
- **Settings** - Configure templates

## 🧪 Testing

Run the comprehensive test suite:

```bash
pnpm test
```

All 17 tests should pass covering:
- Booking creation
- Pujari assignment
- OTP verification
- Authentication

## 🚢 Deployment

### Local Development
```bash
pnpm dev
```

### Production Build
```bash
pnpm build
```

### Deploy to Vercel
```bash
npm install -g vercel
vercel
```

### Deploy to Railway
```bash
npm install -g railway
railway login
railway up
```

## 📝 Environment Variables

Create `.env.local` with:

```env
# Database
DATABASE_URL=postgresql://bseva_user:password123@localhost:5432/bseva

# Security
JWT_SECRET=your-32-character-secret-key

# App
VITE_APP_ID=your-app-id
VITE_APP_TITLE=B-Seva
VITE_APP_LOGO=/logo.png

# Optional: Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-password

# Optional: SMS
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1234567890
```

## 🎓 Learning Resources

- **Code Examples**: See `server/__tests__/` for test examples
- **Database**: See `DATABASE_SCHEMA.sql` for structure
- **Project Status**: See `todo.md` for features & issues
- **API**: See `server/routers.ts` for tRPC procedures

## 📞 Support

For issues:

1. Check **MACOS_SETUP_GUIDE.md** for detailed help
2. Review test files for code examples
3. Check database schema documentation
4. Review project status in `todo.md`

## ✨ Next Steps

1. ✅ Complete quick start above
2. ✅ Explore customer pages
3. ✅ Access admin dashboard
4. ✅ Run tests
5. ✅ Customize for your needs
6. ✅ Deploy to production

## 🍎 macOS Tips

### Add Shell Aliases

Edit `~/.zshrc`:

```bash
alias bseva-dev="cd ~/Projects/bseva-export && pnpm dev"
alias bseva-test="cd ~/Projects/bseva-export && pnpm test"
alias psql-bseva="psql -U bseva_user -d bseva"
```

Then reload:

```bash
source ~/.zshrc
```

### Generate Random Secret

```bash
openssl rand -base64 32
```

### Monitor Processes

```bash
# View running processes
top

# Kill process by name
killall node

# Check port usage
lsof -i :3000
```

---

**Version:** 1.0.0 - macOS Edition  
**Last Updated:** January 2026  
**Status:** Production Ready

**Welcome to B-Seva! 🙏**
