/**
 * Custom Scaffolder Action that calls `services/orchestration-api`'s
 * `/security/scan` — the pre-flight security control-surface scan every
 * golden path runs before it executes. Business logic (the control catalog
 * and policy) stays in orchestration-api; this action only translates
 * Scaffolder input/output and fails the step on a blocking finding.
 */

import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { ActionDeps, getBaseUrl, postJson } from './actionsHttpClient';

/** One finding from `POST {baseUrl}/security/scan`. */
interface SecurityFinding {
  readonly control: string;
  readonly pillar: string;
  readonly severity: 'blocking' | 'warning';
  readonly message: string;
}

/** One control's posture from `POST {baseUrl}/security/scan`. */
interface SecurityControlStatus {
  readonly id: string;
  readonly pillar: string;
  readonly label: string;
  readonly status: 'enforced' | 'missing' | 'not-applicable';
}

/** Response body of `POST {baseUrl}/security/scan`. */
interface SecurityScanResponse {
  readonly passed: boolean;
  readonly score: number;
  readonly findings: SecurityFinding[];
  readonly controls: SecurityControlStatus[];
}

/**
 * `orchestration:security-scan` — scans a golden-path run against the four
 * security control surfaces (Model Registry Governance, Data Isolation,
 * Prompt Security, Inference Audit) and fails the step on any blocking
 * finding, so an insecure run never reaches the cluster.
 */
export function createSecurityScanAction({ config, tokenService }: ActionDeps) {
  return createTemplateAction({
    id: 'orchestration:security-scan',
    description:
      'Scans a golden-path run against its security policy and fails on a blocking finding.',
    schema: {
      input: {
        goldenPath: z =>
          z.string({
            description: 'Golden path name, e.g. llm-serve-deploy',
          }),
        stage: z =>
          z.enum(['build', 'gate', 'run'], {
            description: 'Lifecycle stage the scan belongs to',
          }),
        artifact: z =>
          z.string({ description: 'Artifact the scan is attributed to' }),
        params: z =>
          z
            .record(z.string(), z.any(), {
              description:
                'Security control values (dataClassification, piiScan, inputGuardrails, ...)',
            })
            .optional(),
      },
      output: {
        passed: z =>
          z.boolean({ description: 'True when no blocking finding was raised' }),
        score: z =>
          z.number({ description: 'Security posture score, 0-100' }),
        findings: z =>
          z.array(
            z.object({
              control: z.string(),
              pillar: z.string(),
              severity: z.enum(['blocking', 'warning']),
              message: z.string(),
            }),
            { description: 'Blocking and warning findings' },
          ),
        controls: z =>
          z.array(
            z.object({
              id: z.string(),
              pillar: z.string(),
              label: z.string(),
              status: z.enum(['enforced', 'missing', 'not-applicable']),
            }),
            { description: 'Per-control posture across all four surfaces' },
          ),
      },
    },
    async handler(ctx) {
      const baseUrl = getBaseUrl(config);
      const result = await postJson<SecurityScanResponse>(
        `${baseUrl}/security/scan`,
        {
          golden_path: ctx.input.goldenPath,
          stage: ctx.input.stage,
          artifact: ctx.input.artifact,
          params: ctx.input.params ?? {},
        },
        tokenService,
      );

      for (const finding of result.findings) {
        ctx.logger.info(
          `[${finding.severity}] ${finding.pillar}/${finding.control}: ${finding.message}`,
        );
      }
      ctx.logger.info(
        `Security posture ${result.score}/100 for ${ctx.input.goldenPath} (${ctx.input.artifact})`,
      );

      ctx.output('passed', result.passed);
      ctx.output('score', result.score);
      ctx.output('findings', result.findings);
      ctx.output('controls', result.controls);

      if (!result.passed) {
        const blocking = result.findings
          .filter(f => f.severity === 'blocking')
          .map(f => `${f.control}: ${f.message}`)
          .join('; ');
        throw new Error(`Security scan blocked ${ctx.input.goldenPath}: ${blocking}`);
      }
    },
  });
}
