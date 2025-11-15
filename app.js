const { Telegraf, Markup } = require('telegraf')
const { getWaitlist } = require('./google')

const REDIRECT_TO_START = 'Use /start to make a request'

const REDIRECT_ENDPOINT = '/redirects/form'

const makeFormRedirect = ({ chat, message }) => 
    `${process.env.HOST}${REDIRECT_ENDPOINT}?messageId=${message.message_id}&chatId=${chat.id}&username=${chat.username}`

const makeFormHref = ({ id, username }) =>
    `${process.env.FORM_URL}&entry.${process.env.ENTRY_CHAT_ID}=${id}&entry.${process.env.ENTRY_USERNAME_ID}=${username}`

const bot = new Telegraf(process.env.BOT_TOKEN)
bot.start(async (ctx) => {
  // Check if the user is still pending a request
  const requests = await getWaitlist()
  const requestsFromUser = requests.filter(row => row['Chat ID'] === `${ctx.chat.id}`)
  if (requestsFromUser.some(r => !['Delivered', 'Cancelled'].includes(r.Status))) {
    ctx.reply('You still have a request that has not been completed!\nPlease wait before making a new one.')
  } else {
    ctx.reply(
      'Tap below to make a request',
      Markup.inlineKeyboard([
        {
          text: 'Request', 
          url: makeFormRedirect(ctx),
        },
      ])
    )
  }
})
bot.help((ctx) => ctx.reply(REDIRECT_TO_START))
bot.hears(/.*/, (ctx) => ctx.reply(REDIRECT_TO_START))
const botWebhookPromise = bot.createWebhook({ domain: process.env.HOST })

const handler = (req, res) => {
  // Parse req.url into something structured
  const parsedUrl = new URL(`${req.protocol}://${req.host}${req.url}`)
  switch (parsedUrl.pathname) {
    case REDIRECT_ENDPOINT:
      const { chatId: id, username, messageId } = Object.fromEntries(
        [...parsedUrl.searchParams.entries()]
          .map(
            ([k,v]) => [k, !Number.isNaN(Number(v)) ? Number(v) : v ]
          )
      )
      
      // messageId will be pointing to the message sent by the user.
      // Increment by one to point to the Google Form message
      bot.telegram.deleteMessage(id, messageId + 1)
      bot.telegram.sendMessage(id, "Thanks for making the request!")
      res.writeHead(302, { 'Location': makeFormHref({ id, username }) });
      res.end();
      break;
    default:
      botWebhookPromise.then((callback) => callback(req, res))
  }
}

module.exports = {
  handler, bot
}


