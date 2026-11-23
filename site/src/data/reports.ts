// Labels for content reports (RS-0039), shared by /report-content/ and the
// moderator view. Keys match the content_reports check constraints.
export const contentTypeLabels: Record<string, string> = {
  crew: 'Crew',
  event: 'Event',
  driver_name: 'Driver name',
  other: 'Other',
};
export const contentReasonLabels: Record<string, string> = {
  illegal: 'Illegal content',
  hate_or_harassment: 'Hate or harassment',
  sexual_or_violent: 'Sexual or violent content',
  spam_or_scam: 'Spam, scam or misleading',
  impersonation: 'Impersonation',
  intellectual_property: 'Copyright or trademark',
  other: 'Another breach of the Terms',
};
