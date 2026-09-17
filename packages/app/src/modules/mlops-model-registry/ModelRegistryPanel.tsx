import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Content, Table, TableColumn, Link } from '@backstage/core-components';
import { Alert, AlertTitle } from '@material-ui/lab';
import { Box, Chip, Typography } from '@material-ui/core';
import { PageLoader } from '@openchoreo/backstage-design-system';
import { modelRegistryApiRef, ModelSummary, DeployStatus } from './ModelRegistryApi';

interface ModelRow extends ModelSummary {
  deployStatus: DeployStatus | null;
}

/**
 * Real Model Registry data (MLflow, via orchestration-api's GET /models —
 * packages/backend/src/mlopsModelRegistry proxies it). Replaces the old
 * mlops-overlay module's hardcoded single-model demo data with every
 * model actually registered right now.
 *
 * Also shows what's actually deployed right now (Deploy status columns) —
 * the gap a Dev otherwise hits opening Evaluate & Deploy Model with no
 * way to see current live version/traffic split before picking a
 * strategy, only finding out it was the wrong one after the backend
 * rejects the request (prepare_deploy_manifest's prior-deploy check).
 */
export function ModelRegistryPanel(): JSX.Element {
  const api = useApi(modelRegistryApiRef);
  const [rows, setRows] = useState<ModelRow[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listModels()
      .then(async models => {
        // One deploy-status call per model, in parallel — each hits a
        // real KServe InferenceService lookup, so this stays fine for a
        // handful of models but wouldn't scale to hundreds without
        // pagination the rest of this table doesn't have either.
        const withStatus = await Promise.all(
          models.map(async model => {
            try {
              const deployStatus = await api.getDeployStatus(model.name);
              return { ...model, deployStatus };
            } catch {
              // A single model's status lookup failing (e.g. no
              // kubeconfig in this environment) shouldn't blank the
              // whole table — that row just shows "—" for those columns.
              return { ...model, deployStatus: null };
            }
          }),
        );
        if (!cancelled) setRows(withStatus);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const columns: TableColumn<ModelRow>[] = [
    { title: 'Model', field: 'name', defaultSort: 'asc' },
    { title: 'Latest version', field: 'version' },
    {
      title: 'Task type',
      render: row => row.tags.task_type ?? '—',
    },
    {
      title: 'Gate',
      render: row =>
        row.tags.gate_passed === undefined ? (
          '—'
        ) : (
          <Chip
            size="small"
            label={row.tags.gate_passed === 'True' ? 'passed' : 'failed'}
            color={row.tags.gate_passed === 'True' ? 'primary' : 'default'}
          />
        ),
    },
    {
      title: 'Metrics',
      render: row =>
        Object.entries(row.metrics)
          .map(([key, value]) => `${key}=${value}`)
          .join(' · ') || '—',
    },
    {
      title: 'Deployed',
      render: row => {
        if (row.deployStatus === null) return '—';
        if (!row.deployStatus.deployed) return <Chip size="small" label="not deployed" />;
        return (
          <Chip
            size="small"
            label={`v${row.deployStatus.liveVersion ?? '?'} — ${row.deployStatus.ready ? 'Ready' : 'Not ready'}`}
            color={row.deployStatus.ready ? 'primary' : 'default'}
          />
        );
      },
    },
    {
      title: 'Traffic split',
      render: row => {
        if (!row.deployStatus?.deployed) return '—';
        const percent = row.deployStatus.trafficPercent;
        return percent === null ? '100% (direct)' : `${percent}% canary`;
      },
    },
    {
      title: 'Latest PR',
      render: row =>
        row.deployStatus?.prUrl ? (
          <Link to={row.deployStatus.prUrl}>view PR</Link>
        ) : (
          '—'
        ),
    },
  ];

  if (error) {
    return (
      <Content>
        <Alert severity="error">
          <AlertTitle>Could not load the Model Registry</AlertTitle>
          {error.message}
        </Alert>
      </Content>
    );
  }

  if (rows === null) {
    return (
      <Content>
        <PageLoader />
      </Content>
    );
  }

  if (rows.length === 0) {
    return (
      <Content>
        <Box padding={4} textAlign="center" color="text.secondary">
          <Typography variant="h6">No models registered yet</Typography>
          <Typography variant="body2">
            Run Golden Path #1 (Train → Track → Register) to register a model
            in MLflow.
          </Typography>
        </Box>
      </Content>
    );
  }

  return (
    <Content>
      <Table
        title="Model Registry — MLflow"
        data={rows}
        columns={columns}
        options={{ search: true, paging: false, sorting: true }}
      />
    </Content>
  );
}
