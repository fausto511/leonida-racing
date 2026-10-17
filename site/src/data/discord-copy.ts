// Copy for /discord/ (RS-0076, 17.10.2026).
// COPY STATUS: Claude placeholders, Codex review pending (DEC-0088). Rules lines reuse the approved
// #rules texts (Codex Zuarbeit/Discord-StartHere-Rules-Botkanal-2026-10-15.md).
// Facts checked against the live server on 17.10.: channel names, language channels with voice,
// LFG v1 (DEC-0111), Registered Driver / Verified rights (DEC-0129). Event cards post in #updates.

export const discordPage = {
  title: 'GTA 6 Racing Discord: Car Meets, Crews & LFG',
  description: 'Join the Leonida Racing Discord, a free GTA 6 community for racers, crews and car meets. Find players, sign up for events and talk cars in six languages.',
  eyebrow: 'GTA VI Racing & Car Culture Discord',
  h1: 'Leonida Racing on Discord',
  intro: 'A Discord for GTA VI racers, crews and car-meet regulars. Find people to drive with right now, grab a spot in the next race with one click and talk cars with people who notice the same details you do.',
  joinNote: 'Free to join. Independent community, not run by Rockstar.',
};

export const discordGlance: { k: string; v: string }[] = [
  { k: 'Price', v: 'Free' },
  { k: 'Languages', v: 'English + 5 more' },
  { k: 'Platforms', v: 'PlayStation · Xbox · PC' },
  { k: 'Looking for group', v: 'Own voice per search' },
  { k: 'Events', v: 'One-click sign-up' },
];

export const discordAreas: { title: string; text: string; channels: string[] }[] = [
  { title: 'Races, playlists and meets', channels: ['updates', 'events', 'playlists'],
    text: 'Every public event from the Leonida Racing calendar posts in #updates as a card, in your own time zone. Hit I’m in and you’re on the list. Hosts announce their races and playlists in #events and #playlists.' },
  { title: 'Players, right now', channels: ['lfg'],
    text: 'Hit Find Players, pick what you’re up for and get your own voice channel for three hours. No planning a week ahead, just people who want to drive tonight.' },
  { title: 'Car talk', channels: ['chat', 'car-talk'],
    text: 'Builds, favorite shapes, the car you still regret selling. The car-talk forum keeps threads by topic, so a good argument about headlights is still there tomorrow.' },
  { title: 'Time Attack', channels: ['time-attack'],
    text: 'Lines, braking points and personal bests for the Gellhorn Time Attack. Ask how someone found the last tenth, or just post the lap you’re proud of.' },
  { title: 'Crews and racing styles', channels: ['crews', 'racing-series', 'racing-styles'],
    text: 'Clean circuit racing, street-style sprints, slow cruises with the windows down. Find a crew or a series that drives the way you do.' },
  { title: 'Creators and track builders', channels: ['snapmatics', 'streams-videos', 'job-creators'],
    text: 'Share Snapmatics and videos, show the race jobs you built and find drivers who will actually test them.' },
];

export const discordLanguages = ['Deutsch', 'Español', 'Français', 'Italiano', 'Português'];
export const discordLanguagesText = 'The general channels are English. Each of these languages has its own text and voice channel. Pick the language in #roles and it shows up.';

export const discordLfg = {
  eyebrow: 'Looking for group',
  title: 'Need people to drive with? One button.',
  text: 'In #lfg there’s a Find Players button. Tell the bot what you’re up for, it opens a voice channel for your group and lets everyone with LFG Pings know. Others hit Join and show up on your card.',
  steps: [
    'Pick an activity: Race, Playlist, Car Meet, Cruise, Photo Session or Job.',
    'Say how many you need: 2–4, 5–8 or 9+.',
    'Your voice channel opens right away and stays for three hours.',
  ],
  notes: 'Up to three searches run at once, one per person. Starting one needs a free Leonida Racing account; joining doesn’t. Leave and the next person becomes host.',
};

export const discordSteps: { title: string; text: string }[] = [
  { title: 'Join the server', text: 'One click on the invite. You can read and talk in every open channel right away.' },
  { title: 'Grab your roles', text: 'In #roles, pick your region, platforms, languages, what you do in the scene and which pings you want. Change them anytime.' },
  { title: 'Log in on Leonida Racing', text: 'Log in with Discord on the website and you get Registered Driver on the server. Confirmed Crew Leaders, Event Hosts and Creators get a Verified role on top.' },
];

