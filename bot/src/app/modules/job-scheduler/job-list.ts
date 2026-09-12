import { JobTag } from "../../../generated/prisma/enums.js";
import type Bot from "../../bot.js";
import { runBadmintonReminderJob } from "./jobs/badminton-reminder.js";
import { runMotivationalJob } from "./jobs/daily-motivation.js";
import { runViktorLossJob } from "./jobs/viktor-losses.js";

export type JobExecutor = (bot: Bot, payload: string) => Promise<void>;

export const jobMap: Record<JobTag, JobExecutor> = {
	[JobTag.DAILY_MOTIVATIONAL_QUOTE]: runMotivationalJob,
	[JobTag.SEND_BADMINTON_REMINDER]: runBadmintonReminderJob,
	[JobTag.TRACK_VIKTOR_LOSSES]: runViktorLossJob,
	[JobTag.SEND_CHANNEL_MESSAGE]: async (_bot: Bot, _payload: string) => {},
};