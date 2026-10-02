# Obrázky cviků přes ChatGPT

Hotovo 1 z 124. Zbývá 123 obrázků v 9 dávkách po 15.

## Jak na to

1. Otevři nový chat v ChatGPT a **přilož `assets/exercises/bench-press.jpg`** (vzor stylu).
2. Zkopíruj celý text **jedné dávky** níže (blok kódu, tlačítko „Copy“) a odešli.
3. Po každém obrázku napiš `next`. Každý obrázek hned stáhni (v pořadí 1, 2, 3…) do složky
   `assets/exercises/_inbox/`.
4. Když máš dávku staženou, spusť v PowerShellu ve složce projektu:

   ```powershell
   npm run images:import
   ```

   Obrázky se samy pojmenují podle pořadí, oříznou na 16:9, zmenší a napojí do aplikace.
   Tento soubor se pak přegeneruje jen se zbývajícími cviky.

Tipy:
- Pořadí stahování = pořadí v dávce. Když nějaký obrázek přeskočíš, přejmenuj zbylé soubory
  ručně na název z dávky (např. `hack-squat.png`) – pojmenované soubory import pozná sám.
- Když se obrázek nepovede, napiš ChatGPT `redo` a stáhni až opravenou verzi.
- Na jednu dávku je nejlepší nový chat, styl pak zůstává stejný.

## Dávka 1 z 9

```text
Generate 15 exercise illustrations for a fitness app, one image per reply.
After each image, write only its number and file name, then wait until I write "next".

Style for every image (keep it identical across all of them):
Photorealistic 3D render of a classical white-grey marble statue of a muscular male athlete (Greco-Roman sculpture with curly hair and a short beard, a draped marble loincloth, subtle veining in the stone). Every piece of equipment (bench, barbell, plates, dumbbells, machine, cables) is carved from the same pale marble. Three-quarter view from slightly above, the whole body and equipment in frame, soft diffused studio light with a gentle contact shadow, seamless plain light grey background (#DEDDDC). No text, no logos, no other people. Landscape 3:2 image; keep the statue and equipment within the middle 80 % of the width because the image will be cropped to 16:9.
If I attached bench-press.jpg, treat it as the exact style reference.

1. incline-bench-press.jpg | Incline Bench Press. Pose: lying on a bench inclined about 30 degrees, pressing a barbell up from the upper chest, arms nearly locked out.
2. incline-dumbbell-press.jpg | Incline Dumbbell Press. Pose: lying on a bench inclined about 30 degrees, pressing two dumbbells up from the upper chest.
3. dumbbell-bench-press.jpg | Dumbbell Bench Press. Pose: lying on a flat bench, pressing two dumbbells up from the chest.
4. dips.jpg | Dips. Pose: supported on parallel bars, body leaning slightly forward, elbows bent about 90 degrees at the bottom of a dip.
5. push-up.jpg | Push Up. Pose: in a push-up position on the floor, chest halfway down, body in a straight line.
6. overhead-press.jpg | Overhead Press. Pose: standing, pressing a barbell from the shoulders overhead, arms nearly locked out.
7. dumbbell-shoulder-press.jpg | Dumbbell Shoulder Press. Pose: seated on an upright bench, pressing two dumbbells overhead from shoulder height.
8. lateral-raise.jpg | Lateral Raise. Pose: standing, raising two dumbbells out to the sides to shoulder height, elbows slightly bent.
9. face-pull.jpg | Face Pull. Pose: standing at a cable tower, pulling a rope attachment towards the face, elbows high and flared out.
10. triceps-pushdown.jpg | Triceps Pushdown. Pose: standing at a cable tower, pushing a straight bar down with elbows pinned to the sides, arms almost straight.
11. skull-crusher.jpg | Skull Crusher. Pose: lying on a flat bench, lowering a barbell towards the forehead by bending only the elbows.
12. squat.jpg | Squat. Pose: barbell across the upper back, in a deep squat with thighs just below parallel, chest up.
13. front-squat.jpg | Front Squat. Pose: barbell racked on the front of the shoulders, elbows high, in a deep upright squat.
14. leg-press.jpg | Leg Press. Pose: seated in a 45-degree leg press machine, knees bent deeply, feet on the platform.
15. lunge.jpg | Lunge. Pose: stepping forward into a lunge, back knee close to the floor, holding dumbbells at the sides.

Start with image 1.
```

