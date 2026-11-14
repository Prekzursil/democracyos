/**
 * Module dependencies.
 */

var express = require('express')
var jwt = require('lib/jwt')
var rateLimit = require('express-rate-limit')

// Brute-force protection for the token endpoints (js/missing-rate-limiting)
var tokenLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, delayMs: 0 })
var forgotpassword = require('./lib/forgotpassword')

/**
 * Exports Application
 */

var app = module.exports = express()

/**
 * Define routes for Forgot Password module
 */

app.post('/forgot', function (req, res, next) {
  var meta = {
    ip: req.ip,
    ips: req.ips,
    host: req.get('host'),
    origin: req.get('origin'),
    referer: req.get('referer'),
    ua: req.get('user-agent')
  }

  forgotpassword.createToken(req.body.email, meta, function (err) {
    if (err) {
      // FIXME: horrible hack for #610. Find a final solution and apply.
      if (err.status) {
        // FIXME: needed this special error code for redirection
        return res.status(500).json({ error: err.message, status: err.status })
      } else {
        // FIXME: user just doesn't exist. Not a server error
        return res.status(200).json({ error: err.message })
      }
    }

    return res.status(200).send()
  })
})

app.post('/forgot/verify', tokenLimiter, function (req, res, next) {
  forgotpassword.verifyToken(req.body.token, function (err) {
    if (err) return res.status(500).json({ error: err.message })
    return res.status(200).send()
  })
})

app.post('/forgot/reset', tokenLimiter, function (req, res, next) {
  forgotpassword.resetPassword(req.body, function (err, user) {
    if (err) return res.status(500).json({ error: err.message })
    return jwt.signin(user, req, res)
  })
})