// Rights per tier (DEC-0129). true = yes, false = no, string = condition.
export const discordTiers = {
  cols: ['Guest', 'Registered Driver', 'Verified'],
  rows: [
    { label: 'Chat, voice, files and reactions', v: [true, true, true] },
    { label: 'Join an LFG lobby', v: [true, true, true] },
    { label: 'Link previews, polls, external emojis, activities', v: [false, true, true] },
    { label: 'Sign up for events with I’m in', v: [false, true, true] },
    { label: 'Start your own LFG search', v: [false, true, true] },
    { label: 'Ping Event, Playlist or LFG groups with /ping', v: [false, false, 'Event Hosts'] },
    { label: 'Own color and member-list group', v: [false, false, true] },
  ] as { label: string; v: (boolean | string)[] }[],
  note: 'Registered Driver = logged in on Leonida Racing with Discord. Verified = Crew Leader, Event Host or Creator role confirmed on the site.',
};

// Approved #rules lines, shortened (Codex 15.10.).
export const discordRules = [
  'Respect the people behind the wheel. No harassment, personal insults or targeted abuse.',
  'No racism, hate speech or discrimination.',
  'Keep self-promotion to the creator channels.',
  'No cheats, mod menus or leaks.',
  'Use English in the general channels. Head to the language channels for other languages.',
];

export const discordBotTeaser = {
  eyebrow: 'For crews and server owners',
  title: 'Bring the bot to your own server',
  text: 'The Leonida Racing bot posts your crew’s events, the public calendar or newly revealed cars into any Discord. Every event card has sign-up buttons, and changes on the website update the card.',
  link: 'How the bot works',
};

export const discordFaq: { q: string; a: string }[] = [
  { q: 'What is the Leonida Racing Discord?',
    a: 'A free Discord server for GTA VI racing and car culture. Drivers use it to find people to play with, sign up for races and car meets, talk about cars and share what they create.' },
  { q: 'Is it free?',
    a: 'Yes. Joining, chatting, hopping into an LFG lobby and signing up for events cost nothing.' },
  { q: 'Is this an official Rockstar Games server?',
    a: 'No. Leonida Racing is an independent community project and is not affiliated with Rockstar Games or Take-Two Interactive.' },
  { q: 'Do I need a Leonida Racing account?',
    a: 'Not to join, chat or jump into someone’s LFG lobby. Log in with Discord on the website and you get Registered Driver: link previews and polls on the server, event sign-ups and your own LFG searches. There is no separate password.' },
  { q: 'Which platforms is it for?',
    a: 'GTA VI launches on PlayStation 5 and Xbox Series X|S. Pick your platform in #roles so people on the same system can find you.' },
  { q: 'Is it only for racing?',
    a: 'Racing is the core, but car meets, cruises, photo sessions, builds and crews all have their own place.' },
  { q: 'Which languages can I use?',
    a: 'The general channels are English. Deutsch, Español, Français, Italiano and Português each have their own text and voice channel; pick the language role in #roles to see them.' },
  { q: 'How do my crew’s events get onto the server?',
    a: 'Publish the event on Leonida Racing with a confirmed Event Host role. Public events post on the server automatically as cards with sign-up buttons, and changes on the website update the card.' },
  { q: 'Can I add the bot to my own server?',
    a: 'Yes. The bot can post your crew’s events, the public calendar or new vehicles into your own Discord. The bot page explains setup and every command.' },
];

// ---------------------------------------------------------------------------
// /discord/bot/ (RS-0076). Facts from discord-interactions v19 / discord-dispatch v16 and the
// test notes in Claude outputs/BOT-ERKLAERSEITE-Sammlung.md. Command lines reuse the approved
// #leonida-bot-guide texts (Codex 15.10.) where they fit. COPY STATUS: Claude placeholders.
export const botPage = {
  title: 'GTA 6 Discord Bot for Events, Crews & Car Meets',
  description: 'Add the free Leonida Racing bot to your Discord. Post GTA 6 races and car meets with sign-up buttons, look up cars, compare them and share crews.',
  eyebrow: 'GTA VI Discord Bot',
  h1: 'The Leonida Racing bot',
  intro: 'Your crew’s races and car meets, posted in your own Discord with sign-up buttons on every card. Change the event on the website and the card follows. Plus car lookups, comparisons and crew cards for everyone on the server.',
  addNote: 'Free. Setup needs the Manage Server permission.',
};

export const botGlance: { k: string; v: string }[] = [
  { k: 'Price', v: 'Free' },
  { k: 'Works on', v: 'Any Discord server' },
  { k: 'Event sources', v: 'Crew · Host · Public calendar' },
  { k: 'Setup', v: 'One command' },
];

