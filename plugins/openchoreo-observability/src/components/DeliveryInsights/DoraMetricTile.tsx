import { Box, Card, CardContent, Chip, Typography } from '@material-ui/core';
import { ToggleButton, ToggleButtonGroup } from '@material-ui/lab';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import { DoraClassification } from '../../types';
import {
  classificationColors,
  deltaColor,
  DEVOPS_ACCENT_COLOR,
  MixSlice,
  MLOPS_ACCENT_COLOR,
} from './utils';

const SPARK_W = 84;
const SPARK_H = 30;
const MONO_FONT_STACK =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const useStyles = makeStyles(theme => ({
  card: {
    height: '100%',
    borderRadius: 12,
    overflow: 'visible',
  },
  badgeCard: {
    borderColor: theme.palette.warning.main,
  },
  badgeRibbon: {
    position: 'absolute',
    top: -9,
    left: 14,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    background: theme.palette.warning.main,
    color: theme.palette.getContrastText(theme.palette.warning.main),
    padding: '2px 7px',
    borderRadius: 100,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  title: {
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },
  value: {
    fontWeight: 700,
    marginTop: theme.spacing(1),
    fontFamily: MONO_FONT_STACK,
    fontVariantNumeric: 'tabular-nums',
  },
  chip: {
    fontWeight: 600,
    height: 22,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
    minHeight: 20,
  },
  // Keeps the footer text clear of the absolutely-positioned corner sparkline.
  footerWithSpark: {
    paddingRight: SPARK_W + 16,
  },
  delta: {
    display: 'flex',
    alignItems: 'center',
    fontWeight: 500,
  },
  deltaIcon: {
    fontSize: 14,
  },
  subText: {
    color: theme.palette.text.secondary,
    minHeight: theme.spacing(3.5),
  },
  lensToggle: {
    marginTop: theme.spacing(1),
    height: 26,
    background: theme.palette.action.hover,
    borderRadius: 8,
    padding: 2,
    '& .MuiToggleButtonGroup-groupedHorizontal:not(:first-child)': {
      borderLeft: 'none',
      marginLeft: 0,
    },
  },
  lensButton: {
    fontSize: 10.5,
    fontWeight: 700,
    padding: '2px 9px',
    textTransform: 'none',
    border: 'none',
    borderRadius: '6px !important',
    color: theme.palette.text.secondary,
  },
  mixBar: {
    display: 'flex',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: theme.spacing(1.25),
    background: theme.palette.action.hover,
  },
  mixLegend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
  },
  mixLegendItem: {
    display: 'flex',
    alignItems: 'center',
    fontSize: 10.5,
    color: theme.palette.text.secondary,
  },
  mixDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
    marginRight: 4,
  },
}));

export interface DoraMetricTileProps {
  title: string;
  /** Pre-formatted headline value (e.g. "1.14/day", "5.7h", "7.3%"). */
  value: string;
  classification: DoraClassification;
  /** Change vs the previous window (%); null hides the delta. */
  deltaPct: number | null;
  /** Whether an increase in this metric is an improvement (colors the delta). */
  positiveDeltaIsGood: boolean;
  /** Secondary line, e.g. "302 deployments" or "96% commit coverage". */
  subText?: string;
  /** Per-bucket values rendered as a small sparkline in the tile corner. */
  sparkData?: number[];
  /** ML/LLM callout beside the classification chip, e.g. "drift-driven cadence". */
  secondaryBadge?: { label: string; tone: 'info' | 'warning' };
  lens?: {
    active: 'devops' | 'mlops';
    locked: boolean;
    onChange: (lens: 'devops' | 'mlops') => void;
  };
  breakdown?: MixSlice[];
  badge?: string;
}

