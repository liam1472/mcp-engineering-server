const _ = require('lodash');

function processData(data) {
  return _.map(data, item => item * 2);
}

module.exports = { processData };
