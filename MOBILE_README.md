# Elayone web app

The same Expo app runs as a responsive web app. Use the web command from the repository root:

```bash
npm install
npm run web -- --clear
```

Open the URL printed by Expo, usually `http://localhost:8081`.

# Local database and API

The local database uses PostgreSQL 16 on port `5433`. Its data is stored in the PostgreSQL data directory and survives app restarts.

```bash
npm run db:start
npm run db:status
npm run db:migrate
npm run db:seed
npm run db:backup
npm run server:dev
```

Use `npm run db:stop` when you want to stop PostgreSQL. You do not need to recreate the database for normal development.

`npm run db:backup` creates a timestamped backup in `backups/`. Keep that folder private and back it up separately.

The API runs at `http://localhost:4000`.

To run everything locally, use three terminals:

```bash
# Terminal 1
npm run db:start

# Terminal 2
npm run server:dev

# Terminal 3
npm run web -- --clear
```

# Moving to a hosted database

Create a PostgreSQL database with a provider such as Neon, Supabase, Railway, or Render. Replace only `DATABASE_URL` in `server/.env` with the provider connection string, then run:

```bash
npm run db:migrate
npm run db:seed
```

The API and app code can stay the same because Prisma uses `DATABASE_URL`.
For deployment environments, use `npm run db:deploy` instead of `npm run db:migrate`.

# Elayone mobile app

This directory is the Expo mobile app. Start it from the repository root:

```bash
npm install
npm start
```

For a physical phone, copy `.env.example` to `.env.local`, replace the example IP with the computer's LAN IP, and restart Expo. Do not use `localhost` on a physical phone.

# Elayone API server

The API is a separate Node project in `server/`. Start it independently:

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

The server prints the mobile URL when it starts. Open that URL's `/health` endpoint from the phone's browser to verify network access before testing sign-in.