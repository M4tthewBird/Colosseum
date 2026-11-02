/**
 * The privacy policy shown at /privacy. It describes what the app really does, so change it when
 * that changes. Links to it stay hidden until the contact is filled in.
 */
export const PRIVACY_CONTACT: { name: string; email: string } | null = null;

export const PRIVACY_UPDATED = '2 November 2026';

export const PRIVACY_SECTIONS: { title: string; paragraphs: string[] }[] = [
  {
    title: 'What we store',
    paragraphs: [
      'Your account: username and password. The password is stored only in a scrambled form that nobody can read. We do not ask for your email.',
      'Your profile: name, picture, sex, experience, goals and home gym.',
      'Your training: programs, workouts, sets, PRs, ratings and badges.',
      'Your body: bodyweight, height and body measurements.',
      'What you share: Forum posts, comments, likes, gym check-ins, training plans and friends.',
    ],
  },
  {
    title: 'Why, and on what basis',
    paragraphs: [
      'We use this data only to run Colosseum: to log your training, show your progress and let you compete and train with others. That is necessary to provide the service you signed up for.',
      'Bodyweight and body measurements can count as health data. You choose to enter them, and they are used only for your own tracking and to calculate a DOTS score. You can delete them at any time by deleting your account.',
      'We do not sell your data, show ads or use analytics or tracking tools.',
    ],
  },
  {
    title: 'Who can see what',
    paragraphs: [
      'Bodyweight, height and body measurements: only you. Other people can see a DOTS score calculated from your bodyweight, never the weight itself.',
      'Other signed-in users can see your name, username, picture and home gym. Your sex, experience and goals are stored with your profile, and the app does not show them to others, but they are not technically hidden from other signed-in users.',
      'Friends and members of your home gym can see your finished workouts and lifts. Your Forum posts and comments are visible to friends and your gym.',
      'The global leaderboard is off until you turn it on. Then everyone who joined it sees your name, picture and ranked numbers.',
    ],
  },
  {
    title: 'Where it is kept',
    paragraphs: [
      'Your data is stored with Supabase, which provides our database, sign-in and picture storage. The app itself is served by GitHub Pages, which may keep technical logs such as IP addresses. These companies process data for us and may do so outside the EU, under the safeguards the law requires.',
      'The app also keeps a copy on your device, so logging works offline. This is not used for tracking.',
    ],
  },
  {
    title: 'How long',
    paragraphs: [
      'We keep your data until you delete your account in Settings. That removes your profile, workouts, body data, posts and comments for good. Workouts other people already copied to their own account stay with them. Backups may hold deleted data for a short time.',
    ],
  },
  {
    title: 'Your rights',
    paragraphs: [
      'You can ask to see a copy of your data, correct it, delete it, move it, or limit or object to how it is used. If you gave consent, you can withdraw it. Most of this you can do in the app; for anything else, contact us.',
      'You can also complain to the Czech data protection authority (Úřad pro ochranu osobních údajů, uoou.gov.cz).',
    ],
  },
  {
    title: 'Age',
    paragraphs: ['Colosseum is for people aged 15 and over.'],
  },
];
