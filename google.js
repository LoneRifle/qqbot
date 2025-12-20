const { JWT } = require('google-auth-library')

const creds = {
  email: process.env.GOOGLE_SERVICE_ACCOUNT,
  key: process.env.GOOGLE_API_KEY,
}

const SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SPREADSHEET_ID}/values/${encodeURIComponent(process.env.GOOGLE_SHEET_NAME)}`

const jwt = new JWT({
  ...creds,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
})


const getWaitlist = async () => {
    const res = await jwt.fetch(`${SHEET_URL}!A:Z`)
    if (!res?.ok) {
      throw new Error(res.statusText)
    }
    
    const rawRows = res?.data?.values ?? []
    const headers = rawRows.shift()

    const rows = rawRows.map((row, rowIndex) => {
      return row.reduce(
        (rowData, item, index) => {
          rowData[headers[index]] = item
          return rowData
        }, 
        { index: rowIndex }
      )
    })

    return rows
}

const updateWaitlistStatus = async (status, index) => {
  // Data starts from the second row onwards
  const row = index + 2

  const headerRes = await jwt.fetch(`${SHEET_URL}!A1:Z1`)
  if (!headerRes?.ok) {
    throw new Error(headerRes.statusText)
  }

  const [headers] = headerRes?.data?.values ?? []

  // 65 is the ASCII char code for A
  // TODO - there is a more robust way to handle columns beyond Z,
  // But we assume for now that most sheets wouldn't be that long
  const column = String.fromCharCode(
    headers.indexOf('Status') + 65
  )

  const res = await jwt.fetch(
    `${SHEET_URL}!${column}${row}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({
        majorDimension: 'ROWS',
        range: `${process.env.GOOGLE_SHEET_NAME}!${column}${row}`,
        values: [
          [status],
        ],
      }),
    }
  )
  if (!res?.ok) {
    throw new Error(res.statusText)
  }
}

module.exports = { 
  getWaitlist, updateWaitlistStatus
}