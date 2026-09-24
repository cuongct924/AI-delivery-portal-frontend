import '@backstage/cli/asset-types';
import ReactDOM from 'react-dom/client';
import { enableMapSet } from 'immer';
import app from './App';
import '@backstage/ui/css/styles.css';
import './buiOverrides.css';

// The scaffolder's task event stream uses useImmerReducer; its draft can
// carry Map/Set values, which immer only handles once this plugin is on.
enableMapSet();

ReactDOM.createRoot(document.getElementById('root')!).render(app);
