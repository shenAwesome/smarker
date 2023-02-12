import fse from 'fs-extra'
import path from 'path'


function copy(from, to) {
    const home = process.cwd()
    const srcDir = path.join(home, from)
    const destDir = path.join(home, to)
    try {
        fse.copySync(srcDir, destDir, { overwrite: true })
        console.log('success!')
    } catch (err) {
        console.error(err)
    }
}

copy('./dist', './../desktop/content')
copy('./dist', './../desktop/bin/Debug/content')
