# Disabled Convex backup and unusable anonymous restore path

Date: 2026-10-15 UTC. Status: backup, isolated restore and alarm receipt verified.

## Impact and evidence

The documented daily Convex backup was manually disabled on 2026-08-16. Its
last successful run was [31939041782](https://github.com/misty-step/linejam/actions/runs/31939041782);
no artifact from that run remains retained. Read-only provider inspection on
2026-10-15 returned no cloud backups and no periodic-backup configuration for
the production deployment. This is a recovery-coverage gap, not evidence of
observed data loss.

The [sanitized recovery receipt](https://github.com/misty-step/linejam/issues/564)
owns live activation, backup, non-production restore, and alarm-delivery results.
Do not infer recovery from this document or from a configured cron expression.

## Causes

The workflow's GitHub state was disabled while deployment documentation still
claimed daily execution. The required Actions secret was absent. The reason
for the original manual disable is not established; a hosting migration is
not proof that a still-used database's backup is obsolete.

The old public age recipient had no matching identity located in the live
credential inventory, archived secret snapshot, or repository documentation.
Even a successful encrypted upload would not have demonstrated recoverability.

Real CLI preflight also exposed two independent restore defects:

- The production dotenv guard treated the CLI-generated `anonymous:` marker as
  production, rejecting the safe target.
- `--deployment local` selected a cloud-authenticated path with the pinned CLI,
  while the controlled env file carried no explicit anonymous selection.

A disabled workflow emits no failed run. The existing failed-workflow webhook
therefore cannot, by itself, detect missing backups. Intake HTTP success also
cannot prove that an operator or incident tracker received an actionable alert.

## Corrective changes and verification boundaries

- Kaylee authorized piping the existing deploy key directly from mirrodin pass
  into the expected Actions secret. Secret-name/update-time readback confirmed
  the destination, without printing or duplicating its value.
- The migration lane's real export later showed that deploy key lacks
  `deployment:backups:create`. Kaylee approved the existing team access token
  in the same backup secret. The export now uses access-token authentication,
  an explicit production deployment, and no inherited key/target/dotenv
  selection. The original missing-secret guard and age encryption remain.
- With no old identity found, Kaylee authorized a new keypair. Its private
  identity was generated directly into mirrodin pass; the workflow owns the
  public recipient. Old-recipient backups may not be restorable. Off-host escrow
  remains an operator custody action, not a credential copied into this repo.
- The restore script now accepts the explicit anonymous marker and supplies
  only a validated anonymous deployment name through its controlled env file.
  It does not copy a local admin key. Production guards remain enabled.
- A real encrypted synthetic preflight imported a known document into an
  otherwise empty, loopback-only anonymous backend with no functions or crons;
  actual document readback passed. This is not a production-backup restore drill.
- Missing-key and opt-in failure-drill tests execute the actual workflow shell
  with concrete inputs and assert exact exits/output. The failure drill stops
  before export, without deleting or rotating a credential.
- Explicit production, ambient production selection, and production-shaped key
  inputs were all rejected by the restore script. No production import occurred.

## Recurrence and remaining risk

The domain distinction is configured backup versus demonstrated recovery. A
recovery receipt requires a retained encrypted artifact, a usable independent
identity, a successful non-production restore with data checks, and an alarm
receipt. None can be replaced by a green configuration or webhook transport.

The workflow is active again. Real Actions backup
[38798868394](https://github.com/misty-step/linejam/actions/runs/38798868394)
retains encrypted artifact `12002563957`; private R2 readback matched its
ciphertext hash. Restoring that artifact into a fresh loopback-only anonymous
backend verified all 22 application tables and 118,964 documents exactly,
including IDs and creation times. Import took 13.639 seconds; the full drill
took 26.608 seconds. Plaintext, ephemeral identity and backend were removed.

Intentional pre-export failure
[38799093465](https://github.com/misty-step/linejam/actions/runs/38799093465)
reached the existing incident intake. The current standalone production-triage
consumer automatically created and verified its canonical Powder incident;
exact intake readback confirmed the acknowledged ticket. The backup recovery
owner claimed that existing incident. The retained legacy broker's missing
Powder adapter was not bypassed: no replacement item or false acknowledgement
was created. A normal backup succeeded after the drill. The recovery receipt
links the owned incident and exact intake acknowledgement. This is not a claim
that every secondary notification channel has been verified. The existing
incident route's handling of a completely missing daily run remains a separate
liveness limitation; do not claim that failure-drill success detects disablement.
No application release rollback or production-data mutation was performed.
