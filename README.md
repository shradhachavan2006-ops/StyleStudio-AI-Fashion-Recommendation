# StyleStudio - Fashion Recommendation System

StyleStudio is a full-stack fashion recommendation app that suggests outfits from the local image dataset using questionnaire answers, user profile data, saved actions, feedback, and CSV metadata.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router + TailwindCSS |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| Dataset | `New Images/New Images` + CSV metadata |
| Recommendation | Rule-based matching, behavior scoring, optional local ML score service |

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB running on `localhost:27017` or a MongoDB Atlas URI

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:5000`.

Backend `.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/stylestudio
JWT_SECRET=stylestudio_jwt_secret_key_2024
ADMIN_EMAILS=admin@example.com
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

Frontend `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Main Features

| Page | Route | Description |
|---|---|---|
| Landing | `/` | Welcome page |
| Register | `/register` | Create account |
| Login | `/login` | JWT login |
| Dashboard | `/dashboard` | Main user hub |
| Body Profile | `/body-profile` | Questionnaire for style preferences |
| Themes | `/themes` | Select occasion/theme |
| Outfits | `/outfits` | Recommended outfits from dataset images |
| Saved Outfits | `/saved` | Saved recommendations |
| Admin | `/admin` | Secure analytics, user management, outfit moderation, reports, notifications |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/outfits/generate` | Generate outfit records for a theme |
| GET | `/api/outfits?theme=party` | Get recommended outfits |
| PUT | `/api/outfits/:id/rate` | Rate an outfit |
| POST | `/api/saved-outfits` | Save an outfit |
| GET | `/api/saved-outfits` | Get saved outfits |
| POST | `/api/actions` | Track like/dislike/save actions |
| POST | `/api/feedback` | Submit feedback |
| GET | `/api/dataset` | Dataset inspection endpoints |
| GET | `/api/admin/overview` | Admin overview metrics and realtime activity |
| GET | `/api/admin/satisfaction` | Satisfaction and review analytics |
| GET | `/api/admin/users` | Admin user management |
| PATCH | `/api/admin/users/:id` | Update role, status, or reset preferences |
| DELETE | `/api/admin/users/:id` | Delete user and related data |
| GET | `/api/admin/outfits` | Outfit moderation list |
| PATCH | `/api/admin/outfits/:id` | Update outfit metadata/status |
| GET | `/api/admin/trends` | Fashion trend analytics |
| POST | `/api/admin/notifications` | Send admin-created announcement |
| GET | `/api/admin/reports/export` | Download CSV report |

Admin APIs require a valid JWT plus an admin role. In development, set `ADMIN_EMAILS` or register/login with an email containing `admin`.

## Recommendation Flow

1. User registers/logs in.
2. User fills the body profile and preference questionnaire.
3. User selects a theme such as party, formal, casual, office, travel, wedding, or traditional.
4. Backend creates theme-specific outfit combinations.
5. Image matching service selects real JPG images from `New Images/New Images` using CSV metadata.
6. Personalization and behavior scoring rank outfits.
7. Likes, dislikes, saves, ratings, and feedback improve future ranking.

## MongoDB Collections

```text
users          - account, profile, preferences
outfits        - generated outfit records
savedoutfits   - saved user outfits
actions        - likes, dislikes, saves, visits
feedback       - user feedback and ratings
adminauditlogs - admin actions
adminnotifications - announcements and alerts
```

## Project Structure

```text
style_anti/
  backend/
    controllers/
    middleware/
    models/
    routes/
    services/
    server.js
  frontend/
    app/
    components/
    context/
    lib/
  data/
    new_images_styles.csv
    new_images_theme_metadata.csv
  New Images/
    New Images/
```
