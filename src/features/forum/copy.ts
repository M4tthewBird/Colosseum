/** Copies a Forum workout into my Saved workouts. Works offline like any other write. */
import { blankSavedWorkout } from '@/features/programs/ops';
import { copyExercises, type ForumExercise, type ForumWorkout } from '@/lib/forum';
import { uuid } from '@/lib/uuid';
import { useData } from '@/stores/data';

/**
 * Exercises keep their id when I have them (built-ins), otherwise a built-in with the same name
 * is used, otherwise the author's own exercise is created as mine.
 */
export function copyForumWorkout(w: ForumWorkout, title: string): string {
  const { userId, exercises, saveExercise, saveProgram } = useData.getState();
  const byName = new Map(
    Object.values(exercises).map((e) => [e.name.toLowerCase(), e.id] as const),
  );
  const idOf = (e: ForumExercise) => {
    if (exercises[e.exercise_id]) return e.exercise_id;
    const known = byName.get(e.name.toLowerCase());
    if (known) return known;
    const id = uuid();
    saveExercise({ id, name: e.name, muscles: e.muscles, image_key: null, created_by: userId });
    byName.set(e.name.toLowerCase(), id);
    return id;
  };
  const program = blankSavedWorkout(userId);
  const name = title.trim() || w.name;
  saveProgram({
    ...program,
    name,
    days: [{ ...program.days[0], name, exercises: copyExercises(w, idOf, uuid) }],
  });
  return program.id;
}
