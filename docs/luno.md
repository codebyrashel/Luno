# Discord Productivity Bot Documentation

## 1. Overview

This bot is a modular Discord system designed for:

* Audio playback from YouTube links (audio only, not video)
* Focus session management with voice channel muting
* Voice channel activity tracking, XP leveling, and weekly level rank
* AFK-aware voice credit (muted users do not earn XP)
* Goal accountability system with reminders, progress logging, streaks, and humorous shame
* Future productivity and moderation features

The system is structured to separate concerns so each part can be extended without breaking others.

---

## 2. Project Structure

```
root/
 ├── index.js
 ├── deploy-commands.js (legacy, not used)
 ├── package.json
 ├── src/
 │    ├── commands/
 │    │    ├── focus.js
 │    │    └── leaderboard.js
 │    ├── services/
 │    │    ├── focusService.js
 │    │    └── vcTrackerService.js
 │    ├── events/
 │    │    └── interactionHandler.js
 │    ├── utils/
 │    │    └── time.js
 │    └── data/
 │         └── vc.json
 └── docs/
      └── luno.md
```

Each layer has a clear responsibility.

---

## 3. index.js

### Role

Entry point of the application.

### Responsibilities

* Initialize Discord client
* Register slash commands
* Handle core commands (audio playback)
* Route modular commands
* Start background processes

### Key Concepts

#### 3.1 Client Initialization

Creates the Discord client with required intents.

#### 3.2 Command Registration

Registers slash commands using Discord REST API.

Commands defined:

* play (audio from YouTube link)
* stop (disconnect bot)
* focus (handled modularly)

#### 3.3 Audio System

Function: getAudioStream(url)

* Uses yt-dlp
* Extracts best audio stream
* Pipes output to Discord voice player

Flow:

```
YouTube URL → yt-dlp → audio stream → Discord player
```

#### 3.4 Voice Channel Tracking

Automatically tracks user join/leave events in voice channels.

* Records session start/end times
* Stores data in `data/vc.json`
* Provides statistics and leaderboards

#### 3.5 Interaction Handling

Routes slash commands to their respective handlers.

Flow:

```
interactionCreate
  ├── play/stop handled directly
  └── other commands → interactionHandler → command.execute()
```

#### 3.5 Background Systems

Starts focus watcher:

```
startFocusWatcher(client)
```

---

## 4. src/events/interactionHandler.js

### Role

Central router for modular commands.

### Responsibility

* Receives interaction
* Matches command name
* Executes corresponding command file

### Why this exists

Prevents index.js from becoming large and unmanageable.

---

## 5. src/services/focusService.js

### Role

Handles all focus session data and logic.

### Data Structure

```
Map<userId, session>
```

### Session Object

```
{
  userId,
  channelId,
  startedAt,
  endTime
}
```

### Functions

#### startSession(userId, duration, channelId)

Creates a session and stores it.

#### getSession(userId)

Returns the session for a user.

#### endSession(userId)

Removes session and returns it.

#### getAllSessions()

Returns all active sessions.

#### isInSession(userId)

Checks if user already has a session.

---

## 7. src/commands/leaderboard.js

### Role

Handles voice channel activity statistics and leaderboards.

### Command Structure

```
/leaderboard stats range:24h|7d
/leaderboard vc range:24h|7d
/leaderboard level
```

### Behavior

#### 7.1 Stats

Shows the user's personal VC time summary for the chosen range, plus XP earned, total XP, and level progress.

#### 7.2 VC Leaderboard

Shows the top 10 users by VC time for the selected range.

#### 7.3 Weekly Level Rank

Shows the top 10 users by weekly XP earned and the personal weekly level rank. The weekly rank resets every Monday at 00:00 UTC.

---

## 8. src/commands/smartvc.js

### Role

Handles smart VC enforcement inside a selected voice channel.

### Command Structure

```
/smartvc set channel:#voice-channel requiremic:true|false
/smartvc status
/smartvc disable
```

### Behavior

