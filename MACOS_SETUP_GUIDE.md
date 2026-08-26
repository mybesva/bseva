# B-Seva macOS Setup Guide

Complete guide to set up and run B-Seva on your Apple Mac (Intel or Apple Silicon).

## System Requirements

Before you begin, ensure your Mac meets the following requirements:

| Component | Requirement |
|-----------|-------------|
| **macOS Version** | 10.15 (Catalina) or newer |
| **Mac Type** | Intel or Apple Silicon (M1/M2/M3) |
| **RAM** | Minimum 8GB (16GB recommended) |
| **Disk Space** | At least 5GB free space |
| **Processor** | Intel i5+ or Apple Silicon M1+ |

## Installation Steps

### Step 1: Install Homebrew (if not already installed)

Homebrew is macOS's package manager. Open Terminal and run:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Verify installation:

```bash
brew --version
```

### Step 2: Install Node.js and pnpm

Install Node.js (which includes npm):

```bash
brew install node
```

Verify Node.js installation:

```bash
node --version  # Should be v18 or higher
npm --version
```

Install pnpm (recommended package manager):

```bash
npm install -g pnpm
```

Verify pnpm installation:

```bash
pnpm --version
```

### Step 3: Install PostgreSQL (Recommended Database)

For macOS, we recommend PostgreSQL. Install using Homebrew:

```bash
brew install postgresql@15
```

Start PostgreSQL service:

```bash
brew services start postgresql@15
```

Verify PostgreSQL is running:

```bash
psql --version
```

**Alternative: Using Docker for PostgreSQL**

If you prefer Docker:

```bash
brew install docker
# Then use Docker Desktop from Applications
docker run --name bseva-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15
```

### Step 4: Extract the B-Seva Project

Navigate to your desired location and extract the project:

```bash
# Navigate to your projects directory
cd ~/Projects  # or any directory you prefer

# Extract the archive
unzip ~/Downloads/bseva-project.zip

# Navigate into the project
cd bseva-export
```

### Step 5: Install Project Dependencies

Install all npm packages:

```bash
pnpm install
```

This may take 2-3 minutes on first run.

### Step 6: Create Database and User

Open PostgreSQL:

```bash
psql postgres
```

Create the B-Seva database:

```sql
CREATE DATABASE bseva;
CREATE USER bseva_user WITH PASSWORD 'your_secure_password';
ALTER ROLE bseva_user SET client_encoding TO 'utf8';
ALTER ROLE bseva_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE bseva_user SET default_transaction_deferrable TO on;
ALTER ROLE bseva_user SET default_transaction_read_only TO off;
GRANT ALL PRIVILEGES ON DATABASE bseva TO bseva_user;
\q
```

### Step 7: Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your favorite text editor (VS Code, nano, vim, etc.):

```bash
# Using nano (easiest for beginners)
nano .env.local
```

Update the database connection string:

```env
DATABASE_URL=postgresql://bseva_user:your_secure_password@localhost:5432/bseva
```

Update other required fields:

```env
JWT_SECRET=generate-a-random-32-character-string-here
VITE_APP_ID=your-manus-app-id
VITE_APP_TITLE=B-Seva
VITE_APP_LOGO=/logo.png
```

**To generate a random JWT_SECRET, run:**

```bash
openssl rand -base64 32
```

### Step 8: Run Database Migrations

Apply the database schema:

```bash
pnpm db:push
```

This command will:
- Generate migration files
- Apply all migrations to your database
- Create all required tables

### Step 9: Start the Development Server

Start the application:

```bash
pnpm dev
```

You should see output like:

```
VITE v7.1.9  ready in 487 ms

➜  Local:   http://localhost:3000/
➜  Network: http://192.168.x.x:3000/
```

### Step 10: Access the Application

Open your browser and navigate to:

```
http://localhost:3000
```

You should see the B-Seva homepage!

## Accessing Admin Dashboard

To access the admin dashboard:

1. Click **Login** in the top navigation
2. Sign in with your credentials
3. Once logged in, navigate to `/admin` or look for the admin link in the menu
4. You'll see all admin features including dashboards, pujari management, and analytics

## macOS-Specific Tips

### Using VS Code

For the best development experience, install VS Code:

```bash
brew install visual-studio-code
```

Open the project in VS Code:

```bash
code .
```

Recommended VS Code extensions:
- **ES7+ React/Redux/React-Native snippets**
- **Tailwind CSS IntelliSense**
- **TypeScript Vue Plugin (Volar)**
- **Prettier - Code formatter**

### Managing PostgreSQL

Start PostgreSQL service:

```bash
brew services start postgresql@15
```

Stop PostgreSQL service:

```bash
brew services stop postgresql@15
```

Restart PostgreSQL service:

```bash
brew services restart postgresql@15
```

Check PostgreSQL status:

```bash
brew services list
```

### Accessing PostgreSQL Terminal

Connect to your database:

```bash
psql -U bseva_user -d bseva
```

Useful PostgreSQL commands:

```sql
\dt                    # List all tables
\d table_name          # Describe a table
SELECT * FROM users;   # Query users table
\q                     # Exit PostgreSQL
```

### Using Terminal Aliases

Add these aliases to your `~/.zshrc` or `~/.bash_profile` for faster development:

