const { JWT } = require('google-auth-library')

const creds = {
  email: process.env.GOOGLE_SERVICE_ACCOUNT,
  key: process.env.GOOGLE_API_KEY,
}

const jwt = new JWT({
  ...creds,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
})


const getWaitlist = async () => {
    const res = await jwt.fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SPREADSHEET_ID}/values/${encodeURIComponent(process.env.GOOGLE_SHEET_NAME)}!A:Z`)
    if (!res?.ok) {
      throw new Error(res.statusText)
    }
    
    const rawRows = res?.data?.values ?? []
    const headers = rawRows.shift()

    const rows = rawRows.map((row) => {
      return row.reduce(
        (rowData, item, index) => {
          rowData[headers[index]] = item
          return rowData
        }, 
        {}
      )
    })

    return rows
}

module.exports = { 
  getWaitlist,
}