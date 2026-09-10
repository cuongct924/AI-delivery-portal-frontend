import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { FormFieldBlueprint, createFormField } from '@backstage/plugin-scaffolder-react/alpha';
import { StepLayout } from './StepLayoutField';

const stepLayoutField = FormFieldBlueprint.make({
  params: {
    field: async () =>
      createFormField({
        name: 'StepLayout',
        component: StepLayout,
      }),
  },
});

export const stepLayoutFieldModule = createFrontendModule({
  pluginId: 'scaffolder',
  extensions: [stepLayoutField],
});