## Dávka 2 z 9

```text
Generate 15 exercise illustrations for a fitness app, one image per reply.
After each image, write only its number and file name, then wait until I write "next".

Style for every image (keep it identical across all of them):
Photorealistic 3D render of a classical white-grey marble statue of a muscular male athlete (Greco-Roman sculpture with curly hair and a short beard, a draped marble loincloth, subtle veining in the stone). Every piece of equipment (bench, barbell, plates, dumbbells, machine, cables) is carved from the same pale marble. Three-quarter view from slightly above, the whole body and equipment in frame, soft diffused studio light with a gentle contact shadow, seamless plain light grey background (#DEDDDC). No text, no logos, no other people. Landscape 3:2 image; keep the statue and equipment within the middle 80 % of the width because the image will be cropped to 16:9.
If I attached bench-press.jpg, treat it as the exact style reference.

1. bulgarian-split-squat.jpg | Bulgarian Split Squat. Pose: rear foot elevated on a bench behind, front leg in a deep split squat, holding dumbbells at the sides.
2. leg-extension.jpg | Leg Extension. Pose: seated in a leg extension machine, straightening the knees against the pad.
3. deadlift.jpg | Deadlift. Pose: standing up from the floor with a loaded barbell, halfway up, back flat, bar close to the shins.
4. romanian-deadlift.jpg | Romanian Deadlift. Pose: hips pushed far back, knees slightly bent, lowering a barbell along the thighs to mid-shin, back flat.
5. leg-curl.jpg | Leg Curl. Pose: seated in a leg curl machine, curling the heels down and back against the pad.
6. hip-thrust.jpg | Hip Thrust. Pose: upper back on a bench, barbell across the hips, hips fully extended, torso parallel to the floor.
7. calf-raise.jpg | Calf Raise. Pose: standing on the edge of a block, rising high onto the toes, holding a dumbbell.
8. barbell-row.jpg | Barbell Row. Pose: torso bent forward about 45 degrees, rowing a barbell to the lower ribs.
9. dumbbell-row.jpg | Dumbbell Row. Pose: one knee and hand on a flat bench, rowing a dumbbell to the hip with the other arm.
10. pull-up.jpg | Pull Up. Pose: hanging from a bar with an overhand grip wider than the shoulders, chin pulled above the bar.
11. chin-up.jpg | Chin Up. Pose: hanging from a bar with an underhand shoulder-width grip, chin pulled above the bar.
12. lat-pulldown.jpg | Lat Pulldown. Pose: seated at a lat pulldown machine, pulling a wide bar down to the upper chest, thighs under the pads.
13. seated-cable-row.jpg | Seated Cable Row. Pose: seated at a low cable row, feet on the platform, pulling a handle to the stomach, chest up.
14. shrug.jpg | Shrug. Pose: standing, holding heavy dumbbells at the sides, shoulders shrugged up towards the ears.
15. biceps-curl.jpg | Biceps Curl. Pose: standing, curling two dumbbells up towards the shoulders, elbows at the sides.

Start with image 1.
```

## Dávka 3 z 9

