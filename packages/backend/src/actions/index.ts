/**
 * Backend module registering the orchestration-api Custom Scaffolder
 * Actions used by Golden Path #1 (Train->Track->Register), #2
 * (Register->Deploy), #3 (Recommend->Track->Register), "Register External
 * Run", and "Setup Model Monitoring" (mlopsActions.ts), plus "Serving LLM"
 * and the LLMOps Lifecycle (RAG ingest/evaluate/activate, prompt
 * draft/evaluate/activate) (llmOpsActions.ts) — see examples/templates/.
 */

import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { openChoreoTokenServiceRef } from '@openchoreo/openchoreo-auth';
import {
  createConfirmPromotionAction,
  createEnrichDatasetFeaturesAction,
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

export default createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'mlops-actions',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
        tokenService: openChoreoTokenServiceRef,
      },
      async init({ scaffolder, config, tokenService }) {
        scaffolder.addActions(
          createValidateDatasetAction({ config, tokenService }),
          createEnrichDatasetFeaturesAction({ config, tokenService }),
          createTriggerTrainingAction({ config, tokenService }),
          createRegisterModelAction({ config, tokenService }),
          createModelSummaryAction({ config, tokenService }),
          createPolicyCheckAction({ config, tokenService }),
          createPrepareDeployManifestAction({ config, tokenService }),
          createPrepareLlmDeployManifestAction({ config, tokenService }),
          createRecordDeployAction({ config, tokenService }),
          createPromoteModelAction({ config, tokenService }),
          createRollbackPromotionAction({ config, tokenService }),
          createConfirmPromotionAction({ config, tokenService }),
          createSetupMonitoringAction({ config, tokenService }),
          createRagIngestAction({ config, tokenService }),
          createRagEvaluateAction({ config, tokenService }),
          createRagActivateAction({ config, tokenService }),
          createDraftPromptAction({ config, tokenService }),
          createEvaluatePromptAction({ config, tokenService }),
          createActivatePromptAction({ config, tokenService }),
          createDraftEvalSetAction({ config, tokenService }),
          createFetchEvalSetAction({ config, tokenService }),
        );
      },
    });
  },
});
