import { useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { Content, Table, TableColumn } from '@backstage/core-components';
import { Alert, AlertTitle } from '@material-ui/lab';
import { Box, Chip, Typography } from '@material-ui/core';
import { PageLoader } from '@openchoreo/backstage-design-system';
import { modelRegistryApiRef, ModelSummary } from './ModelRegistryApi';

/**
 * Real Model Registry data (MLflow, via orchestration-api's GET /models —
 * packages/backend/src/mlopsModelRegistry proxies it). Replaces the old
 * mlops-overlay module's hardcoded single-model demo data with every
 * model actually registered right now.
 */
export function ModelRegistryPanel(): JSX.Element {
  const api = useApi(modelRegistryApiRef);
  const [models, setModels] = useState<ModelSummary[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listModels()
      .then(result => {
        if (!cancelled) setModels(result);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const columns: TableColumn<ModelSummary>[] = [
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

  if (models === null) {
    return (
      <Content>
        <PageLoader />
      </Content>
    );
  }

  if (models.length === 0) {
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
        data={models}
        columns={columns}
        options={{ search: true, paging: false, sorting: true }}
      />
    </Content>
  );
}
