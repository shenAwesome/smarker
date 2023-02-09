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
  const filePath = home.Args[1] || "D:/temp/test.md"
  let fileContent = await receiver.readFile(filePath)

  const editor = await createEditor(container, fileContent, async (content) => {//onSave
    await receiver.writeFile(filePath, content)
    fileContent = content
  })

  await receiver.setTitle(filePath)
  console.log('ret: ', home)

  receiver.onClose(async () => {
    if (editor.hasChange()) {
      const content = editor.getCode()
      await receiver.writeFile(filePath, content)
    }
    return true
  })
}

main()
