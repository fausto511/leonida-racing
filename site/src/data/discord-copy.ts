// Copy for /discord/ (RS-0076).
// COPY STATUS: approved Codex copy 18.10.2026 (Codex Zuarbeit/Discord-Seite-Texte-2026-10-18.json), DEC-0088.
// Facts: event cards post in #events (Fausto 20.10.), LFG v1 (DEC-0111), Registered Driver / Verified rights (DEC-0129).

export const discordPage = {
  title: "GTA 6 Racing Discord: Car Meets, Crews & LFG",
  description: "Join the free Leonida Racing Discord for GTA 6 racing and car culture. Meet drivers and crews, find a group, talk cars and get ready for Leonida.",
  eyebrow: "GTA VI Racing & Car Culture Discord",
  h1: "Leonida Racing on Discord",
  intro: "A place for GTA racers, crews and car-meet regulars to meet, swap ideas and get ready for GTA VI. Talk builds, find people to play with and bring your crew along. Good company matters as much as the car.",
  joinNote: "Free to join. Independent community, not run by Rockstar.",
};

export const discordGlance: { k: string; v: string }[] = [
  { k: "Price", v: "Free" },
  { k: "Languages", v: "English + 5 more" },
  { k: "Platforms", v: "PlayStation · Xbox · PC" },
  { k: "Looking for group", v: "Voice channel per search" },
  { k: "Events", v: "Sign up in Discord" },
];

// link: site page behind the area (Sackgassen-Check 04.11.2026; link texts = Claude placeholders, Codex review pending)
export const discordAreas: { title: string; text: string; channels: string[]; link?: { text: string; path: string } }[] = [
  { title: "Races, playlists and meets", channels: ["events", "playlists"], text: "Published events from the Leonida Racing calendar appear as cards in #events, with times shown in your time zone. Use I’m in to sign up through your linked account. Hosts share their announcements in #events and #playlists.", link: { text: "See the event calendar", path: "community/events/" } },
  { title: "Players, right now", channels: ["lfg"], text: "Find a group for a race, cruise, car meet or photo session. Start a search in #lfg or join one that’s already running, with a temporary voice channel for the group." },
  { title: "Car talk", channels: ["chat", "car-talk"], text: "Builds, favorite shapes, the car you still regret selling. The car-talk forum keeps threads by topic, so a good argument about headlights is still there tomorrow." },
  { title: "Time Attack", channels: ["time-attack"], text: "Racing lines, braking points and the hunt for the last tenth. Talk Gellhorn Time Attack, compare approaches and get ready to put a lap on the board when GTA VI launches." },
  { title: "Crews and racing styles", channels: ["crews", "racing-series", "racing-styles"], text: "Clean circuit racing, street-style sprints, slow cruises with the windows down. Find a crew or a series that drives the way you do.", link: { text: "Browse the crews", path: "community/crews/" } },
  { title: "Creators and track builders", channels: ["snapmatics", "streams-videos", "job-creators"], text: "Share Snapmatics and videos, show the race jobs you’ve built and find other creators to swap feedback with." },
];

export const discordLanguages = ["Deutsch", "Español", "Français", "Italiano", "Português"];
export const discordLanguagesText = "The general channels are English. Each of these languages has its own text and voice channel. Pick the language in #roles and it shows up.";

export const discordLfg = {
  eyebrow: "Looking for group",
  title: "Find your next group",
  text: "Use Find Players in #lfg to start a search. Choose an activity and group size; the bot creates a temporary voice channel and notifies members with LFG Pings. Hit Join on an existing search to add yourself to its card, then use Open voice to enter the channel.",
  steps: ["Pick an activity: Race, Playlist, Car Meet, Cruise, Photo Session or Job.", "Choose a group size: 2–4, 5–8 or 9+ players.", "Open the group’s voice channel. The search expires after three hours unless it ends sooner."],
  notes: "Up to three searches can run at once, with one active search per person. A free Leonida Racing account is needed to start one, but not to join. If the host leaves the search, another participant takes over; an empty search ends.",
};

