/**
 * What's new, newest first. Add an entry for every release that users notice: a short title
 * and a few plain sentences about what they can do now (no internals). The `id` only has to be
 * unique; use the release date, with a suffix ("2026-10-23b") for a second release that day.
 * The device remembers the newest id it has shown and the sheet lists everything above it.
 */
import type { Release } from '@/lib/changelog';

export const CHANGELOG: Release[] = [
  {
    id: '2026-11-02d',
    date: '2026-11-02',
    title: 'Fix a finished workout',
    items: [
      'Typed a wrong number? Open a finished workout and tap Edit workout to change weights and reps, remove a set or add one you forgot. PRs update to match.',
      'Change your password in Settings.',
      'Rest over? You now hear a sound, and the screen stays on during a workout. You can turn the sound off in Settings.',
      'Delete your own comments, and report posts, comments or people that do not belong here.',
      'One change the server refuses no longer holds up the rest of your data, and Today tells you about it.',
      'If a screen crashes, you now get a way back instead of a white page.',
      'A set can be at most 1000 kg, so a typo cannot top a leaderboard.',
      'Fix: deleting your account now removes your profile picture too.',
    ],
  },
  {
    id: '2026-11-02c',
    date: '2026-11-02',
    title: 'See your progress',
    items: [
      'After a workout, Colosseum tells you what got better: more weight or more reps in your recent workouts, and how far you have come since your first time.',
      'Back after a break? Colosseum welcomes you and offers a short workout, instead of showing a streak at zero.',
      'Started a gym challenge? You can now change it or cancel it.',
      'A gym challenge can count several exercises, like pull-ups and chin-ups.',
      'What’s new now stays open until you close it, so you can try each new feature in turn.',
      'Went to failure? Tap the F right in that set’s row.',
      'Choose what your profile photo shows: move and zoom it before you use it.',
      'Fix: a new profile picture is saved as soon as you choose it, so friends see it. Before, it needed Save changes further down the page.',
      'Going to train moved to Today, right under the Forum, and you can invite a friend from Friends. Invites waiting for your answer stay near the top of Today.',
    ],
  },
  {
    id: '2026-11-02b',
    date: '2026-11-02',
    title: 'Generate a workout, and train together',
    highlights: [
      {
        feature: 'generate',
        title: 'Generate a workout',
        body: 'Choose what to train, how long you have and what equipment: a full gym, dumbbells, bodyweight or at home with no equipment. Colosseum tells you what you get, like 5 exercises with 2 sets each or 4 with 3, adds warm-up sets and guides you if you are new to the gym.',
        where: 'Workouts → Generate a workout',
      },
      {
        feature: 'train-together',
        title: 'Train together',
        body: 'Post when you are going to train, or invite a friend. After the workout, confirm it with a QR code and it counts in the Arena.',
        where: 'Today, under the Forum · Arena → Friends',
      },
    ],
    items: [
      'Going to train? Post the time, and friends and people from your gym can say they are in.',
      'Invite one friend to train from their profile.',
      'After a workout, show your QR code or scan your partner’s to confirm you trained together.',
      'New Arena board: Together. The newest confirmed workouts are listed in the Arena too.',
      'Sets per muscle this week, in Profile → Lifts, next to the recommended 10–20.',
      'Plate calculator: barbell lifts show which plates go on each side.',
      'After 10 workouts, beginners are asked whether to move up a level.',
      'A workout you forgot to finish now ends by itself after 3 hours without activity, or 6 hours at most. Your sets are saved with the right length, and an empty one is closed.',
    ],
  },
  {
    id: '2026-11-02',
    date: '2026-11-02',
    title: 'Swap exercises',
    items: [
      'Picked the wrong exercise? Swap it in the workout without removing it and adding another. Similar top-rated exercises come first.',
      'Suggested exercises now sit at the top of All when you add an exercise, instead of having their own category.',
      'Fix: after you pick the first exercise of an empty workout, you land on that exercise.',
      'A line now separates the rounds of a superset.',
    ],
  },
  {
    id: '2026-10-26b',
    date: '2026-10-26',
    title: 'New badges',
    items: [
      'Every badge has new artwork: a laurel wreath that grows fuller with each tier, up to a ribbon and three stars at the top.',
      'Plate club shows one more plate per side for each tier, and Squad one more gladiator.',
      'Bench, Squat and Deadlift clubs show the lift above the weight.',
    ],
  },
  {
    id: '2026-10-26',
    date: '2026-10-26',
    title: 'Exercise pictures',
    items: [
      'More than 50 exercises now have a picture: a stone gladiator showing the movement, from squats and presses to cable and machine work. More are on the way.',
    ],
  },
  {
    id: '2026-10-23',
    date: '2026-10-23',
    title: 'See what changed',
    highlights: [
      {
        feature: 'badges',
        title: 'Badges',
        body: '20 ladders, from your first workout to the 1000 lb club. Each badge grows as you climb its tiers, and friends see yours on your profile.',
        where: 'Profile → Badges',
      },
      {
        feature: 'friend-qr',
        title: 'Add friends by QR code',
        body: 'Training with someone new? Show your code; they scan it with the phone camera and tap Add friend.',
        where: 'Arena → Friends → My QR',
      },
      {
        feature: 'favorites',
        title: 'Favorite exercises',
        body: 'Tap the star on an exercise. Favorites come first in every category and get their own chip when you add an exercise.',
        where: 'The star on any exercise',
      },
    ],
    items: [
      'After an update, Colosseum shows what changed since your last visit.',
      'The full history is in Profile → Settings → What’s new.',
      'The app tour now lights up what each step talks about and shows you how to add friends.',
      'Full names everywhere: the Forum, comments, your gym and friends’ PRs.',
      'Names are at most two words, like “Jan Novák”.',
      'Fix: sharing a workout right after finishing it no longer fails with “Are you online?”.',
      'Log each side: for split squats and other one-leg or one-arm exercises, tap a set number and log left and right reps. PRs go by the weaker side.',
      'Warm-up sets: “+ Warm-up” adds a ramp up to your working weight. Warm-ups never count to volume or PRs.',
      'Drop set and Failure buttons right under your sets.',
      'Before a workout, confirm where you train. At your home gym this checks you in, so friends there see you under Training now.',
      'No home gym yet? Colosseum asks once, so My gym in the Arena works for you.',
      'Suggested next exercise: Colosseum looks at your workouts like today’s and offers what usually comes next.',
      'Profile pictures: a photo or an emoji on a colour you pick. Every profile has one now.',
      'Fix: on the Home Screen app, the dark bar behind the clock is gone. The clock is dark again and the screen starts right below it.',
      'Fix: phones set to dark mode no longer turn Colosseum dark and hard to read.',
    ],
  },
  {
    id: '2026-10-11b',
    date: '2026-10-11',
    title: 'App tour and a new Arena',
    items: [
      'A short tour walks you through the app. Replay it any time from Settings.',
      'Arena: one Friends / My gym / Global switch. The leader wears the laurel and your row shows how far the next place is.',
      'Today: swipe through the Forum.',
      'iPhone: the app now fills the whole screen when added to the Home Screen.',
    ],
  },
  {
    id: '2026-10-11',
    date: '2026-10-11',
    title: 'Drop sets, workout feel and the Forum',
    items: [
      'Drop sets and sets to failure, from the set menu.',
      'Rate how a workout felt. Colosseum suggests the next weights and tells you when a deload week could help.',
      '28 gym machines, with the machine’s own weight noted for each exercise.',
      'Forum: share workouts with friends and your gym, like and comment.',
      'Global leaderboard, if you turn it on in Settings.',
    ],
  },
  {
    id: '2026-10-05',
    date: '2026-10-05',
    title: 'Supersets',
    items: [
      'Link exercises into a superset. Rest starts after the whole round.',
      'Customize a template before you use it, and swap exercises for top-rated ones that train the same muscle.',
    ],
  },
  {
    id: '2026-10-02',
    date: '2026-10-02',
    title: 'Programs, notes and a bigger catalog',
    items: [
      'Program templates with phases that build up and end with a deload week.',
      'Over 1,300 exercises with forgiving search (typos and abbreviations like “rdl” work).',
      'A note per exercise, shown again next time.',
      'Save one-off workouts and start them again from Workouts.',
      'Weight PRs and estimated 1RM PRs, and a richer summary after each workout.',
    ],
  },
];
