/**
 * `debug` wrapper that strips control characters from every logged
 * string, so user-controlled input cannot forge or corrupt log lines
 * (log forging / js/log-injection).
 *
 * Objects are passed through untouched: they are rendered by the
 * formatter with JSON encoding, which escapes control characters by
 * construction.
 */

var debug = require('debug')

var CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

function safeDebug (namespace) {
  var logger = debug(namespace)

  return function () {
    for (var i = 0; i < arguments.length; i++) {
      var value = arguments[i]
      if (typeof value === 'string') {
        arguments[i] = value.replace(CONTROL_CHARS, ' ')
      }
    }

    logger.apply(logger, arguments)
  }
}

module.exports = safeDebug
