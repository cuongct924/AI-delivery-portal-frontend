import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { HomePageWidgetBlueprint } from '@backstage/plugin-home-react/alpha';
import { MarkdownContent } from '@backstage/core-components';

const content = `
## AI Delivery Portal

Lớp DevEx & orchestration đặt trên hệ sinh thái AI Platform — Backstage
(Portal) + Orchestration API (FastAPI) + AI Agent/MCP + Adapter layer.

### Golden Paths hiện có

- **[Train, Track & Register](/create/templates/default/train-track-register)** —
  validate dataset, train/fine-tune trên Argo Workflows, track run trong
  MLflow, đăng ký model version và mở PR Catalog entry
- **[Register & Deploy](/create/templates/default/register-deploy)** —
  chạy Evaluate Gate trên model version đã đăng ký, deploy qua
  direct/canary/A-B/blue-green (PR-gated hoặc instant)

### Liên kết nhanh

- [Software Catalog](/) — xem model, pipeline đã đăng ký (chọn Kind = Resource để lọc riêng model)
- [Tạo golden path mới](/create)
- [Prompt Registry](/prompt-registry)
`;

const gettingStartedWidget = HomePageWidgetBlueprint.make({
  name: 'getting-started',
  params: {
    name: 'GettingStarted',
    title: 'Bắt đầu',
    description: 'Mẹo và liên kết giúp bạn bắt đầu sử dụng AI Delivery Portal',
    components: async () => ({
      Content: () => <MarkdownContent content={content} />,
    }),
  },
});

export const homeModule = createFrontendModule({
  pluginId: 'home',
  extensions: [gettingStartedWidget],
});
