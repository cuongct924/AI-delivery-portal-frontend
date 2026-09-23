/**
 * Contract test for every golden-path template's `orchestration:*` step
 * inputs.
 *
 * Backstage renders each step's `input` with Nunjucks and then validates the
 * result against the action's own zod-derived JSON schema, throwing
 * `InputError: Invalid input passed to action ...` on a miss (see
 * NunjucksWorkflowRunner.executeStep). A Nunjucks expression that resolves to
 * `undefined` for a valid parameter combination — e.g. an `artifact`
 * expression that only handled two of three `artifactKind` branches — silently
 * drops the property and only fails at run time, in the UI.
 *
 * This test replays that render+validate for every branch of every template's
 * parameter schema, so the miss is caught in CI instead. It deliberately
 * mirrors Backstage's own renderer (single-`${{ }}`-string handling, `dump`
 * filter, undefined-drops-the-property) rather than approximating it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ConfigReader } from '@backstage/config';
import nunjucks from 'nunjucks';
import { parse as parseYaml } from 'yaml';
import {
  createConfirmPromotionAction,
  createCostGateAction,
  createEnrichDatasetFeaturesAction,
  createEstimateCostAction,
  createModelSummaryAction,
  createPolicyCheckAction,
  createPrepareDeployManifestAction,
  createPromoteModelAction,
  createRecordDeployAction,
  createRegisterModelAction,
  createRollbackPromotionAction,
  createSetupMonitoringAction,
  createTriggerTrainingAction,
  createValidateDatasetAction,
} from './mlopsActions';
import {
  createActivatePromptAction,
  createDraftEvalSetAction,
  createDraftPromptAction,
  createEvaluatePromptAction,
  createFetchEvalSetAction,
  createPrepareLlmDeployManifestAction,
  createRagActivateAction,
  createRagEvaluateAction,
  createRagIngestAction,
} from './llmOpsActions';
import { createNotebookAction } from './notebookActions';

/* eslint-disable @typescript-eslint/no-var-requires */
const jsonschema = require('jsonschema');

const TEMPLATES_DIR = path.resolve(__dirname, '../../../../templates');

// A branch field is any parameter with an `enum`/`oneOf` (or a `const` set in
// an `allOf.then`). Every combination of branch values is exercised; the
// remaining fields get one representative value each. Capped so a template
// with many independent branches can't blow up the run.
const MAX_COMBOS = 2000;

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  allOf?: Array<{ if?: JsonSchema; then?: JsonSchema }>;
  enum?: unknown[];
  oneOf?: Array<{ const?: unknown }>;
  const?: unknown;
  default?: unknown;
  items?: JsonSchema;
}

const config = new ConfigReader({});

const actionsById = new Map(
  [
    createValidateDatasetAction,
    createEnrichDatasetFeaturesAction,
    createTriggerTrainingAction,
    createRegisterModelAction,
    createModelSummaryAction,
    createPolicyCheckAction,
    createEstimateCostAction,
    createCostGateAction,
    createPrepareDeployManifestAction,
    createPrepareLlmDeployManifestAction,
    createRecordDeployAction,
    createPromoteModelAction,
    createRollbackPromotionAction,
    createConfirmPromotionAction,
    createSetupMonitoringAction,
    createRagIngestAction,
    createRagEvaluateAction,
    createRagActivateAction,
    createDraftPromptAction,
    createEvaluatePromptAction,
    createActivatePromptAction,
    createDraftEvalSetAction,
    createFetchEvalSetAction,
    createNotebookAction,
  ].map(factory => {
    const action = factory({ config });
    return [action.id, action] as const;
  }),
);

const nunjucksEnv = new nunjucks.Environment(null, {
  autoescape: false,
  throwOnUndefined: false,
  tags: { variableStart: '${{', variableEnd: '}}' },
});

