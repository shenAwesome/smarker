import _ from 'lodash'
import './css/main.scss'
import './css/print.scss'
import './css/SplitPane.scss'
import { createEditor } from './Editor'
import { Recevier } from './Recevier'

async function main() {
  const receiver = new Recevier
  const container = document.getElementById('root')
  document.addEventListener('contextmenu', evt => evt.preventDefault())
  const home = await receiver.home()
  if (home) {
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
      await save()//save current content
      location.reload()//reload whole page 
    })
  } else {//for testing in browser
    await createEditor(container, "helloWorld")
  }
}

main()
