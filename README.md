# StyleStudio – AI Fashion Designer

A full-stack web application for AI-powered outfit recommendations and virtual 3D try-on.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + TailwindCSS |
| 3D Rendering | React Three Fiber + @react-three/drei |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| AI | OpenAI API (gpt-4o-mini + gpt-4o Vision) |
| Avatar | Ready Player Me |

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB running on `localhost:27017` (or MongoDB Atlas URI)
- OpenAI API key (optional – app works with rich mock data without it)

---

### 1. Clone / Open the project

```
d:\Data\VIT\4th sem\edi1\style_anti\
├── backend/
└── frontend/
```

---

### 2. Set up the Backend

```bash
cd backend
npm install
```

Edit `.env`:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/stylestudio
JWT_SECRET=stylestudio_jwt_secret_key_2024
OPENAI_API_KEY=your_openai_api_key_here   # optional
```

Start the backend:
```bash
npm run dev      # with nodemon (auto-reload)
# OR
npm start        # production
```

Backend runs on: **http://localhost:5000**

---

### 3. Set up the Frontend

```bash
cd frontend
npm install
```

`.env.local` is already configured:
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Start the frontend:
```bash
npm run dev
```

Frontend runs on: **http://localhost:3000**

---

## Pages & Features

| Page | Route | Description |
|---|---|---|
| Landing | `/` | Hero section and feature overview |
| Register | `/register` | Create account (name, email, password) |
| Login | `/login` | JWT-based authentication |
| Dashboard | `/dashboard` | Step-by-step overview hub |
| Avatar | `/avatar` | Ready Player Me 3D avatar creator |
| Style Upload | `/upload` | Upload photo for AI body analysis |
| Themes | `/themes` | Pick occasion: Formal, Casual, Wedding… |
| Outfits | `/outfits` | AI-generated outfit suggestion cards |
| Virtual Try-On | `/tryon` | 3D viewer with orbital controls |
| Saved Designs | `/saved` | Rate ★, favourite ♥, share & delete |

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user (protected) |

### Avatar
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/avatar` | Get user avatar URL |
| PUT | `/api/avatar` | Save Ready Player Me avatar URL |

### Upload & AI Analysis
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/upload` | Upload photo, get AI body analysis |

### Outfits
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/outfits/generate` | Generate AI outfit suggestions for a theme |
| GET | `/api/outfits?theme=casual` | Get outfits (optionally filter by theme) |
| PUT | `/api/outfits/:id/rate` | Rate an outfit 1–5 |

### Saved Designs
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/saved-designs` | Save a design |
| GET | `/api/saved-designs` | Get all saved designs (current user) |
| PUT | `/api/saved-designs/:id/favorite` | Toggle favourite |
| PUT | `/api/saved-designs/:id/rate` | Rate design |
| DELETE | `/api/saved-designs/:id` | Delete design |
| GET | `/api/saved-designs/share/:token` | Public share link |

---

## AI Behaviour

- **Without OpenAI key**: Uses curated mock outfits (3 per theme × 6 themes = 18 outfits)
- **With OpenAI key**: Generates personalised outfits using `gpt-4o-mini` and analyses uploaded photos with `gpt-4o` Vision

---

## 3D Virtual Try-On

- Built with **React Three Fiber** + **@react-three/drei**
- If a Ready Player Me avatar exists, loads its GLB from the saved URL
- Falls back to an animated procedural human figure with outfit colours applied
- Orbit controls: **drag to rotate**, **scroll to zoom**

---

## MongoDB Collections

```
users         – id, name, email, password, avatarUrl, bodyCharacteristics
outfits       – id, userId, theme, outfitName, description, colors, clothingPieces
saveddesigns  – id, userId, avatarUrl, outfitData, theme, isFavorite, rating, shareToken
```

---

## Project Structure

```
style_anti/
├── backend/
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── avatarController.js
│   │   ├── uploadController.js
│   │   ├── outfitController.js
│   │   └── savedDesignController.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Outfit.js
│   │   └── SavedDesign.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── avatar.js
│   │   ├── upload.js
│   │   ├── outfit.js
│   │   └── savedDesign.js
│   ├── server.js
│   └── .env
└── frontend/
    ├── app/
    │   ├── page.tsx          (Landing)
    │   ├── login/
    │   ├── register/
    │   ├── dashboard/
    │   ├── avatar/
    │   ├── upload/
    │   ├── themes/
    │   ├── outfits/
    │   ├── tryon/
    │   └── saved/
    ├── components/
    │   ├── Navbar.tsx
    │   ├── AvatarViewer.tsx
    │   ├── OutfitCard.tsx
    │   ├── ThemeToggle.tsx
    │   └── Providers.tsx
    ├── context/
    │   └── AuthContext.tsx
    └── lib/
        └── api.ts
```
