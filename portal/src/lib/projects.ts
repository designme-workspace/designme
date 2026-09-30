import { TABLES, findOne, getRecord, isValidToken, updateRecord, type AirtableRecord } from "./airtable";

export const STAGES = [
  "0. Awaiting Payment",
  "1. Onboarding Sent",
  "2. Onboarding Complete",
  "3. Brief Review",
  "4. Brief Approved",
  "5. Discovery",
  "6. Moodboard",
  "7. Design",
  "8. Development",
  "9. Revisions",
  "10. Handover",
  "11. Complete",
  "Paused",
] as const;
export type Stage = (typeof STAGES)[number];

export const SERVICE_TYPES = ["Website Design", "Website Development", "Branding", "Product / UI-UX"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export type BriefStatus =
  | "Not Started"
  | "Generating"
  | "Internal Review"
  | "Shared with Client"
  | "Changes Requested"
  | "Client Approved"
  | "Failed";

export type ProjectFields = {
  "Project Name"?: string;
  Client?: string[];
  "Service Type"?: ServiceType[];
  Stage?: Stage;
  Health?: "Green" | "Amber" | "Red";
  "Portal Token"?: string;
  "Contact Name"?: string;
  "Contact Email"?: string;
  "Onboarding Sent At"?: string;
  "Onboarding Completed At"?: string;
  "Proposal Scope"?: string;
  "Onboarding Answers"?: string;
  "Brief Status"?: BriefStatus;
  "Brief JSON"?: string;
  "Brief Summary"?: string;
  "Brief Client Feedback"?: string;
  "Brief Approved At"?: string;
  "Brief Internal Notes"?: string;
  "Kickoff Date"?: string;
  "Target Delivery Date"?: string;
  "Slack EXT Channel"?: string;
  "Slack INT Channel"?: string;
  "ClickUp List URL"?: string;
  "Last Client Update At"?: string;
  "Next Client Update Due"?: string;
  "Latest Update"?: string;
  "Client Actions"?: string;
  "Latest NPS"?: number;
};

export type Project = AirtableRecord<ProjectFields>;

export async function getProjectByToken(token: string): Promise<Project | null> {
  if (!isValidToken(token)) return null;
  return findOne<ProjectFields>(TABLES.projects, `{Portal Token}='${token}'`);
}

export function getProject(id: string): Promise<Project> {
  return getRecord<ProjectFields>(TABLES.projects, id);
}

export function updateProject(id: string, fields: ProjectFields): Promise<Project> {
  return updateRecord<ProjectFields>(TABLES.projects, id, fields);
}

export function stageIndex(stage: Stage | undefined): number {
  return stage ? STAGES.indexOf(stage) : 0;
}