```text
Generate 15 exercise illustrations for a fitness app, one image per reply.
After each image, write only its number and file name, then wait until I write "next".

Style for every image (keep it identical across all of them):
Photorealistic 3D render of a classical white-grey marble statue of a muscular male athlete (Greco-Roman sculpture with curly hair and a short beard, a draped marble loincloth, subtle veining in the stone). Every piece of equipment (bench, barbell, plates, dumbbells, machine, cables) is carved from the same pale marble. Three-quarter view from slightly above, the whole body and equipment in frame, soft diffused studio light with a gentle contact shadow, seamless plain light grey background (#DEDDDC). No text, no logos, no other people. Landscape 3:2 image; keep the statue and equipment within the middle 80 % of the width because the image will be cropped to 16:9.
If I attached bench-press.jpg, treat it as the exact style reference.

1. hammer-curl.jpg | Hammer Curl. Pose: standing, curling two dumbbells with a neutral grip (thumbs up), elbows at the sides.
2. preacher-curl.jpg | Preacher Curl. Pose: seated at a preacher bench, upper arms resting on the angled pad, curling a barbell up.
3. cable-fly.jpg | Cable Fly. Pose: standing between two high cable pulleys, bringing the handles together in front of the chest in a hugging arc.
4. plank.jpg | Plank. Pose: in a forearm plank on the floor, body in a straight line from head to heels.
5. hanging-leg-raise.jpg | Hanging Leg Raise. Pose: hanging from a pull-up bar, legs raised straight in front to hip height.
6. cable-crunch.jpg | Cable Crunch. Pose: kneeling below a high cable, holding a rope at the head, crunching the torso down towards the knees.
7. farmers-carry.jpg | Farmers Carry. Pose: walking upright while holding a very heavy dumbbell in each hand at the sides.
8. good-morning.jpg | Good Morning. Pose: barbell on the upper back, hinging forward at the hips with a flat back until the torso is near parallel.
9. arnold-press.jpg | Arnold Press. Pose: seated, pressing two dumbbells overhead while rotating the palms from facing in to facing forward.
10. cable-lateral-raise.jpg | Cable Lateral Raise. Pose: standing side-on to a low cable pulley, raising the handle out to the side to shoulder height with one arm.
11. cable-y-raise.jpg | Cable Y Raise. Pose: standing between two low cable pulleys, raising both handles up and out into a Y shape above the head.
12. behind-the-back-cuffed-cable-lateral-raise.jpg | Behind the Back Cuffed Cable Lateral Raise. Pose: standing side-on to a low cable, the cable running behind the back to a cuff on the far wrist, raising that arm out to the side.
13. reverse-pec-deck.jpg | Reverse Pec Deck. Pose: seated facing the pad of a pec deck machine, sweeping the handles back with straight arms to open the chest.
14. reverse-cable-crossover.jpg | Reverse Cable Crossover. Pose: standing between two high cable pulleys, crossing arms in front then pulling the cables back and out to the sides.
15. machine-shoulder-press.jpg | Machine Shoulder Press. Pose: seated in a shoulder press machine, pressing the handles overhead.

Start with image 1.
```

## Dávka 4 z 9

