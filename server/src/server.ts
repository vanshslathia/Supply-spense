import dns from "node:dns";
import { resolve } from "node:path";

// Atlas SRV DNS lookups fail with the resolver configured on some local networks.
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import dotenv from "dotenv";
dotenv.config({ path: resolve(__dirname, "../.env") });

const PORT = Number(process.env.PORT) || 5000;

const startServer = async (): Promise<void> => {
  try {
    const [appModule, databaseModule] = await Promise.all([
      import("./app.js"),
      import("./config/database.js"),
    ]);
    const app = appModule.app;

    await databaseModule.connectDatabase();

    app.listen(PORT, () => {
      console.log(`SupplySense AI server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

void startServer();
