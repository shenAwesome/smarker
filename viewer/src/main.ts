import './main.scss'
import $ from "cash-dom"
import { MdEngine } from './engine/MdEngine'

async function main() {
    const searchParams = new URLSearchParams(window.location.search)
    const file = searchParams.get('file') || 'test.md'
    const code = await (await fetch(file)).text()
    console.log('code: ', code)
    if (code) {
        const engine = await (new MdEngine()).init()
        const html = engine.render(code)
        $('.markdown-body').html(html)
        document.title = file
    } else {
        $('.markdown-body').html(`Can not open: ${file}`).addClass('error')
    }

}

$(main)