```text
Generate 15 exercise illustrations for a fitness app, one image per reply.
After each image, write only its number and file name, then wait until I write "next".

Style for every image (keep it identical across all of them):
Photorealistic 3D render of a classical white-grey marble statue of a muscular male athlete (Greco-Roman sculpture with curly hair and a short beard, a draped marble loincloth, subtle veining in the stone). Every piece of equipment (bench, barbell, plates, dumbbells, machine, cables) is carved from the same pale marble. Three-quarter view from slightly above, the whole body and equipment in frame, soft diffused studio light with a gentle contact shadow, seamless plain light grey background (#DEDDDC). No text, no logos, no other people. Landscape 3:2 image; keep the statue and equipment within the middle 80 % of the width because the image will be cropped to 16:9.
If I attached bench-press.jpg, treat it as the exact style reference.

1. standing-machine-lateral-raise.jpg | Standing Machine Lateral Raise. Pose: standing in a lateral raise machine, raising the arm pads out to the sides to shoulder height.
2. lean-in-dumbbell-lateral-raise.jpg | Lean In Dumbbell Lateral Raise. Pose: holding an upright post with one hand and leaning the body towards it, raising a dumbbell out to the side with the other arm.
3. side-lying-dumbbell-lateral-raise.jpg | Side Lying Dumbbell Lateral Raise. Pose: lying on the side on an incline bench, raising a dumbbell up from the hip with the top arm.
4. bent-over-reverse-dumbbell-fly.jpg | Bent Over Reverse Dumbbell Fly. Pose: torso bent forward near parallel, raising two dumbbells out to the sides with slightly bent arms.
5. seated-machine-lateral-raise.jpg | Seated Machine Lateral Raise. Pose: seated in a lateral raise machine, elbows against the pads, raising them out to the sides.
6. lean-away-dumbbell-lateral-raise.jpg | Lean Away Dumbbell Lateral Raise. Pose: holding an upright post with one hand and leaning the body away from it, raising a dumbbell out to the side with the other arm.
7. super-rom-dumbbell-lateral-raise.jpg | Super ROM Dumbbell Lateral Raise. Pose: standing, raising two dumbbells out to the sides all the way above the head, palms facing in.
8. seated-barbell-overhead-press.jpg | Seated Barbell Overhead Press. Pose: seated on an upright bench, pressing a barbell overhead from the front of the shoulders.
9. upright-row.jpg | Upright Row. Pose: standing, pulling a barbell straight up along the body to chest height, elbows high and out.
10. hack-squat.jpg | Hack Squat. Pose: in a hack squat machine, back against the angled pad, in a deep squat with shoulders under the pads.
11. pendulum-squat.jpg | Pendulum Squat. Pose: in a pendulum squat machine, shoulders under the pads, sinking into a very deep squat.
12. smith-machine-squat.jpg | Smith Machine Squat. Pose: barbell of a Smith machine across the upper back, feet slightly forward, in a deep squat.
13. low-bar-squat.jpg | Low Bar Squat. Pose: barbell resting low on the rear shoulders, torso leaning forward more, in a squat to parallel.
14. reverse-nordic.jpg | Reverse Nordic. Pose: kneeling upright with feet anchored, leaning the straight torso backwards by bending only at the knees.
15. goblet-squat.jpg | Goblet Squat. Pose: holding one dumbbell vertically against the chest, in a deep upright squat, elbows inside the knees.

Start with image 1.
```

## Dávka 5 z 9

```text
Generate 15 exercise illustrations for a fitness app, one image per reply.
After each image, write only its number and file name, then wait until I write "next".

Style for every image (keep it identical across all of them):
Photorealistic 3D render of a classical white-grey marble statue of a muscular male athlete (Greco-Roman sculpture with curly hair and a short beard, a draped marble loincloth, subtle veining in the stone). Every piece of equipment (bench, barbell, plates, dumbbells, machine, cables) is carved from the same pale marble. Three-quarter view from slightly above, the whole body and equipment in frame, soft diffused studio light with a gentle contact shadow, seamless plain light grey background (#DEDDDC). No text, no logos, no other people. Landscape 3:2 image; keep the statue and equipment within the middle 80 % of the width because the image will be cropped to 16:9.
If I attached bench-press.jpg, treat it as the exact style reference.

1. sissy-squat.jpg | Sissy Squat. Pose: standing on the toes, knees pushed far forward and torso leaning back in a straight line from knees to head.
2. machine-chest-press.jpg | Machine Chest Press. Pose: seated in a chest press machine, pressing the handles forward from chest height.
3. seated-cable-pec-fly.jpg | Seated Cable Pec Fly. Pose: seated on a bench between two cable pulleys at chest height, bringing the handles together in front of the chest.
4. deficit-push-up.jpg | Deficit Push Up. Pose: hands on two raised blocks, chest lowered below hand level in a deep push-up.
5. dumbbell-guillotine-press.jpg | Dumbbell Guillotine Press. Pose: lying on a flat bench, lowering two dumbbells towards the upper chest and neck with elbows flared wide.
6. smith-machine-bench-press.jpg | Smith Machine Bench Press. Pose: lying on a flat bench under a Smith machine, pressing the fixed barbell up from the chest.
7. incline-smith-machine-bench-press.jpg | Incline Smith Machine Bench Press. Pose: lying on an incline bench under a Smith machine, pressing the fixed barbell up from the upper chest.
8. cable-crossover.jpg | Cable Crossover. Pose: standing between two high cable pulleys, one foot forward, pulling the handles down and together in front of the hips.
9. pec-deck.jpg | Pec Deck. Pose: seated in a pec deck machine, bringing the arm pads together in front of the chest.
10. dumbbell-fly.jpg | Dumbbell Fly. Pose: lying on a flat bench, arms spread wide with a slight elbow bend, lowering two dumbbells out to the sides.
11. cable-press-around.jpg | Cable Press Around. Pose: standing with the back to one cable pulley, pressing the handle forward and across the body with one arm.
12. decline-bench-press.jpg | Decline Bench Press. Pose: lying on a decline bench, legs hooked at the top, pressing a barbell up from the lower chest.
13. decline-dumbbell-press.jpg | Decline Dumbbell Press. Pose: lying on a decline bench, legs hooked at the top, pressing two dumbbells up from the lower chest.
14. banded-push-up.jpg | Banded Push Up. Pose: in a push-up position with a resistance band stretched across the back and held under both hands.
15. neutral-grip-lat-pulldown.jpg | Neutral Grip Lat Pulldown. Pose: seated at a lat pulldown machine, pulling a parallel-grip handle down to the upper chest.

Start with image 1.
```

