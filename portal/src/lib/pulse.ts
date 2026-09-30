import { TABLES, findOne, isValidToken, updateRecord, type AirtableRecord } from "./airtable";

export type PulseType = "Week 1" | "Month 1" | "Quarterly" | "Final";

export type PulseFields = {
  Survey?: string;
  Project?: string[];
  Type?: PulseType;
  Status?: "Scheduled" | "Sent" | "Completed" | "Expired";
  Token?: string;
  "Completed At"?: string;
  NPS?: number;
  Communication?: number;
  Quality?: number;
  Timeliness?: number;
  "Expectations Met"?: "Exceeded" | "Met" | "Partly" | "Not met";
  "Going Well"?: string;
  "Could Improve"?: string;
  "Open To Testimonial"?: boolean;
  "Follow-up Needed"?: boolean;
};

export type Pulse = AirtableRecord<PulseFields>;

export async function getPulseByToken(token: string): Promise<Pulse | null> {
  if (!isValidToken(token)) return null;
  return findOne<PulseFields>(TABLES.pulseSurveys, `{Token}='${token}'`);
}

export function updatePulse(id: string, fields: PulseFields): Promise<Pulse> {
  return updateRecord<PulseFields>(TABLES.pulseSurveys, id, fields);
}

// A response needs a human follow-up if the client is a detractor, any score
// is 3/5 or lower, or expectations weren't fully met.
export function needsFollowUp(f: PulseFields): boolean {
  const lowRating = [f.Communication, f.Quality, f.Timeliness].some((r) => r !== undefined && r <= 3);
  return (f.NPS !== undefined && f.NPS <= 6) || lowRating || f["Expectations Met"] === "Partly" || f["Expectations Met"] === "Not met";
}
