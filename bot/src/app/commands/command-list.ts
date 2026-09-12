import { Command } from "./command.js";
import config from "../config.js"

import Ping from "./src/ping.js";
import ConnectSoundboard from "./src/connect-soundboard.js";
import CrazyFrog from "./src/crazy-frog.js";
import FakeMessage from "./src/fake-message.js";
import LethalCompany from "./src/lethal-company.js";
import Overwatch from "./src/overwatch.js";
import DeleteMessage from "./src/delete-message.js";
import MotivateMe from "./src/motivate-me.js";
import SendMessage from "./src/send-message.js";
import Rename from "./src/rename.js";
import Votation from "./src/votation.js";
import ToggleMotivation from "./src/toggle-motivation.js";
import Record from "./src/record.js";
import TrackJuan from "./src/track-juan.js";
import UBS from "./src/ubs.js";
import ToggleBadminton from "./src/toggle-badminton.js";
import ToggleViktor from "./src/toggle-viktor.js";

const commands = [
	new Ping(),
	new ConnectSoundboard(),
	new CrazyFrog(),
	new FakeMessage(),
	new LethalCompany(),
	new Overwatch(),
	new DeleteMessage(),
	new MotivateMe(),
	new SendMessage(),
	new Rename(),
	new Votation(),
	new ToggleMotivation(),
	new Record(),
	new TrackJuan(),
	new UBS(),
	new ToggleBadminton(),
	new ToggleViktor(),
] as Command[];

export default commands.filter(command => {
	const commandName = command.data.name;
	return config.commands[commandName];
});