# Player Retention Implementation Roadmap

Status: Phases 0-2 and 4-6 implemented; Phases 3 and 7 proposed
Created: 16 August 2026  
Related: [Topic Unlocks and Gameplay Progression](./topic-unlocks-gameplay-proposal.md)

## Product Conclusion

The main reason to return should not be accumulating XP by itself.

Math Battle Arena should help a player:

1. Discover something specific to improve.
2. Practise it in a short, focused session.
3. Prove the improvement in a battle.
4. Receive visible progression and rewards.
5. Get a clear next objective.

The desired product promise is:

> Battle, learn, improve, and prove it.

Competition, collecting, and progression should reinforce this loop rather than operate as disconnected systems.

## Core Player Loop

```text
Clear objective
    -> Short battle or practice session
    -> Result and useful feedback
    -> XP, coins, rating, or collection progress
    -> Visible personal improvement
    -> One recommended next action
```

Every major screen should answer one question:

- Lobby: What should I play now?
- Battle: How am I doing?
- Results: What happened and what should I do next?
- Profile: Where am I improving or struggling?
- Practice: What focused exercise will help me?
- Rewards: What am I collecting and how close am I to the next goal?
- Leaderboard: Who am I realistically competing with?

## Principles

### Make the next action obvious

Each screen should have one primary action. Avoid presenting Cards, Rankings, Practice, Rematch, Lobby, and Profile as equally important after every game.

### Reward improvement, not only winning

A player should make meaningful progress after a useful session even when they lose a battle.

### Keep sessions short

A returning player should be able to complete a useful objective in 5-10 minutes.

### Avoid punitive retention

Do not erase long streaks or accumulated progress because a player misses a day. Daily systems should invite return, not create anxiety.

### Preserve competitive fairness

Progression, cards, and unlocks must not create pay-to-win or level-based mathematical advantages in ranked PvP.

### Measure before adding complexity

Add basic product events before daily missions, leagues, or a large content expansion. Otherwise there will be no reliable way to know which feature improves return behaviour.

## Current Baseline

Already present:

- Quick, friend, bot, and practice flows.
- XP, levels, rank titles, coins, and PvP rating.
- Answer review on the Results page.
- Basic Play Again action.
- Card packs and collection.
- Leaderboards.
- Topic-level accuracy and speed insights in Profile.
- One-time username customisation and guest account upgrade.

Important gaps:

- Results does not clearly show earned XP, coins, rating change, or level progress.
- Answer review does not identify the most important topic to practise.
- Practice cannot be opened preconfigured from a recommendation.
- Play Again creates a new room rather than a true opponent rematch flow.
- No product-event or retention measurement layer is visible in the codebase.
- No daily objectives or daily challenge.
- Cards are weakly connected to the core learning loop.
- Global rankings may not provide an achievable target for new players.
- Topic unlocks are still a separate proposal and should not precede validation of the core loop.

## Delivery Overview

| Phase | Goal | Exit signal |
| --- | --- | --- |
| 0 | Establish measurement and baseline | Core funnel events and retention queries work |
| 1 | Close the post-game loop | Results gives reward, diagnosis, and one useful next action |
| 2 | Connect diagnosis to focused practice | Players can start and complete recommended practice |
| 3 | Strengthen immediate replay and rivalry | Rematch and rival flows increase repeat battles |
| 4 | Add lightweight return objectives | Daily objectives create useful 5-10 minute sessions |
| 5 | Improve weekly competition | Comparable leagues and personal summaries support weekly return |
| 6 | Connect collection to progression | Cards provide visible, cosmetic, non-pay-to-win goals |
| 7 | Introduce topic and mode unlocks | Progression adds content without harming fairness |

Phases should be released and measured independently. Do not implement all phases as one project.

# Phase 0: Measurement Foundation

Implementation status: Complete in code on 16 August 2026. The database migration must be applied before events can be collected.

## Goal

Know where players stop and whether later changes improve return behaviour.

## Scope

Create a small first-party event model. Avoid adding third-party behavioural analytics until the privacy and cookie implications are reviewed.

Suggested events:

- `account_started`
- `guest_upgraded`
- `lobby_viewed`
- `matchmaking_started`
- `match_found`
- `bot_fallback_started`
- `battle_started`
- `battle_finished`
- `results_viewed`
- `answer_review_opened`
- `play_again_clicked`
- `recommended_practice_clicked`
- `practice_started`
- `practice_finished`
- `rematch_requested`
- `rematch_started`
- `pack_opened`
- `profile_insight_viewed`

