import { MessageFlags, SlashCommandBuilder, TextChannel } from "discord.js";

import { isRiotApiConfigured } from "../../../lib/riot-api.js";
import { Command, type Interaction } from "../command.js";
import Bot from "../../bot.js";
import { toggleViktorChannel } from "../../modules/job-scheduler/jobs/viktor-losses.js";

export default class ToggleViktor extends Command {
	override get data() {
		return new SlashCommandBuilder()
			.setName("toggle-viktor")
			.setDescription("Toggle alerts in this channel when viktor#ET40 loses a League game")
	}

	override async execute(_bot: Bot, interaction: Interaction) {
		if (interaction.guild === null || !(interaction.channel instanceof TextChannel)) {
			await interaction.reply({
				content: "Use this in a server text channel.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const enabled = await toggleViktorChannel({
			channelId: interaction.channel.id,
			guildId: interaction.channel.guild.id,
		});

		const keyHint = enabled && !isRiotApiConfigured()
			? " Add `RIOT_API_KEY` to the bot `.env` so tracking can start."
			: "";
		const baselineHint = enabled
			? " Only games that finish after this are announced."
			: "";

		await interaction.reply({
			content: `Viktor loss alerts have been ${enabled ? "enabled" : "disabled"} in this channel.${baselineHint}${keyHint}`,
			flags: MessageFlags.Ephemeral,
		});
	}
}
