import {
  Content,
  InfoCard,
  StatusOK,
  StatusError,
  StructuredMetadataTable,
} from '@backstage/core-components';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import {
  MODEL_NAME,
  MODEL_VERSIONS,
  DATASET_CHECKS,
  CANARY_SPLIT,
} from './seedData';
import { NEUTRAL } from '../theme/colors';

/**
 * Registry/dataset/canary data OpenChoreo's own Component/Deploy model has
 * no concept of — sits as an additional tab next to OpenChoreo's real
 * Overview/Definition/Cell diagram/Deploy tabs, never replacing them.
 */
export function MlopsOverlayPanel(): JSX.Element {
  return (
    <Content>
      <Grid container spacing={3} direction="column">
        <Grid item>
          <InfoCard title={`Model Registry — ${MODEL_NAME}`} subheader="Nguồn: MLflow">
            <StructuredMetadataTable
              metadata={Object.fromEntries(
                MODEL_VERSIONS.map(v => [
                  `v${v.version}`,
                  `accuracy=${v.accuracy} · f1=${v.f1} · gate ${v.gatePassed ? 'passed' : 'failed'}`,
                ]),
              )}
            />
          </InfoCard>
        </Grid>

        <Grid item>
          <InfoCard title="Dataset Validation" subheader="Kết quả lần chạy gần nhất">
            {DATASET_CHECKS.map(check => (
              <div
                key={check.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                  borderBottom: `1px solid ${NEUTRAL.border}`,
                }}
              >
                {check.passed ? <StatusOK /> : <StatusError />}
                <Typography variant="body2" style={{ fontWeight: 600 }}>
                  {check.name}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {check.detail}
                </Typography>
              </div>
            ))}
          </InfoCard>
        </Grid>

        <Grid item>
          <InfoCard title="Traffic Split (KServe)" subheader="Canary deployment hiện tại">
            <Typography variant="body1">
              Stable {CANARY_SPLIT.stable}% / Canary {CANARY_SPLIT.canary}%
            </Typography>
          </InfoCard>
        </Grid>
      </Grid>
    </Content>
  );
}
