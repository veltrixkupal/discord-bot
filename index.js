const { TOKEN, CLIENT_ID, GUILD_ID, PREFIX, OWNERS, INVITE_URL, SUPPORT_SERVER_LINK } = require("./config");
const {
  Client,
  GatewayIntentBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
});

client.config = {
  owner: OWNERS || [],
  prefix: ",",
  inviteURL: INVITE_URL || "",
  support_server_link: SUPPORT_SERVER_LINK || "",
};

client.emoji = {
  error: "❌",
  tick: "✅",
  tick2: "✅",
  cross: "❌",
  enabled2: "✅",
  disabled2: "❌",
  arrow: "▸",
  back: "◀️",
  automod: "🛡️",
  lock: "🔒",
  unlock: "🔓",
};

const lmdbData = new Map();
client.lmdbGet = (key) => lmdbData.get(key);
client.lmdbSet = (key, value) => lmdbData.set(key, value);
client.lmdbDel = (key) => lmdbData.delete(key);

client.db = {
  get: async (key) => lmdbData.get(key),
  set: async (key, value) => lmdbData.set(key, value),
  delete: async (key) => lmdbData.delete(key),
};

const getWarns = (userId, guildId) => {
  const key = `warns_${guildId}_${userId}`;
  return client.lmdbGet(key) || [];
};

const addWarn = (userId, guildId, reason, mod) => {
  const key = `warns_${guildId}_${userId}`;
  const warns = getWarns(userId, guildId);
  warns.push({ reason, mod, date: Date.now() });
  client.lmdbSet(key, warns);
};

const getAutoResponders = (guildId) => {
  const key = `autorespond_${guildId}`;
  return client.lmdbGet(key) || {};
};

const setAutoResponder = (guildId, trigger, response) => {
  const key = `autorespond_${guildId}`;
  const data = getAutoResponders(guildId);
  data[trigger.toLowerCase()] = response;
  client.lmdbSet(key, data);
};

const removeAutoResponder = (guildId, trigger) => {
  const key = `autorespond_${guildId}`;
  const data = getAutoResponders(guildId);
  delete data[trigger.toLowerCase()];
  client.lmdbSet(key, data);
};

const afkUsers = new Map();
const lockedChannels = new Map();

const sep = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);
const thin = () => new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small);

