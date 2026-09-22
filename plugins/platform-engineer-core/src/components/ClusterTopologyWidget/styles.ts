import { makeStyles } from '@material-ui/core/styles';
import { lightTokens, darkTokens } from '@openchoreo/backstage-design-system';

export const useStyles = makeStyles(theme => ({
  section: {
    marginBottom: theme.spacing(3),
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: '1rem',
    fontWeight: 600,
    color:
      theme.palette.type === 'dark'
        ? darkTokens.text.secondary
        : lightTokens.text.subtle,
    marginBottom: theme.spacing(2),
  },
  sectionIcon: {
    fontSize: '1.1rem',
    color:
      theme.palette.type === 'dark'
        ? darkTokens.text.verySubtle
        : lightTokens.grey[400],
  },
  columnCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  planeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: theme.spacing(2),
  },
  planeCard: {
    borderRadius: 10,
    padding: theme.spacing(2),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  coLocatedNote: {
    fontSize: '0.7rem',
    fontStyle: 'italic',
    color:
      theme.palette.type === 'dark'
        ? darkTokens.text.verySubtle
        : lightTokens.grey[400],
    marginTop: theme.spacing(1),
  },
  planeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  planeIcon: {
    fontSize: '1.25rem',
    color:
      theme.palette.type === 'dark'
        ? darkTokens.text.secondary
        : lightTokens.text.subtle,
  },
  nodeName: {
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    color:
      theme.palette.type === 'dark'
        ? darkTokens.text.secondary
        : lightTokens.text.subtle,
  },
  taintChip: {
    fontSize: '0.7rem',
    height: 20,
    marginLeft: theme.spacing(1),
  },
  workloadChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1.5),
  },
  workloadChip: {
    fontSize: '0.7rem',
    height: 22,
  },
}));
