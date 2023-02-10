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
  //const filePath = home.Args[1] || "D:/temp/test.md" 
  if (home) {
    console.log('ret: ', home)
    const filePath = "D:/temp/test.md"
    const fileContent = await receiver.readFile(filePath)
    const editor = await createEditor(container, fileContent, async (content) => {//onSave
      await receiver.writeFile(filePath, content)
    })
    await receiver.setTitle(filePath)
    receiver.onClose(async () => {
      if (editor.hasChange()) {
        const content = editor.getCode()
        await receiver.writeFile(filePath, content)
      }
      return true
    })
  } else {//testing in browser
    await createEditor(container, "helloWorld")
  }
}

main()
