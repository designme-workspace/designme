import type { ServiceType } from "./projects";

export type Question = {
  id: string;
  label: string;
  help?: string;
  required?: boolean;
} & (
  | { type: "text" | "textarea" | "url" | "email" | "date"; placeholder?: string }
  | { type: "select" | "multiselect"; options: string[] }
  // A 1-5 scale between two opposite ends, e.g. Classic ↔ Modern.
  | { type: "scale"; left: string; right: string }
);

export type Section = { id: string; title: string; intro?: string; questions: Question[] };

const aboutYou: Section = {
  id: "about",
  title: "About you & your business",
  intro: "The basics, so everyone on our team starts with the same picture.",
  questions: [
    { id: "contact_name", type: "text", label: "Your name", required: true },
    { id: "contact_role", type: "text", label: "Your role", required: true },
    { id: "company_name", type: "text", label: "Company name", required: true },
    { id: "website", type: "url", label: "Current website (if any)", placeholder: "https://" },
    {
      id: "company_description",
      type: "textarea",
      label: "In two or three sentences, what does your company do and for whom?",
      required: true,
    },
    {
      id: "audience",
      type: "textarea",
      label: "Who is your ideal customer? What do they care about most?",
      required: true,
    },
    {
      id: "competitors",
      type: "textarea",
      label: "Who are your main competitors? What do you like or dislike about how they look and sound?",
    },
  ],
};

const goals: Section = {
  id: "goals",
  title: "Goals & success",
  intro: "This is where most projects go wrong, so please be as specific as you can.",
  questions: [
    {
      id: "why_now",
      type: "textarea",
      label: "Why are you doing this project now? What's the trigger?",
      required: true,
    },
    {
      id: "success",
      type: "textarea",
      label: "Imagine it's 3 months after launch and the project was a huge success. What has changed?",
      required: true,
    },
    {
      id: "metrics",
      type: "textarea",
      label: "How will you measure that success? (e.g. demo bookings, conversion rate, investor meetings, brand recognition)",
    },
    {
      id: "must_haves",
      type: "textarea",
      label: "What are your absolute must-haves?",
      required: true,
    },
    {
      id: "must_avoid",
      type: "textarea",
      label: "Anything we must avoid (styles, words, colours, approaches)?",
    },
    {
      id: "past_experience",
      type: "textarea",
      label: "Have you worked with an agency or designer before? What went well and what didn't?",
      help: "Honest answers help us avoid repeating anyone else's mistakes.",
    },
    {
      id: "concerns",
      type: "textarea",
      label: "What worries you most about this project?",
    },
  ],
};

const look: Section = {
  id: "look",
  title: "Look & feel",
  intro: "No wrong answers. We'll go much deeper in the moodboard stage.",
  questions: [
    {
      id: "brand_words",
      type: "text",
      label: "Three to five words you want people to feel when they see your brand",
      placeholder: "e.g. trustworthy, bold, calm, premium",
      required: true,
    },
    { id: "scale_classic_modern", type: "scale", label: "Style", left: "Classic", right: "Modern" },
    { id: "scale_playful_serious", type: "scale", label: "Tone", left: "Playful", right: "Serious" },
    { id: "scale_minimal_expressive", type: "scale", label: "Density", left: "Minimal", right: "Expressive" },
    { id: "scale_accessible_premium", type: "scale", label: "Positioning", left: "Accessible", right: "Premium" },
    {
      id: "inspiration",
      type: "textarea",
      label: "Share 3+ links to websites, brands or products you love, and say what you love about each",
      required: true,
    },
    {
      id: "existing_assets",
      type: "multiselect",
      label: "Which assets do you already have?",
      options: ["Logo", "Brand guidelines", "Colour palette", "Fonts", "Photography", "Illustrations", "Copy / messaging", "Pitch deck", "None yet"],
    },
    {
      id: "assets_link",
      type: "url",
      label: "Link to a folder with those assets (Google Drive, Dropbox, etc.)",
      placeholder: "https://",
    },
  ],
};

const working: Section = {
  id: "working",
  title: "Working together",
  intro: "Clear roles and timelines keep us both accountable.",
  questions: [
    {
      id: "decision_maker",
      type: "text",
      label: "Who has final sign-off on designs? (name + role)",
      help: "One person giving consolidated feedback keeps the project moving.",
      required: true,
    },
    {
      id: "stakeholders",
      type: "textarea",
      label: "Who else needs to be involved or kept in the loop? (name, role, email)",
    },
    {
      id: "feedback_speed",
      type: "select",
      label: "How quickly can you usually review and give feedback?",
      options: ["Within 24 hours", "Within 2 business days", "Within a week", "It varies a lot"],
      required: true,
    },
    {
      id: "comms_preference",
      type: "multiselect",
      label: "How do you prefer to communicate?",
      options: ["Slack", "Email", "Video calls", "Loom videos", "WhatsApp"],
      required: true,
    },
    { id: "timezone", type: "text", label: "Your timezone and best times for calls", required: true },
    {
      id: "deadline",
      type: "date",
      label: "Is there a hard deadline (launch, fundraise, event)?",
    },
    {
      id: "deadline_reason",
      type: "text",
      label: "What's driving that date, and how fixed is it?",
    },
  ],
};

