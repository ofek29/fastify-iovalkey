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

test('Plugin should decorate instance as fastify.iovalkey', async (t) => {
  t.plan(1)
  const fastify = Fastify()
  fastify.register(fastifyValkey, {
    host: '127.0.0.1'
  })

  await fastify.ready()
  t.assert.ok(fastify.iovalkey)

  await fastify.close()
})

test('Plugin should support url option for iovalkey client', async (t) => {
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

test('fastify.iovalkey should be functional iovalkey client', async (t) => {
  t.plan(1)
  const fastify = Fastify()

  fastify.register(fastifyValkey, {
    host: '127.0.0.1'
  })

  await fastify.ready()

  await fastify.iovalkey.set('functional_client_key', 'functional_client_value')
  const val = await fastify.iovalkey.get('functional_client_key')
  t.assert.strictEqual(val, 'functional_client_value')

  await fastify.close()
})

test('fastify.iovalkey.test namespace should be properly registered', async (t) => {
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

test('fastify.iovalkey.test should be functional namespaced iovalkey client', async (t) => {
  t.plan(1)
  const fastify = Fastify()

  fastify.register(fastifyValkey, {
    host: '127.0.0.1',
    namespace: 'test'
  })

  await fastify.ready()

  await fastify.iovalkey.test.set('namespaced_client_key', 'namespaced_client_value')
  const val = await fastify.iovalkey.test.get('namespaced_client_key')
  t.assert.strictEqual(val, 'namespaced_client_value')

  await fastify.close()
})

test('Plugin should support promises API for iovalkey operations', async (t) => {
  t.plan(1)
  const fastify = Fastify()

  fastify.register(fastifyValkey, {
    host: '127.0.0.1'
  })

  await fastify.ready()

  await fastify.iovalkey.set('promises_api_key', 'promises_api_value')
  const val = await fastify.iovalkey.get('promises_api_key')
  t.assert.strictEqual(val, 'promises_api_value')

  await fastify.close()
})

test('Plugin should accept custom iovalkey client that is already connected', async (t) => {
  t.plan(3)
  const fastify = Fastify()
  const Valkey = require('iovalkey')
  const valkey = new Valkey({ host: 'localhost', port: 6379 })

  await valkey.set('custom_client_key', 'custom_client_value')
  const val = await valkey.get('custom_client_key')
  t.assert.strictEqual(val, 'custom_client_value')

  fastify.register(fastifyValkey, {
    client: valkey,
    lazyConnect: false
  })

  await fastify.ready()

  t.assert.deepStrictEqual(fastify.iovalkey, valkey)

  await fastify.iovalkey.set('custom_client_key2', 'custom_client_value2')
  const val2 = await fastify.iovalkey.get('custom_client_key2')
  t.assert.strictEqual(val2, 'custom_client_value2')

  await fastify.close()
  await fastify.iovalkey.quit()
})

test('Plugin should close the client when closeClient is enabled', async (t) => {
  t.plan(4)
  const fastify = Fastify()
  const Valkey = require('iovalkey')
  const valkey = new Valkey({ host: 'localhost', port: 6379 })

  await valkey.set('close_client_key1', 'close_client_value1')
  const val = await valkey.get('close_client_key1')
  t.assert.strictEqual(val, 'close_client_value1')

  fastify.register(fastifyValkey, {
    client: valkey,
    closeClient: true
  })

  await fastify.ready()

  t.assert.deepStrictEqual(fastify.iovalkey, valkey)

  await fastify.iovalkey.set('close_client_key2', 'close_client_value2')
  const val2 = await fastify.iovalkey.get('close_client_key2')
  t.assert.strictEqual(val2, 'close_client_value2')

  const originalQuit = fastify.iovalkey.quit
  fastify.iovalkey.quit = (callback) => {
    t.assert.ok('valkey client closed')
    originalQuit.call(fastify.iovalkey, callback)
  }

  await fastify.close()
})

test('Plugin should close the client namespace when closeClient is enabled', async (t) => {
  t.plan(4)
  const fastify = Fastify()
  const Valkey = require('iovalkey')
  const valkey = new Valkey({ host: 'localhost', port: 6379 })

  await valkey.set('close_client_namespace_key1', 'close_client_namespace_value1')
  const val = await valkey.get('close_client_namespace_key1')
  t.assert.strictEqual(val, 'close_client_namespace_value1')

  fastify.register(fastifyValkey, {
    client: valkey,
    namespace: 'foo',
    closeClient: true
  })

  await fastify.ready()

  t.assert.deepStrictEqual(fastify.iovalkey.foo, valkey)

  await fastify.iovalkey.foo.set('close_client_namespace_key2', 'close_client_namespace_value2')
  const val2 = await fastify.iovalkey.foo.get('close_client_namespace_key2')
  t.assert.strictEqual(val2, 'close_client_namespace_value2')

  const originalQuit = fastify.iovalkey.foo.quit
  fastify.iovalkey.foo.quit = (callback) => {
    t.assert.ok('valkey client closed')
    originalQuit.call(fastify.iovalkey.foo, callback)
  }

  await fastify.close()
})

test('Plugin should throw with duplicate connection namespaces', async (t) => {
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

test('Should throw when registering multiple instances without namespace', async (t) => {
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

  await t.assert.rejects(fastify.ready(), new Error('@fastify/iovalkey has already been registered'))
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

test('Plugin should create iovalkey client with url option in namespaced instance', async t => {
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

test('Plugin should register multiple namespaced instances successfully', async t => {
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

test('Should throw when @fastify/iovalkey is initialized with an option that makes Valkey throw', async (t) => {
  t.plan(1)

  const fastify = Fastify()
  t.after(() => fastify.close())

  // This will throw a `TypeError: this.options.Connector is not a constructor`
  fastify.register(fastifyValkey, {
    Connector: 'should_fail'
  })

  await t.assert.rejects(fastify.ready())
})

test('Should throw when @fastify/iovalkey is initialized with a namespace and an option that makes Valkey throw', async (t) => {
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

test('Should catch ping errors correctly', async (t) => {
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

test('Should handle ENOTFOUND errors correctly', async (t) => {
  t.plan(1)
  const fastify = Fastify()
  t.after(() => fastify.close())

  const fastifyValkey = proxyquire('..', {
    iovalkey: function Valkey () {
      this.ping = () => {
        const error = new Error('Host not found')
        error.code = 'ENOTFOUND'
        return Promise.reject(error)
      }
      this.quit = () => {}
      this.on = function () {
        return this
      }
      this.off = function () { return this }
      this.status = 'connecting'
      return this
    }
  })

  fastify.register(fastifyValkey)

  const error = new Error('Host not found')
  error.code = 'ENOTFOUND'
  await t.assert.rejects(fastify.ready(), error)
})

setInterval(() => {
  whyIsNodeRunning()
}, 5000).unref()
