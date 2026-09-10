import { ApiBlueprint, createFrontendModule } from '@backstage/frontend-plugin-api';
import {
  SignInPageBlueprint,
  type SignInPageProps,
} from '@backstage/plugin-app-react';
import {
  createApiRef,
  createApiFactory,
  discoveryApiRef,
  oauthRequestApiRef,
  configApiRef,
} from '@backstage/core-plugin-api';
import { OAuth2 } from '@backstage/core-app-api';
import { SignInPage } from '@backstage/core-components';

/**
 * Generic OAuth2 client for the `openchoreo-auth` backend provider
 * (registered by @openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth,
 * pointed at Thunder — see app-config.local.yaml's auth.providers.openchoreo-auth).
 * Needed because the OpenChoreo plugins don't ship a frontend sign-in button
 * themselves — this is the standard Backstage "add a custom auth provider"
 * pattern.
 */
export const openchoreoAuthApiRef = createApiRef<OAuth2>({
  id: 'auth.openchoreo',
});

const openchoreoAuthApi = ApiBlueprint.make({
  name: 'openchoreo-auth',
  params: define =>
    define(
      createApiFactory({
        api: openchoreoAuthApiRef,
        deps: {
          discoveryApi: discoveryApiRef,
          oauthRequestApi: oauthRequestApiRef,
          configApi: configApiRef,
        },
        factory: ({ discoveryApi, oauthRequestApi, configApi }) =>
          OAuth2.create({
            discoveryApi,
            oauthRequestApi,
            provider: { id: 'openchoreo-auth', title: 'OpenChoreo', icon: () => null },
            environment: configApi.getOptionalString('auth.environment'),
            defaultScopes: ['openid', 'profile', 'email'],
          }),
      }),
    ),
});

const openchoreoSignInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => (props: SignInPageProps) => (
      <SignInPage
        {...props}
        providers={[
          {
            id: 'openchoreo-auth',
            title: 'OpenChoreo',
            message:
              'Đăng nhập qua OpenChoreo (Thunder) để xem Deploy/Cell Diagram với dữ liệu control plane thật.',
            apiRef: openchoreoAuthApiRef,
          },
          'guest',
        ]}
        title="AI Delivery Portal"
        align="center"
      />
    ),
  },
});

export const openchoreoAuthModule = createFrontendModule({
  pluginId: 'app',
  extensions: [openchoreoAuthApi, openchoreoSignInPage],
});
