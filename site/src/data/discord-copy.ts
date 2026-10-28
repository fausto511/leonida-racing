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

export const discordAreas: { title: string; text: string; channels: string[] }[] = [
  { title: "Races, playlists and meets", channels: ["events", "playlists"], text: "Published events from the Leonida Racing calendar appear as cards in #events, with times shown in your time zone. Use I’m in to sign up through your linked account. Hosts share their announcements in #events and #playlists." },
  { title: "Players, right now", channels: ["lfg"], text: "Find a group for a race, cruise, car meet or photo session. Start a search in #lfg or join one that’s already running, with a temporary voice channel for the group." },
  { title: "Car talk", channels: ["chat", "car-talk"], text: "Builds, favorite shapes, the car you still regret selling. The car-talk forum keeps threads by topic, so a good argument about headlights is still there tomorrow." },
  { title: "Time Attack", channels: ["time-attack"], text: "Racing lines, braking points and the hunt for the last tenth. Talk Gellhorn Time Attack, compare approaches and get ready to put a lap on the board when GTA VI launches." },
  { title: "Crews and racing styles", channels: ["crews", "racing-series", "racing-styles"], text: "Clean circuit racing, street-style sprints, slow cruises with the windows down. Find a crew or a series that drives the way you do." },
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
  { title: "Log in on Leonida Racing", text: "Sign in with Discord on the website for Registered Driver on this server. A Crew Leader, Event Host or Creator role confirmed on the website adds its matching Verified role." },
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
  text: "Keep your crew’s events close to the conversation. Set up a feed for matching events from your crew, a host or the public calendar, or follow new vehicle posts. Event cards include sign-up buttons and follow updates made on the website.",
  link: "How the bot works",
};

export const discordFaq: { q: string; a: string }[] = [
  { q: "What is the Leonida Racing Discord?", a: "An independent Discord community for GTA racers and car enthusiasts, getting ready for GTA VI. Meet drivers and crews, find groups, talk builds and share photos, videos and race jobs." },
  { q: "Is it free?", a: "Yes. Joining the server and using the community features costs nothing. Some actions, including starting an LFG search and signing up for a calendar event, require a free Leonida Racing account." },
  { q: "Is this an official Rockstar Games server?", a: "No. Leonida Racing is an independent community project and is not affiliated with Rockstar Games or Take-Two Interactive." },
  { q: "Do I need a Leonida Racing account?", a: "Not to join the server, chat or join an existing LFG search. Sign in with Discord on the website for Registered Driver, event sign-ups and the option to start your own LFG search. Registered Driver also adds server permissions such as link previews and polls where the channel allows them. You do not need a separate Leonida Racing password." },
  { q: "Which platforms is it for?", a: "The community has PlayStation, Xbox and PC roles. Choose yours in #roles to find people on the same platform. These community roles do not confirm GTA VI availability on a particular system." },
  { q: "Is it only for racing?", a: "Racing is the core, but car meets, cruises, photo sessions, builds and crews all have their own place." },
  { q: "Which languages can I use?", a: "The general channels are English. Deutsch, Español, Français, Italiano and Português each have their own text and voice channel; pick the language role in #roles to see them." },
  { q: "How do my crew’s events get onto the server?", a: "Publish an event on Leonida Racing through the website’s Event Host process. Matching published events are shared through the calendar feed as Discord cards with sign-up buttons. Event details are managed on the website." },
  { q: "Can I add the bot to my own server?", a: "Yes. Server administrators can add the bot and set up event or vehicle feeds. The bot guide explains the permissions, setup and available commands." },
];

// ---------------------------------------------------------------------------
// /discord/bot/ (RS-0076). COPY STATUS: approved Codex copy 18.10.2026
// (Codex Zuarbeit/Discord-Bot-Seite-Texte-2026-10-18.json), DEC-0088. Command names are API identifiers.
export const botPage = {
  title: "GTA 6 Discord Bot for Events, Crews & Car Meets",
  description: "Add the free Leonida Racing GTA 6 Discord bot. Share event cards and sign-ups, set reminders, look up cars and compare them with your crew.",
  eyebrow: "GTA VI Discord Bot",
  h1: "The Leonida Racing bot",
  intro: "Keep your crew’s events where the conversation happens. The Leonida Racing bot posts event cards with sign-up buttons, follows changes made on the website and brings car and crew lookups into your Discord.",
  addNote: "Free. Setup needs the Manage Server permission.",
};

export const botGlance: { k: string; v: string }[] = [
  { k: "Price", v: "Free" },
  { k: "Works on", v: "Your Discord server" },
  { k: "Event sources", v: "Crew · Host · Public calendar" },
  { k: "Setup", v: "Invite + feed command" },
];

