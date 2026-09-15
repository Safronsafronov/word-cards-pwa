// Ported 1:1 from WordCardsMVP/Models.swift

export const CardTextRules = { maxRecommendedLength: 95 };

export const CardFrontSide = { english: 'english', translation: 'translation' };
export const CardFrontSideTitle = { english: 'Word', translation: 'Translation' };

export const ReviewResult = { remember: 'remember', dontRemember: 'dontRemember', hard: 'hard', easy: 'easy' };
export const ReviewResultTitle = { remember: 'Good', dontRemember: "Don't Remember", hard: 'Hard', easy: 'Easy' };

export const WordLearningBucket = { newWords: 'newWords', toStudy: 'toStudy', studied: 'studied' };

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function makeCollection(title, createdAt = new Date()) {
  return { id: uuid(), title, createdAt: createdAt.toISOString() };
}

export function makeVocabItem({
  id = uuid(),
  collectionID = null,
  english,
  translation,
  frontSide,
  nextReview = new Date(),
  learningState = 'new',
  intervalDays = 0,
  easeFactor = 2.5,
  lapses = 0,
  learningStepIndex = 0,
  cycleStatus = null,
  cycleStreak = 0,
  createdAt = new Date(),
}) {
  return {
    id, collectionID, english, translation, frontSide,
    nextReview: nextReview instanceof Date ? nextReview.toISOString() : nextReview,
    learningState, intervalDays, easeFactor, lapses, learningStepIndex,
    cycleStatus, cycleStreak,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
  };
}

export function makeReviewEvent(itemID, result, date = new Date()) {
  return { id: uuid(), itemID, result, date: date.toISOString() };
}

export function frontText(item) {
  return item.frontSide === CardFrontSide.english ? item.english : item.translation;
}

export function backText(item) {
  return item.frontSide === CardFrontSide.english ? item.translation : item.english;
}
