const { Telegraf, Markup } = require('telegraf')
const { getWaitlist } = require('./google')

const REDIRECT_TO_START = 'Use /start to make a request'
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
          url: makeFormHref(ctx.chat),
        },
      ])
    )
  }
})
bot.help((ctx) => ctx.reply(REDIRECT_TO_START))
bot.hears(/.*/, (ctx) => ctx.reply(REDIRECT_TO_START))
bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

