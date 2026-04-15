import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN = '';
const CLIENT_ID = '';
const GUILD_ID = '';

const commands = [
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a YouTube video')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('YouTube URL')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

await rest.put(
  Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
  { body: commands }
);

console.log('Commands registered');