import { JobExecutionType, JobTag } from "../../../../generated/prisma/enums.js";
import DefaultEmbed, { EmbedColor } from "../../../../lib/default-embed.js";
import {
	describeRiotError,
	getAccountByRiotId,
	getChampion,
	getMatch,
	getRecentMatchIds,
	isRiotApiConfigured,
	isRiotNotFound,
	type RiotMatch,
	type RiotParticipant,
} from "../../../../lib/riot-api.js";
import type Bot from "../../../bot.js";
import { prisma } from "../../../db.js";
import logger from "../../../logger.js";
import { JobScheduler } from "../job-scheduler.js";

// League of Graphs uses "-" in place of "#" in Riot IDs.
const TRACKED_SUMMONER = {
	gameName: "viktor",
	tagLine: "ET40",
	profileUrl: "https://www.leagueofgraphs.com/summoner/euw/viktor-ET40",
} as const;

const QUEUE_NAMES: Record<number, string> = {
	0: "Custom",
	400: "Normal Draft",
	420: "Ranked Solo/Duo",
	430: "Normal Blind",
	440: "Ranked Flex",
	450: "ARAM",
	480: "Swiftplay",
	490: "Quickplay",
	700: "Clash",
	720: "ARAM Clash",
	900: "ARURF",
	1020: "One for All",
	1300: "Nexus Blitz",
	1400: "Ultimate Spellbook",
	1700: "Arena",
	1710: "Arena",
	1900: "URF",
};

const POSITION_NAMES: Record<string, string> = {
	TOP: "Top",
	JUNGLE: "Jungle",
	MIDDLE: "Mid",
	BOTTOM: "Bot",
	UTILITY: "Support",
};

const TAUNTS = [
	"The rift sends its regards.",
	"Another one for the spreadsheet.",
	"GG go next.",
	"Unlucky. Definitely unlucky.",
	"The nexus has notes.",
	"He tried. The scoreboard disagreed.",
	"Skill issue, sourced and peer-reviewed.",
	"The enemy team would like to thank him.",
	"A bold strategy. Poorly executed.",
	"He queued up. The rift said no.",
	"Loss acquired. Dignity not included.",
	"That one is going in the museum.",
	"The victory screen was someone else's.",
	"He saw the enemy nexus and got shy.",
	"Calculated. He calculated wrong.",
	"The report button is warming up.",
	"His teammates are filing for emotional damages.",
	"Not even the fountain could save him.",
	"He lost the lane, the map, and the plot.",
	"A masterclass in the other direction.",
	"The baron pit has entered the chat.",
	"He donated that LP personally.",
	"Highlight reel material. For them.",
	"The surrender vote was a mercy.",
	"He stared at the minimap. It stared back.",
	"Another L. Nature is healing.",
	"The queue found him. The queue won.",
	"He flash-assisted his own funeral.",
	"Chat is typing. We already know.",
	"The dragon got a participation trophy. He did not.",
	"He built the wrong items and the wrong decisions.",
	"Close game. If you squint. And lie.",
	"The enemy jungler owes him a thank-you note.",
	"He inted, but like, artistically.",
	"Ranked anxiety was correct this time.",
	"The rift is 1, he is 0, and it is not close.",
	"He said 'play for late'. Late said no.",
	"Ward the river. Or don't. He didn't.",
	"His KDA just filed a missing persons report.",
	"The champion select was the peak.",
	"He peaked in the loading screen.",
	"A generational loss. Frame it.",
	"The enemy ADC is sending flowers.",
	"He had a plan. The plan had other plans.",
	"GG. The G is silent.",
	"The nexus exploded out of politeness.",
	"He was the win condition. The condition was not met.",
	"Another gray screen, another story.",
	"The post-game lobby is a crime scene.",
	"He lost with confidence, which is worse.",
	"The rift has a type, and it is not him.",
	"He got gapped, mapped, and wrapped.",
	"Only the rift knows what that was.",
	"He contributed. Negatively. But consistently.",
	"The honor screen skipped him on purpose.",
	"He queued for LP and received a lesson.",
	"History will not be kind. The graph already isn't.",
	"He saw an opening. It was a trap. It was always a trap.",
	"The enemy team is framing this screenshot.",
	"A loss so clean it almost looks intentional.",
	"He will review the VOD. He will not enjoy it.",
	"The minions did more for that game than he did.",
	"He pressed R. R pressed charges.",
	"Not his elo. Not his game. Not his day.",
	"The defeat screen loaded faster than he did.",
	"He brought a champion. They brought a team.",
	"Another day, another donation to the enemy LP fund.",
	"The rift keeps the receipt.",
	"He lost so hard the poro flinched.",
	"Champion diff, player diff, aura diff.",
	"He walked up. That was the mistake.",
	"The comeback never left the group chat.",
	"He was never out of the fight. The fight was out of him.",
	"Statistically, this was a choice.",
	"The enemy nexus is fine. His mental is not.",
	"He lost the coin flip, the fight, and the remake window.",
	"A cinematic loss. No sequel needed.",
	"The scoreboard is doing stand-up.",
	"He will queue again. The rift is patient.",
	"That LP was never his. It was visiting.",
	"He played for the clip. The clip played him.",
	"The fountain is the only place he was safe.",
	"He got caught. Then he got caught again. Then again.",
	"A public service announcement: he lost.",
	"The rift does not negotiate.",
	"He had vision of the disaster the whole time.",
	"The enemy team is still laughing in fountain.",
	"He burned flash for nothing and died for less.",
	"Another loss to add to the curriculum.",
	"He was the objective. They took him.",
	"The graph does not lie. The graph is unkind.",
	"He typed 'mb'. It was not the first time.",
	"The nexus fell. So did the excuse.",
	"He lost in 4K.",
	"Even the turrets were embarrassed.",
	"He will get them next game. He said that last game.",
	"The rift collected. Payment refused to bounce.",
	"A loss with extras. No tips accepted.",
	"He was the throw. The throw was complete.",
	"The enemy jungler has a shrine to this game.",
	"He finished the game. The game finished him first.",
	"Certified loss. Signed by the scoreboard.",
] as const;

