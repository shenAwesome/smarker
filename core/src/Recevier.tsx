import _ from 'lodash'
import './css/main.scss'
import './css/print.scss'
import './css/SplitPane.scss'


function sleep(timeout: number) {
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, timeout)
  })
}

interface FormEvent {
  type: string
  payload: any
}

const webview = (window as any)?.chrome?.webview
if (webview) webview.addEventListener('message', (evt: any) => {
  if ((window as any)['onWebViewMessage']) {
    (window as any)['onWebViewMessage'](evt)
  }
})

class Recevier {
  private listeners = [] as Listener[]
  private timeout = 5 //sec
  private pool = [] as Request[]

  constructor() {
    if (!webview) return
    const { pool } = this

    const onWebViewMessage = (evt: any) => {
      if (evt.data?._type_ == 'Request') {
        const request = evt.data as Request
        pool.find(p => p.id == request.id).payload = request.payload || '-Null-'
      }
    }

    const fireFormEvent = (evtJSON: string) => {
      const evt = JSON.parse(evtJSON) as FormEvent
      this.onEvent(evt)
    }

    Object.assign(window, { fireFormEvent, onWebViewMessage })

    this.addListener('FormClosing', async () => {
      const ret = this._onClose ? await this._onClose() : true
      if (ret) this.closeForm()
    })
  }

  private async request(method: string, parameters: string[] = []) {
    const { pool } = this
    if (!webview) return
    const request = new Request(method, parameters)
    pool.push(request)
    webview.postMessage(request)
    const start = Date.now()
    while (true) {
      await sleep(200)
      if (request.payload) break
      if (Date.now() - start > this.timeout * 1000) {
        request.error = 'timeout'
        break
      }
    }
    _.pull(pool, request)
    if (request.error) {
      console.error(request.error)
    }
    const payload = (request.payload + "").replaceAll(`\\\\`, '/')
    var ret = null
    if (payload != '-Null-') try {
      ret = JSON.parse(payload)
    } catch (e) { }
    return ret
  }

  async home() {
    const ret = await this.request('Home', []) as {
      Args: string[],
      Culture: string,
      ExecutablePath: string,
      LocalIPs: string[],
      MachineName: string,
      OSVersion: string,
      UserName: string,
      UserProfile: string
    }
    return ret
  }

  async readFile(path: string) {
    return await this.request('ReadFile', [path]) as string
  }

  async writeFile(path: string, content: string) {
    return await this.request('WriteFile', [path, content]) as string
  }

  async closeForm() {
    await this.request('CloseForm', [])
  }

  async setTitle(title: string) {
    this.request('SetTitle', [title])
  }

  private onEvent(evt: FormEvent) {
    const listeners = this.listeners.filter(l => l.type == evt.type)
    for (const l of listeners) l.handle(evt)
  }

  public addListener(type: string, handle: EventHandle) {
    this.listeners.push(new Listener(type, handle))
  }

  _onClose: OnClose = null;
  onClose(onClose: OnClose) {
    this._onClose = onClose
  }
}

type OnClose = () => Promise<boolean>

type EventHandle = (evt: FormEvent) => void
class Listener {
  constructor(public type: string, public handle: EventHandle) { }
}


class Request {
  public _type_ = "Request";
  public id: string
  public payload: string
  public error: string
  constructor(public method: string, public parameters: string[]) {
    this.id = Math.random() + '_' + Date.now()
  }
}

export { Recevier }