export const discordSteps: { title: string; text: string }[] = [
  { title: "Join the server", text: "Open the invite and join the server. No Leonida Racing account is needed to chat in the open channels or join voice." },
  { title: "Grab your roles", text: "In #roles, choose your region, platforms, languages, interests and notification pings. You can change your picks anytime; each menu saves your full selection for that group." },
  { title: "Log in on Leonida Racing", text: "Log in with Discord on the website for Registered Driver on this server. A Crew Leader, Event Host or Creator role confirmed on the website adds its matching Verified role." },
];

// Rights per tier (DEC-0129). true = yes, false = no, string = condition.
export const discordTiers = {
  cols: ["Guest", "Registered Driver", "Verified"],
  rows: [
    { label: "Chat, voice, files and reactions", v: [true, true, true] },
    { label: "Join an LFG search", v: [true, true, true] },
    { label: "Link previews, polls, external emojis, activities", v: [false, true, true] },
    { label: "Event sign-ups: I’m in", v: [false, true, true] },
    { label: "Start your own LFG search", v: [false, true, true] },
    { label: "Use /ping for event, playlist or LFG notifications", v: [false, false, "Event Hosts"] },
    { label: "Own color and member-list group", v: [false, false, true] },
  ] as { label: string; v: (boolean | string)[] }[],
  note: "Registered Driver comes from signing in with Discord on Leonida Racing. Verified roles match Crew Leader, Event Host or Creator roles confirmed on the website; they are not identity checks. Permissions depend on the channel. Only Verified Event Hosts can use /ping, in #events or #playlists.",
};

export const discordRules = ["Respect the people behind the wheel. No harassment, personal insults or targeted abuse.", "No racism, hate speech or discrimination.", "No spam or unsolicited promo DMs. Keep self-promotion to the creator channels.", "No cheats, mod menus or leaks.", "Use English in the general channels. Head to the language channels for other languages."];

export const discordBotTeaser = {
  eyebrow: "For crews and server owners",
  title: "Bring the bot to your own server",
  // final text 07.11. (Fausto, DEC-0212)
  text: "Bring your crew’s events, new cars, lap records and videos into your own server. Event cards come with sign-up buttons.",
  link: "How the bot works",
};

export const discordFaq: { q: string; a: string }[] = [
  { q: "What is the Leonida Racing Discord?", a: "An independent Discord community for GTA racers and car enthusiasts, getting ready for GTA VI. Meet drivers and crews, find groups, talk builds and share photos, videos and race jobs." },
  { q: "Is it free?", a: "Yes. Joining the server and using the community features costs nothing. Some actions, including starting an LFG search and signing up for a calendar event, require a free Leonida Racing account." },
  { q: "Is this an official Rockstar Games server?", a: "No. Leonida Racing is an independent community project and is not affiliated with Rockstar Games or Take-Two Interactive." },
  { q: "Do I need a Leonida Racing account?", a: "Not to join the server, chat or join an existing LFG search. Log in with Discord on the website for Registered Driver, event sign-ups and the option to start your own LFG search. Registered Driver also adds server permissions such as link previews and polls where the channel allows them. You do not need a separate Leonida Racing password." },
  { q: "Which platforms is it for?", a: "The community has PlayStation, Xbox and PC roles. Choose yours in #roles to find people on the same platform. These community roles do not confirm GTA VI availability on a particular system." },
  { q: "Is it only for racing?", a: "Racing is the core, but car meets, cruises, photo sessions, builds and crews all have their own place." },
  { q: "Which languages can I use?", a: "The general channels are English. Deutsch, Español, Français, Italiano and Português each have their own text and voice channel; pick the language role in #roles to see them." },
  { q: "How do my crew’s events get onto the server?", a: "Publish an event on Leonida Racing through the website’s Event Host process. Matching published events are shared through the calendar feed as Discord cards with sign-up buttons. Event details are managed on the website." },
  { q: "Can I add the bot to my own server?", a: "Yes. Anyone with Manage Server can add it and set up feeds. The bot guide shows how." }, // final text 07.11. (Fausto, DEC-0212)
];