export interface SubscribedChannel {
	guildId: string;
	channelId: string;
}

export interface ViktorLossJobPayload {
	subscribedChannels: SubscribedChannel[];
	puuid: string | null;
	lastSeenMatchId: string | null;
}

let missingKeyLogged = false;

export async function runViktorLossJob(bot: Bot, rawJobPayload: string) {
	try {
		await pollViktorLosses(bot, rawJobPayload);
	} catch (error) {
		logger.error(`Viktor loss job failed: ${describeRiotError(error)}`);
	}
}

export async function createViktorLossJob(subscribedChannels: SubscribedChannel[]) {
	const payload: ViktorLossJobPayload = {
		subscribedChannels,
		puuid: null,
		lastSeenMatchId: null,
	};
	const job = await prisma.scheduledJob.create({
		data: {
			executionType: JobExecutionType.CRON,
			cronExpr: "*/2 * * * *",
			tag: JobTag.TRACK_VIKTOR_LOSSES,
			payload: JSON.stringify(payload),
		},
	});

	JobScheduler.instance.scheduleJob(job);
	void seedViktorTracker();
	return job;
}

export async function toggleViktorChannel(channel: SubscribedChannel): Promise<boolean> {
	const job = await prisma.scheduledJob.findFirst({
		where: { tag: JobTag.TRACK_VIKTOR_LOSSES },
	});
	if (!job) {
		await createViktorLossJob([channel]);
		return true;
	}

	let enabled = false;
	await patchViktorLossPayload((payload) => {
		const subscribed = payload.subscribedChannels.some((entry) => isSameChannel(entry, channel));
		if (subscribed) {
			payload.subscribedChannels = payload.subscribedChannels.filter((entry) => !isSameChannel(entry, channel));
			enabled = false;
			return;
		}
		payload.subscribedChannels.push(channel);
		enabled = true;
	});
	return enabled;
}

