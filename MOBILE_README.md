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