"use strict";

const { Util, Command, Constants, CommandError } = require("../../index.js");

module.exports = class extends Command {
    constructor(...args) {
        super(...args, {
            usage: "[command|category] (subcommand)",
            description: "Displays the help manual.",
            fullDescription: "The help manual is the key to understanding how to use the bot. There are two things " +
            "you should know: arguments and examples usages.\n\n" +

            "An **argument** is the text you pass a command after it's name. Arguments are separated by spaces, but " +
            "some commands have special cases (such as the `role` command). For example, if you do `ping nom nom`, " +
            "you've passed **2** arguments. The command name does not count as an argument. Commands use arguments " +
            "differently:\n" + [
                "`[]` - Argument is optional.",
                "`<>` - Argument is required.",
                "`()` - Argument is semi-required. Not passing anything works, but if you pass an argument and it's " +
                "invalid, the command will fail."
            ].map((str) => `- ${str}`).join("\n") + "\n\n" +

            "Here are some examples usages:\n" + [
                "Get all categories and commands: `help` (no args).",
                "Look up all the commands in a category: `help main` (1 arg).",
                "Look up information on a command: `help anilist`.",
                "Look up information on a subcommand part of a command: `help anilist user` (2 args)."
            ].map((str) => `- ${str}`).join("\n") + "\n\n",
            cooldown: 2,
            protected: true,
            flags: [{
                name: "noembed",
                description: "Sends the help manual as plain text. This is automatically chosen if the bot does not " +
                "have permission to `Embed Links`."
            }]
        });
    }

    /**
     * Runs the command.
     * @param {Eris.Message} message The message the command was called on.
     * @param {Array<String>} args Arguments passed to the command.
     */
    async run(message, args) {
        let flags = Util.messageFlags(message, this.client);

        if (!args.length) {
            return this._sendNormal(message, flags);
        }

        let name = args[0].toLowerCase();
        let category = this.commandList[Util.toTitleCase(args.join(" "))];

        if (category) {
            return this._sendCategory(message, category, flags);
        }

        let command = this.client.commands.get(this.client.aliases.get(name) || name);
        let subcommand = args[1]?.toLowerCase();

        if (command) {
            if (subcommand) {
                let sub = command.subcommands.get(subcommand);

                if (sub) {
                    return this._sendSubcommand(message, command, sub, flags);
                }

                return CommandError.ERR_NOT_FOUND(message, `subcommand of command \`${command.name}\``, subcommand);
            }

            return this._sendCommand(message, command, flags);
        }

        return CommandError.ERR_NOT_FOUND(message, "command or category", args.join(" "));
    }

    _sendNormal(message, flags) {
        let commands = this.commandList;
        let hasEmbeds = !message.channel.guild || message.channel.permissionsOf(this.client.user.id).has("embedLinks");
        let prefix = message.guildID ? message.prefix.match(/<@!?\d+>/)?.map((mention) => {
            let userID = mention.match(/<@!?(\d+)>/)[1];

            if (!message.guildID) {
                if (userID === this.client.user.id) {
                    return `@${Util.userTag(this.client.user)} `;
                }

                return mention + " ";
            }

            let member = message.channel.guild.members.get(userID);

            if (member) {
                return `@${Util.userTag(member)} `;
            }

            return mention + " ";
        }) || message.prefix : message.prefix;
        let prefixes = message.guildID
            ? this.client.guildSettings.get(message.guildID)?.prefixes
            : Constants.BOT_PREFIXES.join("`, `");

        if (message.guildID) {
            if (prefixes === null) {
                prefixes = Constants.BOT_PREFIXES.join("`, `");
            } else if (prefixes.length) {
                prefixes = prefixes.join("`, `");
            } else {
                prefixes = "";
            }
        }

        if (prefixes !== "") {
            prefixes = `\`${prefixes}\``;
        }

        let description = [
            `- The bot prefix${prefixes ? "es" : ""} for the server${prefixes
                ? ` are ${prefixes},`
                : " is"} ${this.client.user.mention}.`,
            `- To get more info on a command or category, use \`${prefix}help <command|category>\``,
            "- A list of recent updates can be found in the `changelog` command."
        ];

        for (const category of Object.keys(commands)) {
            let index = 0;

            for (const command of commands[category]) {
                if (!command.enabled && !Constants.BOT_STAFF.includes(message.author.id)) {
                    commands[category].splice(index, 1);
                }

                ++index;
            }
        }

        if (flags.noembed || !hasEmbeds) {
            let content = `__**Help Manual**__\n${description.join("\n")}\n\n` +
            Object.keys(commands).map((category) => commands[category].length
                ? `**${category} — ${commands[category].length}**:\n\`${commands[category]
                    .map((command) => command.name).join("`, `")}\``
                : null).filter((prop) => prop !== null).join("\n\n");

            return message.channel.createMessage(content);
        }

        return message.channel.createMessage({
            embed: {
                description: description.join("\n"),
                color: Util.base10(Constants.Colors.DEFAULT),
                author: {
                    icon_url: this.client.user.avatarURL,
                    name: `${this.client.user.username} Help Manual`
                },
                fields: Object.keys(commands).map((category) => commands[category].length ? {
                    name: `${category} — ${commands[category].length}`,
                    value: commands[category].map((command) => `\`${command.name}\``).join(", ")
                } : null).filter((prop) => prop !== null)
            }
        });
    }

    _sendCategory(message, category, flags) {
        let hasEmbeds = !message.channel.guild ||
        message.channel.permissionsOf(this.client.user.id).has("embedLinks");
        let prefix = message.prefix;
        let command = category[0];

        if (flags.noembed || !hasEmbeds) {
            let content = `__**${command.category.name} Category**__\n${command.category.description}\n\n${category
                .map((command) => `**${prefix + command.name}** — ${command.description} ${(command
                    .enabled ? "" : "(disabled)")}`).join("\n")}`;

            return message.channel.createMessage(content);
        }

        return message.channel.createMessage({
            embed: {
                description: command.category.description,
                title: `${command.category.name} Category`,
                color: Util.base10(Constants.Colors.DEFAULT),
                fields: [{
                    name: "Commands",
                    value: category.map((command) => `**${prefix + command.name}** — ${command.description} ${(command
                        .enabled ? "" : "(disabled)")}`).join("\n")
                }]
            }
        });
    }

    _sendCommand(message, command, flags) {
        return command.buildHelp(message, null, { time: null, embed: !flags.noembed });
    }

    _sendSubcommand(message, command, subcommand, flags) {
        return command.buildHelp(message, subcommand, { time: null, embed: !flags.noembed });
    }

    get commandList() {
        let commands = {};

        for (const [, command] of this.client.commands) {
            if (commands[command.category.name]) {
                commands[command.category.name].push(command);
            } else {
                commands[command.category.name] = [command];
            }
        }

        return commands;
    }
};