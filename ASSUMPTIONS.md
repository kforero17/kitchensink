# Assumptions

- Rating scale is 1-5, mapped to [-1, +1] via `(rating - 3) / 2`
- Time decay uses exponential with 90-day constant (half-life ~62 days)
- Selecting a recipe in meal plan = implicit like (not selecting ≠ dislike)
- Feedback weight at 0.15 is enough to influence without dominating
- 100-item feedback history limit is sufficient for signal computation