Minimum event fields:

```ts
type ProductEvent = {
  userId: string
  eventName: string
  occurredAt: string
  sessionId?: string
  battleId?: string
  practiceSessionId?: string
  properties?: Record<string, string | number | boolean | null>
}
```

Do not place email, answer text, usernames, or other unnecessary personal information in event properties.

## Technical work

- Add a migration for a `product_events` table or an equivalent privacy-reviewed event store.
- Apply RLS so clients cannot read other users' events or forge privileged events.
- Prefer server-side event creation for battle and reward outcomes.
- Add a small typed event helper instead of direct inserts across components.
- Define session identification without fingerprinting users.
- Add diagnostic SQL for funnel and retention analysis.
- Update the Data Protection and Cookies pages if the final implementation changes actual processing.

Likely areas:

- `supabase/migrations/`
- `lib/analytics/` or `lib/events/`
- Battle, Practice, Results, Lobby, Profile, and Rewards APIs
- `diagnostic-queries.sql`

## Baseline metrics

Capture at least two weeks if practical:

- Percentage of new users who start a first battle.
- Percentage of started battles that finish.
- Battles per session.
- Answer review open rate.
- Play Again rate.
- Profile insight view rate.
- Practice-after-insight rate.
- Next-day return rate.
- Seven-day return rate.
- Matchmaking abandonment rate.
- Guest-to-registered conversion rate.

## Acceptance criteria

- Events are idempotent where duplicate delivery is possible.
- Events contain no unnecessary personal data.
- A query can reconstruct the core funnel without joining on email.
- Test/demo accounts can be excluded from product reporting.
- Existing gameplay still works if event recording fails.

# Phase 1: Results That Create the Next Session

Implementation status: Complete in code on 16 August 2026. Apply the reward-receipt migration before deploying this version.

## Goal

Make the Results screen explain what happened, show meaningful progress, and recommend one next action.

## Player experience

The Results page should show, in this order:

1. Outcome: win, draw, or loss.
2. Score and opponent.
3. Reward summary: XP, coins, and rating change.
4. Level progress before and after the match.
5. One performance insight from the completed game.
6. One primary next action.
7. Expandable answer review and secondary destinations.

Primary action logic:

```text
If a clear weak topic was detected -> Focused Practice
Else if opponent is available -> Rematch
Else -> Find Another Match
```

Secondary actions can include answer review, Cards, Profile, and Rankings.

## Technical work

- Return or expose the settled reward breakdown for the current player.
- Capture level and rating before and after settlement, or derive them reliably.
- Add category to review items if it is not already available from the review API.
- Summarise incorrect answers by category.
- Reuse `lib/game/performance.ts` for honest topic-level language.
- Add a focused-practice URL such as `/practice?topic=division&source=results`.
- Keep reward settlement server-authoritative.

Likely areas:

- `app/results/[id]/page.tsx`
- `app/api/battles/[id]/review/route.ts`
- `app/api/battles/[id]/finish/route.ts`
- `lib/game/performance.ts`
- `lib/game/progression.ts`

## Acceptance criteria

- Rewards displayed match database settlement exactly.
- Refreshing Results does not grant rewards twice.
- The recommendation never claims a misconception that was not measured.
- Players with no incorrect answers receive a positive next challenge.
- The primary action is usable with keyboard and on mobile.
- Results remains understandable when an opponent disconnects or settlement is delayed.

## Metrics

- Results-to-next-action conversion.
- Answer review open rate.
- Recommended-practice click rate.
- Rematch request rate.
- Second game or practice session within 10 minutes.

# Phase 2: Focused Practice and Improvement Proof

Implementation status: Complete in code on 16 August 2026. Apply the focused-practice migration before deploying this version.

## Goal

Turn a detected weakness into a short exercise and show whether the player improved.

## Player experience

A recommendation should open Practice already configured:

```text
Topic: Division
Difficulty: Easy
Questions: 10
Goal: 10 correct answers or improve previous accuracy
```

The player may change the setup, but starting the recommended session should require one clear action.

At the end of practice, show:

