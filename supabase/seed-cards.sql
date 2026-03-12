-- Math Battle Arena — Card Catalogue Seed
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- Images: DiceBear Pixel Art (free, open licence)
-- https://www.dicebear.com/how-to-use/http-api/

INSERT INTO reward_catalog (name, description, rarity, image_url, drop_weight, is_active)
VALUES

  -- ── COMMON (drop_weight 12) ─────────────────────────────────────────────
  (
    'Count Bot',
    'A friendly robot who loves counting to infinity and beyond.',
    'common',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=CountBot&backgroundColor=b6e3f4',
    12, true
  ),
  (
    'Addition Ace',
    'Master of adding numbers at lightning speed.',
    'common',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=AdditionAce&backgroundColor=b6e3f4',
    12, true
  ),
  (
    'Minus Mouse',
    'Quick as a flash — subtracts before you even blink.',
    'common',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=MinusMouse&backgroundColor=b6e3f4',
    12, true
  ),
  (
    'Zero Hero',
    'The number that makes everything special — never underestimate zero!',
    'common',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=ZeroHero&backgroundColor=b6e3f4',
    12, true
  ),
  (
    'Even Steven',
    'Only deals in even numbers, and proud of every last one of them.',
    'common',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=EvenSteven&backgroundColor=b6e3f4',
    12, true
  ),
  (
    'Odd Bob',
    'Perfectly odd in every single way. 1, 3, 5, 7 — that''s the life.',
    'common',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=OddBob&backgroundColor=b6e3f4',
    12, true
  ),
  (
    'Carry Carl',
    'Always ready to carry the one. Never drops the ball.',
    'common',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=CarryCarl&backgroundColor=b6e3f4',
    12, true
  ),
  (
    'Number Ned',
    'Knows every single digit from 0 to 9 — ask him anything!',
    'common',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=NumberNed&backgroundColor=b6e3f4',
    12, true
  ),

  -- ── UNCOMMON (drop_weight 8) ────────────────────────────────────────────
  (
    'Fraction Fox',
    'Splits any problem into perfectly equal pieces with a sly grin.',
    'uncommon',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=FractionFox&backgroundColor=b5ead7',
    8, true
  ),
  (
    'Division Dog',
    'Shares everything fairly and equally — not a crumb left over.',
    'uncommon',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=DivisionDog&backgroundColor=b5ead7',
    8, true
  ),
  (
    'Times Tiger',
    'Multiplies power with every pounce. Watch those numbers grow!',
    'uncommon',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=TimesTiger&backgroundColor=b5ead7',
    8, true
  ),
  (
    'Equals Eagle',
    'Soars high and sees perfect balance on both sides of every equation.',
    'uncommon',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=EqualsEagle&backgroundColor=b5ead7',
    8, true
  ),
  (
    'Prime Paul',
    'Can only be divided by 1 and himself. The loneliest, coolest number.',
    'uncommon',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=PrimePaul&backgroundColor=b5ead7',
    8, true
  ),
  (
    'Decimal Duke',
    'Lives in the space between whole numbers, making precision possible.',
    'uncommon',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=DecimalDuke&backgroundColor=b5ead7',
    8, true
  ),
  (
    'Speed Solver',
    'Clocks faster answer times than any other hero in the arena.',
    'uncommon',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=SpeedSolver&backgroundColor=b5ead7',
    8, true
  ),
  (
    'Order Oscar',
    'A stickler for BODMAS. Always does brackets first, no exceptions.',
    'uncommon',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=OrderOscar&backgroundColor=b5ead7',
    8, true
  ),

  -- ── RARE (drop_weight 5) ────────────────────────────────────────────────
  (
    'Algebra Knight',
    'Charges into battle solving for X with a mighty strike of the sword.',
    'rare',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=AlgebraKnight&backgroundColor=a5b4fc',
    5, true
  ),
  (
    'Geometry Guardian',
    'Defender of all angles, shapes and theorems across the maths realm.',
    'rare',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=GeometryGuardian&backgroundColor=a5b4fc',
    5, true
  ),
  (
    'Decimal Dragon',
    'Breathes fire in two decimal places. Extremely precise and terrifying.',
    'rare',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=DecimalDragon&backgroundColor=a5b4fc',
    5, true
  ),
  (
    'Square Root Sage',
    'An ancient wizard who finds hidden roots inside every perfect square.',
    'rare',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=SquareRootSage&backgroundColor=a5b4fc',
    5, true
  ),
  (
    'Streak Samurai',
    'Earns devastating streak bonuses with every consecutive correct answer.',
    'rare',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=StreakSamurai&backgroundColor=a5b4fc',
    5, true
  ),
  (
    'Binary Bandit',
    'Works only with 0s and 1s. Somehow always gets the right answer.',
    'rare',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=BinaryBandit&backgroundColor=a5b4fc',
    5, true
  ),

  -- ── LEGENDARY (drop_weight 2) ───────────────────────────────────────────
  (
    'The Grand Mathematician',
    'The ultimate master of all numerical arts. Feared and respected by every number.',
    'legendary',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=GrandMathematician&backgroundColor=fde68a',
    2, true
  ),
  (
    'Infinity Emperor',
    'Rules over all numbers without end. Even time itself bows to their calculations.',
    'legendary',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=InfinityEmperor&backgroundColor=fde68a',
    2, true
  ),
  (
    'Chaos Calculator',
    'Creates seemingly impossible equations, then solves them before anyone notices.',
    'legendary',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=ChaosCalculator&backgroundColor=fde68a',
    2, true
  ),
  (
    'Theorem Titan',
    'Proved every mathematical theorem before breakfast. Still hungry for more.',
    'legendary',
    'https://api.dicebear.com/9.x/pixel-art/svg?seed=TheoremTitan&backgroundColor=fde68a',
    2, true
  )

ON CONFLICT DO NOTHING;
