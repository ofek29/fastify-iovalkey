import Fastify, { FastifyInstance } from 'fastify'
import IOValkey, { Redis as Valkey } from 'iovalkey'
import { expectAssignable, expectDeprecated, expectError, expectType } from 'tsd'
import fastifyValkey, { FastifyValkey, FastifyValkeyPlugin, FastifyValkeyNamespacedInstance, FastifyValkeyPluginOptions } from '..'

const app: FastifyInstance = Fastify()
const valkey: Valkey = new IOValkey({ host: 'localhost', port: 6379 })
const valkeyCluster = new IOValkey.Cluster([{ host: 'localhost', port: 6379 }])

app.register(fastifyValkey, { host: '127.0.0.1' })

app.register(fastifyValkey, {
  client: valkey,
  closeClient: true,
  namespace: 'one'
})

app.register(fastifyValkey, {
  namespace: 'two',
  url: 'valkey://127.0.0.1:6379'
})

expectAssignable<FastifyValkeyPluginOptions>({
  client: valkeyCluster
})

expectError(app.register(fastifyValkey, {
  namespace: 'three',
  unknownOption: 'this should trigger a typescript error'
}))

// Plugin property available
app.after(() => {
  expectAssignable<Valkey>(app.iovalkey)
  expectType<FastifyValkey>(app.iovalkey)

  expectAssignable<FastifyValkeyNamespacedInstance>(app.iovalkey)
  expectType<Valkey>(app.iovalkey.one)
  expectType<Valkey>(app.iovalkey.two)
})

expectDeprecated({} as FastifyValkeyPlugin)