## Dávka 6 z 9

```text
Generate 15 exercise illustrations for a fitness app, one image per reply.
After each image, write only its number and file name, then wait until I write "next".

Style for every image (keep it identical across all of them):
Photorealistic 3D render of a classical white-grey marble statue of a muscular male athlete (Greco-Roman sculpture with curly hair and a short beard, a draped marble loincloth, subtle veining in the stone). Every piece of equipment (bench, barbell, plates, dumbbells, machine, cables) is carved from the same pale marble. Three-quarter view from slightly above, the whole body and equipment in frame, soft diffused studio light with a gentle contact shadow, seamless plain light grey background (#DEDDDC). No text, no logos, no other people. Landscape 3:2 image; keep the statue and equipment within the middle 80 % of the width because the image will be cropped to 16:9.
If I attached bench-press.jpg, treat it as the exact style reference.

1. one-arm-lat-pulldown.jpg | One Arm Lat Pulldown. Pose: seated at a cable pulldown, pulling a single handle down beside the body with one arm.
2. cross-body-one-arm-lat-pulldown.jpg | Cross Body One Arm Lat Pulldown. Pose: half-kneeling beside a high cable, pulling a single handle down and across the body with one arm.
3. meadows-row.jpg | Meadows Row. Pose: staggered stance beside a landmine barbell, rowing the end of the bar with one hand using an overhand grip.
4. chest-supported-row.jpg | Chest Supported Row. Pose: lying face down on an incline bench, rowing two dumbbells up towards the ribs.
5. wide-grip-cable-row.jpg | Wide Grip Cable Row. Pose: seated at a low cable row, pulling a wide bar to the lower chest with elbows flared out.
6. neutral-grip-pull-up.jpg | Neutral Grip Pull Up. Pose: hanging from parallel handles with palms facing each other, chin pulled above the handles.
7. deficit-pendlay-row.jpg | Deficit Pendlay Row. Pose: standing on a raised platform, torso parallel to the floor, rowing a barbell explosively from a dead stop to the lower chest.
8. pendlay-row.jpg | Pendlay Row. Pose: torso parallel to the floor, rowing a barbell explosively from the floor to the lower chest.
9. kroc-row.jpg | Kroc Row. Pose: one hand braced on a bench, rowing a very heavy dumbbell to the hip with the other arm, torso slightly raised.
10. cable-lat-prayer.jpg | Cable Lat Prayer. Pose: kneeling in front of a high cable, arms straight, pulling a rope down in an arc to the thighs while hinging forward.
11. dumbbell-pullover.jpg | Dumbbell Pullover. Pose: lying across a flat bench, holding one dumbbell with both hands behind the head, arms nearly straight.
12. overhead-cable-triceps-extension.jpg | Overhead Cable Triceps Extension. Pose: facing away from a cable, one foot forward, extending the elbows to push a bar from behind the head forward and up.
13. katana-cable-triceps-extension.jpg | Katana Cable Triceps Extension. Pose: standing side-on to a low cable, extending one arm diagonally up and across the body like drawing a sword.
14. one-arm-dumbbell-overhead-extension.jpg | One Arm Dumbbell Overhead Extension. Pose: seated, holding one dumbbell overhead and lowering it behind the head by bending the elbow.
15. dumbbell-skull-crusher.jpg | Dumbbell Skull Crusher. Pose: lying on a flat bench, lowering two dumbbells beside the head by bending only the elbows.

Start with image 1.
```

