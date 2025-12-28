const { Telegraf, Markup } = require('telegraf')
const { getWaitlist, updateWaitlistStatus } = require('./google')

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
  if (`${process.env.ADMIN_CHAT_ID}`.split(',').map(Number).includes(ctx.chat.id)) {
    const pendingRequests = requests.filter(row => !row.Status)
    const purposes = new Set(requests.map(row => row.Purpose))
    const message = 
`
*Pending Requests*
Tap one of the entries to copy the chat command, then paste it as a message to the bot
${
  [...purposes].sort().map(purpose => `
_${purpose}_
${
  pendingRequests.map((row, index) => ({...row, index})).filter(row => row.Purpose === purpose).map(
    row => `@${row['Telegram Handle']}: ${row.Qty} - \`/choose ${row['Chat ID']}\``
  ).join('\n')
}
`).join('')
}
`
    ctx.reply(message, { parse_mode: 'Markdown' })
  } else {
    // Non-admin user, direct to form
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
  }
})

//
// Commands to start fulfillment workflow
//

bot.command('choose', async (ctx) => {
  if (`${process.env.ADMIN_CHAT_ID}`.split(',').map(Number).includes(ctx.chat.id)) {
    if (!ctx.args.length) {
      ctx.reply('Use /start to find a list of requests to fulfill')
    } else {
      const requests = await getWaitlist()
      const request = requests.filter(row => row['Chat ID'] === `${ctx.args[0]}`).at(0)
      if (request) {
        ctx.reply(
          `Fulfill request of qty ${request.Qty} from @${request['Telegram Handle']} for ${request.Purpose}?`,
          Markup.inlineKeyboard([
            {
              text: 'No ❌',
              callback_data: 'abort',
            },
            {
              text: 'Fulfill 👍',
              callback_data: `fulfill-${request['Chat ID']}`
            },
          ])
        )
      } else {
        ctx.reply(`Invalid request ${ctx.args[0]} specified. Use /start to find a list of requests to fulfill`)
      }
    }
  } else {
    ctx.reply('You are not allowed to use this command')
  }
})

bot.action('abort', (ctx) => {
  ctx.editMessageText(ctx.callbackQuery.message.text + '\n(You replied with: No ❌)')
  ctx.reply('Action aborted. Use /start to find a list of requests to fulfill')
  ctx.answerCbQuery()
})

bot.action(/fulfill-(\d+)/, async (ctx) => {
  const requests = await getWaitlist()
  const chatId = Number(ctx.match[1])
  const request = requests.filter(row => row['Chat ID'] === `${chatId}`).at(0)
  ctx.editMessageText(ctx.callbackQuery.message.text + '\n(You replied with: Fulfill 👍)')
  await updateWaitlistStatus('Pending', request.index)
  bot.telegram.sendMessage(
    chatId, 
    'Hello! we would like to confirm your request.\n' +
    `This is for a qty of ${request.Qty} for ${request.Purpose}.\n` +
    'Please respond with the button below.',
    Markup.inlineKeyboard([
      {
        text: 'Cancel ❌',
        callback_data: `cancel-${chatId}`,
      },
      {
        text: 'Confirm 👍',
        callback_data: `confirm-${chatId}`,
      },
    ]),
  )
  ctx.reply(`Message sent to @${request['Telegram Handle']} for confirmation.`)
  ctx.answerCbQuery()
})

//
// Commands for customer to confirm or cancel the request
//
bot.action(/cancel-(\d+)/, async (ctx) => {
  const requests = await getWaitlist()
  const chatId = Number(ctx.match[1])
  const request = requests.filter(row => row['Chat ID'] === `${chatId}`).at(0)
  await updateWaitlistStatus('Cancelled', request.index)
  ctx.editMessageText(ctx.callbackQuery.message.text + '\n(You replied with: Cancel ❌)')
  ctx.reply("That's okay! Use /start if you ever want to make a new request in future.")
  ctx.answerCbQuery()
})

bot.action(/confirm-(\d+)/, async (ctx) => {
  const requests = await getWaitlist()
  const chatId = Number(ctx.match[1])
  const request = requests.filter(row => row['Chat ID'] === `${chatId}`).at(0)
  await updateWaitlistStatus('Confirmed', request.index)
  ctx.editMessageText(ctx.callbackQuery.message.text + '\n(You replied with: Confirm 👍)')
  ctx.reply('Got it! We will be in touch with further information soon.')
  ctx.answerCbQuery()
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


