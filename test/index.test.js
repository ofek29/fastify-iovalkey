'use strict'

const whyIsNodeRunning = require('why-is-node-running')
const { test } = require('node:test')
const proxyquire = require('proxyquire')
const Fastify = require('fastify')
const Valkey = require('iovalkey')
const fastifyValkey = require('..')

test.beforeEach(async () => {
  const fastify = Fastify()

  fastify.register(fastifyValkey, {
    host: '127.0.0.1'
  })

  await fastify.ready()
  await fastify.iovalkey.flushall()
  await fastify.close()
})

test('fastify.iovalkey should exist', async (t) => {
  t.plan(1)
  const fastify = Fastify()
  fastify.register(fastifyValkey, {
    host: '127.0.0.1'
  })

  await fastify.ready()
  t.assert.ok(fastify.iovalkey)

  await fastify.close()
})

test('fastify.iovalkey should support url', async (t) => {
  t.plan(2)
  const fastify = Fastify()

  const fastifyValkey = proxyquire('..', {
    iovalkey: function Valkey (path, options) {
      t.assert.deepStrictEqual(path, 'valkey://127.0.0.1')
      t.assert.deepStrictEqual(options, {
        otherOption: 'foo'
      })
      this.quit = () => {}
      this.info = cb => cb(null, 'info')
      this.on = function (name, handler) {
        if (name === 'ready') {
          handler(null, 'ready')
        }

        return this
      }
      this.status = 'ready'
      this.off = function () { return this }

      return this
    }
  })

  fastify.register(fastifyValkey, {
    url: 'valkey://127.0.0.1',
    otherOption: 'foo'
  })

  await fastify.ready()

  await fastify.close()
})

test('fastify.iovalkey should be the valkey client', async (t) => {
  t.plan(1)
  const fastify = Fastify()

  fastify.register(fastifyValkey, {
    host: '127.0.0.1'
  })

  await fastify.ready()

  await fastify.iovalkey.set('key', 'value')
  const val = await fastify.iovalkey.get('key')
  t.assert.deepStrictEqual(val, 'value')

  await fastify.close()
})

test('fastify.iovalkey.test namespace should exist', async (t) => {
  t.plan(2)

  const fastify = Fastify()
  fastify.register(fastifyValkey, {
    host: '127.0.0.1',
    namespace: 'test'
  })

  await fastify.ready()

  t.assert.ok(fastify.iovalkey)
  t.assert.ok(fastify.iovalkey.test)

  await fastify.close()
})

test('fastify.iovalkey.test should be the valkey client', async (t) => {
  t.plan(1)
  const fastify = Fastify()

  fastify.register(fastifyValkey, {
    host: '127.0.0.1',
    namespace: 'test'
  })

  await fastify.ready()

  await fastify.iovalkey.test.set('key_namespace', 'value_namespace')
  const val = await fastify.iovalkey.test.get('key_namespace')
  t.assert.deepStrictEqual(val, 'value_namespace')

  await fastify.close()
})

test('promises support', async (t) => {
  t.plan(1)
  const fastify = Fastify()

  fastify.register(fastifyValkey, {
    host: '127.0.0.1'
  })

  await fastify.ready()

  await fastify.iovalkey.set('key', 'value')
  const val = await fastify.iovalkey.get('key')
  t.assert.deepStrictEqual(val, 'value')

  await fastify.close()
})

test('custom iovalkey client that is already connected', async (t) => {
  t.plan(3)
  const fastify = Fastify()
  const Valkey = require('iovalkey')
  const valkey = new Valkey({ host: 'localhost', port: 6379 })

  await valkey.set('key', 'value')
  const val = await valkey.get('key')
  t.assert.deepStrictEqual(val, 'value')

  fastify.register(fastifyValkey, {
    client: valkey,
    lazyConnect: false
  })

  await fastify.ready()

  t.assert.deepStrictEqual(fastify.iovalkey, valkey)

  await fastify.iovalkey.set('key2', 'value2')
  const val2 = await fastify.iovalkey.get('key2')
  t.assert.deepStrictEqual(val2, 'value2')

  await fastify.close()
  await fastify.iovalkey.quit()
})

test('If closeClient is enabled, close the client.', async (t) => {
  t.plan(4)
  const fastify = Fastify()
  const Valkey = require('iovalkey')
  const valkey = new Valkey({ host: 'localhost', port: 6379 })

  await valkey.set('key', 'value')
  const val = await valkey.get('key')
  t.assert.deepStrictEqual(val, 'value')

  fastify.register(fastifyValkey, {
    client: valkey,
    closeClient: true
  })

  await fastify.ready()

  t.assert.deepStrictEqual(fastify.iovalkey, valkey)

  await fastify.iovalkey.set('key2', 'value2')
  const val2 = await fastify.iovalkey.get('key2')
  t.assert.deepStrictEqual(val2, 'value2')

  const originalQuit = fastify.iovalkey.quit
  fastify.iovalkey.quit = (callback) => {
    t.assert.ok('valkey client closed')
    originalQuit.call(fastify.iovalkey, callback)
  }

  await fastify.close()
})

