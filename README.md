# Elayone Choir

React Native + TypeScript mobile app with a Postgres-backed TypeScript API.

## Start Postgres and API

Requirements: Node.js 20+, Docker Desktop, and Expo Go or an iOS/Android simulator.

```bash
docker compose up -d
cp server/.env.example server/.env
npm run server:install
npm --prefix server run db:migrate -- --name init
npm --prefix server run db:seed
npm run server:dev
```

For a physical phone, set `EXPO_PUBLIC_API_URL` in `.env` to the computer's LAN IP, for example `http://192.168.1.20:4000`. `localhost` works in a simulator on the same computer.

## Start the mobile app

```bash
npm install
npm start
```

The client supports persisted login/signup sessions using Expo SecureStore. The API exposes auth, choir membership, rehearsal, attendance, and song endpoints.

Seed account:

- Email: `director@elayone.org`
- Password: `ChangeMe123!`

Change the seed password before using this outside local development.
# Elayone-p