const website: Section = {
  id: "website",
  title: "Your website",
  questions: [
    {
      id: "site_type",
      type: "select",
      label: "What kind of site is this?",
      options: ["Marketing site", "Landing page", "E-commerce", "Web app marketing + docs", "Other"],
      required: true,
    },
    {
      id: "pages",
      type: "textarea",
      label: "Which pages do you think you need? (rough list is fine)",
      required: true,
    },
    {
      id: "platform",
      type: "select",
      label: "Preferred platform",
      options: ["Webflow", "Framer", "WordPress", "Shopify", "No preference, recommend one"],
    },
    {
      id: "cms",
      type: "multiselect",
      label: "Content you'll want to update yourselves",
      options: ["Blog", "Case studies", "Team", "Careers", "Changelog", "Resources", "None"],
    },
    {
      id: "integrations",
      type: "textarea",
      label: "Tools the site must connect to (CRM, forms, analytics, booking, newsletter)",
    },
    {
      id: "copy_status",
      type: "select",
      label: "Who is writing the copy?",
      options: ["We have final copy", "We'll write it, you polish", "We need copywriting from you", "Not sure yet"],
      required: true,
    },
    {
      id: "current_site_problems",
      type: "textarea",
      label: "What's not working on your current site?",
    },
    {
      id: "access",
      type: "textarea",
      label: "Who manages your domain/DNS and hosting today?",
      help: "We'll need access later for launch. No passwords here please.",
    },
  ],
};

const branding: Section = {
  id: "branding",
  title: "Your brand",
  questions: [
    {
      id: "brand_scope",
      type: "select",
      label: "What are we doing?",
      options: ["Brand new identity", "Refresh of existing brand", "Full rebrand (new direction)"],
      required: true,
    },
    { id: "name_final", type: "select", label: "Is the company/product name final?", options: ["Yes", "No", "Exploring options"] },
    {
      id: "keep",
      type: "textarea",
      label: "If you have a brand today, what must we keep and what can go?",
    },
    {
      id: "brand_deliverables",
      type: "multiselect",
      label: "What do you expect to receive?",
      options: ["Logo suite", "Colour palette", "Typography", "Brand guidelines", "Social templates", "Pitch deck template", "Stationery", "Iconography", "Illustration style", "Motion / animation"],
      required: true,
    },
    {
      id: "applications",
      type: "textarea",
      label: "Where will the brand show up most? (website, app, packaging, events, social, sales decks…)",
    },
    { id: "values", type: "textarea", label: "Your company values or the story behind the business" },
  ],
};

const product: Section = {
  id: "product",
  title: "Your product",
  questions: [
    {
      id: "product_stage",
      type: "select",
      label: "Product stage",
      options: ["Idea / pre-build", "MVP in progress", "Live product", "Redesign of a live product"],
      required: true,
    },
    {
      id: "product_platforms",
      type: "multiselect",
      label: "Platforms",
      options: ["Web app", "iOS", "Android", "Desktop", "Admin / internal tools"],
      required: true,
    },
    {
      id: "key_flows",
      type: "textarea",
      label: "What are the 3–5 most important things users must be able to do?",
      required: true,
    },
    {
      id: "users",
      type: "textarea",
      label: "Who uses the product and what's their biggest frustration today?",
    },
    {
      id: "research",
      type: "textarea",
      label: "Any user research, analytics, support tickets or feedback we can learn from?",
    },
    {
      id: "design_system",
      type: "select",
      label: "Do you have a design system or component library?",
      options: ["Yes, in Figma", "Yes, in code only", "Partially", "No"],
    },
    {
      id: "dev_team",
      type: "textarea",
      label: "Who builds it? Tech stack, and how they like to receive designs",
      required: true,
    },
    {
      id: "accessibility",
      type: "select",
      label: "Accessibility requirements",
      options: ["WCAG AA required", "Nice to have", "Not sure"],
    },
  ],
};

const final: Section = {
  id: "final",
  title: "Anything else?",
  questions: [
    {
      id: "anything_else",
      type: "textarea",
      label: "Anything else we should know? Anything you'd love us to ask about?",
    },
  ],
};

export function sectionsFor(services: ServiceType[] | undefined): Section[] {
  const s = new Set(services ?? []);
  const serviceSections: Section[] = [];
  if (s.has("Website Design") || s.has("Website Development")) serviceSections.push(website);
  if (s.has("Branding")) serviceSections.push(branding);
  if (s.has("Product / UI-UX")) serviceSections.push(product);
  return [aboutYou, goals, look, ...serviceSections, working, final];
}

export type Answers = Record<string, string | string[] | number>;

export function missingRequired(sections: Section[], answers: Answers): string[] {
  return sections
    .flatMap((s) => s.questions)
    .filter((q) => q.required)
    .filter((q) => {
      const v = answers[q.id];
      return v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    })
    .map((q) => q.id);
}

// Renders answers as "Question: answer" lines, grouped by section, for the AI prompt.
export function answersAsText(sections: Section[], answers: Answers): string {
  return sections
    .map((section) => {
      const lines = section.questions
        .map((q) => {
          const v = answers[q.id];
          if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return null;
          if (q.type === "scale") return `- ${q.label} (1=${q.left}, 5=${q.right}): ${v}`;
          return `- ${q.label}: ${Array.isArray(v) ? v.join(", ") : v}`;
        })
        .filter(Boolean);
      return lines.length ? `## ${section.title}\n${lines.join("\n")}` : null;
    })
    .filter(Boolean)
    .join("\n\n");
}