```bash
alias bseva-dev="cd ~/Projects/bseva-export && pnpm dev"
alias bseva-test="cd ~/Projects/bseva-export && pnpm test"
alias bseva-build="cd ~/Projects/bseva-export && pnpm build"
alias psql-bseva="psql -U bseva_user -d bseva"
```

Then reload your shell:

```bash
source ~/.zshrc
```

## Common macOS Issues and Solutions

### Issue: Port 3000 Already in Use

Find and stop the process using port 3000:

```bash
lsof -i :3000
kill -9 <PID>
```

Or run on a different port:

```bash
PORT=3001 pnpm dev
```

### Issue: PostgreSQL Connection Refused

Verify PostgreSQL is running:

```bash
brew services list
```

If not running, start it:

```bash
brew services start postgresql@15
```

Check PostgreSQL socket location:

```bash
psql -h localhost -U bseva_user -d bseva
```

### Issue: Permission Denied When Installing Packages

If you get permission errors with npm/pnpm:

```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH

# Add to ~/.zshrc or ~/.bash_profile
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
```

### Issue: Node Modules Corruption

Clear and reinstall:

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Issue: M1/M2 Mac Compatibility

For Apple Silicon Macs, ensure you're using native versions:

```bash
# Check your Mac type
uname -m

# Should return 'arm64' for Apple Silicon
# If you see 'x86_64', you're running in Rosetta emulation
```

If running in Rosetta, reinstall Node.js:

```bash
# Uninstall current version
brew uninstall node

# Install native version
arch -arm64 brew install node
```

## Running Tests

Execute the test suite:

```bash
pnpm test
```

Run tests in watch mode (auto-rerun on file changes):

```bash
pnpm test -- --watch
```

Run a specific test file:

```bash
pnpm test -- server/__tests__/bookings.test.ts
```

## Building for Production

Create an optimized production build:

```bash
pnpm build
```

The build output will be in the `dist/` directory.

## Deployment from macOS

### Option 1: Deploy to Vercel

```bash
npm install -g vercel
vercel
```

### Option 2: Deploy to Railway

```bash
npm install -g railway
railway login
railway up
```

### Option 3: Deploy to Heroku

```bash
brew tap heroku/brew && brew install heroku
heroku login
git push heroku main
```

### Option 4: Self-Hosted Server

Build and upload to your server:

```bash
pnpm build
scp -r dist/ user@your-server:/path/to/app/
```

## Useful macOS Development Commands

```bash
# Open project in Finder
open .

# Open project in default browser
open http://localhost:3000

# View system processes
top

# Check disk usage
df -h

# View network connections
netstat -an

# Monitor file system changes
fswatch -r .

# Kill process by name
killall node
```

## macOS Development Workflow

### Recommended Setup

1. **Terminal**: Use iTerm2 (brew install iterm2) for better terminal experience
2. **Editor**: VS Code with recommended extensions
3. **Database**: PostgreSQL via Homebrew
4. **Version Control**: Git (pre-installed on macOS)

### Daily Development Workflow

```bash
# 1. Start your day
brew services start postgresql@15
cd ~/Projects/bseva-export
pnpm dev

# 2. In another terminal tab
pnpm test -- --watch

# 3. Make changes in VS Code
# Changes auto-reload in browser

# 4. End of day
# Stop the dev server (Ctrl+C)
brew services stop postgresql@15
```

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@localhost:5432/bseva` |
| `JWT_SECRET` | Session signing secret | `base64-encoded-32-char-string` |
| `VITE_APP_ID` | OAuth app ID | `app-id-from-manus` |
| `VITE_APP_TITLE` | Application title | `B-Seva` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `PORT` | Server port | `3000` |

## Troubleshooting Checklist

Before seeking help, verify:

- ✅ macOS 10.15 or newer
- ✅ Node.js 18+ installed (`node --version`)
- ✅ pnpm installed (`pnpm --version`)
- ✅ PostgreSQL running (`brew services list`)
- ✅ Database created (`psql -l`)
- ✅ `.env.local` configured with correct DATABASE_URL
- ✅ Migrations run successfully (`pnpm db:push`)
- ✅ Port 3000 not in use (`lsof -i :3000`)

## Next Steps

1. ✅ Complete the installation steps above
2. ✅ Start the development server
3. ✅ Explore the customer-facing pages
4. ✅ Access the admin dashboard
5. ✅ Run the test suite
6. ✅ Review the LOCAL_SETUP_GUIDE.md for advanced configuration
7. ✅ Customize the application for your needs

## Support Resources

- **Quick Start**: See QUICK_START.md
- **General Setup**: See LOCAL_SETUP_GUIDE.md
- **Database Schema**: See DATABASE_SCHEMA.sql
- **Project Status**: See todo.md
- **Code Examples**: See server/__tests__/

## Additional macOS Resources

- [Homebrew Documentation](https://brew.sh)
- [Node.js on macOS](https://nodejs.org/en/download/package-manager/)
- [PostgreSQL macOS Guide](https://www.postgresql.org/download/macosx/)
- [VS Code on macOS](https://code.visualstudio.com/docs/setup/mac)

---

**Last Updated:** January 2026  
**Version:** 1.0.0 - macOS Edition  
**Status:** Production Ready

**Happy coding on your Mac! 🍎**
