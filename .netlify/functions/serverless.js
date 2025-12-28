const serverless = require('serverless-http')
const { handler: app } = require('../../app')

const handler = serverless(app)

module.exports = {
  handler,
}
