// Linear-time email validation: deterministic hostname labels
// (alnum, optional middle dashes, alnum) so no amount of hostile input
// can trigger exponential backtracking (js/redos).
var EMAIL = /^(?:[\w!#\$%&'\*\+\-\/=\?\^`\{\|\}~]+\.)*[\w!#\$%&'\*\+\-\/=\?\^`\{\|\}~]+@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?|\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\])$/
exports.email = EMAIL
// Linear-time URL validation: no nested unbounded quantifiers, so a
// hostile URL cannot trigger exponential backtracking (js/redos), and
// the port range is bounded to valid TCP ports (js/overly-large-range).
exports.url = /^(?:(?:ht|f)tp(?:s?):\/\/|~\/|\/)?(?:\w+:\w+@)?((?:(?:[-\w\d]+\.)+(?:com|org|net|gov|mil|biz|info|mobi|name|aero|jobs|edu|co\.uk|ac\.uk|it|fr|tv|museum|asia|local|travel|cat|arpa|coop|firm|gob|nato|store|web|xxx|[a-z]{2}))|((\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)(\.(\b25[0-5]\b|\b[2][0-4][0-9]\b|\b[0-1]?[0-9]?[0-9]\b)){3}))(?::(?:6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[0-9]{1,4}))?(?:\/[-\w~!$+|.,=:%]*)*(?:\?[-\w~!$+|.,*:=&%]*)?(?:#[-\w~!$ |\/.,*:;=%]*)?$/i
exports.urlsafe = /^[^&$+,\/:=?@ <>\[\]\{\}\\^~%#]+$/
exports.subdomain = /^([a-z0-9]{1,2}|[a-z0-9][a-z0-9\-]{1,78}[a-z0-9])$/
exports.hexColor = /^#[0-9a-fA-F]{6}$/
exports.names = /^([a-zA-Zа-яА-ЯьъЁЫЭҐЇЄёыэґїєÁÉÍÓÚáéíóúÀÈÌÒÙàèìòùÄËÏÖÜäëïöüÂÊÎÔÛâêîôûÇçÑñ'\-\.\s]){1,100}$/
exports.username = /^\w{4,15}$/
exports.blank = /^\s+$/
exports.password = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?!.*\s).{4,}$/
exports.numeric = /^[0-9]+$/
exports.time = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/
exports.ip = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/
// Comma-separated emails: an explicit 'EMAIL(,EMAIL)*' shape instead of
// the previous '(EMAIL,?)+', which backtracked ambiguously on hostile
// input (js/redos).
var EMAIL_SOURCE = EMAIL.source.slice(1, -1)
exports.emails = new RegExp('^' + EMAIL_SOURCE + '(?:,' + EMAIL_SOURCE + ')*$')
exports.forum = {
  // String, between 1~80 chars, alphanumeric or '-', not starting nor finishing with '-'.
  name: /^([a-zA-Z0-9]{1,2}|[a-zA-Z0-9][a-zA-Z0-9\-]{1,78}[a-zA-Z0-9])$/i
}
