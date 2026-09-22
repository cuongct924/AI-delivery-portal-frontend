import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Link, Progress, WarningPanel } from '@backstage/core-components';
import { useAsync } from 'react-use';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@material-ui/core';
import DescriptionIcon from '@material-ui/icons/Description';

const TECH_DOCS_ANNOTATION = 'backstage.io/techdocs-ref';

/**
 * Home widget listing the platform's TechDocs. Queries the catalog for
 * entities carrying a `backstage.io/techdocs-ref` and links each to its
 * TechDocs reader page (`/docs/...`), so the docs are one click from home.
 */
export const TechDocsWidget = () => {
  const catalogApi = useApi(catalogApiRef);
  const { value, loading, error } = useAsync(
    () =>
      catalogApi.getEntities({
        filter: { kind: ['Component', 'System'] },
        fields: [
          'kind',
          'metadata.name',
          'metadata.namespace',
          'metadata.title',
          'metadata.description',
          'metadata.annotations',
        ],
      }),
    [],
  );

  if (loading) return <Progress />;
  if (error) {
    return (
      <WarningPanel title="Could not load documentation">
        {error.message}
      </WarningPanel>
    );
  }

  const docs = (value?.items ?? []).filter(
    entity => entity.metadata.annotations?.[TECH_DOCS_ANNOTATION],
  );

  if (docs.length === 0) {
    return (
      <Typography variant="body2" color="textSecondary">
        No documentation found. Add a <code>backstage.io/techdocs-ref</code>{' '}
        annotation to an entity to publish its docs.
      </Typography>
    );
  }

  return (
    <Box>
      <List dense>
        {docs.map(entity => {
          const namespace = entity.metadata.namespace ?? 'default';
          const to = `/docs/${namespace}/${entity.kind.toLowerCase()}/${
            entity.metadata.name
          }`;
          return (
            <ListItem
              key={`${entity.kind}/${namespace}/${entity.metadata.name}`}
              button
              component={Link}
              to={to}
            >
              <ListItemIcon>
                <DescriptionIcon />
              </ListItemIcon>
              <ListItemText
                primary={entity.metadata.title ?? entity.metadata.name}
                secondary={entity.metadata.description}
              />
            </ListItem>
          );
        })}
      </List>
      <Box mt={1}>
        <Link to="/docs">Browse all documentation</Link>
      </Box>
    </Box>
  );
};
