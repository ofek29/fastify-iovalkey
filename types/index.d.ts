import { FastifyPluginCallback } from 'fastify'
import { Cluster, Redis as Valkey, RedisOptions as ValkeyOptions } from 'iovalkey'

type FastifyValkeyPluginType = FastifyPluginCallback<fastifyValkey.FastifyValkeyPluginOptions>

declare module 'fastify' {
  interface FastifyInstance {
    iovalkey: fastifyValkey.FastifyValkey;
  }
}

declare namespace fastifyValkey {

  export interface FastifyValkeyNamespacedInstance {
    [namespace: string]: Valkey;
  }

  export type FastifyValkey = FastifyValkeyNamespacedInstance & Valkey

  export type FastifyValkeyPluginOptions = (ValkeyOptions &
  {
    url?: string;
    namespace?: string;
  }) | {
    client: Valkey | Cluster;
    namespace?: string;
    /**
     * @default false
     */
    closeClient?: boolean;
  }
  /*
   * @deprecated Use `FastifyValkeyPluginOptions` instead
   */
  export type FastifyValkeyPlugin = FastifyValkeyPluginOptions
  export const fastifyValkey: FastifyValkeyPluginType
  export { fastifyValkey as default }
}

declare function fastifyValkey (...params: Parameters<FastifyValkeyPluginType>): ReturnType<FastifyValkeyPluginType>
export = fastifyValkey
