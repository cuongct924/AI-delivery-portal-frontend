/**
 * Backend module registering the orchestration-api Custom Scaffolder
 * Actions (mlopsActions.ts) used by Golden Path #1 (Train->Track->Register),
 * #2 (Register->Deploy), #3 (Recommend->Track->Register), "Register
 * External Run", "Setup Model Monitoring", "Serving LLM", and the LLMOps
 * Lifecycle (RAG ingest/evaluate/activate, prompt draft/evaluate/activate)
 * — see examples/templates/.
 */

import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { openChoreoTokenServiceRef } from '@openchoreo/openchoreo-auth';
import {
  createActivatePromptAction,
  createDraftPromptAction,
  createEnrichDatasetFeaturesAction,
  createEvaluatePromptAction,
  createModelSummaryAction,
  createPolicyCheckAction,
  createPrepareDeployManifestAction,
  createPrepareLlmDeployManifestAction,
  createPromoteModelAction,
  createRagActivateAction,
  createRagEvaluateAction,
  createRagIngestAction,
  createRecordDeployAction,
  createRegisterModelAction,
  createRollbackPromotionAction,
  createSetupMonitoringAction,
  createTriggerRecTrainingAction,
  createTriggerTrainingAction,
  createValidateDatasetAction,
  createValidateRecDatasetAction,
} from './mlopsActions';

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
          createValidateRecDatasetAction({ config, tokenService }),
          createTriggerRecTrainingAction({ config, tokenService }),
          createSetupMonitoringAction({ config, tokenService }),
          createRagIngestAction({ config, tokenService }),
          createRagEvaluateAction({ config, tokenService }),
          createRagActivateAction({ config, tokenService }),
          createDraftPromptAction({ config, tokenService }),
          createEvaluatePromptAction({ config, tokenService }),
          createActivatePromptAction({ config, tokenService }),
        );
      },
    });
  },
});
