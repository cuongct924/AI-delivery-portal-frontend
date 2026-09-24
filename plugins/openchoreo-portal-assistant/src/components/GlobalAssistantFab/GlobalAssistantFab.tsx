import { useState } from 'react';
import {
  Badge,
  Box,
  Fab,
  Grow,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  fade,
  makeStyles,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import { useAssistantEnabled } from '@openchoreo/backstage-plugin-react';
import { useAssistantDrawer } from '../AssistantContext/AssistantDrawerContext';
import { AssistantBotIcon } from '../AssistantBotIcon/AssistantBotIcon';

// The CTA bubble is a persistent affordance, not a one-time hint: it stays
// until the user explicitly dismisses it (X), so the "click to open chat"
// call-to-action is always visible. Persisted so a dismissal sticks.
const BUBBLE_DISMISSED_KEY = 'openchoreo.assistant.bubbleDismissed';

function readBubbleDismissed(): boolean {
  try {
    return localStorage.getItem(BUBBLE_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function persistBubbleDismissed(): void {
  try {
    localStorage.setItem(BUBBLE_DISMISSED_KEY, '1');
  } catch {
    // localStorage can be unavailable (private mode) — the bubble just returns.
  }
}

const useStyles = makeStyles(theme => ({
  root: {
    position: 'fixed',
    right: theme.spacing(3),
    bottom: theme.spacing(3),
    zIndex: theme.zIndex.snackbar - 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: theme.spacing(1.5),
  },
  // First-run call-to-action bubble above the FAB — the explicit "click to
  // open chat" that an icon-only button can't convey.
  bubble: {
    position: 'relative',
    maxWidth: 280,
    padding: theme.spacing(1.5),
    paddingRight: theme.spacing(3),
    borderRadius: theme.shape.borderRadius * 2,
    boxShadow: theme.shadows[6],
    cursor: 'pointer',
    '&::after': {
      content: '""',
      position: 'absolute',
      right: 30,
      bottom: -7,
      width: 14,
      height: 14,
      backgroundColor: theme.palette.background.paper,
      transform: 'rotate(45deg)',
    },
  },
  bubbleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    marginBottom: theme.spacing(0.5),
  },
  bubbleTitle: { fontWeight: 600, fontSize: 13 },
  bubbleText: {
    fontSize: 13,
    lineHeight: 1.4,
    color: theme.palette.text.secondary,
  },
  bubbleCta: {
    marginTop: theme.spacing(1),
    fontWeight: 600,
    fontSize: 12,
    color: theme.palette.primary.main,
  },
  closeBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    padding: 2,
  },
  fab: {
    textTransform: 'none',
    fontWeight: 600,
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2.5),
    boxShadow: theme.shadows[6],
  },
  fabIcon: { marginRight: theme.spacing(1) },
  // Attention ring while the assistant has never been opened — a soft pulse
  // that stops once the user has seen it.
  fabPulse: {
    animation: '$fabPulse 2.4s ease-in-out infinite',
  },
  '@keyframes fabPulse': {
    '0%': {
      boxShadow: `${theme.shadows[6]}, 0 0 0 0 ${fade(
        theme.palette.primary.main,
        0.45,
      )}`,
    },
    '70%': {
      boxShadow: `${theme.shadows[6]}, 0 0 0 14px ${fade(
        theme.palette.primary.main,
        0,
      )}`,
    },
    '100%': {
      boxShadow: `${theme.shadows[6]}, 0 0 0 0 ${fade(
        theme.palette.primary.main,
        0,
      )}`,
    },
  },
}));

/**
 * Always-on assistant entry point, bottom-right on every page. Rendered as a
 * child of AssistantDrawerProvider rather than a second
 * AppRootWrapperBlueprint, since wrapper nesting order isn't guaranteed.
 *
 * Deliberately a labelled, extended FAB ("Ask AI") rather than an icon-only
 * circle — an unlabelled chat bubble is easy to miss. Until the user opens
 * it once, it also carries a red dot, a soft pulse and a one-time CTA bubble
 * so the entry point is unmistakable. Hidden while the drawer is open, and
 * while a contextual launcher (failed build / build overview) owns the slot.
 */
export const GlobalAssistantFab = () => {
  const classes = useStyles();
  const enabled = useAssistantEnabled();
  const { state, openDrawer, hasUnread, hasContextualLauncher } =
    useAssistantDrawer();
  const [bubbleDismissed, setBubbleDismissed] = useState(readBubbleDismissed);

  if (!enabled || state.isOpen || hasContextualLauncher) return null;

  const showBubble = !bubbleDismissed;

  return (
    <div className={classes.root}>
      <Grow
        in={showBubble}
        style={{ transformOrigin: 'bottom right' }}
        mountOnEnter
        unmountOnExit
      >
        <Paper
          className={classes.bubble}
          elevation={6}
          role="status"
          onClick={() => openDrawer()}
        >
          <IconButton
            size="small"
            className={classes.closeBtn}
            aria-label="Dismiss assistant hint"
            onClick={e => {
              e.stopPropagation();
              setBubbleDismissed(true);
              persistBubbleDismissed();
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          <Box className={classes.bubbleHeader}>
            <AssistantBotIcon color="primary" fontSize="small" />
            <Typography className={classes.bubbleTitle}>
              Portal Assistant
            </Typography>
          </Box>
          <Typography className={classes.bubbleText}>
            Ask me anything about your models, builds and logs.
          </Typography>
          <Typography className={classes.bubbleCta}>
            Click to open chat →
          </Typography>
        </Paper>
      </Grow>
      <Tooltip title="Ask the MLOps Assistant" placement="left">
        <Badge
          color="error"
          variant="dot"
          invisible={!hasUnread}
          overlap="circle"
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Fab
            variant="extended"
            color="primary"
            className={`${classes.fab}${
              hasUnread ? ` ${classes.fabPulse}` : ''
            }`}
            onClick={() => openDrawer()}
            aria-label="Open MLOps Assistant"
          >
            <AssistantBotIcon className={classes.fabIcon} />
            Ask AI
          </Fab>
        </Badge>
      </Tooltip>
    </div>
  );
};