const sendContainer = (channel, title, content) => {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${title}`)
    )
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(content)
    );
  return channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
};

const errorContainer = (text) => {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
};

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

const slashCommands = [
  new SlashCommandBuilder().setName("help").setDescription("View all commands"),
  new SlashCommandBuilder().setName("say").setDescription("Send a message")
    .addStringOption(o => o.setName("message").setDescription("The message to send").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel to send in").setRequired(false)),
  new SlashCommandBuilder().setName("embed").setDescription("Send an embed message")
    .addStringOption(o => o.setName("title").setDescription("Embed title").setRequired(true))
    .addStringOption(o => o.setName("description").setDescription("Embed description").setRequired(true))
    .addChannelOption(o => o.setName("channel").setDescription("Channel to send in").setRequired(false))
    .addStringOption(o => o.setName("color").setDescription("Embed color").setRequired(false)),
  new SlashCommandBuilder().setName("ban").setDescription("Ban a member")
    .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Ban reason").setRequired(false)),
  new SlashCommandBuilder().setName("unban").setDescription("Unban a user")
    .addStringOption(o => o.setName("userid").setDescription("User ID to unban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Unban reason").setRequired(false)),
  new SlashCommandBuilder().setName("kick").setDescription("Kick a member")
    .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Kick reason").setRequired(false)),
  new SlashCommandBuilder().setName("purge").setDescription("Delete messages")
    .addIntegerOption(o => o.setName("amount").setDescription("Number of messages").setRequired(true)),
  new SlashCommandBuilder().setName("role").setDescription("Assign a role to a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)),
  new SlashCommandBuilder().setName("steal").setDescription("Add an emoji to the server")
    .addStringOption(o => o.setName("emoji").setDescription("Emoji or URL").setRequired(true)),
  new SlashCommandBuilder().setName("userinfo").setDescription("View user information")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),
  new SlashCommandBuilder().setName("avatar").setDescription("View user avatar")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),
  new SlashCommandBuilder().setName("banner").setDescription("View user banner")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),
  new SlashCommandBuilder().setName("serverinfo").setDescription("View server information"),
  new SlashCommandBuilder().setName("prefix").setDescription("Change server prefix")
    .addStringOption(o => o.setName("newprefix").setDescription("New prefix").setRequired(false)),
  new SlashCommandBuilder().setName("warn").setDescription("Warn a user")
    .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Warning reason").setRequired(false)),
  new SlashCommandBuilder().setName("warnings").setDescription("View warnings for a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),
  new SlashCommandBuilder().setName("afk").setDescription("Set yourself as AFK")
    .addStringOption(o => o.setName("reason").setDescription("AFK reason").setRequired(false)),
  new SlashCommandBuilder().setName("addresponder").setDescription("Add an auto responder")
    .addStringOption(o => o.setName("trigger").setDescription("Trigger word").setRequired(true))
    .addStringOption(o => o.setName("response").setDescription("Response").setRequired(true)),
  new SlashCommandBuilder().setName("removeresponder").setDescription("Remove an auto responder")
    .addStringOption(o => o.setName("trigger").setDescription("Trigger word").setRequired(true)),
  new SlashCommandBuilder().setName("listresponders").setDescription("List all auto responders"),
  new SlashCommandBuilder().setName("antinuke").setDescription("Anti-nuke protection")
    .addStringOption(o => o.setName("action").setDescription("enable/disable/status").setRequired(true)),
  new SlashCommandBuilder().setName("antiraid").setDescription("Anti-raid protection")
    .addStringOption(o => o.setName("action").setDescription("enable/disable/status").setRequired(true)),
  new SlashCommandBuilder().setName("logging").setDescription("Logging system")
    .addStringOption(o => o.setName("action").setDescription("enable/disable/status/setup").setRequired(true)),
  new SlashCommandBuilder().setName("autorole").setDescription("Auto role on join")
    .addStringOption(o => o.setName("action").setDescription("enable/disable/add/remove/clear").setRequired(true))
    .addRoleOption(o => o.setName("role").setDescription("Role for add/remove").setRequired(false))
    .addStringOption(o => o.setName("type").setDescription("human/bot for add/remove").setRequired(false)),
  new SlashCommandBuilder().setName("lock").setDescription("Lock a channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to lock").setRequired(false))
    .addStringOption(o => o.setName("reason").setDescription("Lock reason").setRequired(false)),
  new SlashCommandBuilder().setName("unlock").setDescription("Unlock a channel")
    .addChannelOption(o => o.setName("channel").setDescription("Channel to unlock").setRequired(false))
    .addStringOption(o => o.setName("reason").setDescription("Unlock reason").setRequired(false)),
];

(async () => {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: slashCommands.map(cmd => cmd.toJSON()) });
    console.log("Slash commands registered.");
  } catch (error) {
    console.error(error);
  }
})();

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options } = interaction;

  if (commandName === "help") {
    const helpContainer = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("# Bot Commands"),
        new TextDisplayBuilder().setContent(`**Prefix:** \`,\` | **Slash:** \`/\``)
      )
      .addSeparatorComponents(sep())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("**Moderation**\n,ban ,unban ,kick ,purge ,role ,lock ,unlock"),
        new TextDisplayBuilder().setContent("**Utility**\n,steal ,userinfo ,avatar ,banner ,serverinfo ,prefix ,embed"),
        new TextDisplayBuilder().setContent("**Protection**\n,antinuke ,antiraid ,logging ,autorole"),
        new TextDisplayBuilder().setContent("**Other**\n,say ,warn ,warnings ,afk ,addresponder ,removeresponder ,listresponders ,help")
      )
      .addSeparatorComponents(sep())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`[Invite Me](${client.config.inviteURL}) | [Support Server](${client.config.support_server_link})`)
      );
    await interaction.reply({ components: [helpContainer], flags: MessageFlags.IsComponentsV2, ephemeral: true });
    return;
  }

  if (commandName === "say") {
    const msg = options.getString("message");
    const channel = options.getChannel("channel") ?? interaction.channel;
    const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(msg));
    await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    await interaction.reply({ content: `Sent in ${channel}`, ephemeral: true });
    return;
  }

  if (commandName === "embed") {
    const title = options.getString("title");
    const description = options.getString("description");
    const channel = options.getChannel("channel") ?? interaction.channel;
    const color = options.getString("color") || "default";
    
    const embedContainer = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${title}`),
        new TextDisplayBuilder().setContent(description)
      );
    
    await channel.send({ components: [embedContainer], flags: MessageFlags.IsComponentsV2 });
    await interaction.reply({ content: `Embed sent in ${channel}`, ephemeral: true });
    return;
  }

  if (commandName === "ban") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply(errorContainer("You need Ban Members permission."));
    }
    const user = options.getUser("user");
    const reason = options.getString("reason") || "No reason";
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member && member.bannable) {
      await member.ban({ reason });
      await interaction.reply(sendContainer(interaction.channel, "Ban", `**User:** ${user.tag}\n**Reason:** ${reason}`));
    } else {
      await interaction.reply(errorContainer("Cannot ban this user."));
    }
    return;
  }

  if (commandName === "unban") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply(errorContainer("You need Ban Members permission."));
    }
    const userId = options.getString("userid");
    const reason = options.getString("reason") || "No reason";
    const bans = await interaction.guild.bans.fetch();
    const ban = bans.get(userId);
    if (ban) {
      await interaction.guild.members.unban(userId, reason);
      await interaction.reply(sendContainer(interaction.channel, "Unban", `**User:** ${ban.user.tag}\n**Reason:** ${reason}`));
    } else {
      await interaction.reply(errorContainer("User not found in bans."));
    }
    return;
  }

  if (commandName === "kick") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply(errorContainer("You need Kick Members permission."));
    }
    const user = options.getUser("user");
    const reason = options.getString("reason") || "No reason";
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member && member.kickable) {
      await member.kick(reason);
      await interaction.reply(sendContainer(interaction.channel, "Kick", `**User:** ${user.tag}\n**Reason:** ${reason}`));
    } else {
      await interaction.reply(errorContainer("Cannot kick this user."));
    }
    return;
  }

  if (commandName === "purge") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply(errorContainer("You need Manage Messages permission."));
    }
    const amount = options.getInteger("amount");
    const deleted = await interaction.channel.bulkDelete(Math.min(amount + 1, 100), true);
    await interaction.reply(sendContainer(interaction.channel, "Purge", `Deleted ${deleted.size - 1} messages.`));
    setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
    return;
  }

  if (commandName === "role") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply(errorContainer("You need Manage Roles permission."));
    }
    const user = options.getMember("user");
    const role = options.getRole("role");
    if (user.roles.cache.has(role.id)) {
      await user.roles.remove(role);
      await interaction.reply(sendContainer(interaction.channel, "Role", `Removed ${role.name} from ${user.user.tag}`));
    } else {
      await user.roles.add(role);
      await interaction.reply(sendContainer(interaction.channel, "Role", `Added ${role.name} to ${user.user.tag}`));
    }
    return;
  }

  if (commandName === "steal") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) {
      return interaction.reply(errorContainer("You need Manage Emojis permission."));
    }
    const emoji = options.getString("emoji");
    const match = emoji.match(/<a?:\w+:(\d+)>/);
    if (match) {
      const url = `https://cdn.discordapp.com/emojis/${match[1]}.${emoji.includes("a:") ? "gif" : "png"}`;
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const name = `emoji_${Date.now()}`;
      const newEmoji = await interaction.guild.emojis.create({ attachment: buffer, name });
      await interaction.reply(sendContainer(interaction.channel, "Steal", `Added emoji: ${newEmoji}`));
    } else {
      await interaction.reply(errorContainer("Invalid emoji format."));
    }
    return;
  }

  if (commandName === "userinfo") {
    const user = options.getUser("user") || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const info = `**User:** ${user.tag}\n**ID:** ${user.id}\n**Bot:** ${user.bot ? "Yes" : "No"}\n**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:F>\n${member ? `**Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "**Not a member**"}`;
    await interaction.reply(sendContainer(interaction.channel, "User Info", info));
    return;
  }

  if (commandName === "avatar") {
    const user = options.getUser("user") || interaction.user;
    const avatarUrl = user.displayAvatarURL({ size: 4096, extension: "png" });
    await interaction.reply({ content: avatarUrl, ephemeral: true });
    return;
  }

  if (commandName === "banner") {
    const user = options.getUser("user") || interaction.user;
    const fetchedUser = await client.users.fetch(user.id, { force: true });
    if (fetchedUser.banner) {
      const bannerUrl = fetchedUser.bannerURL({ size: 4096 });
      await interaction.reply(sendContainer(interaction.channel, "Banner", bannerUrl));
    } else {
      await interaction.reply(errorContainer("No banner set."));
    }
    return;
  }

  if (commandName === "serverinfo") {
    const guild = interaction.guild;
    const owner = await guild.fetchOwner();
    const info = `**Server:** ${guild.name}\n**ID:** ${guild.id}\n**Owner:** ${owner.user.tag}\n**Members:** ${guild.memberCount}\n**Boosts:** ${guild.premiumSubscriptionCount}\n**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:F>`;
    await interaction.reply(sendContainer(interaction.channel, "Server Info", info));
    return;
  }

  if (commandName === "prefix") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply(errorContainer("You need Manage Server permission."));
    }
    const newPrefix = options.getString("newprefix");
    if (!newPrefix) {
      const current = await client.db.get(`prefix_${interaction.guild.id}`) || ",";
      await interaction.reply(sendContainer(interaction.channel, "Prefix", `Current prefix: \`${current}\``));
    } else {
      await client.db.set(`prefix_${interaction.guild.id}`, newPrefix);
      await interaction.reply(sendContainer(interaction.channel, "Prefix", `Prefix changed to \`${newPrefix}\``));
    }
    return;
  }

  if (commandName === "warn") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply(errorContainer("You need Moderate Members permission."));
    }
    const user = options.getUser("user");
    const reason = options.getString("reason") || "No reason";
    addWarn(user.id, interaction.guild.id, reason, interaction.user.tag);
    await interaction.reply(sendContainer(interaction.channel, "Warn", `Warned ${user.tag}: ${reason}`));
    return;
  }

  if (commandName === "warnings") {
    const user = options.getUser("user") || interaction.user;
    const warns = getWarns(user.id, interaction.guild.id);
    if (!warns.length) {
      await interaction.reply(errorContainer(`${user.tag} has no warnings.`));
    } else {
      const list = warns.map((w, i) => `${i + 1}. ${w.reason} - by ${w.mod} on <t:${Math.floor(w.date / 1000)}:F>`).join("\n");
      await interaction.reply(sendContainer(interaction.channel, `Warnings for ${user.tag}`, list));
    }
    return;
  }

  if (commandName === "afk") {
    const reason = options.getString("reason") || "AFK";
    afkUsers.set(interaction.user.id, { name: interaction.user.username, reason, time: Date.now() });
    await interaction.reply(sendContainer(interaction.channel, "AFK", `${interaction.user.username} is now AFK: ${reason}`));
    return;
  }

  if (commandName === "addresponder") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: "You need Manage Messages permission.", ephemeral: true });
    }
    const trigger = options.getString("trigger");
    const response = options.getString("response");
    setAutoResponder(interaction.guild.id, trigger, response);
    await interaction.reply({ content: `Auto responder added: "${trigger}" -> "${response}"`, ephemeral: true });
    return;
  }

  if (commandName === "removeresponder") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: "You need Manage Messages permission.", ephemeral: true });
    }
    const trigger = options.getString("trigger");
    removeAutoResponder(interaction.guild.id, trigger);
    await interaction.reply({ content: `Auto responder removed: "${trigger}"`, ephemeral: true });
    return;
  }

  if (commandName === "listresponders") {
    const responders = getAutoResponders(interaction.guild.id);
    const entries = Object.entries(responders);
    if (!entries.length) {
      await interaction.reply({ content: "No auto responders set.", ephemeral: true });
    } else {
      const list = entries.map(([t, r], i) => `${i + 1}. "${t}" -> "${r}"`).join("\n");
      await interaction.reply({ content: `**Auto Responders:**\n${list}`, ephemeral: true });
    }
    return;
  }

  if (commandName === "antinuke") {
    const action = options.getString("action");
    const key = `antinuke_${interaction.guild.id}`;
    if (action === "enable") {
      client.lmdbSet(key, "enabled");
      await interaction.reply(sendContainer(interaction.channel, "Anti-Nuke", "Antinuke enabled."));
    } else if (action === "disable") {
      client.lmdbDel(key);
      await interaction.reply(sendContainer(interaction.channel, "Anti-Nuke", "Antinuke disabled."));
    } else if (action === "status") {
      const status = client.lmdbGet(key) === "enabled" ? "Enabled" : "Disabled";
      await interaction.reply(sendContainer(interaction.channel, "Anti-Nuke", `Status: ${status}`));
    }
    return;
  }

  if (commandName === "antiraid") {
    const action = options.getString("action");
    const key = `antiraid_${interaction.guild.id}`;
    if (action === "enable") {
      client.lmdbSet(key, "enabled");
      await interaction.reply(sendContainer(interaction.channel, "Anti-Raid", "Antiraid enabled."));
    } else if (action === "disable") {
      client.lmdbDel(key);
      await interaction.reply(sendContainer(interaction.channel, "Anti-Raid", "Antiraid disabled."));
    } else if (action === "status") {
      const status = client.lmdbGet(key) === "enabled" ? "Enabled" : "Disabled";
      await interaction.reply(sendContainer(interaction.channel, "Anti-Raid", `Status: ${status}`));
    }
    return;
  }

  if (commandName === "logging") {
    const action = options.getString("action");
    const key = `logging_${interaction.guild.id}`;
    if (action === "enable") {
      client.lmdbSet(key, "enabled");
      await interaction.reply(sendContainer(interaction.channel, "Logging", "Logging enabled."));
    } else if (action === "disable") {
      client.lmdbDel(key);
      await interaction.reply(sendContainer(interaction.channel, "Logging", "Logging disabled."));
    } else if (action === "status") {
      const status = client.lmdbGet(key) === "enabled" ? "Enabled" : "Disabled";
      await interaction.reply(sendContainer(interaction.channel, "Logging", `Status: ${status}`));
    }
    return;
  }

  if (commandName === "autorole") {
    const action = options.getString("action");
    const role = options.getRole("role");
    const type = options.getString("type");
    const settings = await client.db.get(`autorole_${interaction.guild.id}`) || { enabled: false, roles: [], botRoles: [] };

    if (action === "enable") {
      settings.enabled = true;
      await client.db.set(`autorole_${interaction.guild.id}`, settings);
      await interaction.reply(sendContainer(interaction.channel, "Auto Role", "Autorole enabled."));
    } else if (action === "disable") {
      settings.enabled = false;
      await client.db.set(`autorole_${interaction.guild.id}`, settings);
      await interaction.reply(sendContainer(interaction.channel, "Auto Role", "Autorole disabled."));
    } else if (action === "add" && role && type) {
      const arr = type === "human" ? "roles" : "botRoles";
      if (!settings[arr].includes(role.id)) {
        settings[arr].push(role.id);
        await client.db.set(`autorole_${interaction.guild.id}`, settings);
        await interaction.reply(sendContainer(interaction.channel, "Auto Role", `Added ${role.name} to ${type} autorole.`));
      }
    } else if (action === "remove" && role && type) {
      const arr = type === "human" ? "roles" : "botRoles";
      settings[arr] = settings[arr].filter(id => id !== role.id);
      await client.db.set(`autorole_${interaction.guild.id}`, settings);
      await interaction.reply(sendContainer(interaction.channel, "Auto Role", `Removed ${role.name} from ${type} autorole.`));
    } else if (action === "clear") {
      await client.db.set(`autorole_${interaction.guild.id}`, { enabled: false, roles: [], botRoles: [] });
      await interaction.reply(sendContainer(interaction.channel, "Auto Role", "Cleared all autorole settings."));
    }
    return;
  }

  if (commandName === "lock") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply(errorContainer("You need Manage Channels permission."));
    }
    const channel = options.getChannel("channel") || interaction.channel;
    const reason = options.getString("reason") || "No reason";
    
    try {
      await channel.permissionOverwrites.edit(interaction.guild.id, {
        SendMessages: false
      });
      lockedChannels.set(channel.id, { lockedBy: interaction.user.id, reason, time: Date.now() });
      await interaction.reply(sendContainer(interaction.channel, "Lock", `${channel} has been locked.\n**Reason:** ${reason}`));
    } catch (error) {
      await interaction.reply(errorContainer("Failed to lock channel."));
    }
    return;
  }

  if (commandName === "unlock") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply(errorContainer("You need Manage Channels permission."));
    }
    const channel = options.getChannel("channel") || interaction.channel;
    const reason = options.getString("reason") || "No reason";
    
    try {
      await channel.permissionOverwrites.edit(interaction.guild.id, {
        SendMessages: null
      });
      lockedChannels.delete(channel.id);
      await interaction.reply(sendContainer(interaction.channel, "Unlock", `${channel} has been unlocked.\n**Reason:** ${reason}`));
    } catch (error) {
      await interaction.reply(errorContainer("Failed to unlock channel."));
    }
    return;
  }
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  let prefix = ",";
  const prefixData = await client.db.get(`prefix_${message.guild.id}`);
  if (prefixData) prefix = prefixData;

  const responders = getAutoResponders(message.guild.id);
  const content = message.content.toLowerCase();
  for (const [trigger, response] of Object.entries(responders)) {
    if (content.includes(trigger.toLowerCase())) {
      await message.reply(response);
      break;
    }
  }

  for (const [userId, afkData] of afkUsers) {
    if (message.mentions.users.has(userId)) {
      await message.reply(`${afkData.name} is AFK: ${afkData.reason}`);
      break;
    }
  }

  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    await message.reply(`Welcome back ${message.author.username}! Your AFK has been removed.`);
  }

  if (lockedChannels.has(message.channel.id)) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await message.delete();
      return;
    }
  }

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "help") {
    const helpContainer = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("# Bot Commands"),
        new TextDisplayBuilder().setContent(`**Prefix:** \`${prefix}\` | **Slash:** \`/\``)
      )
      .addSeparatorComponents(sep())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("**Moderation**\nban, unban, kick, purge, role, lock, unlock"),
        new TextDisplayBuilder().setContent("**Utility**\nsteal, userinfo, avatar, banner, serverinfo, prefix, embed"),
        new TextDisplayBuilder().setContent("**Protection**\nantinuke, antiraid, logging, autorole"),
        new TextDisplayBuilder().setContent("**Other**\nsay, warn, warnings, afk, addresponder, removeresponder, listresponders, help")
      )
      .addSeparatorComponents(sep())
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`[Invite Me](${client.config.inviteURL}) | [Support Server](${client.config.support_server_link})`)
      );
    await message.reply({ components: [helpContainer], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  if (cmd === "say") {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply("Admin only.");
    }
    const channel = message.mentions.channels.first();
    const text = args.slice(1).join(" ");
    if (!channel || !text) {
      return message.reply(`Usage: ${prefix}say #channel message`);
    }
    await message.delete().catch(() => {});
    await channel.send(text);
    return;
  }

  if (cmd === "embed") {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply(errorContainer("Admin only."));
    }
    const channel = message.mentions.channels.first();
    const args2 = args.slice(1).join(" ");
    if (!channel || !args2) {
      return message.reply(errorContainer(`Usage: ${prefix}embed #channel title | description`));
    }
    const [title, ...descParts] = args2.split("|");
    const description = descParts.join("|");
    
    const embedContainer = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${title.trim()}`),
        new TextDisplayBuilder().setContent(description.trim())
      );
    
    await channel.send({ components: [embedContainer], flags: MessageFlags.IsComponentsV2 });
    await message.reply({ content: `Embed sent in ${channel}`, ephemeral: true });
    return;
  }

  if (cmd === "ban") {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply(errorContainer("You need Ban Members permission."));
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply(errorContainer("Mention a user."));
    const reason = args.slice(1).join(" ") || "No reason";
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (member && member.bannable) {
      await member.ban({ reason });
      await message.reply(sendContainer(message.channel, "Ban", `**User:** ${user.tag}\n**Reason:** ${reason}`));
    } else {
      await message.reply(errorContainer("Cannot ban this user."));
    }
    return;
  }

  if (cmd === "unban") {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply(errorContainer("You need Ban Members permission."));
    }
    const userId = args[0];
    if (!userId) return message.reply(errorContainer("Provide a user ID."));
    const reason = args.slice(1).join(" ") || "No reason";
    const bans = await message.guild.bans.fetch();
    const ban = bans.get(userId);
    if (ban) {
      await message.guild.members.unban(userId, reason);
      await message.reply(sendContainer(message.channel, "Unban", `**User:** ${ban.user.tag}\n**Reason:** ${reason}`));
    } else {
      await message.reply(errorContainer("User not found in bans."));
    }
    return;
  }

  if (cmd === "kick") {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply(errorContainer("You need Kick Members permission."));
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply(errorContainer("Mention a user."));
    const reason = args.slice(1).join(" ") || "No reason";
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (member && member.kickable) {
      await member.kick(reason);
      await message.reply(sendContainer(message.channel, "Kick", `**User:** ${user.tag}\n**Reason:** ${reason}`));
    } else {
      await message.reply(errorContainer("Cannot kick this user."));
    }
    return;
  }

  if (cmd === "purge" || cmd === "clear") {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply(errorContainer("You need Manage Messages permission."));
    }
    const amount = parseInt(args[0]);
    if (isNaN(amount)) return message.reply(errorContainer("Provide a number."));
    const deleted = await message.channel.bulkDelete(Math.min(amount + 1, 100), true);
    const msg = await message.channel.send(sendContainer(message.channel, "Purge", `Deleted ${deleted.size - 1} messages.`));
    setTimeout(() => msg.delete().catch(() => {}), 3000);
    return;
  }

  if (cmd === "role" || cmd === "giverole" || cmd === "addrole") {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply(errorContainer("You need Manage Roles permission."));
    }
    const user = message.mentions.members.first();
    const role = message.mentions.roles.first();
    if (!user || !role) return message.reply(errorContainer(`Usage: ${prefix}role @user @role`));
    if (user.roles.cache.has(role.id)) {
      await user.roles.remove(role);
      await message.reply(sendContainer(message.channel, "Role", `Removed ${role.name} from ${user.user.tag}`));
    } else {
      await user.roles.add(role);
      await message.reply(sendContainer(message.channel, "Role", `Added ${role.name} to ${user.user.tag}`));
    }
    return;
  }

  if (cmd === "steal" || cmd === "eadd" || cmd === "grab") {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) {
      return message.reply(errorContainer("You need Manage Emojis permission."));
    }
    const emoji = args[0];
    if (!emoji) return message.reply(errorContainer("Provide an emoji."));
    const match = emoji.match(/<a?:\w+:(\d+)>/);
    if (match) {
      const url = `https://cdn.discordapp.com/emojis/${match[1]}.${emoji.includes("a:") ? "gif" : "png"}`;
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const name = `emoji_${Date.now()}`;
      const newEmoji = await message.guild.emojis.create({ attachment: buffer, name });
      await message.reply(sendContainer(message.channel, "Steal", `Added emoji: ${newEmoji}`));
    } else {
      await message.reply(errorContainer("Invalid emoji format."));
    }
    return;
  }

  if (cmd === "userinfo" || cmd === "ui") {
    const user = message.mentions.users.first() || message.author;
    const member = await message.guild.members.fetch(user.id).catch(() => null);
    const info = `**User:** ${user.tag}\n**ID:** ${user.id}\n**Bot:** ${user.bot ? "Yes" : "No"}\n**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:F>\n${member ? `**Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "**Not a member**"}`;
    await message.reply(sendContainer(message.channel, "User Info", info));
    return;
  }

  if (cmd === "avatar" || cmd === "av") {
    const user = message.mentions.users.first() || message.author;
    const avatarUrl = user.displayAvatarURL({ size: 4096, extension: "png" });
    await message.reply(avatarUrl);
    return;
  }

  if (cmd === "banner" || cmd === "bn") {
    const user = message.mentions.users.first() || message.author;
    const fetchedUser = await client.users.fetch(user.id, { force: true });
    if (fetchedUser.banner) {
      const bannerUrl = fetchedUser.bannerURL({ size: 4096 });
      await message.reply(sendContainer(message.channel, "Banner", bannerUrl));
    } else {
      await message.reply(errorContainer("No banner set."));
    }
    return;
  }

  if (cmd === "serverinfo" || cmd === "si") {
    const guild = message.guild;
    const owner = await guild.fetchOwner();
    const info = `**Server:** ${guild.name}\n**ID:** ${guild.id}\n**Owner:** ${owner.user.tag}\n**Members:** ${guild.memberCount}\n**Boosts:** ${guild.premiumSubscriptionCount}\n**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:F>`;
    await message.reply(sendContainer(message.channel, "Server Info", info));
    return;
  }

  if (cmd === "prefix" || cmd === "setprefix") {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply(errorContainer("You need Manage Server permission."));
    }
    const newPrefix = args[0];
    if (!newPrefix) {
      const current = await client.db.get(`prefix_${message.guild.id}`) || ",";
      await message.reply(sendContainer(message.channel, "Prefix", `Current prefix: \`${current}\``));
    } else {
      await client.db.set(`prefix_${message.guild.id}`, newPrefix);
      await message.reply(sendContainer(message.channel, "Prefix", `Prefix changed to \`${newPrefix}\``));
    }
    return;
  }

  if (cmd === "warn") {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply(errorContainer("You need Moderate Members permission."));
    }
    const user = message.mentions.users.first();
    if (!user) return message.reply(errorContainer("Mention a user."));
    const reason = args.slice(1).join(" ") || "No reason";
    addWarn(user.id, message.guild.id, reason, message.author.tag);
    await message.reply(sendContainer(message.channel, "Warn", `Warned ${user.tag}: ${reason}`));
    return;
  }

  if (cmd === "warnings") {
    const user = message.mentions.users.first() || message.author;
    const warns = getWarns(user.id, message.guild.id);
    if (!warns.length) {
      await message.reply(errorContainer(`${user.tag} has no warnings.`));
    } else {
      const list = warns.map((w, i) => `${i + 1}. ${w.reason} - by ${w.mod} on <t:${Math.floor(w.date / 1000)}:F>`).join("\n");
      await message.reply(sendContainer(message.channel, `Warnings for ${user.tag}`, list));
    }
    return;
  }

  if (cmd === "afk") {
    const reason = args.join(" ") || "AFK";
    afkUsers.set(message.author.id, { name: message.author.username, reason, time: Date.now() });
    await message.reply(sendContainer(message.channel, "AFK", `${message.author.username} is now AFK: ${reason}`));
    return;
  }

  if (cmd === "addresponder") {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply("You need Manage Messages permission.");
    }
    const trigger = args[0];
    const response = args.slice(1).join(" ");
    if (!trigger || !response) return message.reply(`Usage: ${prefix}addresponder <trigger> <response>`);
    setAutoResponder(message.guild.id, trigger, response);
    await message.reply(`Auto responder added: "${trigger}" -> "${response}"`);
    return;
  }

  if (cmd === "removeresponder") {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply("You need Manage Messages permission.");
    }
    const trigger = args[0];
    if (!trigger) return message.reply(`Usage: ${prefix}removeresponder <trigger>`);
    removeAutoResponder(message.guild.id, trigger);
    await message.reply(`Auto responder removed: "${trigger}"`);
    return;
  }

  if (cmd === "listresponders") {
    const responders = getAutoResponders(message.guild.id);
    const entries = Object.entries(responders);
    if (!entries.length) {
      await message.reply("No auto responders set.");
    } else {
      const list = entries.map(([t, r], i) => `${i + 1}. "${t}" -> "${r}"`).join("\n");
      await message.reply(`**Auto Responders:**\n${list}`);
    }
    return;
  }

  if (cmd === "antinuke" || cmd === "an") {
    const sub = args[0]?.toLowerCase();
    const key = `antinuke_${message.guild.id}`;
    if (sub === "enable") {
      client.lmdbSet(key, "enabled");
      await message.reply(sendContainer(message.channel, "Anti-Nuke", "Antinuke enabled."));
    } else if (sub === "disable") {
      client.lmdbDel(key);
      await message.reply(sendContainer(message.channel, "Anti-Nuke", "Antinuke disabled."));
    } else if (sub === "status") {
      const status = client.lmdbGet(key) === "enabled" ? "Enabled" : "Disabled";
      await message.reply(sendContainer(message.channel, "Anti-Nuke", `Status: ${status}`));
    } else {
      await message.reply(errorContainer(`Usage: ${prefix}antinuke enable/disable/status`));
    }
    return;
  }

  if (cmd === "antiraid" || cmd === "ar") {
    const sub = args[0]?.toLowerCase();
    const key = `antiraid_${message.guild.id}`;
    if (sub === "enable") {
      client.lmdbSet(key, "enabled");
      await message.reply(sendContainer(message.channel, "Anti-Raid", "Antiraid enabled."));
    } else if (sub === "disable") {
      client.lmdbDel(key);
      await message.reply(sendContainer(message.channel, "Anti-Raid", "Antiraid disabled."));
    } else if (sub === "status") {
      const status = client.lmdbGet(key) === "enabled" ? "Enabled" : "Disabled";
      await message.reply(sendContainer(message.channel, "Anti-Raid", `Status: ${status}`));
    } else {
      await message.reply(errorContainer(`Usage: ${prefix}antiraid enable/disable/status`));
    }
    return;
  }

  if (cmd === "logging" || cmd === "log") {
    const sub = args[0]?.toLowerCase();
    const key = `logging_${message.guild.id}`;
    if (sub === "enable") {
      client.lmdbSet(key, "enabled");
      await message.reply(sendContainer(message.channel, "Logging", "Logging enabled."));
    } else if (sub === "disable") {
      client.lmdbDel(key);
      await message.reply(sendContainer(message.channel, "Logging", "Logging disabled."));
    } else if (sub === "status") {
      const status = client.lmdbGet(key) === "enabled" ? "Enabled" : "Disabled";
      await message.reply(sendContainer(message.channel, "Logging", `Status: ${status}`));
    } else {
      await message.reply(errorContainer(`Usage: ${prefix}logging enable/disable/status`));
    }
    return;
  }

  if (cmd === "autorole" || cmd === "ar") {
    const sub = args[0]?.toLowerCase();
    const role = message.mentions.roles.first();
    const type = args[1]?.toLowerCase();
    const settings = await client.db.get(`autorole_${message.guild.id}`) || { enabled: false, roles: [], botRoles: [] };

    if (sub === "enable") {
      settings.enabled = true;
      await client.db.set(`autorole_${message.guild.id}`, settings);
      await message.reply(sendContainer(message.channel, "Auto Role", "Autorole enabled."));
    } else if (sub === "disable") {
      settings.enabled = false;
      await client.db.set(`autorole_${message.guild.id}`, settings);
      await message.reply(sendContainer(message.channel, "Auto Role", "Autorole disabled."));
    } else if (sub === "add" && role && type) {
      const arr = type === "human" ? "roles" : "botRoles";
      if (!settings[arr].includes(role.id)) {
        settings[arr].push(role.id);
        await client.db.set(`autorole_${message.guild.id}`, settings);
        await message.reply(sendContainer(message.channel, "Auto Role", `Added ${role.name} to ${type} autorole.`));
      }
    } else if (sub === "remove" && role && type) {
      const arr = type === "human" ? "roles" : "botRoles";
      settings[arr] = settings[arr].filter(id => id !== role.id);
      await client.db.set(`autorole_${message.guild.id}`, settings);
      await message.reply(sendContainer(message.channel, "Auto Role", `Removed ${role.name} from ${type} autorole.`));
    } else if (sub === "clear") {
      await client.db.set(`autorole_${message.guild.id}`, { enabled: false, roles: [], botRoles: [] });
      await message.reply(sendContainer(message.channel, "Auto Role", "Cleared all autorole settings."));
    } else {
      await message.reply(errorContainer(`Usage: ${prefix}autorole enable/disable/add/remove/clear`));
    }
    return;
  }

  if (cmd === "lock") {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply(errorContainer("You need Manage Channels permission."));
    }
    const channel = message.mentions.channels.first() || message.channel;
    const reason = args.slice(1).join(" ") || "No reason";
    
    try {
      await channel.permissionOverwrites.edit(message.guild.id, {
        SendMessages: false
      });
      lockedChannels.set(channel.id, { lockedBy: message.author.id, reason, time: Date.now() });
      await message.reply(sendContainer(message.channel, "Lock", `${channel} has been locked.\n**Reason:** ${reason}`));
    } catch (error) {
      await message.reply(errorContainer("Failed to lock channel."));
    }
    return;
  }

  if (cmd === "unlock") {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return message.reply(errorContainer("You need Manage Channels permission."));
    }
    const channel = message.mentions.channels.first() || message.channel;
    const reason = args.slice(1).join(" ") || "No reason";
    
    try {
      await channel.permissionOverwrites.edit(message.guild.id, {
        SendMessages: null
      });
      lockedChannels.delete(channel.id);
      await message.reply(sendContainer(message.channel, "Unlock", `${channel} has been unlocked.\n**Reason:** ${reason}`));
    } catch (error) {
      await message.reply(errorContainer("Failed to unlock channel."));
    }
    return;
  }
});

client.on("guildMemberAdd", async (member) => {
  const settings = await client.db.get(`autorole_${member.guild.id}`);
  if (!settings || !settings.enabled) return;

  const isBot = member.user.bot;
  const rolesToAdd = isBot ? settings.botRoles : settings.roles;
  if (!rolesToAdd || rolesToAdd.length === 0) return;

  for (const roleId of rolesToAdd) {
    const role = member.guild.roles.cache.get(roleId);
    if (role && role.editable && role.position < member.guild.members.me.roles.highest.position) {
      try {
        await member.roles.add(role);
      } catch (err) {
        console.error(`Failed to add role ${roleId}:`, err);
      }
    }
  }
});

client.login(TOKEN);
