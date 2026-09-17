import { useCallback } from 'react';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { SwappableComponentBlueprint } from '@backstage/plugin-app-react';
import {
  TemplateCard,
  type TemplateCardComponentProps,
} from '@backstage/plugin-scaffolder-react/alpha';
import { taskCreatePermission } from '@backstage/plugin-scaffolder-common/alpha';
import { usePermission } from '@backstage/plugin-permission-react';
import { useAnalytics } from '@backstage/core-plugin-api';
import {
  getEntityRelations,
  EntityRefLinks,
} from '@backstage/plugin-catalog-react';
import { RELATION_OWNED_BY } from '@backstage/catalog-model';
import { ItemCardHeader, MarkdownContent, UserIcon } from '@backstage/core-components';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardActions from '@material-ui/core/CardActions';
import Chip from '@material-ui/core/Chip';
import Divider from '@material-ui/core/Divider';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import { categoryColorForTags } from './colors';

/**
 * Replaces the stock TemplateCard (registered via Backstage's
 * SwappableComponentBlueprint extension point — see
 * https://backstage.io/docs/frontend-system/building-plugins/swappable-components/)
 * so the "Choose a template" gallery follows the color rulebook: category
 * (mlops/llmops/llm-serving, from metadata.tags) shows as a thin
 * 4px strip + tag chips, never a full-card colored banner — the page-theme
 * gradient the stock CardHeader would otherwise use is already neutralized
 * in redTheme.ts's `pageTheme`, so this only adds the strip on top of that.
 */
function CategoryTemplateCard(props: TemplateCardComponentProps): JSX.Element {
  const { template, onSelected } = props;
  const analytics = useAnalytics();
  const ownedByRelations = getEntityRelations(template, RELATION_OWNED_BY);
  const { allowed: canCreateTask } = usePermission({ permission: taskCreatePermission });
  const categoryColor = categoryColorForTags(template.metadata.tags);
  const tags = template.metadata.tags ?? [];

  const handleChoose = useCallback(() => {
    analytics.captureEvent('click', 'Template has been opened');
    onSelected?.();
  }, [analytics, onSelected]);

  return (
    <Card style={{ borderTop: `4px solid ${categoryColor}` }}>
      <ItemCardHeader
        title={template.metadata.title ?? template.metadata.name}
        subtitle={template.spec.type}
      />
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Box
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 10,
                WebkitBoxOrient: 'vertical',
              }}
            >
              <MarkdownContent content={template.metadata.description ?? 'No description'} />
            </Box>
          </Grid>
          {tags.length === 0 && (
            <Grid item xs={12}>
              <Divider />
            </Grid>
          )}
          {tags.length > 0 && (
            <>
              <Grid item xs={12}>
                <Divider />
              </Grid>
              <Grid item xs={12}>
                <Grid container spacing={1}>
                  {tags.map(tag => (
                    <Grid item key={tag}>
                      <Chip
                        size="small"
                        label={tag}
                        style={{
                          margin: 0,
                          backgroundColor: categoryColorForTags([tag]),
                          color: '#fff',
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </>
          )}
        </Grid>
      </CardContent>
      <CardActions style={{ padding: 16, flex: 1, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            {ownedByRelations.length > 0 && (
              <>
                <UserIcon fontSize="small" />
                <EntityRefLinks
                  style={{ marginLeft: 8 }}
                  entityRefs={ownedByRelations}
                  defaultKind="Group"
                  hideIcons
                />
              </>
            )}
          </div>
          {/* Outlined, no color — many equal template cards on this
              screen, so none of them gets the brand-red "primary action"
              treatment (see colors.ts's module doc). */}
          {canCreateTask && (
            <Button size="small" variant="outlined" onClick={handleChoose}>
              Choose
            </Button>
          )}
        </div>
      </CardActions>
    </Card>
  );
}

const categoryTemplateCard = SwappableComponentBlueprint.make({
  params: define =>
    define({
      component: TemplateCard,
      loader: () => CategoryTemplateCard,
    }),
});

export const templateCardModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [categoryTemplateCard],
});