const Sparkline = ({ data }: { data: number[] }) => {
  const theme = useTheme();
  if (data.length < 2) {
    return null;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * SPARK_W;
      const y = SPARK_H - 3 - ((v - min) / range) * (SPARK_H - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      aria-hidden
      style={{ position: 'absolute', right: 12, bottom: 10, opacity: 0.85 }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={theme.palette.primary.main}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const DoraMetricTile = ({
  title,
  value,
  classification,
  deltaPct,
  positiveDeltaIsGood,
  subText,
  sparkData,
  secondaryBadge,
  lens,
  breakdown,
  badge,
}: DoraMetricTileProps) => {
  const classes = useStyles();
  const theme = useTheme();
  const colors = classificationColors(theme)[classification];

  const deltaIsImprovement =
    deltaPct !== null && deltaPct >= 0 === positiveDeltaIsGood;
  const deltaTextColor = deltaColor(theme, deltaIsImprovement);

  return (
    <Card
      className={`${classes.card} ${badge ? classes.badgeCard : ''}`}
      variant="outlined"
      style={{ position: 'relative' }}
    >
      {badge && <Box className={classes.badgeRibbon}>{badge}</Box>}
      {sparkData && <Sparkline data={sparkData} />}
      <CardContent>
        <Box className={classes.header}>
          <Typography variant="body2" className={classes.title}>
            {title}
          </Typography>
          <Box style={{ display: 'flex', gap: theme.spacing(0.5) }}>
            {secondaryBadge && (
              <Chip
                size="small"
                label={secondaryBadge.label}
                className={classes.chip}
                style={{
                  backgroundColor: theme.palette[secondaryBadge.tone].light,
                  color: theme.palette[secondaryBadge.tone].dark,
                }}
              />
            )}
            <Chip
              size="small"
              label={classification}
              className={classes.chip}
              style={{ backgroundColor: colors.background, color: colors.text }}
            />
          </Box>
        </Box>
        {lens && (
          <ToggleButtonGroup
            size="small"
            exclusive
            value={lens.active}
            className={classes.lensToggle}
            onChange={(_, next) => {
              if (next && !lens.locked) {
                lens.onChange(next);
              }
            }}
          >
            <ToggleButton
              value="devops"
              disabled={lens.locked}
              className={classes.lensButton}
              style={
                lens.active === 'devops'
                  ? { background: `${DEVOPS_ACCENT_COLOR}22`, color: DEVOPS_ACCENT_COLOR }
                  : undefined
              }
            >
              DevOps
            </ToggleButton>
            <ToggleButton
              value="mlops"
              disabled={lens.locked}
              className={classes.lensButton}
              style={
                lens.active === 'mlops'
                  ? { background: `${MLOPS_ACCENT_COLOR}22`, color: MLOPS_ACCENT_COLOR }
                  : undefined
              }
            >
              MLOps/LLMOps
            </ToggleButton>
          </ToggleButtonGroup>
        )}
        <Typography variant="h4" className={classes.value}>
          {value}
        </Typography>
        <Box
          className={`${classes.footer} ${
            sparkData ? classes.footerWithSpark : ''
          }`}
        >
          {deltaPct !== null && deltaPct !== 0 && (
            <Typography
              variant="caption"
              className={classes.delta}
              style={{ color: deltaTextColor }}
            >
              {deltaPct > 0 ? (
                <ArrowUpwardIcon className={classes.deltaIcon} />
              ) : (
                <ArrowDownwardIcon className={classes.deltaIcon} />
              )}
              {Math.abs(deltaPct).toFixed(1)}%
            </Typography>
          )}
          {subText && (
            <Typography variant="caption" className={classes.subText}>
              {subText}
            </Typography>
          )}
        </Box>
        {breakdown && breakdown.length > 0 && (
          <>
            <Box className={classes.mixBar}>
              {breakdown.map(slice => (
                <Box
                  key={slice.key}
                  style={{ width: `${slice.pct}%`, background: slice.color }}
                />
              ))}
            </Box>
            <Box className={classes.mixLegend}>
              {breakdown.map(slice => (
                <Box key={slice.key} className={classes.mixLegendItem}>
                  <Box
                    className={classes.mixDot}
                    style={{ background: slice.color }}
                  />
                  {slice.label} {slice.pct}%
                </Box>
              ))}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};
