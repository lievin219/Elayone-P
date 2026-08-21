# Elayone Choir API

## Local Postgres

Create a Postgres database named `elayone`, copy `.env.example` to `.env`, and update `DATABASE_URL` and `JWT_SECRET`.

```bash
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run dev
```

The API runs on `http://localhost:4000`. Set `EXPO_PUBLIC_API_URL` for the mobile client. For a physical phone, use your computer's LAN IP instead of `localhost`.

Routes:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/choirs/me`
- `GET /api/choirs/:choirId/people`
- `GET /api/choirs/:choirId/rehearsals`
- `GET /api/choirs/:choirId/attendance/summary`
- `POST /api/choirs/:choirId/rehearsals/:rehearsalId/attendance`
- `GET /api/choirs/:choirId/announcements`
- `GET /api/choirs/:choirId/songs`