/** Mirrors NunjucksWorkflowRunner.isSingleTemplateString. */
function isSingleTemplateString(input: string): boolean {
  // @types/nunjucks omits the runtime `parser`/`nodes` exports.
  const { parser, nodes } = nunjucks as any;
  const parsed = parser.parse(
    input,
    {},
    {
      autoescape: false,
      tags: { variableStart: '${{', variableEnd: '}}' },
    },
  );
  return (
    parsed.children.length === 1 &&
    !(parsed.children[0]?.children?.[0] instanceof nodes.TemplateData)
  );
}

/** Mirrors NunjucksWorkflowRunner.render's per-value handling. */
function renderValue(
  value: unknown,
  context: Record<string, unknown>,
): unknown {
  if (typeof value !== 'string') return value;
  if (isSingleTemplateString(value)) {
    const wrapped = value.replace(/\${{(.+)}}/g, '${{ ( $1 ) | dump }}');
    const templated = nunjucksEnv.renderString(wrapped, context);
    if (templated === '') return undefined;
    return JSON.parse(templated);
  }
  const templated = nunjucksEnv.renderString(value, context);
  if (templated === '') return undefined;
  return templated;
}

/** Mirrors NunjucksWorkflowRunner.render — undefined drops the property. */
function render(input: unknown, context: Record<string, unknown>): unknown {
  return JSON.parse(
    JSON.stringify(input, (_key, value) => {
      if (typeof value === 'string') return renderValue(value, context);
      return value;
    }),
  );
}

/**
 * A stand-in for `steps.<id>.output.<field>`: any property access returns
 * another stand-in. It serializes to a string, except for `questions` (the
 * one step output consumed as an array — `fetch-eval-set`'s eval cases), so
 * expressions like `steps['fetch-eval-set'].output.questions` still validate
 * as arrays while `...output.remoteUrl` validates as a string.
 */
function anyValue(name = ''): unknown {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'toJSON') {
          return () => (name === 'questions' ? ['placeholder'] : 'placeholder');
        }
        if (prop === Symbol.toPrimitive) return () => 'placeholder';
        if (prop === 'toString') return () => 'placeholder';
        if (prop === 'valueOf') return () => 'placeholder';
        if (prop === 'then') return undefined;
        return anyValue(String(prop));
      },
    },
  );
}

function branchValues(prop: JsonSchema): unknown[] | undefined {
  if (Array.isArray(prop.enum)) return prop.enum;
  if (Array.isArray(prop.oneOf)) {
    return prop.oneOf
      .map(option => option.const)
      .filter(value => value !== undefined);
  }
  return undefined;
}

function collectBranchFields(
  schema: JsonSchema,
  out: Map<string, Set<unknown>>,
): void {
  const add = (name: string, values: readonly unknown[]) => {
    const set = out.get(name) ?? new Set<unknown>();
    values.forEach(value => set.add(value));
    out.set(name, set);
  };
  for (const [name, prop] of Object.entries(schema.properties ?? {})) {
    const values = branchValues(prop);
    if (values) add(name, values);
    if (prop.const !== undefined) add(name, [prop.const]);
  }
  for (const entry of schema.allOf ?? []) {
    if (entry.then) collectBranchFields(entry.then, out);
  }
}

/** The properties actually present for `combo`, following the allOf `if`s. */
function effectiveProperties(
  schema: JsonSchema,
  combo: Record<string, unknown>,
): Record<string, JsonSchema> {
  const props: Record<string, JsonSchema> = { ...(schema.properties ?? {}) };
  for (const entry of schema.allOf ?? []) {
    if (entry.if && entry.then && jsonschema.validate(combo, entry.if).valid) {
      Object.assign(props, effectiveProperties(entry.then, combo));
    }
  }
  return props;
}

function scalarFor(prop: JsonSchema): unknown {
  if (prop.const !== undefined) return prop.const;
  if (prop.default !== undefined) return prop.default;
  const values = branchValues(prop);
  if (values && values.length > 0) return values[0];
  switch (prop.type) {
    case 'integer':
    case 'number':
      return 1;
    case 'boolean':
      return true;
    default:
      return 'placeholder';
  }
}

