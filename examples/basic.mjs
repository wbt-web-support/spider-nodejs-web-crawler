// npm i @spider-rs/spider-rs
// node basic.mjs
import { Website } from '../index.js'

const url = process.argv[2] || 'https://fortiswindows.co.uk'


const website = new Website(url).withBudget({ '*': 300, licenses: 0 })

const onPageEvent = (_err, value) => {
  console.log(`Found: ${value.url}`)
  console.log(`HTML Content Length: ${value.content ? value.content.length : 0} characters`)
  console.log(`Status Code: ${value.status_code}`)
  console.log(`Title: ${value.title()}`)
  
  // Show first 200 characters of HTML content
  if (value.content) {
    console.log(`HTML Preview: ${value.content.substring(0, 200)}...`)
  }
  console.log('---')
}

const startTime = performance.now()

await website.crawl(onPageEvent)

const duration = performance.now() - startTime

// Get all pages to show detailed summary
const allPages = website.getPages()
const totalHtmlLength = allPages.reduce((sum, page) => sum + (page.content ? page.content.length : 0), 0)

console.log('Finished', url)
console.log(`Pages found: ${website.getLinks().length}`)
console.log(`Total HTML content: ${totalHtmlLength} characters`)
console.log(`Average HTML per page: ${allPages.length > 0 ? Math.round(totalHtmlLength / allPages.length) : 0} characters`)
console.log(`Elapsed duration: ${Math.round(duration)}ms`)
