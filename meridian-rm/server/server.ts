import { createApp, genie, lakebase, server, serving } from '@databricks/appkit';
import { setupRetentionRoutes } from './routes/retention/retention-routes';

createApp({
  plugins: [
    genie(),
    lakebase(),
    server(),
    serving({
      endpoints: {
        chat: { env: 'DATABRICKS_SERVING_ENDPOINT_NAME' },
        embeddings: { env: 'DATABRICKS_EMBEDDINGS_ENDPOINT_NAME' },
      },
      timeout: 120000,
    }),
  ],
  async onPluginsReady(appkit) {
    setupRetentionRoutes(appkit);
  },
}).catch(console.error);