- Accuracy before and after.
- Average response time before and after.
- Personal best, when meaningful.
- A clear result: improved, stable, or needs another session.
- A choice between another focused set and returning to battle.

## Technical work

- Parse and validate Practice query parameters.
- Add a `source` field for recommendation attribution.
- Define a comparison window, for example recent 20 attempts versus the focused session.
- Ensure `student_weaknesses` is updated by real answer data.
- Add a server-generated practice summary.
- Store enough attempt history to compare performance without exposing other users.
- Add a direct recommendation link from Profile.

Likely areas:

- `app/practice/page.tsx`
- `app/practice/[id]/page.tsx`
- `app/api/practice/route.ts`
- `app/profile/[id]/page.tsx`
- Practice answer/finish APIs and migrations

## Acceptance criteria

- Unsupported topic or difficulty parameters are rejected or safely normalised.
- A recommendation can be launched in one or two clicks.
- Improvement comparisons use a documented sample and do not mislead on very small samples.
- Practice rewards cannot be farmed through repeated finish requests.
- A player can return to an appropriate battle flow after practice.

## Metrics

- Recommendation-to-practice-start conversion.
- Focused practice completion rate.
- Repeat practice rate.
- Accuracy change in the recommended topic.
- Percentage who battle again after focused practice.
- Percentage who improve that topic in a later battle.

## Product success metric

The strongest product-specific metric should be:

> Percentage of players who receive a weakness recommendation, complete focused practice, and later improve that topic in battle.

# Phase 3: Rematch and Rivalry

## Goal

Create a strong reason to play one more battle in the same session.

## Scope

Implement a true rematch handshake rather than creating an unrelated new battle.

Suggested states:

```text
none -> requested -> accepted -> battle_created
                  -> declined
                  -> expired
```

Player experience:

- Results shows `Request Rematch` when both human players are eligible.
- The opponent receives a realtime request on Results or in a lightweight notification.
- Accepted rematches reuse fair settings and create a new battle atomically.
- Show a simple rivalry record such as `Cris 4 - 3 Adrian` only when the calculation is reliable.

## Technical work

- Add rematch state to a separate table or a battle relationship model.
- Add server endpoints to request, accept, decline, and expire rematches.
- Use Supabase Realtime for prompt delivery, with polling fallback if needed.
- Prevent duplicate battles from simultaneous acceptance.
- Define whether card stakes carry over. Recommended default: they do not.
- Add blocking and abuse controls before persistent friend/rival features.

## Acceptance criteria

- A rematch requires consent from both players.
- Only participants in the original finished battle may initiate or accept it.
- One accepted request creates one new battle.
- Requests expire automatically.
- Bot battles use `Play Again`, not rematch consent.
- Declining does not expose unnecessary presence information.

## Metrics

- Rematch request rate.
- Rematch acceptance rate.
- Rematch battle completion rate.
- Average battles per rivalry session.
- Abuse reports or excessive request rate.

# Phase 4: Lightweight Daily Objectives

## Goal

Give the player a useful, achievable reason to return tomorrow.

## Initial design

Start with three objectives at most:

- Accuracy: answer 15 questions correctly.
- Competition: complete or win one battle.
- Improvement: practise a recommended weak topic.

Include one fixed daily challenge so players can compare the same task under the same rules.

Avoid at launch:

- Losing a long streak because of one missed day.
- Objectives requiring purchases or excessive grinding.
- Random objectives that depend on unavailable opponents.
- Large rewards that destabilise the coin economy.

## Technical work

- Add objective definitions with server-side progress rules.
- Store daily assignments and claimed rewards.
- Use a single documented reset timezone, preferably UTC initially.
- Update objective progress from authoritative game events.
- Make reward claiming atomic and idempotent.
- Add a compact objective summary to Lobby.
- Add a complete objective view only if three items cannot be handled cleanly in Lobby.

Possible schema:

```text
daily_objective_definitions
daily_objective_assignments
daily_objective_progress
```

## Acceptance criteria

- Every objective is achievable in 5-10 minutes without spending money.
- Objective progress cannot be forged by the client.
- Reward claims are idempotent.
- Timezone/reset behaviour is visible and tested.
- Missing a day does not remove previously earned permanent progress.
- Anonymous accounts can participate, and progress survives Google linking.

## Metrics