function valueFor(
  name: string,
  prop: JsonSchema,
  combo: Record<string, unknown>,
): unknown {
  if (name in combo) return combo[name];
  if (prop.const !== undefined) return prop.const;
  if (prop.default !== undefined) return prop.default;
  if (prop.type === 'array') return [scalarFor(prop.items ?? {})];
  return scalarFor(prop);
}

/**
 * Every combination of branch values when that fits in `max`; otherwise a
 * coverage-first sample: the all-defaults combo, then one combo per (field,
 * value) pair so every branch is exercised at least once, then deterministic
 * pseudo-random combos for multi-field coverage. train-track-register alone
 * has ~368M raw combinations, too many to materialize.
 */
function buildCombos(
  entries: Array<[string, unknown[]]>,
  max: number,
): Array<Record<string, unknown>> {
  const total = entries.reduce((acc, [, values]) => acc * values.length, 1);
  if (total <= max) {
    let combos: Array<Record<string, unknown>> = [{}];
    for (const [name, values] of entries) {
      const next: Array<Record<string, unknown>> = [];
      for (const combo of combos) {
        for (const value of values) next.push({ ...combo, [name]: value });
      }
      combos = next;
    }
    return combos;
  }

  const baseline = Object.fromEntries(entries.map(([name, v]) => [name, v[0]]));
  const combos: Array<Record<string, unknown>> = [{ ...baseline }];
  for (const [name, values] of entries) {
    for (const value of values) combos.push({ ...baseline, [name]: value });
  }

  let seed = 123456789;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  while (combos.length < max) {
    const combo: Record<string, unknown> = {};
    for (const [name, values] of entries) {
      combo[name] = values[Math.floor(rand() * values.length)];
    }
    combos.push(combo);
  }
  return combos;
}

const templateFiles = fs
  .readdirSync(TEMPLATES_DIR)
  .map(name => path.join(TEMPLATES_DIR, name, 'template.yaml'))
  .filter(file => fs.existsSync(file));

describe('golden-path template step inputs', () => {
  it.each(templateFiles)('%s', templatePath => {
    const template = parseYaml(fs.readFileSync(templatePath, 'utf-8'));
    const templateName = path.basename(path.dirname(templatePath));

    const steps: Array<{
      id?: string;
      action?: string;
      if?: string;
      input?: unknown;
    }> = template?.spec?.steps ?? [];
    const orchestrationSteps = steps.filter(
      step =>
        typeof step.action === 'string' &&
        step.action.startsWith('orchestration:'),
    );
    if (orchestrationSteps.length === 0) return;

    const parameterSchemas: JsonSchema[] = template?.spec?.parameters ?? [];
    const branchFields = new Map<string, Set<unknown>>();
    for (const schema of parameterSchemas) {
      collectBranchFields(schema, branchFields);
    }

    const combos = buildCombos(
      [...branchFields].map(([name, values]) => [name, [...values]]),
      MAX_COMBOS,
    );

    for (const combo of combos) {
      const effective: Record<string, JsonSchema> = {};
      for (const schema of parameterSchemas) {
        Object.assign(effective, effectiveProperties(schema, combo));
      }
      const parameters: Record<string, unknown> = {};
      for (const [name, prop] of Object.entries(effective)) {
        parameters[name] = valueFor(name, prop, combo);
      }
      const context = { parameters, steps: anyValue() };

      for (const step of orchestrationSteps) {
        const action = actionsById.get(step.action!);
        expect(action).toBeDefined();
        if (!action?.schema?.input) continue;

        if (step.if !== undefined && !render(step.if, context)) continue;

        const input = step.input ? render(step.input, context) : {};
        const result = jsonschema.validate(input, action.schema.input);
        if (!result.valid) {
          throw new Error(
            `${templateName} step "${step.id}" (${
              step.action
            }) with parameters ${JSON.stringify(
              parameters,
            )}:\n  ${result.errors.join('\n  ')}`,
          );
        }
      }
    }
  });
});
