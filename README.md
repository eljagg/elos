# ELOS - Employee Lunch Ordering System

```
███████╗██╗      ██████╗ ███████╗
██╔════╝██║     ██╔═══██╗██╔════╝
█████╗  ██║     ██║   ██║███████╗
██╔══╝  ██║     ██║   ██║╚════██║
███████╗███████╗╚██████╔╝███████║
╚══════╝╚══════╝ ╚═════╝ ╚══════╝

Employee Lunch Ordering System
```

## 📋 Overview

ELOS is an enterprise-grade, multi-tenant employee meal ordering system designed for organizations with multiple subsidiaries and cafeterias. Built to handle 5,000+ concurrent users with robust security, stability, and bilingual support (English/Spanish).

## ✨ Features

### 👤 Employee Module
- Personalized dashboard with company branding
- Weekly menu view with highlighted current day
- Breakfast and lunch ordering with separate cutoff times
- Dietary filters (Vegan, Vegetarian, Gluten-Free, etc.)
- Order notes and special instructions
- Order history with export (PDF/Excel)
- Kitchen messaging system
- Anonymous HR feedback

### 🍳 Kitchen Staff Module
- Menu management (daily/weekly)
- Made-to-order handling
- Order viewing by company/department
- Soup and special menus
- Employee message responses
- Permission levels (Head Chef, Sous Chef, Assistant)

### 👑 Super Admin Module (Max 2)
- System-wide control
- Company and cafeteria management
- Domain restrictions for sign-ups
- Kitchen staff assignment
- Department management

### 👥 HR Department Module
- Employee management (CRUD)
- Bulk import/export (Excel/CSV)
- Issue tracking and resolution
- Company logo management
- Comprehensive reporting

### 🏢 Receptionist Module
- Guest code generation
- Visitor logging
- Order visibility
- Code usage tracking

### 🚚 Delivery Module
- Multi-building delivery support
- Route management
- Driver tracking
- Delivery notifications

### 🎫 Guest/Contractor Module
- Single-use code access
- Day menu viewing
- One-time ordering

## 🛡️ Security Features

- Password hashing with bcrypt
- JWT authentication with refresh tokens
- Role-based access control (RBAC)
- Two-factor authentication (2FA) for admins
- Domain whitelist for registration
- Rate limiting and brute-force protection
- SQL injection prevention
- XSS protection
- CSRF tokens
- Audit logging
- Session management

## 🌐 Supported Languages

- English (en)
- Spanish (es)

## 📱 Platform Support

- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Android Chrome)
- Responsive design for all screen sizes

## 🏗️ Tech Stack

### Backend
- Node.js with Express.js
- PostgreSQL database
- JWT for authentication
- bcrypt for password hashing

### Frontend
- React 18 with hooks
- Tailwind CSS for styling
- React Router for navigation
- Axios for API calls
- i18next for internationalization

## 📁 Project Structure

```
elos/
├── backend/                 # Server-side code
│   ├── config/             # Configuration files
│   ├── models/             # Database models
│   ├── controllers/        # Business logic
│   ├── routes/             # API endpoints
│   ├── middleware/         # Request processing
│   ├── utils/              # Helper functions
│   └── seeds/              # Initial data
├── frontend/               # Client-side code
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page views
│   │   ├── services/       # API services
│   │   ├── translations/   # Language files
│   │   ├── styles/         # CSS files
│   │   ├── hooks/          # Custom hooks
│   │   └── context/        # React context
│   └── public/             # Static assets
├── database/               # Database scripts
│   ├── migrations/         # Schema changes
│   └── seeds/              # Sample data
└── docs/                   # Documentation
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. Clone the repository
2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```
4. Set up environment variables (see `.env.example`)
5. Run database migrations
6. Start the development servers

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/elos

# JWT
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=3001
NODE_ENV=development

# Email (for notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password
```

## 📊 Default Accounts

After installation, two super admin accounts are created:

| Email | Password | Notes |
|-------|----------|-------|
| superadmin1@elos.local | ChangeMe123! | Must change on first login |
| superadmin2@elos.local | ChangeMe456! | Must change on first login |

## 🔒 Allowed Email Domains

By default, the following domains can register:
- faceycommodity.com
- seprod.com
- mussongroup.com
- tgeddesgrant.com
- pbs.group

Super admins can modify this list.

## 📄 License

Proprietary - All rights reserved

## 👥 Support

For support, contact your system administrator.

---

**ELOS** - Making employee meal ordering simple, secure, and efficient.
