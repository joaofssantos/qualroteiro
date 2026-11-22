# QA — TRUST_PROXY for route-plan rate limiting

Result: approved for review.

`TRUST_PROXY` defaults to disabled, so `X-Forwarded-For` cannot select a
different rate-limit bucket on a direct request. On Render the Blueprint sets
one trusted proxy hop: the right-most entry in the real XFF chain becomes the
client bucket, while a forged entry to its left does not change that bucket.
Invalid hop counts and malformed CIDR lists fail during boot with
`InvalidTrustProxyError`.

Verified in a throwaway Agentistics environment using Node 20.19.0 and pnpm
9.12.0: workspace dependency packages built; API tests passed (188 tests),
typecheck passed, and ESLint passed. The limiter's store remains in memory per
process, so replicas do not share counters.
