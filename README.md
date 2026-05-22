# StyleStudio - AI Fashion Recommendation System

StyleStudio is a full-stack fashion recommendation app. It creates theme-based outfit recommendations from a local fashion image dataset, matches each recommendation to real catalogue images, and learns from each user's saves, likes, dislikes, ratings, and profile data.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, React, TailwindCSS, lucide-react |
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB |
| Auth | JWT, bcryptjs |
| Dataset | Local `New Images/New Images` folder plus CSV metadata |
| Recommendation | Rule-based theme/gender matching, behavior scoring, optional local ML score service |

## Current Feature Set

- User registration/login with JWT.
- First login sends the user to Body Profile; later logins skip it once `onboardingDone` is saved.
- Body profile stores gender, body type, skin tone, style preferences, lifestyle, personality, and season.
- Theme recommendations for `formal`, `casual`, `traditional`, `wedding`, `party`, `office`, and `travel`.
- Strict theme filters:
  - `formal` and `office`: formal shirts only.
  - `casual` and `travel`: casual t-shirts, tops, and shirts.
  - `traditional`: kurtas and kurta sets.
  - `wedding`: embroidered/zari/silk/ethnic wedding items.
  - `party`: only explicitly added party supplement images.
- Strict gender filtering for outfit images. Gendered users only receive exact-gender clothing images; bad `Unisex` fallback is avoided for clothing.
- Male wedding labels use sherwani/kurta templates; female wedding labels use lehenga/saree templates.
- One-image outfit display. Bottomwear images are not shown and are excluded from the main picker.
- Saved outfits, likes, dislikes, and recent activity are tracked per logged-in user.
- Dashboard stats are user-specific and update from backend data.
- Admin dashboard supports overview metrics, user management, outfit moderation, reports, notifications, and dataset views.
- Roles are intentionally limited to only `user` and `admin`.

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB running locally or an Atlas URI
- Dataset images in `New Images/New Images`

### Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:5000`.

Backend `.env` example:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/stylestudio
JWT_SECRET=stylestudio_jwt_secret_key_2024
ADMIN_EMAILS=admin@example.com
```

Useful backend scripts:

```bash
npm run create-admin
npm run normalize-roles
npm run clean-user-enums
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

Frontend `.env.local` example:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Build check:

```bash
cd frontend
npm.cmd run build
```

Use `npm.cmd` on Windows if PowerShell blocks `npm.ps1`.

## Admin Accounts

There are only two roles:

- `user`
- `admin`

Admin accounts can be created from the admin signup flow or with:

```bash
cd backend
npm run create-admin
```

If old users have legacy roles, normalize them:

```bash
npm run normalize-roles
```

Admin routes require a valid JWT and admin role or an email listed in `ADMIN_EMAILS`.

## Data Files

The main catalogue files are:

```text
data/new_images_styles.csv
data/new_images_theme_metadata.csv
New Images/New Images/
```

Supplement files are loaded in addition to the main CSV:

```text
data/party_images_styles.csv
data/party_images_theme_metadata.csv
data/formal_images_styles.csv
data/formal_images_theme_metadata.csv
```

These supplements are useful when the main CSV is open in Excel or when a theme needs curated images.

### Supplement CSV Format

Style rows:

```csv
id,gender,masterCategory,subCategory,articleType,baseColour,season,year,usage,productDisplayName
formal_0,Women,Apparel,Topwear,Shirts,Lavender,All,2026,Formal,Women Lavender Striped Formal Shirt
```

Theme metadata rows:

```csv
id,theme,sourceId,sourceImage
formal_0,formal,14010,14010.jpeg
```

The `sourceImage` file must exist under:

```text
New Images/New Images/
```

## Recommendation Flow

1. User registers or logs in.
2. If the body profile is incomplete, the app opens `/body-profile`.
3. User selects a theme on `/themes`.
4. Backend deletes the user's previous generated outfits for that theme.
5. Backend chooses a varied set of templates for the theme and gender.
6. Image matching selects real dataset images using strict gender and theme rules.
7. Outfits are ranked by profile and user behavior.
8. User interactions are saved as user-specific actions.
9. Dashboard reads `/api/actions/summary` for live per-user stats.

