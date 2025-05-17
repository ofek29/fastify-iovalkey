'use strict'

const fp = require('fastify-plugin')
const Valkey = require('iovalkey')

function fastifyValkey (fastify, options, next) {
  const { namespace, url, closeClient = false, ...valkeyOptions } = options

  let client = options.client || null

  if (namespace) {
    if (!fastify.iovalkey) {
      fastify.decorate('iovalkey', Object.create(null))
    }
    if (fastify.iovalkey[namespace]) {
      return next(new Error(`Valkey '${namespace}' instance namespace has already been registered`))
    }

    const closeNamedInstance = (fastify) => fastify.iovalkey[namespace].quit()

    client = setupClient(fastify, client, url, closeClient, valkeyOptions, closeNamedInstance)

    fastify.iovalkey[namespace] = client
  } else {
    if (fastify.iovalkey) {
      return next(new Error('@fastify/valkey has already been registered'))
    }

    const close = (fastify) => { fastify.iovalkey.quit() }

    client = setupClient(fastify, client, url, closeClient, valkeyOptions, close)

    fastify.decorate('iovalkey', client)
  }

  function setupClient (fastify, client, url, closeClient, valkeyOptions, closeInstance) {
    if (client) {
      if (closeClient === true) {
        fastify.addHook('onClose', closeInstance)
      }
    } else {
      try {
        if (url) {
          client = new Valkey(url, valkeyOptions)
        } else {
          client = new Valkey(valkeyOptions)
        }
      } catch (err) {
        return next(err)
      }

      fastify.addHook('onClose', closeInstance)
    }
    return client
  }

  const onEnd = function (err) {
    client
      .off('ready', onReady)
      .off('error', onError)
      .off('end', onEnd)
      .quit()

    next(err)
  }

  const onReady = function () {
    client
      .off('end', onEnd)
      .off('error', onError)
      .off('ready', onReady)

    next()
  }

  const onError = function (err) {
    if (err.code === 'ENOTFOUND') {
      onEnd(err)
      return
    }

    // Swallow network errors to allow iovalkey
    // to perform reconnection and emit 'end'
    // event if reconnection eventually
    // fails.
    // Any other errors during startup will
    // trigger the 'end' event.
    if (err instanceof Valkey.ReplyError) {
      onEnd(err)
    }
  }

  // iovalkey provides it in a .status property
  if (client && client.status === 'ready') {
    // client is already connected, do not register event handlers
    // call next() directly to avoid ERR_AVVIO_PLUGIN_TIMEOUT
    next()
  } else if (client) {
    // ready event can still be emitted
    client
      .on('end', onEnd)
      .on('error', onError)
      .on('ready', onReady)

    client.ping().catch(onError)
  }
}

module.exports = fp(fastifyValkey, {
  fastify: '5.x',
  name: '@fastify/iovalkey'
})
module.exports.default = fastifyValkey
module.exports.fastifyValkey = fastifyValkey
