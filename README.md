# Discord Voice Activity & Engagement Bot

A lightweight Discord bot designed to track voice channel activity, reward engagement, and provide moderation-friendly automation features. Built with Node.js, this bot focuses on real-time voice tracking, data persistence, and extensibility for future systems like XP leveling and leaderboards.

## Features

* Voice channel activity tracking
* Automatic join/leave detection
* Time-based engagement monitoring
* Data persistence using JSON storage
* Smart session tracking with timeout handling
* Slash command support

## Planned / Extendable Features

* XP leveling system based on voice activity
* Weekly leaderboard (Top active users)
* Automatic weekly reset scheduler
* AFK detection (inactive users not rewarded)
* Analytics dashboard integration

## Tech Stack

* Node.js
* Discord.js
* File system (JSON-based storage)
* Environment-based configuration (dotenv)

## Project Structure

```
.
├── data/                 # Stores JSON data (voice activity, sessions)
├── services/             # Core logic (voice tracking, session handling)
├── commands/             # Slash command implementations
├── events/               # Discord event listeners
├── index.js              # Entry point
├── .env                  # Environment variables
└── package.json
```

## Installation

1. Clone the repository

   ```bash
   git clone https://github.com/your-username/your-repo.git
   cd your-repo
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Configure environment variables
   Create a `.env` file in the root directory:

   ```env
   DISCORD_TOKEN=your_bot_token
   CLIENT_ID=your_client_id
   GUILD_ID=your_guild_id
   ```

4. Run the bot

   ```bash
   node index.js
   ```

## Usage

* Invite the bot to your server with proper permissions
* Join or leave voice channels to trigger tracking
* Use slash commands to interact with bot features

## Data Handling

* Voice activity is stored locally in JSON files
* Sessions are tracked with timestamps and timeouts
* Designed for simplicity and easy migration to a database (e.g., MongoDB or PostgreSQL)

## Deployment

This bot can be deployed on:

* VPS (recommended for stability)
* Cloud platforms (e.g., Railway, Render)
* Oracle Cloud Free Tier (for cost-free hosting)

Ensure environment variables are properly configured in your hosting platform.

## Notes

* Not optimized for large-scale production yet
* JSON storage may not scale well under heavy load
* Future versions should migrate to a proper database

## License

MIT License
