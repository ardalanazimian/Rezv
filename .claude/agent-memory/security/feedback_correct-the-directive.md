---
name: correct-the-directive
description: This owner rewards being corrected — verify the mechanism a directive names, not just its conclusion, and report the variance
metadata:
  type: feedback
---

When a directive names a specific *mechanism* ("the swallowed `.catch()`", "the file that
says X"), verify the mechanism independently. Fix what the directive named **and** what it
missed, and report both. The owner asks explicitly to be corrected rather than agreed with,
and folds accepted corrections back into the directive.

**Why:** confirmed twice on 2026-09-06. (1) A mandate said an irreversible cross-tenant
write was unaudited because `audit(...)` was swallowed by `.catch(() => {})`. The
conclusion was right; the mechanism was a decoy — `audit()` never throws, so those catches
caught nothing and removing them would have fixed **nothing**. The real hole was the
`Promise<void>` return type. The coordinator's reply: "that correction is going into the
directive." (2) The same session, a coordinator claimed zero swallowed catches remained;
three did, in `fraud.ts`. Constitution §1 already carries two prior instances (P0-014,
P0-021) of literal compliance hiding the real defect.

**How to apply:** treat the directive's diagnosis as a claim and its conclusion as a lead.
Before writing the fix, prove the named mechanism with an executed check — a test that the
"guard" is inert is worth more than the fix itself, because it stops the next person
from re-fixing the decoy. Then state the variance plainly in the report; do not quietly
fix the better thing and let the directive stand.
