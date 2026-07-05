import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { loadEnv } from "./env.js";
import { registerRoutes } from "./routes.js";
import { createSstlRepository } from "./sstl/readonlyRepository.js";
import { createStore } from "./store/appStore.js";

const env = loadEnv();
const app = Fastify({ logger: true });

await app.register(cors, { origin: [env.webOrigin, "http://localhost:5173", "http://127.0.0.1:5173"] });
await app.register(swagger, {
  openapi: {
    info: {
      title: "SSTL AI Platform API",
      description: "Self-evolving AI middle platform for SSTL search arbitrage operations.",
      version: "0.1.0"
    }
  }
});
await app.register(swaggerUi, { routePrefix: "/docs" });

const store = createStore(env.aiDatabaseUrl);
const sstl = createSstlRepository(env);
await registerRoutes(app, { env, store, sstl });

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply.status(500).send({ message: "Internal server error", detail: error.message });
});

await app.listen({ host: env.apiHost, port: env.apiPort });
