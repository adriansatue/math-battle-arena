# Topic Unlocks and Gameplay Progression

Status: Proposal for later review  
Created: 15 August 2026

## Purpose

Explore a progression system where players unlock new mathematical topics and mental-game formats as they level up.

The system should:

- Give levels a purpose beyond rank titles.
- Introduce concepts in a sensible learning order.
- Reward mastery without blocking useful basic practice.
- Keep competitive battles fair between players at different levels.
- Make upcoming content visible so players have a clear next goal.

This document is not an implementation commitment.

## Recommended Progression

| Level | Proposed unlock |
| ---: | --- |
| 1 | Addition and subtraction |
| 3 | Introductory mental games |
| 5 | Multiplication |
| 8 | Division |
| 12 | Advanced times tables and negative numbers |
| 16 | Order of operations |
| 21 | Fractions |
| 31 | Decimals |
| 41 | Percentages |
| 51 | Ratios and proportions |
| 61 | Sequences and patterns |
| 71 | Powers and roots |
| 81 | Basic algebra |
| 91 | Mixed advanced challenges |
| 100 | Grandmaster Challenge |

The early unlocks are intentionally closer together. Later topics use wider level intervals because they are more complex and should feel more significant.

## Mental Game Formats

Mental games should be interaction formats rather than mathematical topics. Possible formats include:

- Number chain: repeatedly apply an operation to the previous result.
- Missing number: complete an equation or sequence.
- True or false: judge an expression quickly.
- Memory sequence: remember and reproduce a number pattern.
- Estimate the answer: choose the closest result without exact calculation.
- Beat your time: repeat a comparable challenge against a personal best.

These formats could unlock separately and reuse the topics already available to the player.

## Unlock Rules

### Level-only unlocks

Simple early topics may unlock based only on level. This keeps onboarding easy to understand.

### Level and mastery unlocks

Advanced topics may require both a minimum level and sufficient performance in prerequisite topics.

Example:

```text
Percentages unlock when:
- Player level is at least 41; and
- Accuracy in fractions or decimals is at least 65% over a meaningful sample.
```

Conceptually:

```text
unlocked = level requirement met AND prerequisite mastery met
```

A minimum attempt count should accompany accuracy requirements so that one correct answer cannot satisfy mastery.

Suggested initial mastery rule:

- At least 20 attempts across the prerequisite topic.
- At least 65% accuracy.
- Consider recent performance rather than lifetime performance if old results make progression too slow.

## Practice Experience

All topics should be visible from the beginning.

Unlocked topics:

- Can be selected normally.
- Show available difficulty levels and practice options.

Locked topics:

- Show the topic name and a sample question.
- Show the required level.
- Show prerequisite mastery progress when applicable.
- Link directly to the prerequisite practice topic.
- Must not appear as disabled content with no explanation.

Basic unlocked topics should never become unavailable.

## Battle Fairness

### Player versus player

Ranked and standard PvP battles should only use topics available to both players.

```text
Battle topics = Player A unlocked topics intersect Player B unlocked topics
```

This prevents a high-level player from gaining an unfair advantage through access to content the opponent has never unlocked.

Questions, timing, and scoring should remain symmetrical for both players.

### Bot battles

Bot battles may use every topic unlocked by the human player. Bot ability should still match the selected difficulty.

### Friend battles

Possible room settings:

- Fair mode: use the shared topic set.
- Host selection: host chooses from topics available to both players.
- Open challenge: allow advanced topics only when both players explicitly accept.

Fair mode should be the default.

## Matchmaking Considerations

Topic unlocks must not fragment matchmaking into many small queues.

Recommended approach:

- Continue matching primarily by rating and level.
- Compute the shared topic set after a match is found.
- Require a guaranteed core set such as addition and subtraction.
- Do not create a separate queue for every unlocked topic.

## Profile and Progress Feedback

The profile could show:

- Number of topics unlocked.
- Next topic and required level.
- Prerequisite mastery progress.
- Recently unlocked topic.
- Strongest and weakest topics.

Example:

```text
6 of 14 topics unlocked
Next: Percentages at Level 41
Fractions mastery: 58% / 65%
```

