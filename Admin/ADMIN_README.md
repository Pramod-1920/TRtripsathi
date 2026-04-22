# TRTrips Admin Dashboard

A comprehensive Next.js-based admin dashboard for managing TRTrips users, profiles, and analytics.

## Features

### 📊 Dashboard
- Real-time statistics and metrics
- User activity overview
- Recent users list
- Activity trends visualization

### 👥 User Management
- View all users with search and filtering
- User profile details and editing
- Status management (active/inactive/blocked)
- Profile completion tracking
- Cascade delete with auth record cleanup

### 📈 Analytics & Reports
- User growth metrics
- Profile completion rates
- Experience level distribution
- Top active users
- Session duration tracking
- User retention analytics

### 🔐 Authentication
- Admin-only access
- JWT token-based authentication
- Automatic token refresh
- Secure cookie storage

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Icons**: React Icons

## Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env.local
   ```

3. **Update `.env.local` with your backend API URL**:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3000/api
   ```

### Development

Start the development server:
```bash
npm run dev
```

The admin panel will be available at `http://localhost:3000`

### Production Build

Build for production:
```bash
npm run build
npm run start
```

## Project Structure

```
admin/
├── app/
│   ├── dashboard/          # Dashboard page
│   ├── users/              # Users management
│   │   ├── page.tsx        # Users list
│   │   └── [id]/           # User detail page
│   ├── analytics/          # Analytics page
│   ├── login/              # Login page
│   ├── layout.tsx          # Root layout
│   ├── layout-wrapper.tsx  # Layout wrapper with sidebar
│   └── page.tsx            # Home/redirect page
├── components/
│   ├── sidebar.tsx         # Navigation sidebar
│   ├── header.tsx          # Top header
│   ├── stat-card.tsx       # Statistics card component
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── api.ts              # Axios API client with interceptors
│   ├── auth-store.ts       # Zustand auth store
│   └── utils.ts            # Utility functions
├── public/                 # Static assets
└── ...config files         # Next.js, TypeScript, etc.
```

## API Integration

The admin dashboard connects to the NestJS backend API. Ensure your backend is running and accessible.

### Backend API Endpoints Used

**Authentication**:
- `POST /auth/login` - Admin login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout

**Users (Admin)**:
- `GET /user/admin/profiles` - Get all user profiles
- `GET /user/admin/profiles/:id` - Get specific user profile
- `PATCH /user/admin/profiles/:id` - Update user profile
- `DELETE /user/admin/profiles/:id` - Delete user profile

**Users (Search)**:
- `GET /user/search` - Search and filter users

## Authentication Flow

1. User navigates to `/login`
2. Enters phone number and password
3. Backend validates credentials and returns JWT access token
4. Token stored in httpOnly cookie and localStorage
5. Subsequent API calls include token in Authorization header
6. Token auto-refresh on expiry (401 response)
7. Invalid/expired tokens redirect to login

## Development Tips

### Adding New Pages

1. Create a new folder in `app/`
2. Add `page.tsx` file
3. File-based routing will automatically create the route

### API Calls

Use the provided `apiClient` from `lib/api.ts`:

```typescript
import { apiClient } from '@/lib/api';

// GET
const data = await apiClient.get('/user/admin/profiles');

// POST
const response = await apiClient.post('/auth/login', { phoneNumber, password });

// PATCH
await apiClient.patch(`/user/admin/profiles/${id}`, updates);

// DELETE
await apiClient.delete(`/user/admin/profiles/${id}`);
```

### State Management

Use Zustand store for auth state:

```typescript
import { useAuthStore } from '@/lib/auth-store';

const user = useAuthStore((state) => state.user);
const login = useAuthStore((state) => state.login);
const logout = useAuthStore((state) => state.logout);
```

## Common Tasks

### Modify User Search Filters

Edit `app/users/page.tsx` to add or remove filter options in the search form.

### Add New Dashboard Metric

1. Add new StatCard in `app/dashboard/page.tsx`
2. Fetch data from backend API
3. Display using the StatCard component

### Customize Styling

Tailwind CSS classes are used throughout. Modify `tailwind.config.ts` for custom theme colors.

## Troubleshooting

### "Cannot find module" errors
```bash
npm install
```

### API Connection Errors
1. Verify backend is running on `http://localhost:3000`
2. Check `NEXT_PUBLIC_API_URL` in `.env.local`
3. Ensure CORS is enabled on backend

### Token Expiry Issues
1. Check browser DevTools > Application > Cookies
2. Verify token is stored correctly
3. Check backend JWT configuration

## License

MIT

## Support

For issues or questions, contact the development team.