// ---------------------------------------------------------------------------
// /discord/bot/ (RS-0076). COPY STATUS: approved Codex copy 18.10.2026
// (Codex Zuarbeit/Discord-Bot-Seite-Texte-2026-10-18.json), DEC-0088. Command names are API identifiers.
export const botPage = {
  title: "GTA 6 Discord Bot for Events, Crews & Car Meets",
  description: "Add the free Leonida Racing GTA 6 Discord bot: event cards with sign-ups and reminders, car lookups, leaderboards and video feeds.", // final text 07.11. (Fausto, DEC-0212)
  eyebrow: "GTA VI Discord Bot",
  h1: "The Leonida Racing bot",
  intro: "Keep your crew’s events where the conversation happens. The bot posts event cards with sign-up buttons, looks up cars, crews and lap times, and shares new records and videos.", // final text 07.11. (Fausto, DEC-0212)
  addNote: "Free. Setup needs the Manage Server permission.",
};

export const botGlance: { k: string; v: string }[] = [
  { k: "Price", v: "Free" },
  { k: "Works on", v: "Your Discord server" },
  { k: "Event sources", v: "Crew · Host · Public calendar" },
  { k: "Feeds", v: "Events · Cars · Records · Videos" }, // final text 07.11. (Fausto, DEC-0212)
  { k: "Setup", v: "Invite + feed command" },
];

export const botFeatures: { title: string; text: string }[] = [
  { title: "Event cards that keep up", text: "Matching published events appear as cards with the host, sign-up count and start time shown in each reader’s time zone. Updates made on Leonida Racing are reflected in the cards." },
  { title: "Sign-ups in Discord", text: "Use I’m in or Withdraw on the event card through a linked Leonida Racing account. The sign-up count refreshes after processing; full, closed or cancelled events cannot accept new sign-ups." },
  { title: "Server events, if you want them", text: "Enable add_to_server_events to create matching events in your server’s Events list as well as posting cards. Website details stay in sync; you can change the cover image or choose a voice channel in Discord." },
  { title: "Reminders before the start", text: "Choose reminders 24 hours before the start, one hour before, or both. The bot replies to the event card. Optional mentions notify signed-up drivers who are members of that server." },
  { title: "New additions to Cars", text: "A vehicle feed shares new additions to Cars that are documented in official GTA VI material. Cards show the available vehicle details and a photo when one is included." },
  { title: "Lookups for everyone", text: "/car, /compare and /crew pull cards straight from Leonida Racing, so the next argument about which car to bring has something to point at." },
  // Claude placeholders 06.11. (features built 01.–04.11.), Codex review pending
  { title: "Gellhorn leaderboard and records", text: "/leaderboard shows the Gellhorn top 10 by class, car or manufacturer, plus your own place. The record feed posts new lap records, for all drivers or just your crew." }, // final text 07.11. (Fausto, DEC-0212)
  { title: "Rate cars", text: "Give a car 1–5 stars right on its card. Change your rating anytime." }, // final text 07.11. (Fausto, DEC-0212)
  { title: "Videos from GTA and car channels", text: "A video feed posts new videos from GTA and car channels we picked." },
];

export const botSetup: { title: string; text: string }[] = [
  { title: "Add the bot", text: "Open the bot invite, choose Add to server and select your server. You need Manage Server or Administrator there. Check that the bot can access the channel you want to use." },
  { title: "Choose a feed", text: "Run /leonida feed and pick what to post: events, new cars, records or videos. Then choose the channel." }, // final text 07.11. (Fausto, DEC-0212)
  { title: "Check your feed", text: "The bot posts a confirmation in that channel. Use /leonida feed list to see all your feeds." }, // final text 07.11. (Fausto, DEC-0212)
];