* Admins can enable smart enforcement for one voice channel.
* Users must turn on camera within 30 seconds of joining.
* Optional mic enforcement can be enabled.
* Silent lurkers are removed automatically.
* Smart VC sessions still count normal VC time and also earn boosted XP for leaderboard rank.

---

## 9. src/services/vcTrackerService.js


### Role

Manages voice channel activity data and calculations, including XP conversion, weekly grinding, and AFK-aware session counting.

### Data Storage

* File: `data/vc.json`
* Format: JSON object with user sessions, XP totals, and weekly reset metadata

### Data Structure

```json
{
  "userId": {
    "active": 1640995200000,
    "sessions": [
      {"start": 1640995200000, "end": 1640998800000}
    ]
  }
}
```

### Functions

#### joinVC(userId)

Records when user joins voice channel.

#### leaveVC(userId)

Records when user leaves voice channel, calculates session duration.

#### getTime(userId, range)

Calculates total VC time for user in given range. The service can still compute time ranges, but the weekly level rank command focuses on the 7-day weekly XP leaderboard.

#### getLeaderboard(range)

Returns top 10 users by VC time for the range.

#### formatTime(ms)

Formats milliseconds to "Xh Ym" string.

---

## 9. src/commands/goal.js

### Role

Handles goal accountability commands for setting, updating, completing, and cancelling goals.

### Command Structure

```
/goal set description:"Finish backend API" days:3
/goal status
/goal update progress:"Made API schema changes"
/goal complete
/goal cancel
```

### Behavior

#### 9.1 Set

* Creates a goal with a due date
* Reminds the user 5 times per day
* Asks for progress 3 times daily
* Logs progress updates

#### 9.2 Status

* Shows active goal details
* Shows due date, updates count, and streaks

#### 9.3 Update

* Logs progress updates
* Publicly complements the user when they update

#### 9.4 Complete

* Marks the goal completed
* Increments streak
* Sends a proud completion message

#### 9.5 Cancel

* Cancels the current active goal

---

### Role

Handles all focus-related commands.

### Command Structure

```
/focus start minutes
/focus stop
/focus status
```

### Behavior

#### 6.1 Start

* Validates user is in voice channel
* Prevents duplicate sessions
* Creates session via service
* Mutes user in voice channel

#### 6.2 Stop

* Ends session
* Unmutes user

#### 6.3 Status

* Calculates remaining time
* Returns remaining minutes

---

## 9. src/utils/time.js

### Role

Background engine for session lifecycle.

### Behavior

Runs every 5 seconds:

```
for each session:
  if current time >= endTime:
    end session
    unmute user
    notify user
```

### Why needed

Discord does not provide scheduling or timers.

---

## 10. Focus System Lifecycle

### Flow

```
User runs /focus start
  → focusService stores session
  → user muted
  → watcher monitors time
  → session ends
  → user unmuted
  → user notified
```

---

## 11. Permissions Required

The bot must have:

* Connect
* Speak
* Mute Members
* Move Members (optional but recommended)

## 12. Data Storage

### vc.json

Contains voice channel activity data.

* **Location**: `data/vc.json`
* **Purpose**: Persistent storage of VC sessions
* **Backup**: Consider regular backups as data accumulates over time

### Automatic Cleanup

Currently no automatic cleanup - old sessions are kept indefinitely.
Future enhancement could include periodic cleanup of very old data.

---

## 10. Limitations

* Sessions stored in memory (lost on restart)
* Depends on Discord voice permissions
* DM may fail if disabled

---

## 11. Design Principles

All features follow this structure:

```
Command → Service → Background → Output
```

This ensures:

* separation of concerns
* easier debugging
* scalability

---

## 12. Current State

Implemented:

* audio playback system
* modular command architecture
* focus session system (start, stop, status)
* automatic session lifecycle handling

Planned:

* leaderboard
* persistent storage
* advanced productivity features

---

## 13. Summary

This system is built as a modular backend for a Discord-based productivity environment.

Each layer has a defined responsibility and communicates through controlled interfaces.

Maintaining this structure is critical to avoid complexity growth over time.
