const elements/* : Record<string, Element> */ = {};
let peerConnection/* : RTCPeerConnection */ = null;
let dataChannel/* : RTCDataChannel  */ = null;
const specialProps = ['xmlns', 'tag', 'textContent', 'children', 'onclick', 'insertPosition'];
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const randString = () => Array.from(new Array(20)).map(() => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
const newElement = (parentElement /* : Element */, config/* : Record<string, any> */ = {}) => {
  const element = document.createElementNS(config.xmlns || 'http://www.w3.org/1999/xhtml', config.tag || 'div');
  element.textContent = config.textContent || null;
  config.children?.map(childConfig => newElement(element, childConfig));
  if (config.onclick) element.addEventListener('click', config.onclick);
  Object.entries(config).filter(v => !(specialProps.includes(v[0]))).map(v => element.setAttribute(v[0], v[1] || ''));
  return parentElement.insertAdjacentElement(config.insertPosition || 'beforeend', element);
};

const userSvg = {
  xmlns: 'http://www.w3.org/2000/svg',
  tag: 'svg',
  width: '40px',
  height: '40px',
  viewBox: '0 0 24 24',
  class: 'clickable',
  onclick: () => alert('this is a user'),
  children: [{
    xmlns: 'http://www.w3.org/2000/svg',
    tag: 'use',
    href: '#user-symbol'
  }]
};

const chatLog = (message, isSysLog, time = new Date().toLocaleTimeString()) => newElement(elements['chat'], {
  insertPosition: 'afterbegin',
  class: 'light flexed padded bordered',
  children: [
    isSysLog ? undefined : userSvg,
    { tag: 'span', class: `${isSysLog ? 'light-text' : ''} aligned`, textContent: message },
    { class: 'light-text right', textContent: `(${time})` }
  ]
});

const log = (data /* : string | { [k: string]: unknown } */ = '') => {
  const stackTrace = new Error().stack;
  const stackCall = stackTrace?.split('\n')?.[2]?.trim();
  const content = JSON.stringify({
    t: new Date().getTime(),
    d: data,
    f: stackCall?.split(' ')[1]
  });
  console.log(content);
  chatLog(`system: ${data}`, true);
  return content;
};

const offer = async () => {
  peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  log(`Offering SDP ${offer?.sdp}...`);
  peerConnection.addEventListener('datachannel', dcEvent => {
    log(`Received datachannel event ${JSON.stringify(dcEvent)}`);
    dataChannel = dcEvent.channel;
    dataChannel.onmessage = (msgEvent) => chatLog(`other_user: ${JSON.stringify(msgEvent.data)}`);
  });
};

const answer = async () => {
  peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const offerSdp = elements['sdp'].value;
  log(`Answering SDP ${offerSdp}...`)
  const remoteDescription = new RTCSessionDescription({ sdp: offerSdp, type: 'offer' });
  await peerConnection.setRemoteDescription(remoteDescription);
  log(`Remote description set for SDP ${remoteDescription.sdp}`);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  log(`Answered SDP ${answer.sdp}`);
  dataChannel = peerConnection.createDataChannel('default');
  dataChannel.onmessage = (event) => chatLog(`other_user: ${JSON.stringify(event.data)}`);
};

const logIpAddress = async () => {
  const ifconfigResponse = await fetch('https://ifconfig.me/ip');
  log(`ifconfig.me response (http ${ifconfigResponse.status}) ${await ifconfigResponse.text()}`);
};

const init = async () => {
  logIpAddress();
  ['chat', 'input', 'send', 'offer', 'answer', 'sdp', 'randomMessages'].map(id => elements[id] = document.querySelector(`#${id}`));
  elements['send'].addEventListener('click', () => {
    dataChannel?.send(elements['input'].value);
    chatLog(`you: ${elements['input'].value}`);
    elements['input'].value = '';
    elements['input'].focus();
  });
  elements['offer'].addEventListener('click', async (event) => await offer());
  elements['answer'].addEventListener('click', async (event) => await answer());
  elements['randomMessages'].addEventListener('click', () => {
    let i = 0;
    const interval = setInterval(() => {
      const data = randString();
      dataChannel?.send(elements['input'].value);
      log(data);
      i++;
      if (i >= 5) clearInterval(interval);
    }, 1000);
  });
  // const worker = new Worker('main.js');
  // worker.postMessage(JSON.stringify({ at: 0, s: '' }));
  // worker.onmessage = (e) => (document.querySelector('#result') || new Element()).textContent = e.data;
};

const webWorker = async () => {
  onmessage = async (e) => {
    const root = await navigator.storage.getDirectory();
    const draftHandle = await root.getFileHandle('draft.txt', { create: true });
    // const accessHandle = await draftHandle.createSyncAccessHandle();
    const data = JSON.parse(e.data);
    const encodedMessage = new TextEncoder().encode(data.s);
    // accessHandle.write(encodedMessage, { at: data.at });
    // const fileSize = accessHandle.getSize();
    // const buffer = new DataView(new ArrayBuffer(fileSize));
    // accessHandle.read(buffer, { at: 0 });
    // postMessage(new TextDecoder().decode(buffer));
    // accessHandle.flush(); // Persist changes to disk.
    // accessHandle.close();
  };
};

if (typeof document !== 'undefined') window.addEventListener('DOMContentLoaded', init);
else webWorker();
