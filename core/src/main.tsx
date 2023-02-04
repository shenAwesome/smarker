import './css/main.scss'
import './css/SplitPane.scss'
import './css/print.scss'
import { createEditor } from './Editor'

function main() {
  const container = document.getElementById('root')
  createEditor(container, 'hello', code => {
    console.log('code: ', code)
  })
}

main()
