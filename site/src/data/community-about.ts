// About blocks at the bottom of Community / Events / Crews (SEO + context, DEC-0192).
// Copy: Codex 2026-10-28 (Community-About-Texte-2026-10-27.md); Events ¶2 and Crews ¶2 mixed
// with Claude's suggestions on Fausto's pick (28.10.2026). Fausto: no Racing Society mention, no reporting in the Events block. {base} is replaced with BASE_URL.
export interface CommunityAbout { title: string; paras: string[] }

export const communityAbout: Record<'community' | 'events' | 'crews', CommunityAbout> = {
  community: {
    title: 'Find your people, then find your next drive',
    paras: [
      'There’s room here for the driver chasing a cleaner lap and the one who spent the evening getting the wheels just right. Leonida Racing brings the GTA VI racing community together around <a href="{base}community/crews/">crews</a>, <a href="{base}community/events/">events</a>, and <a href="{base}community/tracks/">tracks</a>. Find people who enjoy the same kind of driving, whether that means close racing, car meets, or a cruise where arriving first misses the point.',
      'Browse the community pages, then sign in with Discord when you’re ready to take part. <a href="{base}discord/">Our Discord</a> connects the conversations between drives: event announcements, finding a lobby, and meeting a crew. The website helps you find what’s happening; the people give you a reason to turn up.',
      '<a href="{base}about/">Our roots</a> are in the Rockford Racing League, bringing championship experience and a network of racers, hosts, and creators into one place. That’s the idea behind our approach to motorsport and car culture: build it with the people who keep showing up.',
    ],
  },
  events: {
    title: 'Pick the kind of night you’re after',
    paras: [
      'A race puts you on the grid. <a href="{base}time-attack/gellhorn-international-raceway/">Time Attack</a> gives you a clock to chase. Leagues bring drivers back for the next round, while car meets and cruises leave more room to enjoy the builds and the company. The event calendar brings those plans together, with start times shown in your local time so you can spend less time converting time zones.',
      'Every event card shows who’s hosting and what the night involves. Spot still open? Hit “I’m in.” Share it with the drivers you want next to you.',
      'Got an evening of your own in mind? Apply to <a href="{base}account/events/">become a host</a> through your account. Hosts enter and publish their own events, from a relaxed cruise to a grid that expects everyone to know the braking point.',
    ],
  },
  crews: {
    title: 'More than a tag beside your name',
    paras: [
      'Some crews live for <a href="{base}community/events/">league nights</a>. Others would rather put a meet together, trade builds, or take the long way across Leonida. Look through the crew profiles for the people, language, and driving interests that fit you. Each listing brings a crew’s tag, color, and members together, with a leader and any commissioners helping run things.',
      'Open crews: hit “Join Crew” and you’re in. “Request Invite” sends a request for the crew to review. Official crews are run by us or by the original creators; Featured ones are picked by our team. None of them are run or endorsed by Rockstar.',
      'Already have a group you drive with? <a href="{base}account/crew/">Start a crew</a> through your account and submit its profile for moderation. Give other drivers a useful picture of what you enjoy and how you play. A matching tag is a start; enjoying the same kind of night is what matters.',
    ],
  },
};