## Dávka 7 z 9

```text
Generate 15 exercise illustrations for a fitness app, one image per reply.
After each image, write only its number and file name, then wait until I write "next".

Style for every image (keep it identical across all of them):
Photorealistic 3D render of a classical white-grey marble statue of a muscular male athlete (Greco-Roman sculpture with curly hair and a short beard, a draped marble loincloth, subtle veining in the stone). Every piece of equipment (bench, barbell, plates, dumbbells, machine, cables) is carved from the same pale marble. Three-quarter view from slightly above, the whole body and equipment in frame, soft diffused studio light with a gentle contact shadow, seamless plain light grey background (#DEDDDC). No text, no logos, no other people. Landscape 3:2 image; keep the statue and equipment within the middle 80 % of the width because the image will be cropped to 16:9.
If I attached bench-press.jpg, treat it as the exact style reference.

1. smith-machine-jm-press.jpg | Smith Machine JM Press. Pose: lying on a flat bench under a Smith machine, lowering the bar towards the upper chest with elbows forward.
2. jm-press.jpg | JM Press. Pose: lying on a flat bench, lowering a barbell towards the chin with elbows pointing forward, half skull crusher half press.
3. cable-triceps-kickback.jpg | Cable Triceps Kickback. Pose: bent forward at the hips, upper arm pinned to the side, extending the arm back against a low cable.
4. close-grip-bench-press.jpg | Close Grip Bench Press. Pose: lying on a flat bench, pressing a barbell with hands shoulder-width apart, elbows tucked.
5. rope-triceps-pushdown.jpg | Rope Triceps Pushdown. Pose: standing at a cable tower, pushing a rope down and spreading the ends apart at the bottom.
6. dumbbell-french-press.jpg | Dumbbell French Press. Pose: seated, holding one dumbbell overhead with both hands and lowering it behind the head.
7. machine-dips.jpg | Machine Dips. Pose: seated in a dip machine, pressing the handles down beside the hips.
8. diamond-push-up.jpg | Diamond Push Up. Pose: in a push-up position with the hands together under the chest, thumbs and index fingers forming a diamond.
9. bayesian-cable-curl.jpg | Bayesian Cable Curl. Pose: facing away from a low cable, one arm stretched behind the body, curling the handle forward.
10. dumbbell-preacher-curl.jpg | Dumbbell Preacher Curl. Pose: seated at a preacher bench, one upper arm on the angled pad, curling a dumbbell up.
11. machine-preacher-curl.jpg | Machine Preacher Curl. Pose: seated in a preacher curl machine, upper arms on the pad, curling the handles up.
12. preacher-hammer-curl.jpg | Preacher Hammer Curl. Pose: seated at a preacher bench, curling a dumbbell with a neutral grip (thumb up).
13. ez-bar-curl.jpg | EZ Bar Curl. Pose: standing, curling an EZ curl bar with an angled grip up towards the shoulders.
14. incline-dumbbell-curl.jpg | Incline Dumbbell Curl. Pose: seated back on an incline bench, arms hanging straight down behind the torso, curling two dumbbells.
15. lying-dumbbell-curl.jpg | Lying Dumbbell Curl. Pose: lying face up on a high flat bench, arms hanging below the bench, curling two dumbbells.

Start with image 1.
```

## Dávka 8 z 9

