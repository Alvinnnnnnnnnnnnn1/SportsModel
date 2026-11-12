export const CLOUD_EVIDENCE_NOT_CONNECTED = 'Cloud research evidence not yet connected';
/** Missing provisioning is distinct from corrupt evidence or a transport outage. */
export class CloudEvidenceNotConnected extends Error {
  constructor() { super(CLOUD_EVIDENCE_NOT_CONNECTED); }
}
