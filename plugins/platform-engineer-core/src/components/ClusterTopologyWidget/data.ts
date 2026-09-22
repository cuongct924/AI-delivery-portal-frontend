export interface ClusterPlane {
  key: string;
  title: string;
  node: string;
  nodeLabel: string;
  tainted: boolean;
  workloads: string[];
  /** Set when this plane shares its physical node with another card below — logically distinct, not a 4th node. */
  coLocatedWith?: string;
}

// Mirrors backend repo CLAUDE.md's "Local infra" node layout and
// scripts/setup-3node-infra.sh, plus the componentTypeEnvironmentConfigs.
// nodeSelector pinning in infra/openchoreo/namespaces/default/projects/
// platform/**/releasebinding-*.yaml and infra/ai-platform-zone/*.yaml —
// update alongside those if the topology changes.
//
// cert-manager and the standard (non-GPU) model-serving KServe path
// (infra/openchoreo/platform-shared/component-types/
// clustercomponenttype-inference-service.yaml) are cluster-wide add-ons
// from the initial k3d bootstrap — not pinned to any one plane by this
// project's own manifests, so they're deliberately left off every card
// rather than guessed onto one. The GPU/vLLM self-hosted serving path
// (adapters/delivery/gpu_inference_adapter.py) IS pinned, to this same
// worker2 node, via PLANE_LABEL_KEY/PLANE_TAINT_KEY there.
//
// worker2 (plane.viettel.vn=ai-platform-workflow) carries two logically
// distinct roles the setup script itself names separately ("AI Platform
// zone" vs "workflow plane pin") — split into 2 cards here, both pinned to
// the same physical node.
export const CLUSTER_PLANES: ClusterPlane[] = [
  {
    key: 'control-plane',
    title: 'Control Plane',
    node: 'k3d-openchoreo-quick-start-server-0',
    nodeLabel: 'plane.viettel.vn=control-plane',
    tainted: false,
    workloads: ['OpenChoreo control plane (API, controllers)', 'Thunder (IdP)'],
  },
  {
    key: 'data-plane-portal',
    title: 'Data Plane Portal',
    node: 'k3d-worker1-0',
    nodeLabel: 'plane.viettel.vn=data-plane-portal',
    tainted: true,
    workloads: [
      'orchestration-api',
      'ai-observability-server',
      'golden-path-guide-server',
      'llmops-golden-paths-server',
      'mlops-golden-paths-server',
    ],
  },
  {
    key: 'ai-platform-data-plane',
    title: 'Data Plane',
    node: 'k3d-worker2-0',
    nodeLabel: 'plane.viettel.vn=ai-platform-workflow',
    tainted: true,
    workloads: [
      'MLflow',
      'Qdrant',
      'MinIO',
      'LiteLLM',
      'Feast (feast-serve)',
      'KServe + vLLM (LLM self-hosted serving)',
    ],
    coLocatedWith: 'Workflow Plane',
  },
  {
    key: 'workflow-plane',
    title: 'Workflow Plane',
    node: 'k3d-worker2-0',
    nodeLabel: 'plane.viettel.vn=ai-platform-workflow',
    tainted: true,
    workloads: ['Argo train-register workflow (training/fine-tuning)'],
    coLocatedWith: 'Data Plane',
  },
];
