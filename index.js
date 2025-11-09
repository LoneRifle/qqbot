const { Telegraf, Markup } = require('telegraf')
const { message } = require('telegraf/filters')

const REDIRECT_TO_START = 'Use /start to make a request'
const makeFormHref = ({ id, username }) =>
    `${process.env.FORM_URL}&entry.${process.env.ENTRY_CHAT_ID}=${id}&entry.${process.env.ENTRY_USERNAME_ID}=${username}`

const bot = new Telegraf(process.env.BOT_TOKEN)
bot.start((ctx) => {
  // TODO - Check if the user is still pending a request
  ctx.reply(
    'Tap below to make a request',
    Markup.inlineKeyboard([
      {
        text: 'Register', 
        url: makeFormHref(ctx.chat),
      },
    ])
  )
})
bot.help((ctx) => ctx.reply(REDIRECT_TO_START))
bot.hears(/.*/, (ctx) => ctx.reply(REDIRECT_TO_START))
bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))

