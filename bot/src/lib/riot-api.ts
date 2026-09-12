import axios from "axios";
import { RIOT_API_KEY } from "../app/env.js";

const REGIONAL_HOST = "https://europe.api.riotgames.com";
const REQUEST_TIMEOUT_MS = 10_000;

interface ChampionCatalog {
	byId: Map<string, ChampionInfo>;
	fetchedAt: number;
}

export interface ChampionInfo {
	name: string;
	iconUrl: string;
}

export interface RiotAccount {
	puuid: string;
	gameName: string;
	tagLine: string;
}

export interface RiotParticipant {
	puuid: string;
	championName: string;
	kills: number;
	deaths: number;
	assists: number;
	win: boolean;
	teamPosition: string;
	placement: number;
}

export interface RiotMatch {
	matchId: string;
	gameDuration: number;
	gameEndTimestamp: number | null;
	gameMode: string;
	queueId: number;
	participants: RiotParticipant[];
}

interface AccountDto {
	puuid: string;
	gameName: string;
	tagLine: string;
}

interface MatchDto {
	metadata: { matchId: string };
	info: {
		gameDuration: number;
		gameEndTimestamp?: number;
		gameMode: string;
		queueId: number;
		participants: Array<{
			puuid: string;
			championName: string;
			kills: number;
			deaths: number;
			assists: number;
			win: boolean;
			teamPosition?: string;
			placement?: number;
		}>;
	};
}

interface ChampionDto {
	data: Record<string, {
		id: string;
		name: string;
		image?: { full?: string };
	}>;
}

let championCatalog: ChampionCatalog | null = null;

export function isRiotApiConfigured(): boolean {
	return RIOT_API_KEY.length > 0 && RIOT_API_KEY !== "NOT_SET";
}

export function isRiotNotFound(error: unknown): boolean {
	return axios.isAxiosError(error) && error.response?.status === 404;
}

export function describeRiotError(error: unknown): string {
	if (axios.isAxiosError(error)) {
		const status = error.response?.status;
		const body = error.response?.data;
		const detail = typeof body === "string"
			? body
			: body
				? JSON.stringify(body)
				: error.message;
		const summary = status ? `HTTP ${status}: ${detail}` : detail;
		return summary.slice(0, 500);
	}
	if (error instanceof Error) return error.message;
	return String(error);
}

export async function getAccountByRiotId(gameName: string, tagLine: string): Promise<RiotAccount> {
	const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
	const data = await riotGet<AccountDto>(path);
	if (!data.puuid) {
		throw new Error(`Riot account ${gameName}#${tagLine} did not include a puuid`);
	}
	return {
		puuid: data.puuid,
		gameName: data.gameName,
		tagLine: data.tagLine,
	};
}

export async function getRecentMatchIds(puuid: string, count: number): Promise<string[]> {
	const path = `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${count}`;
	const ids = await riotGet<string[]>(path);
	return Array.isArray(ids) ? ids : [];
}

export async function getMatch(matchId: string): Promise<RiotMatch> {
	const data = await riotGet<MatchDto>(`/lol/match/v5/matches/${encodeURIComponent(matchId)}`);
	return {
		matchId: data.metadata.matchId,
		gameDuration: data.info.gameDuration,
		gameEndTimestamp: data.info.gameEndTimestamp ?? null,
		gameMode: data.info.gameMode,
		queueId: data.info.queueId,
		participants: data.info.participants.map((participant) => ({
			puuid: participant.puuid,
			championName: participant.championName,
			kills: participant.kills,
			deaths: participant.deaths,
			assists: participant.assists,
			win: participant.win,
			teamPosition: participant.teamPosition ?? "",
			placement: participant.placement ?? 0,
		})),
	};
}

export async function getChampion(championId: string): Promise<ChampionInfo | null> {
	const catalog = await getChampionCatalog();
	return catalog?.byId.get(championId.toLowerCase()) ?? null;
}

async function getChampionCatalog(): Promise<ChampionCatalog | null> {
	if (championCatalog && Date.now() - championCatalog.fetchedAt < 24 * 60 * 60 * 1000) {
		return championCatalog;
	}

	const versions = await axios.get<string[]>("https://ddragon.leagueoflegends.com/api/versions.json", {
		timeout: REQUEST_TIMEOUT_MS,
	});
	const version = versions.data[0];
	if (!version) return championCatalog;

	const response = await axios.get<ChampionDto>(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`, {
		timeout: REQUEST_TIMEOUT_MS,
	});
	const byId = new Map<string, ChampionInfo>();
	for (const champion of Object.values(response.data.data)) {
		const image = champion.image?.full ?? `${champion.id}.png`;
		byId.set(champion.id.toLowerCase(), {
			name: champion.name,
			iconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${encodeURIComponent(image)}`,
		});
	}
	championCatalog = { byId, fetchedAt: Date.now() };
	return championCatalog;
}

async function riotGet<T>(path: string): Promise<T> {
	const response = await axios.get<T>(`${REGIONAL_HOST}${path}`, {
		timeout: REQUEST_TIMEOUT_MS,
		headers: {
			"X-Riot-Token": RIOT_API_KEY,
		},
	});
	return response.data;
}