A level-up result should announce meaningful unlocks immediately.

## Levels and Rank Titles

Rank titles should be reviewed alongside topic unlocks so titles do not contradict available content.

Current examples that may need revision:

- `Fraction Specialist` should not appear long after fractions become available without an explanation of mastery.
- `Algebra Expert` should align with the actual algebra unlock range.
- Level 100 should provide a distinct challenge or achievement rather than only another title.

Titles may represent mastery bands rather than the exact first level at which a topic appears.

## Grandmaster Challenge

A Level 100 unlock should feel mechanically distinct.

Possible design:

- Mixed questions from all unlocked topics.
- Adaptive difficulty.
- Limited mistakes or a survival format.
- Personal-best leaderboard.
- Cosmetic badge or profile frame.
- No exclusive power advantage in normal PvP.

## Data Model Direction

Prefer a central topic catalogue in application code rather than duplicating unlock rules across pages and APIs.

A topic definition may include:

```ts
type TopicDefinition = {
  id: string
  label: string
  unlockLevel: number
  prerequisite?: {
    topicIds: string[]
    minimumAttempts: number
    minimumAccuracy: number
  }
  availableInPractice: boolean
  availableInBattles: boolean
}
```

Practice, question generation, profiles, battle matchmaking, and the Levels & XP page should consume the same catalogue.

The server must enforce unlock rules. Client-side disabled buttons alone are not sufficient.

## Existing Areas Likely Affected

- `lib/game/questions.ts`
- `lib/game/progression.ts`
- `app/practice/page.tsx`
- `app/api/practice/route.ts`
- `app/api/battles/route.ts`
- `app/api/matchmaking/queue/route.ts`
- `app/api/matchmaking/bot/route.ts`
- `app/profile/[id]/page.tsx`
- `app/levels-and-xp/page.tsx`
- Question and progression tests

New categories would also require database compatibility checks wherever category values are stored or aggregated.

## Risks

- Players may feel punished if familiar practice topics are locked.
- Mastery thresholds may trap players who need the new topic for school.
- PvP question pools may become repetitive for mismatched levels.
- Too many unlock notifications may make progression noisy.
- New topic generators can introduce ambiguous answers or rounding problems.
- Existing weakness analytics may not recognise new category identifiers.
- Level requirements may take too long under the current XP curve.

## Questions for Review

1. Should Practice allow a temporary preview of locked topics?
2. Are unlocks based on account level, school age, chosen curriculum, or a combination?
3. Should mastery be calculated from lifetime results or recent attempts?
4. What minimum attempt count is enough to make accuracy meaningful?
5. Should friend battles permit topics locked for one player?
6. Should difficulty levels have separate unlock requirements?
7. Are decimals a separate category or part of fractions?
8. Should mental games award the same XP and coins as normal practice?
9. How should unlocks work for existing high-level accounts?
10. Does the current XP curve make Levels 41-100 reachable at the intended pace?

## Suggested Validation Before Implementation

- Calculate expected time and number of sessions needed to reach each unlock level.
- Test the proposed order with the intended player age range.
- Prototype locked topic cards in Practice.
- Simulate PvP shared-topic pools across large level differences.
- Define answer and rounding rules for decimals, percentages, roots, and algebra.
- Confirm database constraints and analytics support every new category.
- Decide how existing accounts receive retroactive unlocks.

## Possible Delivery Phases

### Phase 1: Foundation

- Central topic catalogue.
- Level-only unlock rules.
- Locked topic display in Practice.
- Server-side Practice validation.

### Phase 2: Fair battles

- Shared-topic calculation for PvP.
- Bot topic selection.
- Match and question-generation tests.

### Phase 3: New content

- Percentages, decimals, sequences, ratios, powers, roots, and algebra generators.
- Clear numeric answer and rounding rules.
- Topic-specific tests.

### Phase 4: Mastery progression

- Prerequisite accuracy and attempt tracking.
- Profile unlock progress.
- Level-up announcements.
- Grandmaster Challenge.

## Decision Status

No final progression, mastery threshold, or implementation schedule has been approved. Review the questions and validation steps above before development begins.