- Daily objective view and completion rates.
- Time to complete the first objective.
- Next-day return among participants versus baseline.
- Reward inflation and pack-opening changes.
- Percentage of users who abandon an objective after starting.

# Phase 5: Weekly Competition and Personal Summary

Implementation status: Complete in code on 16 August 2026. Apply the weekly competition and event migrations before release.

## Goal

Provide a medium-term reason to return that remains achievable for ordinary players.

## Player experience

- Weekly groups based on rating or level band rather than one global list.
- Participation rewards that do not require finishing first.
- Personal weekly summary:
  - Battles completed.
  - Rating movement.
  - Accuracy improvement.
  - Strongest and weakest topic.
  - Personal best.

Recommended ranking categories:

- PvP rating.
- XP earned during the week.
- Most improved accuracy, with minimum attempts.

Do not combine these into one opaque score.

## Technical work

- Define weekly boundaries and immutable snapshots.
- Prevent lifetime XP from being presented as weekly XP.
- Create comparable cohorts with minimum viable size.
- Exclude bots and flagged activity.
- Add tie-breaking rules.
- Generate summaries server-side.

## Acceptance criteria

- New users have an achievable comparison group.
- Weekly values are based only on the stated time window.
- Flagged or bot activity cannot win rewards.
- Rewards are bounded and cannot be claimed twice.
- Empty or undersized cohorts degrade gracefully.

## Metrics

- Weekly leaderboard participation.
- Seven-day return rate.
- Percentage viewing the personal summary.
- Return after receiving a weekly summary.
- Distribution of rewards across skill levels.

# Phase 6: Collection With Purpose

Implementation status: Complete in code on 16 August 2026. Apply the collection progression migration before release.

## Goal

Make cards a visible long-term goal without making mathematics or PvP pay-to-win.

## Recommended direction

Cards should provide:

- Collection completion.
- Profile frames, badges, titles, or battle intro cosmetics.
- Set completion rewards.
- Duplicate progression through crafting, upgrading, or deterministic exchange.
- Clear progress toward the next affordable pack.

Cards should not provide:

- Better answers.
- Extra battle time.
- Higher scoring multipliers in ranked play.
- Topic access unavailable through normal progression.

## Technical work

- Define card sets and completion state.
- Add equipped cosmetic selections to the profile.
- Add safe duplicate conversion with atomic transactions.
- Show coin progress toward a selected pack goal.
- Review pack odds, duplicate refunds, and coin supply using real economy data.
- Publish accurate pack odds in the UI where applicable.

## Acceptance criteria

- Cosmetics do not alter ranked outcomes.
- Duplicate conversion cannot duplicate inventory or coins.
- Pack odds displayed match server behaviour.
- Collection goals remain possible without purchasing anything.
- Card staking is reviewed separately for suitability, fairness, and intended audience.

## Metrics

- Pack affordability time.
- Pack-open rate after battles.
- Collection completion by set.
- Duplicate frustration and conversion usage.
- Return rate among players with an active collection goal.

# Phase 7: Topic and Mode Unlocks

## Goal

Make long-term progression unlock meaningful content after the core return loop has proven useful.

Use the separate [Topic Unlocks and Gameplay Progression](./topic-unlocks-gameplay-proposal.md) proposal as the detailed design source.

Do not start this phase until:

- The XP curve has been measured against real playtime.
- Focused practice is working.
- PvP shared-topic fairness is designed and tested.
- Existing players have a migration policy.

## Delivery sequence

1. Central topic catalogue.
2. Visible locked-topic cards in Practice.
3. Server-side level rules.
4. Shared-topic pool for PvP.
5. New generators with explicit numeric answer rules.
6. Mastery prerequisites.
7. Level-up unlock announcements.
8. Grandmaster Challenge.

## Acceptance criteria

- Practice and API rules use the same catalogue.
- PvP only uses topics available to both players.
- Every generator has deterministic tests and valid answer tolerances.
- Existing users receive correct retroactive unlocks.
- Locked content does not prevent access to foundational practice.
- Level 100 includes a meaningful non-pay-to-win experience.

# Cross-Phase Technical Requirements

## Server authority

The server must control:

- Reward calculation and settlement.
- Mission progress and reward claims.
- Rematch creation.
- Topic eligibility.
- Pack costs, odds, and inventory changes.
- Rating updates.

## Idempotency

Every endpoint that grants value must tolerate retries without granting value twice.

Examples:

