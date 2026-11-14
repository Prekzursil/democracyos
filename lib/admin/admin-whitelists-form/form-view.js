/**
 * Module dependencies.
 */

import page from 'page'
import t from 't-component'
import FormView from '../../form-view/form-view.js'
import request from '../../request/request.js'
import whitelists from '../../whitelists/whitelists.js'
import template from './template.jade'

/**
 * Creates a password edit view
 */

export default class WhitelistForm extends FormView {
  constructor (whitelist) {
    // Options must be computed before super() (ES classes forbid using
    // `this` first), and the parent constructor is invoked exactly once
    // via super() instead of the illegal FormView.call(this, ...) form.
    const options = WhitelistForm.buildOptions(whitelist)
    super(template, options)
    this.whitelist = whitelist
    this.action = options.form.action
    this.title = options.form.title
  }

  static buildOptions (whitelist) {
    let action = '/api/whitelists/'
    let title
    if (whitelist) {
      action += whitelist.id
      title = 'admin-whitelists-form.title.edit'
    } else {
      action += 'create'
      title = 'admin-whitelists-form.title.create'
    }

    return {
      form: { title: title, action: action },
      whitelist: whitelist || { new: true }
    }
  }

  switchOn () {
    this.on('success', this.bound('onsuccess'))
    this.bind('click', '.btn-delete', this.bound('ondelete'))
  }

  /**
   * Handle `success` event
   *
   * @api private
   */

  onsuccess (res) {
    whitelists.fetch()
    whitelists.ready(this.bound('onsave'))
  }

  onsave () {
    this.messages([t('admin-whitelists-form.message.onsuccess')])
  }

  ondelete () {
    request
      .del('/api/whitelists/:id'.replace(':id', this.whitelist.id))
      .end(function (err, res) {
        if (err || !res.ok) {
          this.errors([err || res.text])
        }

        whitelists.fetch()
        page('/admin/users')
      })
  }
}