async function pollViktorLosses(bot: Bot, rawJobPayload: string) {
	const payload = parsePayload(rawJobPayload);
	if (!isRiotApiConfigured()) {
		warnMissingKey();
		return;
	}

	const puuid = payload.puuid ?? await resolvePuuid();
	if (!puuid) return;

	if (!payload.lastSeenMatchId) {
		await baselineTracker(puuid);
		return;
	}

	const matchIds = await getRecentMatchIds(puuid, 10);
	const cursor = payload.lastSeenMatchId;
	const newest = matchIds[0];
	if (payload.subscribedChannels.length === 0) {
		if (newest && matchSequence(newest) > matchSequence(cursor)) {
			await rememberMatch(puuid, newest);
		}
		return;
	}

	const unseen = matchIds
		.filter((matchId) => matchSequence(matchId) > matchSequence(cursor))
		.sort((left, right) => matchSequence(left) - matchSequence(right));
	if (unseen.length === matchIds.length && matchIds.length > 0) {
		logger.warn(`Viktor tracker cursor ${cursor} is older than the last ${matchIds.length} matches. Losses in between may be skipped.`);
	}

	for (const matchId of unseen) {
		try {
			const match = await getMatch(matchId);
			if (isTrackedLoss(match, puuid)) {
				await announceLoss(bot, payload.subscribedChannels, match, puuid);
			}
		} catch (error) {
			if (!isRiotNotFound(error)) {
				logger.error(`Failed to process match ${matchId}: ${describeRiotError(error)}`);
				break;
			}
			logger.error(`Skipping missing match ${matchId}: ${describeRiotError(error)}`);
		}
		await rememberMatch(puuid, matchId);
	}
}

async function rememberMatch(puuid: string, matchId: string) {
	await patchViktorLossPayload((current) => {
		current.puuid = puuid;
		current.lastSeenMatchId = matchId;
	});
}

async function seedViktorTracker() {
	if (!isRiotApiConfigured()) {
		warnMissingKey();
		return;
	}
	try {
		const account = await getAccountByRiotId(TRACKED_SUMMONER.gameName, TRACKED_SUMMONER.tagLine);
		logger.info(`Tracking Riot account ${account.gameName}#${account.tagLine}`);
		await baselineTracker(account.puuid);
	} catch (error) {
		logger.error(`Failed to baseline Viktor tracker: ${describeRiotError(error)}`);
	}
}

async function resolvePuuid(): Promise<string | null> {
	try {
		const account = await getAccountByRiotId(TRACKED_SUMMONER.gameName, TRACKED_SUMMONER.tagLine);
		logger.info(`Tracking Riot account ${account.gameName}#${account.tagLine}`);
		await patchViktorLossPayload((payload) => {
			payload.puuid = account.puuid;
		});
		return account.puuid;
	} catch (error) {
		logger.error(`Failed to resolve ${riotId()}: ${describeRiotError(error)}`);
		return null;
	}
}

async function baselineTracker(puuid: string) {
	const matchIds = await getRecentMatchIds(puuid, 1);
	const latest = matchIds[0] ?? null;
	await patchViktorLossPayload((payload) => {
		payload.puuid = puuid;
		if (!payload.lastSeenMatchId && latest) {
			payload.lastSeenMatchId = latest;
		}
	});
	logger.info(latest
		? `Viktor tracker is watching for games after ${latest}`
		: "Viktor has no recent matches yet; waiting for the first finished game.");
}

function isTrackedLoss(match: RiotMatch, puuid: string): boolean {
	const player = match.participants.find((participant) => participant.puuid === puuid);
	if (!player || player.win) return false;
	// Remakes and aborted games have no winner.
	return match.participants.some((participant) => participant.win);
}

async function announceLoss(bot: Bot, channels: SubscribedChannel[], match: RiotMatch, puuid: string) {
	const player = match.participants.find((participant) => participant.puuid === puuid);
	if (!player) return;

	const embed = await buildLossEmbed(match, player);
	const content = `💀 **${riotId()}** lost a game.`;
	logger.info(`${riotId()} lost ${match.matchId} as ${player.championName} (${player.kills}/${player.deaths}/${player.assists})`);

	for (const channelInfo of channels) {
		try {
			const guild = bot.client.guilds.cache.get(channelInfo.guildId);
			if (!guild) continue;
			const channel = guild.channels.cache.get(channelInfo.channelId)
				?? await guild.channels.fetch(channelInfo.channelId);
			if (!channel || !channel.isTextBased()) continue;
			await channel.send({ content, embeds: [embed] });
		} catch (error) {
			logger.error(`Failed to send Viktor loss to ${channelInfo.channelId} in guild ${channelInfo.guildId}: ${describeRiotError(error)}`);
		}
	}
}

