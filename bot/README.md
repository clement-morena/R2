# Installation

Prerequisites
- Node.js (recommended LTS) and npm installed
- Discord application and bot token

1) Create the environment file
- Copy or create `.env` in the repository root and fill values:

```
# .env (example)
NODE_ENV="development"

APP_NAME="R2"
DATABASE_URL="file:./dev.db"

TOKEN="DISCORD TOKEN"
CLIENT_ID="DISCORD CLIENT ID"
DEV_GUILD_ID="DEV GUILD ID"

SOUNDBOARD_ORIGIN="http://localhost:8888"
SOUNDBOARD_PORT="8888"

RIOT_API_KEY="RIOT API KEY"

```

2) Install dependencies and prepare the database
- Install project dependencies and run migrations:

```
npm run install-all
npx prisma migrate dev
```

Notes:
- `install-all` is expected to install required packages.
- `npx prisma migrate dev` requires the database from `DATABASE_URL` to be reachable. To reset local migrations use `npx prisma migrate reset`.

3) Build the app

```
npm run build
```

4) Deploy and run
- Deploy (if applicable) and start the app locally:

```
npm run global-deploy
npm start
```
