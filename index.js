const { handler } = require('./app')
const { createServer } = require('http')

const server = createServer(handler)
server.listen(process.env.PORT ?? 8000)