async function buildLossEmbed(match: RiotMatch, player: RiotParticipant) {
	const champion = await resolveChampion(player.championName);
	const kda = `${player.kills}/${player.deaths}/${player.assists}`;
	const details = [
		queueLabel(match.queueId, match.gameMode),
		positionLabel(player.teamPosition),
		placementLabel(player.placement),
		formatDuration(durationSeconds(match)),
	].filter((part): part is string => part !== null);

	const embed = new DefaultEmbed();
	embed.setColor(EmbedColor.RED);
	embed.setAuthor({
		name: riotId(),
		url: TRACKED_SUMMONER.profileUrl,
	});
	embed.setTitle(`${champion.name} · ${kda}`);
	embed.setDescription(`${tauntFor(match.matchId)}\n${details.join(" · ")}`);
	embed.setTimestamp(match.gameEndTimestamp ? new Date(match.gameEndTimestamp) : new Date());

	const matchUrl = leagueOfGraphsMatchUrl(match.matchId);
	if (matchUrl) {
		embed.setURL(matchUrl);
	}
	if (champion.iconUrl) {
		embed.setThumbnail(champion.iconUrl);
	}

	return embed;
}

async function patchViktorLossPayload(mutate: (payload: ViktorLossJobPayload) => void) {
	const job = await prisma.scheduledJob.findFirst({
		where: { tag: JobTag.TRACK_VIKTOR_LOSSES },
	});
	if (!job) return;
	const payload = parsePayload(job.payload);
	mutate(payload);
	await prisma.scheduledJob.update({
		where: { id: job.id },
		data: { payload: JSON.stringify(payload) },
	});
}

function parsePayload(raw: string): ViktorLossJobPayload {
	const parsed = JSON.parse(raw) as Partial<ViktorLossJobPayload>;
	return {
		subscribedChannels: parsed.subscribedChannels ?? [],
		puuid: parsed.puuid ?? null,
		lastSeenMatchId: parsed.lastSeenMatchId ?? null,
	};
}

function warnMissingKey() {
	if (missingKeyLogged) return;
	missingKeyLogged = true;
	logger.warn("Viktor loss tracker is enabled but RIOT_API_KEY is not set. Add it to the bot environment.");
}

function isSameChannel(left: SubscribedChannel, right: SubscribedChannel): boolean {
	return left.channelId === right.channelId && left.guildId === right.guildId;
}

function riotId(): string {
	return `${TRACKED_SUMMONER.gameName}#${TRACKED_SUMMONER.tagLine}`;
}

function matchSequence(matchId: string): number {
	const raw = matchId.split("_")[1];
	if (!raw) return 0;
	const value = Number(raw);
	return Number.isFinite(value) ? value : 0;
}

function queueLabel(queueId: number, gameMode: string): string {
	return QUEUE_NAMES[queueId] ?? prettifyToken(gameMode);
}

function positionLabel(teamPosition: string): string | null {
	if (!teamPosition) return null;
	return POSITION_NAMES[teamPosition] ?? null;
}

function placementLabel(placement: number): string | null {
	if (placement <= 0) return null;
	const suffix = placement === 1 ? "st" : placement === 2 ? "nd" : placement === 3 ? "rd" : "th";
	return `${placement}${suffix}`;
}

async function resolveChampion(championId: string): Promise<{ name: string; iconUrl: string | null }> {
	try {
		const champion = await getChampion(championId);
		if (champion) return champion;
	} catch (error) {
		logger.debug(`Could not resolve champion ${championId}: ${describeRiotError(error)}`);
	}
	return { name: prettifyToken(championId), iconUrl: null };
}

function prettifyToken(value: string): string {
	if (!value) return "Unknown";
	return value
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.split(/[_\s]+/)
		.filter((word) => word.length > 0)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

function durationSeconds(match: RiotMatch): number {
	// Match-v5 reports seconds. Very old payloads used milliseconds.
	if (match.gameDuration > 10_000) return Math.floor(match.gameDuration / 1000);
	return match.gameDuration;
}

function formatDuration(seconds: number): string {
	const safeSeconds = Math.max(0, Math.floor(seconds));
	const minutes = Math.floor(safeSeconds / 60);
	const rest = safeSeconds % 60;
	return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function leagueOfGraphsMatchUrl(matchId: string): string | null {
	const gameId = matchId.split("_")[1];
	if (!gameId) return null;
	return `https://www.leagueofgraphs.com/match/euw/${gameId}`;
}

function tauntFor(matchId: string): string {
	let hash = 0;
	for (const char of matchId) {
		hash = (hash + char.charCodeAt(0)) % TAUNTS.length;
	}
	return TAUNTS[hash] ?? TAUNTS[0];
}
