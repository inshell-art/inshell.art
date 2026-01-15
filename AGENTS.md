# AGENTS

## Curve Rendering (Half-Lives)
- X-axis uses half-lives: `u = (t - last_bid_time) / t_half`.
- Draw a fixed window of 10 half-lives (`CURVE_HALF_LIVES`) for a smooth curve.
- Tooltip timing converts back with `tau = u * t_half`, then uses `(now - last_bid_time) - tau` for ago.