```text
Generate 15 exercise illustrations for a fitness app, one image per reply.
After each image, write only its number and file name, then wait until I write "next".

Style for every image (keep it identical across all of them):
Photorealistic 3D render of a classical white-grey marble statue of a muscular male athlete (Greco-Roman sculpture with curly hair and a short beard, a draped marble loincloth, subtle veining in the stone). Every piece of equipment (bench, barbell, plates, dumbbells, machine, cables) is carved from the same pale marble. Three-quarter view from slightly above, the whole body and equipment in frame, soft diffused studio light with a gentle contact shadow, seamless plain light grey background (#DEDDDC). No text, no logos, no other people. Landscape 3:2 image; keep the statue and equipment within the middle 80 % of the width because the image will be cropped to 16:9.
If I attached bench-press.jpg, treat it as the exact style reference.

1. cable-curl.jpg | Cable Curl. Pose: standing at a low cable, curling a straight bar up towards the shoulders.
2. inverse-zottman-curl.jpg | Inverse Zottman Curl. Pose: standing, curling two dumbbells up with palms facing down, turning palms up at the top.
3. barbell-curl.jpg | Barbell Curl. Pose: standing, curling a straight barbell up towards the shoulders, elbows at the sides.
4. flat-bench-dumbbell-curl.jpg | Flat Bench Dumbbell Curl. Pose: lying face up on a flat bench, arms hanging out to the sides, curling two dumbbells.
5. walking-lunge.jpg | Walking Lunge. Pose: mid-stride in a walking lunge, back knee close to the floor, holding dumbbells at the sides.
6. machine-hip-abduction.jpg | Machine Hip Abduction. Pose: seated in a hip abduction machine, pushing the knees outwards against the pads.
7. 45-degree-back-extension.jpg | 45 Degree Back Extension. Pose: on a 45-degree back extension bench, hips on the pad, torso raised in line with the legs.
8. front-foot-elevated-smith-machine-lunge.jpg | Front Foot Elevated Smith Machine Lunge. Pose: under a Smith machine bar, front foot on a low step, in a deep split lunge.
9. smith-machine-lunge.jpg | Smith Machine Lunge. Pose: under a Smith machine bar, in a deep split lunge, back knee close to the floor.
10. machine-hip-thrust.jpg | Machine Hip Thrust. Pose: seated back in a hip thrust machine, pad across the hips, hips fully extended.
11. single-leg-dumbbell-hip-thrust.jpg | Single Leg Dumbbell Hip Thrust. Pose: upper back on a bench, one foot on the floor and the other leg raised, a dumbbell on the hip, hips extended.
12. cable-glute-kickback.jpg | Cable Glute Kickback. Pose: bent slightly forward holding a cable tower, kicking one leg straight back against an ankle cuff.
13. step-up.jpg | Step Up. Pose: stepping up onto a box with one foot, holding dumbbells at the sides.
14. glute-bridge.jpg | Glute Bridge. Pose: lying on the back on the floor, knees bent, barbell across the hips, hips raised.
15. cable-hip-abduction.jpg | Cable Hip Abduction. Pose: standing side-on to a low cable, an ankle cuff on the far leg, raising that leg out to the side.

Start with image 1.
```

## Dávka 9 z 9

```text
Generate 3 exercise illustrations for a fitness app, one image per reply.
After each image, write only its number and file name, then wait until I write "next".

Style for every image (keep it identical across all of them):
Photorealistic 3D render of a classical white-grey marble statue of a muscular male athlete (Greco-Roman sculpture with curly hair and a short beard, a draped marble loincloth, subtle veining in the stone). Every piece of equipment (bench, barbell, plates, dumbbells, machine, cables) is carved from the same pale marble. Three-quarter view from slightly above, the whole body and equipment in frame, soft diffused studio light with a gentle contact shadow, seamless plain light grey background (#DEDDDC). No text, no logos, no other people. Landscape 3:2 image; keep the statue and equipment within the middle 80 % of the width because the image will be cropped to 16:9.
If I attached bench-press.jpg, treat it as the exact style reference.

1. curtsy-lunge.jpg | Curtsy Lunge. Pose: stepping one leg diagonally behind the other into a curtsy lunge, holding dumbbells.
2. sumo-deadlift.jpg | Sumo Deadlift. Pose: very wide stance, toes out, hands inside the knees, lifting a barbell from the floor with an upright torso.
3. cable-pull-through.jpg | Cable Pull Through. Pose: facing away from a low cable, rope between the legs, hips pushed back in a hinge, about to stand up.

Start with image 1.
```
