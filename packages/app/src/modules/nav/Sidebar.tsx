import {
  Sidebar,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarScrollWrapper,
  SidebarSpace,
  ChatIcon,
} from '@backstage/core-components';
import { NavContentBlueprint } from '@backstage/plugin-app-react';
import { SidebarLogo } from './SidebarLogo';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { SidebarSearchModal } from '@backstage/plugin-search';
import { UserSettingsSignInAvatar } from '@backstage/plugin-user-settings';
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';

// Same convention as examples/templates/*/template.yaml's output.links —
// hardcode the local gateway URL rather than adding a new app-config.yaml
// key (matches .env's LITELLM_GATEWAY_URL). LiteLLM's own bundled admin UI
// (key/budget management) lives at /ui on the proxy itself — no need to
// re-implement it as a Backstage plugin (see App.tsx's removed
// convertedLitellmPlugin).
const LITELLM_UI_URL = 'http://localhost:4000/ui';

export const SidebarContent = NavContentBlueprint.make({
  params: {
    component: ({ navItems }) => {
      const nav = navItems.withComponent(item => (
        <SidebarItem icon={() => item.icon} to={item.href} text={item.title} />
      ));

      // Skipped items
      nav.take('page:search'); // Using search modal instead
      nav.take('page:notifications'); // Using NotificationsSidebarItem manually instead
      // Superseded by Catalog (kind: Resource, type: ml-model) — pick
      // Kind=Resource from the Catalog page's own filter instead of a
      // separate dashboard nav entry (same reasoning as page:prompt-registry
      // and page:catalog-import below).
      nav.take('page:mlops-dashboard');
      // Superseded by Catalog (kind: Resource, type: prompt) — each prompt
      // is a real entity now (see examples/entities.yaml), so it belongs
      // in the same Catalog table/filters as everything else instead of a
      // hand-rolled list page with no owner/relations columns.
      nav.take('page:prompt-registry');
      // "Register existing component" is Backstage's own Catalog Import
      // flow — reachable from Catalog's own "+ Create" button, doesn't
      // need a second top-level entry point competing with it.
      nav.take('page:catalog-import');
      // page:mcp-chat is NOT taken here — it's placed explicitly inside
      // the "GenAI tools" SidebarGroup below instead of the general list.

      return (
        <Sidebar>
          <SidebarLogo />
          <SidebarGroup label="Tìm kiếm" icon={<SearchIcon />} to="/search">
            <SidebarSearchModal />
          </SidebarGroup>
          <SidebarGroup label="Trình đơn" icon={<MenuIcon />}>
            {nav.take('page:home')}
            {nav.take('page:catalog')}
            {nav.take('page:scaffolder')}
          </SidebarGroup>
          <SidebarScrollWrapper>
            {nav.rest({ sortBy: 'title' })}
          </SidebarScrollWrapper>
          <SidebarDivider />
          <SidebarGroup label="GenAI tools" icon={<ChatIcon />}>
            {nav.take('page:mcp-chat')}
            <SidebarItem
              icon={OpenInNewIcon}
              to={LITELLM_UI_URL}
              text="LiteLLM Admin"
            />
          </SidebarGroup>
          <SidebarSpace />
          <NotificationsSidebarItem />
          <SidebarGroup
            label="Cài đặt"
            icon={<UserSettingsSignInAvatar />}
            to="/settings"
          >
            {nav.take('page:app-visualizer')}
            {nav.take('page:user-settings')}
          </SidebarGroup>
        </Sidebar>
      );
    },
  },
});