export const botFeatures: { title: string; text: string }[] = [
  { title: "Event cards that keep up", text: "Matching published events appear as cards with the host, sign-up count and start time shown in each reader’s time zone. Updates made on Leonida Racing are reflected in the cards." },
  { title: "Sign-ups in Discord", text: "Use I’m in or Withdraw on the event card through a linked Leonida Racing account. The sign-up count refreshes after processing; full, closed or cancelled events cannot accept new sign-ups." },
  { title: "Server events, if you want them", text: "Enable add_to_server_events to create matching events in your server’s Events list as well as posting cards. Website details stay in sync; you can change the cover image or choose a voice channel in Discord." },
  { title: "Reminders before the start", text: "Choose reminders 24 hours before the start, one hour before, or both. The bot replies to the event card. Optional mentions notify signed-up drivers who are members of that server." },
  { title: "New additions to Cars", text: "A vehicle feed shares new additions to Cars that are documented in official GTA VI material. Cards show the available vehicle details and a photo when one is included." },
  { title: "Lookups for everyone", text: "/car, /compare and /crew pull cards straight from Leonida Racing, so the next argument about which car to bring has something to point at." },
];

export const botSetup: { title: string; text: string }[] = [
  { title: "Add the bot", text: "Open the bot invite, choose Add to server and select your server. You need Manage Server or Administrator there. Check that the bot can access the channel you want to use." },
  { title: "Run /leonida feed events", text: "Choose a channel and event source with /leonida feed events. Public-calendar feeds require a platform filter. Crew and host feeds require the matching website role. Add server events and reminders if you want them." },
  { title: "Check your feed", text: "The bot posts a setup confirmation in the chosen channel. Matching upcoming events are queued for delivery. Use /leonida feed list to check the feed and any reported problems." },
];

export const botCommands: { cmd: string; text: string; who: string }[] = [
  { cmd: "/events", text: "See upcoming events. Filter by event type or platform.", who: "Everyone" },
  { cmd: "/event", text: "Find one event by name.", who: "Everyone" },
  { cmd: "/car", text: "Look up a make or model for its vehicle card.", who: "Everyone" },
  { cmd: "/compare", text: "Put two to four cars side by side, with a link to the full comparison.", who: "Everyone" },
  { cmd: "/crew", text: "Show a crew card: platforms, focus, region, language and next event.", who: "Everyone" },
  { cmd: "/create-event", text: "Open the event form on Leonida Racing. Event publication follows the website’s host and review requirements.", who: "Everyone" },
  { cmd: "/help", text: "See what the bot can do. Server admins also get the feed setup commands.", who: "Everyone" },
  { cmd: "/leonida feed events", text: "Post events from your crew, your host profile or the public calendar into a channel.", who: "Manage Server" },
  { cmd: "/leonida feed vehicles", text: "Post new additions to Cars documented in official GTA VI material.", who: "Manage Server" },
  { cmd: "/leonida feed videos", text: "Post new GTA videos and live streams from the creators Leonida Racing follows.", who: "Manage Server" },
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
  { q: "I can’t see the /leonida commands.", a: "Feed setup requires Manage Server or Administrator. Check your server permissions and that the bot was added to the server with commands enabled. Refresh Discord if the command list has not updated." },
  { q: "Do I need a Leonida Racing account?", a: "You do not need a website account to set up a public-calendar or vehicle feed, but you do need Manage Server in Discord. A crew or host feed also requires a linked website account with the matching confirmed role. Event sign-ups require a free linked account." },
  { q: "Can I edit an event in Discord?", a: "Title, time and description always come from the website, so change them there. In your server’s Events list you can swap the cover image or move the event to a voice channel; the bot keeps those changes. Changes in Discord never reach the website." },
  { q: "What happens when an event is cancelled?", a: "Once processed, the card is marked Cancelled and its sign-up buttons are removed. If server events are enabled, the bot also removes the linked server event. Missing permissions or API errors can delay updates." },
  { q: "The cards have no images.", a: "Check that the bot has Embed Links in the channel and that your Discord display settings allow link previews. Some vehicle cards have no photo because none is available in Cars." },
  { q: "What happens if I remove a feed?", a: "Removing a feed stops its updates and removes its settings. Existing channel cards stay. The bot also attempts to remove the server events linked to that feed; check permissions if any remain." },
  { q: "Does it work on private channels?", a: "Yes, if the bot can view the channel, send messages and embed links there. Private-channel permissions must allow those actions for the bot." },
];
