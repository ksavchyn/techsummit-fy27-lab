import { createApp, genie, lakebase, server, serving } from '@databricks/appkit';
import { setupRetentionRoutes } from './routes/retention/retention-routes';

createApp({
  plugins: [genie(), lakebase(), server(), serving()],
  async onPluginsReady(appkit) {
    setupRetentionRoutes(appkit);
  },
}).catch(console.error);