export const botCommands: { cmd: string; text: string; who: string }[] = [
  { cmd: "/events", text: "See upcoming events. Filter by event type or platform.", who: "Everyone" },
  { cmd: "/event", text: "Find one event by name.", who: "Everyone" },
  { cmd: "/car", text: "Look up a car and rate it.", who: "Everyone" }, // final text 07.11. (Fausto, DEC-0212)
  { cmd: "/compare", text: "Put two to four cars side by side, with a link to the full comparison.", who: "Everyone" },
  { cmd: "/crew", text: "Show a crew card: platforms, focus, region, language and next event.", who: "Everyone" },
  { cmd: "/leaderboard", text: "Gellhorn top 10 by class, car or manufacturer. Shows your own place too.", who: "Everyone" }, // final text 07.11. (Fausto, DEC-0212)
  { cmd: "/create-event", text: "Open the event form on Leonida Racing. Event publication follows the website’s host and review requirements.", who: "Everyone" },
  { cmd: "/edit-event", text: "Change one of your events: details, sign-ups open or closed, or cancel it.", who: "Event host" }, // Claude placeholder 06.11.
  { cmd: "/help", text: "See what the bot can do. Server admins also get the feed setup commands.", who: "Everyone" },
  { cmd: "/leonida feed events", text: "Post events from your crew, your host profile or the public calendar into a channel.", who: "Manage Server" },
  { cmd: "/leonida feed vehicles", text: "Post new additions to Cars documented in official GTA VI material.", who: "Manage Server" },
  { cmd: "/leonida feed videos", text: "Post new videos from GTA and car channels we picked.", who: "Manage Server" },
  { cmd: "/leonida feed gellhorn", text: "Post new Gellhorn lap records with a checked video. All records or only your crew's.", who: "Manage Server" }, // Claude placeholder 06.11.
  { cmd: "/leonida feed list", text: "See your feeds and any reported problems.", who: "Manage Server" },
  { cmd: "/leonida feed edit", text: "Change an event feed’s options: server events, reminders, mentions.", who: "Manage Server" },
  { cmd: "/leonida feed remove", text: "Stop a feed. Existing channel posts stay.", who: "Manage Server" },
];

export const botPerms: { p: string; why: string }[] = [
  { p: "View Channels, Send Messages, Embed Links", why: "To post and update the cards." },
  { p: "Create Events, Manage Events", why: "Only for the server-events option." },
  { p: "Connect", why: "Only if you move a server event to a voice channel. The bot needs View Channel and Connect there to keep updating it." },
];

export const botFaq: { q: string; a: string }[] = [
  { q: "Is the bot free?", a: "Yes. Adding it, feeds and every command are free." },
  { q: "The bot shows as offline. Is it broken?", a: "Not necessarily. This bot handles commands through HTTP rather than keeping a permanent Discord connection, so it may appear offline. Try a command; if it fails, check the bot’s channel permissions and any feed errors." },
  { q: "I can’t see the /leonida commands.", a: "You need Manage Server. If you have it, refresh Discord." }, // final text 07.11. (Fausto, DEC-0212)
  { q: "Do I need a Leonida Racing account?", a: "Not to look things up or set up most feeds. Crew feeds, event sign-ups and ratings need a free account." }, // final text 07.11. (Fausto, DEC-0212)
  { q: "Are crew-only events private in Discord?", a: "Only in your crew's own feeds. Everyone who can see that channel can read them, but only crew members can sign up." }, // final 10.11. (Codex review + Fausto)
  // Claude placeholder 06.11. (/edit-event exists since 02.11., DEC-0100), Codex review pending
  { q: "Can I edit an event in Discord?", a: "Yes, with /edit-event: change the title, start, end, description or driver limit, close or reopen sign-ups, or cancel the event. Everything else you change on the website. In your server’s Events list you can still swap the cover image or move the event to a voice channel." },
  { q: "Why didn't a video appear?", a: "The bot checks for new videos about every 10 minutes. It only posts new videos about GTA, cars or racing; older videos are skipped." }, // final text 03.11. (DEC-0212)
  { q: "Which channels does the video feed follow?", a: "Channels picked by Leonida Racing, the same for every server. Want to suggest one? Tell us on our Discord." }, // final text 07.11. (Fausto, DEC-0212)
  { q: "What counts as a Gellhorn record?", a: "A lap that beats the best time on the track, in a class or in a car, with a video checked by a moderator." }, // final text 07.11. (Fausto, DEC-0212)
  { q: "What happens when an event is cancelled?", a: "Once processed, the card is marked Cancelled and its sign-up buttons are removed. If server events are enabled, the bot also removes the linked server event. Missing permissions or API errors can delay updates." },
  { q: "The cards have no images.", a: "Check that the bot has Embed Links in the channel and that your Discord display settings allow link previews. Some vehicle cards have no photo because none is available in Cars." },
  { q: "What happens if I remove a feed?", a: "Removing a feed stops its updates and removes its settings. Existing channel cards stay. The bot also attempts to remove the server events linked to that feed; check permissions if any remain." },
  { q: "Does it work on private channels?", a: "Yes, if the bot can view the channel, send messages and embed links there. Private-channel permissions must allow those actions for the bot." },
];
