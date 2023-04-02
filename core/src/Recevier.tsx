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
  private _onClose: OnClose = null;
  private core: any
  private listeners = [] as Listener[]

  get isConnected() {
    return (!!this.core)
  }

  constructor() {
    if (!webview) return
    this.core = webview.hostObjects.Core

    const fireFormEvent = (evtJSON: string) => {
      console.log(evtJSON)
      const evt = JSON.parse(evtJSON) as FormEvent
      this.onEvent(evt)
    }

    Object.assign(window, { fireFormEvent })

    this.addListener('FormClosing', async () => {
      const ret = this._onClose ? await this._onClose() : true
      if (ret) this.closeForm()
    })
  }

  private onEvent(evt: FormEvent) {
    const listeners = this.listeners.filter(l => l.type == evt.type)
    for (const l of listeners) l.handle(evt)
  }

  public addListener(type: string, handle: EventHandle) {
    this.listeners.push(new Listener(type, handle))
  }

  async closeForm() {
    await this.core.CloseForm()
  }

  async home() {
    return JSON.parse(await this.core.Home()) as {
      Args: string[],
      Culture: string,
      ExecutablePath: string,
      LocalIPs: string[],
      MachineName: string,
      OSVersion: string,
      UserName: string,
      UserProfile: string
    }
  }

  onClose(onClose: OnClose) {
    this._onClose = onClose
  }

  async readFile(path: string) {
    return await this.core.ReadFile(path) as string
  }

  async setTitle(title: string) {
    await this.core.SetTitle(title)
  }

  async writeFile(path: string, content: string) {
    return await this.core.WriteFile(path, content) as string
  }
}

type OnClose = () => Promise<boolean>

type EventHandle = (evt: FormEvent) => void
class Listener {
  constructor(public type: string, public handle: EventHandle) { }
}

export { Recevier }