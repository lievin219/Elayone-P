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

## Access control

The platform controls who can view and use files and information based on role and responsibility.

- Team leader → controls access
- Musician → accesses relevant rehearsal material
- Other volunteer → sees information relevant to their assignment

The file-storage system is managed by team leaders, who control access and visibility for each user or role.

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
