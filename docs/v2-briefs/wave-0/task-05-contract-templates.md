# Wave 0, Task 5: Set Up Contract Templates

> **Priority:** MEDIUM — Needed before season setup workflow in V2.
> **Reference docs:** L-4 (Snow Contract Templates & Billing Setup)

---

## What This Is

Sunset Services needs contract templates for their service agreements — both landscape maintenance and snow removal. These templates are used when creating new contracts for customers.

## Pre-Requisites
- [ ] Task 3 complete (V1 deployed to production)

## What Needs to Be Set Up

### Landscape Contract Templates
- Annual Lawn Maintenance Agreement (for Gold/Silver/Bronze tiers — this becomes important in V2)
- One-time Landscape Project Agreement

### Snow Contract Templates (from L-4)
- Snow Seasonal Contract (flat monthly billing × 5 months, Nov–Mar)
- Snow Per-Event Contract (billed per qualifying storm)
- Contract language for trigger thresholds, calcium add-on, service scope

## How to Do This

This is primarily done through the CRM web interface:

1. Log in to the CRM
2. Go to Settings > Contract Templates (or Contracts section)
3. Create templates with standard language for each contract type
4. Set default terms, billing frequencies, and payment terms

### Contract template content should include:
- Service description and scope
- Billing terms and frequency
- Payment terms (net 30, etc.)
- Cancellation policy
- Season dates (landscape: April–November, snow: November–March)

## Note for V2
In V2, the Templates Module (D-26) will formalize this into a proper template system with 5 categories. For now in Wave 0, we just need basic contract templates so existing V1 functionality works.

## Done When
- [ ] Landscape maintenance contract template created
- [ ] Snow seasonal contract template created
- [ ] Snow per-event contract template created
- [ ] Templates accessible when creating new contracts
- [ ] Erick has reviewed and approved the template language