test('If closeClient is enabled, close the client namespace.', async (t) => {
  t.plan(4)
  const fastify = Fastify()
  const Valkey = require('iovalkey')
  const valkey = new Valkey({ host: 'localhost', port: 6379 })

  await valkey.set('key', 'value')
  const val = await valkey.get('key')
  t.assert.deepStrictEqual(val, 'value')

  fastify.register(fastifyValkey, {
    client: valkey,
    namespace: 'foo',
    closeClient: true
  })

  await fastify.ready()

  t.assert.deepStrictEqual(fastify.iovalkey.foo, valkey)

  await fastify.iovalkey.foo.set('key2', 'value2')
  const val2 = await fastify.iovalkey.foo.get('key2')
  t.assert.deepStrictEqual(val2, 'value2')

  const originalQuit = fastify.iovalkey.foo.quit
  fastify.iovalkey.foo.quit = (callback) => {
    t.assert.ok('valkey client closed')
    originalQuit.call(fastify.iovalkey.foo, callback)
  }

  await fastify.close()
})

test('fastify.iovalkey.test should throw with duplicate connection namespaces', async (t) => {
  t.plan(1)

  const namespace = 'test'

  const fastify = Fastify()
  t.after(() => fastify.close())

  fastify
    .register(fastifyValkey, {
      host: '127.0.0.1',
      namespace
    })
    .register(fastifyValkey, {
      host: '127.0.0.1',
      namespace
    })

  await t.assert.rejects(fastify.ready(), new Error(`Valkey '${namespace}' instance namespace has already been registered`))
})

test('Should throw when trying to register multiple instances without giving a namespace', async (t) => {
  t.plan(1)

  const fastify = Fastify()
  t.after(() => fastify.close())

  fastify
    .register(fastifyValkey, {
      host: '127.0.0.1'
    })
    .register(fastifyValkey, {
      host: '127.0.0.1'
    })

  await t.assert.rejects(fastify.ready(), new Error('@fastify/valkey has already been registered'))
})

test('Should not throw within different contexts', async (t) => {
  t.plan(1)

  const fastify = Fastify()
  t.after(() => fastify.close())

  fastify.register(function (instance, _options, next) {
    instance.register(fastifyValkey, {
      host: '127.0.0.1'
    })
    next()
  })

  fastify.register(function (instance, _options, next) {
    instance
      .register(fastifyValkey, {
        host: '127.0.0.1',
        namespace: 'test1'
      })
      .register(fastifyValkey, {
        host: '127.0.0.1',
        namespace: 'test2'
      })
    next()
  })

  await fastify.ready()
  t.assert.ok(fastify)
})

// Skipped because it makes TAP crash
test('Should throw when trying to connect on an invalid host', { skip: true }, async (t) => {
  t.plan(1)

  const fastify = Fastify({ pluginTimeout: 20000 })
  t.after(() => fastify.close())

  fastify
    .register(fastifyValkey, {
      host: 'invalid_host'
    })

  await t.assert.rejects(fastify.ready())
})

test('Should successfully create a Valkey client when registered with a `url` option and without a `client` option in a namespaced instance', async t => {
  t.plan(2)

  const fastify = Fastify()
  t.after(() => fastify.close())

  await fastify.register(fastifyValkey, {
    url: 'valkey://127.0.0.1',
    namespace: 'test'
  })

  await fastify.ready()
  t.assert.ok(fastify.iovalkey)
  t.assert.ok(fastify.iovalkey.test)
})

test('Should be able to register multiple namespaced @fastify/valkey instances', async t => {
  t.plan(3)

  const fastify = Fastify()
  t.after(() => fastify.close())

  await fastify.register(fastifyValkey, {
    url: 'valkey://127.0.0.1',
    namespace: 'one'
  })

  await fastify.register(fastifyValkey, {
    url: 'valkey://127.0.0.1',
    namespace: 'two'
  })

  await fastify.ready()
  t.assert.ok(fastify.iovalkey)
  t.assert.ok(fastify.iovalkey.one)
  t.assert.ok(fastify.iovalkey.two)
})

test('Should throw when @fastify/valkey is initialized with an option that makes Valkey throw', async (t) => {
  t.plan(1)

  const fastify = Fastify()
  t.after(() => fastify.close())

  // This will throw a `TypeError: this.options.Connector is not a constructor`
  fastify.register(fastifyValkey, {
    Connector: 'should_fail'
  })

  await t.assert.rejects(fastify.ready())
})

test('Should throw when @fastify/valkey is initialized with a namespace and an option that makes Valkey throw', async (t) => {
  t.plan(1)

  const fastify = Fastify()
  t.after(() => fastify.close())

  // This will throw a `TypeError: this.options.Connector is not a constructor`
  fastify.register(fastifyValkey, {
    Connector: 'should_fail',
    namespace: 'fail'
  })

  await t.assert.rejects(fastify.ready())
})

test('catch .ping() errors', async (t) => {
  t.plan(1)
  const fastify = Fastify()
  t.after(() => fastify.close())

  const fastifyValkey = proxyquire('..', {
    iovalkey: function Valkey () {
      this.ping = () => {
        return Promise.reject(new Valkey.ReplyError('ping error'))
      }
      this.quit = () => {}
      this.info = cb => cb(null, 'info')
      this.on = function () {
        return this
      }
      this.off = function () { return this }

      return this
    }
  })

  fastify.register(fastifyValkey)

  await t.assert.rejects(fastify.ready(), new Valkey.ReplyError('ping error'))
})

setInterval(() => {
  whyIsNodeRunning()
}, 5000).unref()
