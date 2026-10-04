# Moonlit Accusations

PROJECT: MAFIA — PREMIUM ONLINE SOCIAL DEDUCTION GAME

1. PRODUCT VISION

Build a high-quality, production-oriented multiplayer online Mafia game.

This should not be a simple landing page, static prototype, or collection of non-functional screens. Create a real, interactive web application with a polished user experience, functional game logic, persistent data, and a scalable architecture.

The game should feel like a modern competitive social gaming platform, combining the social deduction gameplay of Mafia with progression, player profiles, rankings, cosmetics, and live multiplayer rooms.

Prioritize:

Reliable gameplay

Clean and premium visual design

Mobile-first responsive experience

Fair gameplay and anti-cheat principles

Fast navigation

Clear game states

Maintainable code

Do not add fake functionality and present it as working. If a feature requires external infrastructure, implement the appropriate integration or provide a clearly marked development fallback.



2. VISUAL IDENTITY AND DESIGN

Create a distinctive premium dark interface.

Design direction:

Dark charcoal and near-black background

Subtle moonlit blue and violet accents

Elegant typography

Soft gradients

High-quality cards and panels

Subtle glassmorphism, used sparingly

Smooth transitions and micro-interactions

Clear visual hierarchy

No excessive neon

No cluttered interface

No generic admin dashboard appearance

No excessive use of emojis

No copied branding from existing Mafia games

The design should feel like a serious, polished game product rather than a template.

Use a consistent design system:

Color tokens

Typography scale

Spacing system

Buttons

Cards

Modals

Avatars

Notifications

Game status indicators

The UI must work well on:

iPhone

Android phones

Tablets

Desktop browsers

Use accessible contrast, readable text, clear interaction states, and keyboard-friendly controls where applicable.



3. CORE GAMEPLAY

Create a multiplayer Mafia game based on hidden roles, discussion, deduction, and voting.

The game should support configurable room settings and role distribution.

Initial roles:

Mafia

Civilian

Detective

Doctor

Optional additional roles through future expansion

Core game cycle:

Players join a room.

The host configures the game.

Players receive secret roles.

Night phase begins.

Players with night abilities perform their actions.

Day phase begins.

Players discuss the events.

Players vote to eliminate a player.

The game checks the win conditions.

The next night begins if the game continues.

The game ends when a team meets its win condition.

Implement a reliable game state machine.

Every game must have:

A unique game ID

A clear current phase

A round number

A player list

Hidden roles stored securely

Validated player actions

A history of relevant game events

Server-side win-condition checks

Do not expose secret roles or private actions to players who should not see them.

Implement configurable timers for:

Night phase

Discussion phase

Voting phase

Results phase

The game should handle:

Player disconnects

Reconnection

Player leaving during a match

AFK players

Invalid actions

Duplicate votes

Timer expiration

Host leaving

Game cancellation

Unexpected errors

Avoid allowing clients to decide game outcomes.



4. MULTIPLAYER ROOMS

Build a functional lobby and room system.

Features:

Create a room

Join a room using a code

Public rooms

Private rooms

Room capacity

Minimum player requirement

Host controls

Ready status

Game settings

Invite/share room code

Leave room

Reconnect to an active match where possible

Room settings:

Number of players

Available roles

Discussion duration

Voting duration

Night duration

Optional anonymous voting

Optional voice chat

Public/private status

Prevent:

Joining full rooms

Starting a game without enough players

Unauthorized room setting changes

Multiple conflicting game starts

Invalid room transitions

Create a visually polished lobby with player avatars, ready indicators, role settings, and an obvious Start Game button for the host.



5. USER ACCOUNTS AND PROFILES

Implement authentication using a secure supported authentication system.

Features:

Sign up

Sign in

Sign out

Password reset

Guest mode if technically appropriate

Profile editing

Username

Avatar

Account creation date

Statistics

Match history

Level

Experience points

Currency balance

Inventory

Rank

Users must not be able to change protected statistics, currency, ranks, or game results through client-side requests.

Apply appropriate access control to private user data.

Create a polished profile page that displays:

Avatar

Username

Level

Rank

Games played

Wins

Win rate

Favorite role

Recent matches

Achievements



6. RANKING AND PROGRESSION

Create a fair and understandable progression system.

Implement:

Experience points

Player levels

Match statistics

Competitive ranking as a future-ready system

Achievements

Seasonal progression as an optional future feature

Do not award competitive ranking points solely based on purchases.

Ensure statistics and rewards are validated server-side.

Create:

Leaderboard page

Player ranking cards

Personal statistics

Achievement display

Progress bar to the next level

Avoid pay-to-win mechanics.



7. IN-GAME CHAT AND VOICE

Implement text chat for active games and lobbies, with appropriate moderation controls.

Text chat requirements:

Messages tied to the correct room

Message timestamps

Chat visibility based on game phase

Separate private and team communication where applicable

Rate limiting

Basic reporting and moderation tools

Voice chat:
Design the architecture for real-time voice communication using an appropriate WebRTC-compatible solution or supported third-party service.

Voice requirements:

Join/leave voice

Mute/unmute

