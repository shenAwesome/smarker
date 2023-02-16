import _ from 'lodash'
import './css/main.scss'
import './css/print.scss'
import './css/SplitPane.scss'
import { createEditor } from './Editor'
import { Recevier } from './Recevier'

async function main() {

  const container = document.getElementById('root')
  document.addEventListener('contextmenu', evt => evt.preventDefault())

  const receiver = new Recevier
  if (receiver.isConnected) { //inside webview2
    const home = await receiver.home()
    console.log('ret: ', home)
    let filePath = home.Args[1] || ''
    console.log('filePath: ', filePath)
    const fileContent = filePath ? await receiver.readFile(filePath) : ''

    async function save() {
      const content = editor.getCode()
      filePath = await receiver.writeFile(filePath, content)
      receiver.setTitle(filePath)
    }

    const editor = await createEditor(container, fileContent, save)
    await receiver.setTitle(filePath)

    receiver.onClose(async () => {
      if (editor.hasChange()) {
        await save()
      }
      return true
    })
    receiver.addListener("Reload", async (evt) => {
      console.log('reload')
      await save()//save current content
      location.reload()//reload whole page 
    })

  } else {//inside web browser, for testing
    await createEditor(container, "helloWorld")
  }
}

main()