- Battle finish.
- Practice finish.
- Objective claim.
- Weekly reward claim.
- Pack opening.
- Rematch acceptance.

## Privacy

- Collect only events needed to evaluate the product.
- Avoid free-text analytics properties.
- Keep private learning insights visible only to the account owner.
- Review retention periods for event and attempt-level data.
- Update legal notices when actual processing changes.
- Do not add third-party analytics silently.

## Accessibility and younger players

- Do not rely only on colour for success or failure.
- Avoid shame-based language such as `bad at fractions`.
- Describe evidence and next steps, not fixed ability.
- Keep objectives understandable without dark patterns.
- Ensure timers, motion, and sounds have appropriate controls where needed.

## Testing

Each phase should include:

- Unit tests for pure progression and recommendation rules.
- API tests for auth, ownership, idempotency, and invalid input.
- Database contract tests for RLS and unique constraints.
- UI tests for the primary player journey.
- Mobile layout checks.
- Economy regression tests whenever rewards change.

# Release Method

Use small releases and feature flags for systems that affect rewards or matchmaking.

Recommended sequence per phase:

1. Define the metric and baseline.
2. Write the server contract and tests.
3. Build the smallest complete player flow.
4. Release to internal/test users.
5. Check correctness and abuse cases.
6. Release to a limited percentage if infrastructure allows.
7. Compare against baseline.
8. Keep, revise, or remove the change.

Do not judge a phase only by clicks. Confirm that it improves completed useful sessions and return behaviour without harming learning or fairness.

# Prioritised Backlog

## Now

- Add measurement foundation.
- Redesign Results around reward, progress, diagnosis, and one next action.
- Add category information to battle review if missing.
- Support preconfigured focused-practice URLs.

## Next

- Add before/after practice comparison.
- Add true rematch consent flow.
- Add direct Practice actions from Profile insights.
- Validate the XP and coin economy with real usage.

## Later

- Daily objectives.
- Daily challenge.
- Weekly comparable leagues and personal summaries.
- Cosmetic collection goals and duplicate utility.
- Topic and mental-game unlock progression.
- Grandmaster Challenge.

# Decisions Required Before Phase 0

1. Is Supabase the intended event store, or will another first-party analytics system be used?
2. What constitutes a session?
3. Which accounts should be excluded from reporting?
4. What retention period is appropriate for product events?
5. Who reviews privacy implications before event collection changes?

# Decisions Required Before Daily Objectives

1. What is the daily reset timezone?
2. Can anonymous users claim rewards?
3. What coin and XP budget can objectives add without distorting packs and levels?
4. Is the daily challenge identical for all levels or normalised by difficulty?
5. Should objectives reroll when matchmaking is unavailable?

# Go/No-Go Gates

## Before Phase 1 release

- Battle settlement is reliable and idempotent.
- Displayed reward data has one authoritative source.

## Before Phase 3 release

- Rematch abuse and duplicate-creation cases are covered.
- Realtime failure has a fallback.

## Before Phase 4 release

- Economy simulation approves reward volume.
- Objective progress is server-authoritative.

## Before Phase 7 release

- XP pacing is understood from real data.
- Shared-topic PvP fairness is proven in tests.
- New topic answer rules are specified.

# Definition of Success

The roadmap is successful if players increasingly complete this sequence:

```text
See a useful objective
-> play
-> understand the result
-> practise a specific weakness
-> improve
-> return to prove the improvement
```

Primary outcome measures:

- More completed useful sessions per player.
- Higher next-day and seven-day return.
- More practice started from a real diagnosis.
- Measurable topic improvement after focused practice.
- More rematches without increased abuse.
- Stable economy and fair PvP.

Guardrail measures:

- No increase in reward duplication or cheating.
- No worsening of matchmaking completion.
- No disproportionate disadvantage for new or low-level players.
- No manipulative pressure to maintain attendance.
- No decline in learning accuracy caused by excessive speed incentives.

## Final Recommendation

Implement Phases 0-2 before daily missions, weekly leagues, or a large topic expansion.

Those first phases test the central product hypothesis at the lowest reasonable complexity:

> Players will return when the game identifies a meaningful weakness, helps them improve it, and lets them prove that improvement in battle.

If this loop does not improve useful repeat play, adding more currencies, missions, or locked content will increase complexity without solving the core retention problem.