Microphone permission handling

Phase-based communication rules

Team-only communication for permitted roles

Disconnection handling

Clear voice status indicators

Do not claim that a simulated audio interface is a real voice chat system.

If a production voice provider is not configured, create a clear development fallback and integration boundary.



8. ECONOMY AND MONETIZATION

Create a virtual economy designed around cosmetic and non-pay-to-win features.

Possible features:

Soft currency earned through gameplay

Cosmetic avatars

Profile frames

Emotes

Lobby effects

Cosmetic themes

Seasonal rewards

Do not allow users to purchase advantages that undermine fair deduction gameplay.

Any premium currency or purchase system must be designed with:

Secure server-side validation

Transaction records

No client-side balance manipulation

Clear purchase confirmation

Refund and support considerations

Platform/legal compliance where applicable

Do not implement fake payment success screens and label them as real purchases.

Advertising can be considered as a future monetization feature. Avoid intrusive advertising during active gameplay.



9. SECURITY AND FAIR PLAY

Treat security as a core requirement.

Implement:

Server-authoritative game logic

Secure role assignment

Server-side action validation

Access controls

Rate limiting

Input validation

Protection against unauthorized role disclosure

Secure handling of user sessions

Appropriate database security policies

Anti-spam measures

Reporting and moderation foundations

Never rely on hidden frontend elements as a security mechanism.

A player should only receive information they are authorized to see.



10. MAIN APPLICATION PAGES

Create the following pages with consistent navigation.

Landing / Welcome

Clear game identity

Play Now button

Sign in

Learn how to play

Visual game atmosphere

Home Dashboard

Play Now

Quick join

Create room

Active events

Player level

Recent activity

Game Lobby

Public room browser

Search/filter

Player count

Room settings

Join button

Room

Player slots

Host controls

Ready status

Game configuration

Room code

Start game button

Active Game

Current phase

Timer

Player cards

Allowed actions

Discussion interface

Voting interface

Event log

Role-specific information

Results

Winning team

Match summary

Experience earned

Statistics update

Rewards

Play again button

Profile

Player statistics

Achievements

Match history

Cosmetics

Level progression

Leaderboards

Ranking

Player statistics

Search players

Season-ready structure

Shop

Cosmetic items

Item previews

Ownership status

Secure purchase flow placeholder if payments are not configured

Settings

Account

Audio

Notifications

Accessibility

Privacy

Language-ready architecture



11. INTERNATIONALIZATION

Build the application with localization in mind.

Initial language:

English

Design the architecture so the following can be added later:

Ukrainian

Russian

Turkish

Azerbaijani

Do not hardcode all user-facing strings directly into components. Use a localization-ready structure.



12. TECHNICAL ARCHITECTURE

Use a suitable modern web stack supported by Lovable.

Recommended approach:

React with TypeScript

A structured component system

Secure authentication

PostgreSQL or an appropriate relational database

Backend/server-side logic

Real-time synchronization for multiplayer functionality

Row-level security or equivalent access controls where supported

Modular game engine

Validation schemas

Clear separation between frontend and backend

Design the game engine as a testable module.

Separate:

Game state

Role logic

Player actions

Win conditions

Timers

Room management

Persistence

Real-time events

Do not put all gameplay logic into a single frontend component.

Use appropriate database constraints and transactions to prevent inconsistent state.



13. QUALITY REQUIREMENTS

Before considering the application complete:

Test the complete game loop.

Test multiple players joining the same room.

Test invalid actions.

Test player disconnection and reconnection.

Test role privacy.

Test voting and win conditions.

Test mobile responsiveness.

Test loading and error states.

Test authentication and authorization.

Test database access controls.

Test duplicate requests and race conditions where relevant.

Do not simply create visual screens and mark the project complete.

If a feature cannot be fully implemented in the current environment, explain what is missing, what has been implemented, and what is required for production.



14. DEVELOPMENT PRIORITIES

Build in the following order:

PHASE 1 — FOUNDATION

Design system

Authentication

Database schema

User profiles

Navigation

PHASE 2 — PLAYABLE MAFIA

Room creation and joining

Server-authoritative game state

Role assignment

Night/day phases

Voting

Win conditions

Results

PHASE 3 — MULTIPLAYER EXPERIENCE

Real-time synchronization

Reconnection

Text chat

Lobby improvements

Game notifications

PHASE 4 — PROGRESSION

Experience

Levels

Statistics

Leaderboards

Achievements

PHASE 5 — ADVANCED FEATURES

Voice chat integration

Cosmetics

Shop

Moderation

Events

Localization

Start with a genuinely playable and reliable core game. Do not prioritize cosmetic features over working gameplay.



15. FINAL PRODUCT STANDARD

The final product should feel like a real online multiplayer game that users would want to return to.

Focus on:

Fun gameplay

Reliable multiplayer

Strong visual identity

Intuitive user experience

Fair competition

Security

Performance

Future scalability

Make sensible implementation decisions without repeatedly asking for approval on every minor detail. When an important architectural decision requires clarification, explain the options and trade-offs clearly.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8a629fc9-706c-591d-b766-0d46ec8a450d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
