const elements/* : Record<string, Element> */ = {};
const pc = new RTCPeerConnection();
let channel/* : RTCDataChannel  */ = null;

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

const switchTabs = (id) => {
  [].slice.call(document.getElementsByClassName('tab')).map(e => e.style.display = 'none');
  elements[id].style.display = 'block';
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

const handleMessage = (e) => chatLog(`other_user: ${JSON.stringify(e.data)}`);

const getOfferSdp = async () => {
  channel = pc.createDataChannel('chat');
  channel.onmessage = handleMessage;
  const offer = await pc.createOffer();
  log(`Created offer SDP: ${offer.sdp}`);
  await pc.setLocalDescription(offer);
  return offer.sdp;
}

const getAnswerSdp = async (sdp, candidate) => {
  if (!sdp) { log('No SDP provided'); return; }
  if (!candidate) { log('No ICE candidate provided'); return; }

  pc.ondatachannel = (e) => {
    log(`Received datachannel event ${JSON.stringify(e)}`);
    channel = e.channel;
    channel.onmessage = handleMessage;
  };

  await pc.setRemoteDescription({ type: 'offer', sdp: sdp });
  log(`Set Remote SDP of Offer ${sdp}`);

  await pc.addIceCandidate({ candidate: candidate, sdpMid: '0', sdpMLineIndex: 0 });
  log(`Set ICE candidate of Offer`);

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  log(`Answered with SDP ${answer.sdp}`);
  return answer.sdp;
}

const logIpAddress = async () => {
  const ifconfigResponse = await fetch('https://ifconfig.me/ip');
  log(`ifconfig.me response (HTTP ${ifconfigResponse.status}) ${await ifconfigResponse.text()}`);
};

const sendMessage = () => {
  channel ? channel.send(elements['input'].value) : null; // TODO: remove condition
  chatLog(`you: ${elements['input'].value}`);
  elements['input'].value = '';
  elements['input'].focus();
};

const generateRandomMessages = () => {
  let i = 0;
  const interval = setInterval(() => {
    elements['input'].value = randString();;
    sendMessage();
    i++;
    if (i >= 5) clearInterval(interval);
  }, 1000);
};

const init = async () => {
  logIpAddress();
  ['chat', 'input', 'send', 'randomMessages', 'offer', 'answer', 'setRemote', 
    'candidateTab', 'localSdpTab', 'remoteSdpTab', 'candidateTabButton', 'localSdpTabButton', 'remoteSdpTabButton', 
    'candidate', 'localSdp', 'remoteSdp', 'copyCandidate', 'copyLocal', 'copyRemote'].map(id => elements[id] = document.querySelector(`#${id}`));

  elements['candidateTabButton'].addEventListener('click', () => switchTabs('candidateTab'));
  elements['localSdpTabButton'].addEventListener('click', () => switchTabs('localSdpTab'));
  elements['remoteSdpTabButton'].addEventListener('click', () => switchTabs('remoteSdpTab'));

  elements['copyCandidate'].addEventListener('click', () => navigator.clipboard.writeText(elements['candidate'].value));
  elements['copyLocal'].addEventListener('click', () => navigator.clipboard.writeText(elements['localSdp'].value));
  elements['copyRemote'].addEventListener('click', () => navigator.clipboard.writeText(elements['remoteSdp'].value));

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      log(`ICE candidate ${e.candidate.candidate}`);
      elements['candidate'].value = e.candidate.candidate;
    }
  };

  elements['offer'].addEventListener('click', async (event) => elements['localSdp'].value = offer.sdp = await getOfferSdp());
  elements['answer'].addEventListener('click', async (event) => elements['localSdp'].value = await getAnswerSdp(elements['remoteSdp'].value, elements['candidate'].value));
  elements['setRemote'].addEventListener('click', async (event) => await pc.setRemoteDescription({type: 'answer', sdp: elements['remoteSdp'].value}));


  elements['send'].addEventListener('click', () => sendMessage());
  elements['randomMessages'].addEventListener('click', () => generateRandomMessages());

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
