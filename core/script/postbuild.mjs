import fse from 'fs-extra'
import path from 'path'

const home = process.cwd()
const srcDir = path.join(home, './dist')
const destDir = path.join(home, './../desktop/content')

// To copy a folder or file, select overwrite accordingly
try {
    fse.copySync(srcDir, destDir, { overwrite: true })
    console.log('success!')
} catch (err) {
    console.error(err)
}