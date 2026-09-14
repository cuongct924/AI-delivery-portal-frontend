import { Fab, Tooltip, makeStyles } from '@material-ui/core';
import ChatOutlinedIcon from '@material-ui/icons/ChatOutlined';
import { useAssistantEnabled } from '@openchoreo/backstage-plugin-react';
import { useAssistantDrawer } from '../AssistantContext/AssistantDrawerContext';

const useStyles = makeStyles(theme => ({
  fab: {
    position: 'fixed',
    right: theme.spacing(3),
    bottom: theme.spacing(3),
    zIndex: theme.zIndex.snackbar - 1,
    boxShadow: theme.shadows[6],
  },
}));

/**
 * Always-on chat FAB, bottom-right on every page — this fork's assistant
 * answers general MLOps/LLMOps questions, not just build/log-specific
 * ones, so (unlike upstream) an always-available entry point makes sense.
 *
 * Rendered as a child of AssistantDrawerProvider rather than a second
 * AppRootWrapperBlueprint, since wrapper nesting order isn't guaranteed.
 * Hidden while the drawer is open to avoid overlapping its controls.
 */
export const GlobalAssistantFab = () => {
  const classes = useStyles();
  const enabled = useAssistantEnabled();
  const { state, openDrawer } = useAssistantDrawer();

  if (!enabled || state.isOpen) return null;

  return (
    <Tooltip title="Ask the MLOps Assistant" placement="left">
      <Fab
        color="primary"
        className={classes.fab}
        onClick={() => openDrawer()}
        aria-label="Open MLOps Assistant"
      >
        <ChatOutlinedIcon />
      </Fab>
    </Tooltip>
  );
};
