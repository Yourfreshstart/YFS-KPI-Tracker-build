// Shared field list for the KPI Interview intake form (/kpi-intake) and its
// admin view (/kpi-intake-admin) -- one source of truth for labels/hints so
// the two pages can't drift out of sync.

export type IntakeField = { id: string; label: string; hint?: string; type: "text" | "textarea" };
export type IntakeSection = { title: string; sub?: string; fields: IntakeField[] };

export const INTAKE_SCHEMA: IntakeSection[] = [
  {
    title: "The Basics",
    sub: "Warm-up — get oriented before the numbers start.",
    fields: [
      { id: "svc_type", label: "Residential, commercial, or both?", type: "text", hint: "Ask: what kind of cleaning do you mostly do?" },
      { id: "recurring_mix", label: "Recurring vs. one-time split", type: "text", hint: "Ask: roughly what share of your business is repeat clients vs. one-off jobs?" },
      { id: "team_size", label: "Team size right now", type: "text", hint: "Ask: how many people are cleaning for you day to day?" },
      { id: "top_worry", label: "What's keeping them up at night", type: "textarea", hint: "Ask: if you had one number in front of you every morning, what would it be?" },
    ],
  },
  {
    title: "Revenue & Profitability",
    fields: [
      { id: "rev_normal", label: "A normal week's revenue", type: "text", hint: "Ask: what does a solid week look like in dollars? What would worry you?" },
      { id: "rev_target", label: "Target weekly revenue", type: "text" },
      { id: "rev_watch", label: "“Watch” line", type: "text", hint: "Below target but not an emergency yet" },
      { id: "rev_critical", label: "“Critical” line", type: "text", hint: "The number that means act now" },
      { id: "rev_term", label: "What do they call this?", type: "text", hint: "e.g. “Gross Sales,” “Weekly Take”" },
      { id: "payroll_pct", label: "Payroll as % of revenue — target band", type: "text", hint: "Ask: what percent of revenue going to payroll feels healthy? Too low or too high?" },
      { id: "rev_per_cleaner", label: "Revenue per cleaner — target per week", type: "text", hint: "Ask: what should one tech bring in during a good week?" },
      { id: "cleaner_term", label: "What do they call a cleaner/tech?", type: "text", hint: "Tech, RGE, associate, maid — use their word going forward" },
    ],
  },
  {
    title: "Growth & Retention",
    fields: [
      { id: "recurring_count", label: "Recurring clients right now (roughly)", type: "text" },
      { id: "growth_target", label: "A good month of net growth", type: "text", hint: "Ask: new recurring clients added minus ones lost — what's a good month?" },
      { id: "attrition_target", label: "Attrition / cancellation rate — acceptable vs. concerning", type: "text", hint: "Ask: what percent of clients leaving each month is normal? When does it worry you?" },
      { id: "initial_conv", label: "First-clean-to-recurring conversion — target", type: "text", hint: "Ask: of people who try you once, how many should stick around?" },
    ],
  },
  {
    title: "Sales Funnel",
    fields: [
      { id: "lead_sources", label: "How leads come in", type: "text", hint: "Phone, web form, referral, a booking tool (Zenmaid, Housecall Pro, etc.)" },
      { id: "contact_rate", label: "Contact rate — target", type: "text", hint: "Of leads that come in, how many actually get a response?" },
      { id: "lead_to_booking", label: "Lead-to-booking conversion — target", type: "text" },
      { id: "contact_to_booking", label: "Contact-to-booking conversion — target", type: "text" },
    ],
  },
  {
    title: "Operations",
    fields: [
      { id: "cleans_per_week", label: "Cleans completed per week (roughly)", type: "text" },
      { id: "incident_tracking", label: "What incidents do they already track?", type: "textarea", hint: "Skips, route changes, breakage/damage, complaints — what matters to them?" },
      { id: "care_opp", label: "How do they flag a client who needs a check-in?", type: "text", hint: "Some businesses call this a “care opportunity” — do they have their own version?" },
    ],
  },
  {
    title: "Team & Hiring",
    fields: [
      { id: "pay_structure", label: "Pay structure", type: "text", hint: "Flat rate, tiered, commission? This shapes a lot of the dashboard." },
      { id: "interview_show", label: "Interview show-up rate — worth tracking?", type: "text" },
      { id: "hire_conv", label: "Hire conversion — interviews to hires", type: "text" },
      { id: "trainee_pay", label: "Is trainee pay tracked separately?", type: "text" },
    ],
  },
  {
    title: "The Real Talk",
    sub: "Wrap-up — the practical stuff.",
    fields: [
      { id: "current_system", label: "What are they using right now?", type: "text", hint: "Excel, a whiteboard, nothing at all?" },
      { id: "whats_broken", label: "What's broken about it?", type: "textarea" },
      { id: "who_sees_it", label: "Who needs to see this?", type: "text", hint: "Just the owner, or office staff too?" },
      { id: "other_notes", label: "Anything else that came up", type: "textarea" },
    ],
  },
];

export const ALL_INTAKE_FIELDS: IntakeField[] = INTAKE_SCHEMA.flatMap((s) => s.fields);
