import { makeStyles } from '@material-ui/core';
import viettelLogo from './assets/viettel-cloud-logo.png';

const useStyles = makeStyles({
  crop: {
    width: 28,
    height: 28,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
  },
  img: {
    height: 28,
    width: 'auto',
    maxWidth: 'none',
    objectFit: 'cover',
    objectPosition: 'left center',
  },
});

/** Sidebar logo mark shown when the sidebar is collapsed — cropped to the "V" glyph of the Viettel wordmark. */
export const LogoIcon = () => {
  const classes = useStyles();

  return (
    <div className={classes.crop}>
      <img className={classes.img} src={viettelLogo} alt="Viettel" />
    </div>
  );
};
