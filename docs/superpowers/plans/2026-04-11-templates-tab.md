# Templates Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Templates settings page (`/settings/templates`) with 5 sub-tabs: Quotes, Contracts, Field Tasks, Emails, and Automations.

**Architecture:** TemplatesPage container with URL-synced tabs. Quote templates have a section/item editor (reuses DND Kit). Email templates have merge field chips and SMS character counter. Automations show 5 hardcoded types as toggle cards with config panels.

**Tech Stack:** React 18, TypeScript, shadcn/ui, @dnd-kit/sortable, Lucide icons, React Query hooks, Vitest + RTL.

---

## Tasks:
1. TemplatesPage shell + route + sidebar entry
2. QuoteTemplateList + QuoteTemplateEditor
3. ContractTemplateList + FieldTasksTab
4. EmailTemplateList + EmailTemplateEditor
5. AutomationList + AutomationConfigPanel
6. Test suite (22 cases)
7. Final verification