Repeated generation uses seeded shuffling and template variants so the same theme does not always return the exact same set.

## Main Routes

| Page | Route | Description |
|---|---|---|
| Landing | `/` | Welcome page |
| Register | `/register` | Create user account |
| Login | `/login` | JWT login |
| Dashboard | `/dashboard` | User stats and journey |
| Body Profile | `/body-profile` | Profile questionnaire |
| Themes | `/themes` | Select occasion/theme |
| Outfits | `/outfits?theme=formal` | Outfit recommendations |
| Saved | `/saved` | User's saved outfits |
| Stores | `/stores` | Store discovery |
| Admin | `/admin` | Admin login/dashboard/signup |

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| PUT | `/api/profile` | Save body profile |
| POST | `/api/outfits/generate` | Generate a fresh theme batch |
| GET | `/api/outfits?theme=formal` | Fetch generated outfits |
| PUT | `/api/outfits/:id/rate` | Rate outfit |
| POST | `/api/saved-outfits` | Save outfit |
| DELETE | `/api/saved-outfits/:outfitId` | Unsave outfit |
| GET | `/api/saved-outfits` | User saved outfits |
| GET | `/api/saved-outfits/ids` | Saved outfit IDs for UI state |
| POST | `/api/actions` | Log view, like, save, reject, rating |
| DELETE | `/api/actions` | Remove like/save/reject/rating state |
| GET | `/api/actions` | User action history |
| GET | `/api/actions/summary` | User dashboard counters |
| GET | `/api/actions/analytics` | User ML readiness analytics |
| POST | `/api/feedback` | Submit feedback |
| GET | `/api/dataset/*` | Dataset inspection/validation |
| GET | `/api/admin/overview` | Admin overview |
| GET | `/api/admin/satisfaction` | Feedback analytics |
| GET | `/api/admin/users` | Admin user management |
| PATCH | `/api/admin/users/:id` | Update user role/status/preferences |
| DELETE | `/api/admin/users/:id` | Delete user and related data |
| GET | `/api/admin/outfits` | Outfit moderation |
| PATCH | `/api/admin/outfits/:id` | Update outfit metadata/status |
| GET | `/api/admin/trends` | Trend analytics |
| POST | `/api/admin/notifications` | Admin announcement |
| GET | `/api/admin/reports/export` | CSV report export |

## MongoDB Collections

```text
users                account, role, body profile, onboarding state
outfits              generated outfit records
saved_outfits        saved outfit snapshots per user
useractions          views, likes, saves, rejects, ratings
userfeedbacks        feedback modal ratings/comments
adminauditlogs       admin activity records
adminnotifications   admin announcements
```

## Project Structure

```text
style_anti/
  backend/
    controllers/
    middleware/
    models/
    routes/
    scripts/
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
    party_images_styles.csv
    party_images_theme_metadata.csv
    formal_images_styles.csv
    formal_images_theme_metadata.csv
  New Images/
    New Images/
```

## Notes For Dataset Updates

- Keep IDs unique across all CSVs.
- Use exact gender values: `Women`, `Men`, or `Unisex`.
- Prefer exact theme usage values such as `Formal`, `Casual`, `Ethnic`, and `Party`.
- For curated themes, add a supplement CSV instead of editing the large main CSV while it is open in Excel.
- Restart the backend after adding CSV rows so the catalogue reloads.
- Click `Refresh` on the outfit page to regenerate old MongoDB records after dataset changes.

## Troubleshooting

- If PowerShell blocks `npm run build`, use `npm.cmd run build`.
- If profile login crashes with enum validation, run `npm run clean-user-enums`.
- If old admin roles exist, run `npm run normalize-roles`.
- If wrong images persist after a code/data fix, click `Refresh` on the outfit page to regenerate records.
- If the dashboard count looks stale, leave and return to `/dashboard`; it refetches on focus and page load.
