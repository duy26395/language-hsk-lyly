import { ReviewGrade, WordReview } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const createInitialReview = (): WordReview => ({
  dueAt: Date.now(),
  intervalDays: 0,
  ease: 2.5,
  lapses: 0,
  streak: 0,
});

export const scheduleReview = (
  currentReview: WordReview | undefined,
  grade: ReviewGrade,
): WordReview => {
  const now = Date.now();
  const review = { ...createInitialReview(), ...currentReview };
  const ease = review.ease || 2.5;
  let nextEase = ease;
  let intervalDays = review.intervalDays || 0;
  let streak = review.streak || 0;
  let lapses = review.lapses || 0;
  let dueAt = now;

  if (grade === 'again') {
    nextEase = Math.max(1.3, ease - 0.2);
    intervalDays = 0;
    streak = 0;
    lapses += 1;
    dueAt = now + 10 * 60 * 1000; // 10 minutes
  }

  if (grade === 'hard') {
    nextEase = Math.max(1.3, ease - 0.05);
    intervalDays = Math.max(1, Math.ceil(Math.max(1, intervalDays) * 1.2));
    streak += 1;
    dueAt = now + intervalDays * DAY_MS;
  }

  if (grade === 'good') {
    intervalDays = intervalDays <= 0 ? 1 : Math.ceil(intervalDays * nextEase);
    streak += 1;
    dueAt = now + intervalDays * DAY_MS;
  }

  if (grade === 'easy') {
    nextEase = Math.min(3.2, ease + 0.15);
    intervalDays = intervalDays <= 0 ? 3 : Math.ceil(intervalDays * (nextEase + 0.7));
    streak += 1;
    dueAt = now + intervalDays * DAY_MS;
  }

  return {
    dueAt,
    intervalDays,
    ease: nextEase,
    lapses,
    streak,
    lastReviewedAt: now,
  };
};
