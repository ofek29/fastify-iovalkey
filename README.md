# @fastify/iovalkey

Fastify Valkey connection plugin, with this you can share the same Valkey connection in every part of your server.

Under the hood [iovalkey](https://github.com/valkey-io/iovalkey) is used as client.

## Install

```
npm i @fastify/iovalkey
```

### Compatibility
| Plugin version | Fastify version |
| ---------------|-----------------|
| `0.x`        | `^5.x`          |


Please note that if a Fastify version is out of support, then so are the corresponding versions of this plugin
in the table above.
See [Fastify's LTS policy](https://github.com/fastify/fastify/blob/main/docs/Reference/LTS.md) for more details.

## Usage

Add it to your project with `register` and you are done!

### Create a new Valkey Client

the ``options`` that you pass to `register` will be passed to the Valkey client.

```js
import Fastify from 'fastify'
import fastifyValkey from '@fastify/iovalkey'

const fastify = Fastify()

// create by specifying host
await fastify.register(fastifyValkey, { host: '127.0.0.1' })

// OR by specifying Valkey URL
await fastify.register(fastifyValkey, { url: 'valkey://127.0.0.1', /* other valkey options */ })

// OR with more options
await fastify.register(fastifyValkey, {
  host: '127.0.0.1',
  password: '***',
  port: 6379, // Valkey port
  family: 4   // 4 (IPv4) or 6 (IPv6)
})
```

### Accessing the Valkey Client

Once you have registered your plugin, you can access the Valkey client via `fastify.iovalkey`.

The client is automatically closed when the fastify instance is closed.

```js
import Fastify from 'fastify'
import fastifyValkey from '@fastify/iovalkey'

const fastify = Fastify({ logger: true })

await fastify.register(fastifyValkey, {
  host: '127.0.0.1',
  password: 'your strong password here',
  port: 6379, // Valkey port
  family: 4   // 4 (IPv4) or 6 (IPv6)
})

fastify.get('/foo', async (req, reply) => {
  const { iovalkey } = fastify
  try {
    const val = await iovalkey.get(req.query.key)
    return val
  } catch (err) {
    return err
  }
})

fastify.post('/foo', async (req, reply) => {
  const { iovalkey } = fastify
  try {
    await iovalkey.set(req.body.key, req.body.value)
    return { status: 'ok' }
  } catch (err) {
    return err
  }
})

try {
  await fastify.listen({ port: 3000 })
  console.log(`server listening on ${fastify.server.address().port}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
```

### Using an existing Valkey client

You may also supply an existing *Valkey* client instance by passing an options
object with the `client` property set to the instance. In this case,
the client is not automatically closed when the Fastify instance is
closed.

```js
import Fastify from 'fastify'
import Valkey from 'iovalkey'
import fastifyValkey from '@fastify/iovalkey'

const fastify = Fastify()
const client = new Valkey({ host: 'localhost', port: 6379 })

await fastify.register(fastifyValkey, { client })
```

You can also supply a *Valkey Cluster* instance to the client:

```js
import Fastify from 'fastify'
import Valkey from 'iovalkey'
import fastifyValkey from '@fastify/iovalkey'

const fastify = Fastify()
const client = new Valkey.Cluster([{ host: 'localhost', port: 6379 }]);

await fastify.register(fastifyValkey, { client })
```

Note: by default, *@fastify/iovalkey* will **not** automatically close the client
connection when the Fastify server shuts down.

To automatically close the client connection, set clientClose to true.

```js
await fastify.register(fastifyValkey, { client, closeClient: true })
```

## Registering multiple Valkey client instances

By using the `namespace` option you can register multiple Valkey client instances.

```js
import Fastify from 'fastify'
import Valkey from 'iovalkey'
import fastifyValkey from '@fastify/iovalkey'

const fastify = Fastify()
const valkeyClient = new Valkey({ host: 'localhost', port: 6379 })

await fastify.register(fastifyValkey, {
  host: '127.0.0.1',
  port: 6380,
  namespace: 'hello'
})

await fastify.register(fastifyValkey, {
  client: valkeyClient,
  namespace: 'world'
})

// Here we will use the `hello` named instance
fastify.get('/hello', async (req, reply) => {
  const { iovalkey } = fastify
  
  try {
    const val = await iovalkey.hello.get(req.query.key)
    return val
  } catch (err) {
    return err
  }
})

fastify.post('/hello', async (req, reply) => {
  const { iovalkey } = fastify
  
  try {
    await iovalkey['hello'].set(req.body.key, req.body.value)
    return { status: 'ok' }
  } catch (err) {
    return err
  }
})

// Here we will use the `world` named instance
fastify.get('/world', async (req, reply) => {
  const { iovalkey } = fastify
  
  try {
    const val = await iovalkey['world'].get(req.query.key)
    return val
  } catch (err) {
    return err
  }
})

fastify.post('/world', async (req, reply) => {
  const { iovalkey } = fastify
  
  try {
    await iovalkey.world.set(req.body.key, req.body.value)
    return { status: 'ok' }
  } catch (err) {
    return err
  }
})

try {
  await fastify.listen({ port: 3000 })
  console.log(`server listening on ${fastify.server.address().port}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
```

## Valkey streams (Valkey 5.0 or greater is required)

`@fastify/iovalkey` supports Valkey streams out of the box.

```js
import Fastify from 'fastify'
import fastifyValkey from '@fastify/iovalkey'

const fastify = Fastify()

await fastify.register(fastifyValkey, {
  host: '127.0.0.1',
  port: 6380
})

fastify.get('/streams', async (request, reply) => {
  // We write an event to the stream 'my awesome fastify stream name', setting 'key' to 'value'
  await fastify.iovalkey.xadd(['my awesome fastify stream name', '*', 'hello', 'fastify is awesome'])

  // We read events from the beginning of the stream called 'my awesome fastify stream name'
  let valkeyStream = await fastify.iovalkey.xread(['STREAMS', 'my awesome fastify stream name', 0])

  // We parse the results
  let response = []
  let events = valkeyStream[0][1]

  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    response.push(`#LOG: id is ${e[0].toString()}`)

    // We log each key
    for (const key in e[1]) {
      response.push(e[1][key].toString())
    }
  }

  return { output: response }
  // Will return something like this :
  // { "output": ["#LOG: id is 1559985742035-0", "hello", "fastify is awesome"] }
})

try {
  await fastify.listen({ port: 3000 })
  console.log(`server listening on ${fastify.server.address().port}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
```
*NB you can find more information about Valkey streams and the relevant commands [here](https://valkey.io/topics/streams-intro/) end [here](https://valkey.io/commands/#stream).*

## Valkey connection error
The majority of errors are silent due to the `iovalkey` silent error handling but during the plugin registration it will check that the connection with the valkey instance is correctly established.
In this case, you can receive an `ERR_AVVIO_PLUGIN_TIMEOUT` error if the connection cannot be established in the expected time frame or a dedicated error for an invalid connection.


## License

Licensed under [MIT](./LICENSE).