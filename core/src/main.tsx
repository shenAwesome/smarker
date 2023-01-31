import './css/main.scss'
import './css/SplitPane.scss'
import './css/print.scss'
import { createEditor } from './Editor'

async function main() {
  const container = document.getElementById('root')
  await createEditor(container)
}

main()
