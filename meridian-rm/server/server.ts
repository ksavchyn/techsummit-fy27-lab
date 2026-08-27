import { createApp, genie, lakebase, server, serving } from '@databricks/appkit';
import { setupSampleLakebaseRoutes } from './routes/lakebase/todo-routes';

createApp({
  plugins: [
    genie(),
    lakebase(),
    server(),
    serving(),
  ],
  async onPluginsReady(appkit) {
    await setupSampleLakebaseRoutes(appkit);
  },
}).catch(console.error);
