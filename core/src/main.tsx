import _ from 'lodash'
import './css/main.scss'
import './css/print.scss'
import './css/SplitPane.scss'
import { createEditor } from './Editor'
import { Recevier } from './Recevier'

async function main() {
  const receiver = new Recevier
  const container = document.getElementById('root')
  const home = await receiver.home()
  if (home) {
    console.log('ret: ', home)
    let filePath = home.Args[1]
    const fileContent = await receiver.readFile(filePath)

    const editor = await createEditor(container, fileContent, async (content) => {//onSave
      await receiver.writeFile(filePath, content)
    })
    await receiver.setTitle(filePath)
    async function save() {
      const content = editor.getCode()
      await receiver.writeFile(filePath, content)
    }
    receiver.onClose(async () => {
      if (editor.hasChange()) {
        await save()
      }
      return true
    })
    receiver.addListener("Reload", async (evt) => {
      await save()
      //reload whole page 
      location.reload()
    })
  } else {//testing in browser
    await createEditor(container, "helloWorld")
  }
}

main()
