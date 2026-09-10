import { makeStyles } from '@material-ui/core';
import viettelLogo from './assets/viettel-cloud-logo.png';

const useStyles = makeStyles({
  img: {
    height: 30,
    width: 'auto',
  },
});

/** Full Viettel wordmark shown when the sidebar is expanded. */
export const LogoFull = () => {
  const classes = useStyles();

  return <img className={classes.img} src={viettelLogo} alt="Viettel" />;
};
