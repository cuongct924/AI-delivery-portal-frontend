import { Box, Card, Chip, Tooltip, Typography } from '@material-ui/core';
import DeviceHubIcon from '@material-ui/icons/DeviceHub';
import DnsIcon from '@material-ui/icons/Dns';
import { CLUSTER_PLANES } from './data';
import { useStyles } from './styles';

export const ClusterTopologyWidget = () => {
  const classes = useStyles();

  return (
    <Box className={classes.section}>
      <Typography className={classes.sectionTitle}>
        <DeviceHubIcon className={classes.sectionIcon} />
        Cluster Topology ({CLUSTER_PLANES.length})
      </Typography>
      <Box className={classes.planeGrid}>
        {CLUSTER_PLANES.map(plane => (
          <Card variant="outlined" className={classes.planeCard} key={plane.key}>
            <Box className={classes.planeHeader}>
              <DnsIcon className={classes.planeIcon} />
              <Box>
                <Box display="flex" alignItems="center">
                  <Typography variant="h6">{plane.title}</Typography>
                  {plane.tainted && (
                    <Tooltip title={`Tainted — only ${plane.title} workloads schedule here`}>
                      <Chip
                        label="tainted"
                        size="small"
                        className={classes.taintChip}
                      />
                    </Tooltip>
                  )}
                </Box>
                <Typography className={classes.nodeName}>
                  {plane.node}
                </Typography>
                <Typography className={classes.nodeName}>
                  {plane.nodeLabel}
                </Typography>
              </Box>
            </Box>
            <Box className={classes.workloadChips}>
              {plane.workloads.map(workload => (
                <Chip
                  key={workload}
                  label={workload}
                  size="small"
                  variant="outlined"
                  className={classes.workloadChip}
                />
              ))}
            </Box>
            {plane.coLocatedWith && (
              <Typography className={classes.coLocatedNote}>
                Shares its node with {plane.coLocatedWith} — logically
                separate, same physical machine.
              </Typography>
            )}
          </Card>
        ))}
      </Box>
    </Box>
  );
};