export const botFeatures: { title: string; text: string }[] = [
  { title: 'Event cards that keep up', text: 'Every matching event lands in your channel as a card with start time in each reader’s time zone, host and head count. Change the time on the website and the card changes too. Cancel it and the card turns grey.' },
  { title: 'Sign-ups in Discord', text: 'I’m in and Withdraw sit right on the card. Drivers sign up without leaving Discord, and the count on the card updates within about a minute.' },
  { title: 'Server events, if you want them', text: 'Switch on add_to_server_events and each event also shows up in your server’s Events list at the top of the channel list. You can still swap the cover image or move it to a voice channel yourself.' },
  { title: 'Reminders before the start', text: 'Choose 24 hours, 1 hour or both. The bot replies to the event card, and can mention the drivers who signed up and are on your server.' },
  { title: 'New cars as they’re revealed', text: 'A vehicle feed posts officially revealed cars from The Garage as they’re added, with class, drivetrain and a photo when there is one.' },
  { title: 'Lookups for everyone', text: '/car, /compare and /crew pull cards straight from Leonida Racing, so the next argument about which car to bring has something to point at.' },
];

export const botSetup: { title: string; text: string }[] = [
  { title: 'Add the bot', text: 'Open the invite and choose “Add to server”, not “Add to my apps”. Pick your server and keep the suggested permissions.' },
  { title: 'Run /leonida feed add', text: 'Pick the channel and the source: your crew, your host profile or the public calendar with a platform filter. Optionally switch on server events and reminders.' },
  { title: 'That’s it', text: 'The bot posts a short confirmation in the channel, and upcoming events show up right after. /leonida feed list shows your feeds and any problem the bot ran into.' },
];

export const botCommands: { cmd: string; text: string; who: string }[] = [
  { cmd: '/events', text: 'See upcoming events. Filter by event type or platform.', who: 'Everyone' },
  { cmd: '/event', text: 'Find one event by name.', who: 'Everyone' },
  { cmd: '/car', text: 'Look up a make or model for its vehicle card.', who: 'Everyone' },
  { cmd: '/compare', text: 'Put two to four cars side by side, with a link to the full comparison.', who: 'Everyone' },
  { cmd: '/crew', text: 'Show a crew card: platforms, focus, region, language and next event.', who: 'Everyone' },
  { cmd: '/create-event', text: 'Open the event form on Leonida Racing. Publishing needs a confirmed Event Host role.', who: 'Everyone' },
  { cmd: '/leonida feed add', text: 'Post events from your crew, your host profile or the public calendar into a channel.', who: 'Manage Server' },
  { cmd: '/leonida feed vehicles', text: 'Post newly added, officially revealed vehicles to a channel.', who: 'Manage Server' },
  { cmd: '/leonida feed list', text: 'See your feeds and any reported problems.', who: 'Manage Server' },
  { cmd: '/leonida feed edit', text: 'Change an event feed’s options: server events, reminders, mentions.', who: 'Manage Server' },
  { cmd: '/leonida feed remove', text: 'Stop a feed. Existing channel posts stay.', who: 'Manage Server' },
];

export const botPerms: { p: string; why: string }[] = [
  { p: 'View Channels, Send Messages, Embed Links', why: 'To post and update the cards.' },
  { p: 'Create Events, Manage Events', why: 'Only for the server-events option.' },
  { p: 'Connect', why: 'Only if you move a server event to a voice channel. The bot needs View Channel and Connect there to keep updating it.' },
];

export const botFaq: { q: string; a: string }[] = [
  { q: 'Is the bot free?', a: 'Yes. Adding it, feeds and every command are free.' },
  { q: 'The bot shows as offline. Is it broken?', a: 'No, that’s normal. It only wakes up when someone uses a command or something changes on the website; it doesn’t keep a permanent connection to Discord.' },
  { q: 'I can’t see the /leonida commands.', a: 'Setup commands are only visible to members with Manage Server. After an update, reloading Discord (Ctrl+R) helps.' },
  { q: 'Do I need a Leonida Racing account?', a: 'For a public-calendar feed, no. For a crew or host feed you need the matching role on Leonida Racing: Crew Leader or Event Host, confirmed by a moderator. Drivers need a free account to hit I’m in.' },
  { q: 'Can I edit an event in Discord?', a: 'Title, time and description always come from the website, so change them there. In your server’s Events list you can swap the cover image or move the event to a voice channel; the bot keeps those changes. Changes in Discord never reach the website.' },
  { q: 'What happens when an event is cancelled?', a: 'The card turns grey and says Cancelled, the buttons disappear, and the server event is removed.' },
  { q: 'The cards have no images.', a: 'Usually a Discord setting on your side: Settings → Chat → show images and previews from links.' },
  { q: 'What happens if I remove a feed?', a: 'Cards already in the channel stay. Server events the bot created for that feed are removed.' },
  { q: 'Does it work on private channels?', a: 'Yes, if you allow the Leonida Racing role in that channel’s permissions.' },
];
