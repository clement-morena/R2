import 'dotenv/config'

export const NODE_ENV=process.env.NODE_ENV ?? "production"
export const DATABASE_URL=process.env.DATABASE_URL ?? ""
export const APP_NAME=process.env.APP_NAME ?? "Bot"

export const TOKEN=process.env.TOKEN ?? "NOT_SET"
export const CLIENT_ID=process.env.CLIENT_ID ?? "NOT_SET"
export const DEV_GUILD_ID=process.env.DEV_GUILD_ID ?? "NOT_SET"

export const SOUNDBOARD_ORIGIN=process.env.SOUNDBOARD_ORIGIN ?? ""
export const SOUNDBOARD_PORT=process.env.SOUNDBOARD_PORT ? parseInt(process.env.SOUNDBOARD_PORT) : 3600

// https://developer.riotgames.com/ — required for Viktor loss alerts
export const RIOT_API_KEY=process.env.RIOT_API_KEY ?? ""