let pc;
let channel;

const offerButton = document.getElementById('offer');
const answerButton = document.getElementById('answer');
const sendButton = document.getElementById('sendButton');
const input = document.querySelector('textarea#input');

const candidateElement = document.querySelector('textarea#candidate');
const localSdp = document.querySelector('textarea#local-sdp');
const remoteSdp = document.querySelector('textarea#remote-sdp');

sendButton.onclick = () => channel.send(input.value);

const signaling = new BroadcastChannel('webrtc');
signaling.onmessage = async e => {
  switch (e.data.type) {
    case 'offer':
      localSdp.value = e.data.sdp; // manual copy task
      answer();
      break;
    case 'answer':
      if (!pc) throw new Error('no peerconnection');
      remoteSdp.value = e.data.sdp; // manual copy task
      await pc.setRemoteDescription({type: 'answer', sdp: remoteSdp.value});
      break;
    case 'candidate':
      candidateElement.value = JSON.stringify(e.data); // manual copy task
      await pc?.addIceCandidate(JSON.parse(candidateElement.value));
      break;
    default:
      console.log('unhandled', e);
      break;
  }
};

const handleIceCandidate = e => {
  const candidateInit = {
    type: 'candidate',
    candidate: e.candidate?.candidate,
    sdpMid: e.candidate?.sdpMid,
    sdpMLineIndex: e.candidate?.sdpMLineIndex,
  };

  console.log(JSON.stringify(candidateInit));
  if(e.candidate) candidateElement.value = JSON.stringify(candidateInit);
  // signaling.postMessage(candidateInit);
};

offerButton.onclick = async () => {
  offerButton.disabled = true;
  pc = new RTCPeerConnection();
  pc.onicecandidate = handleIceCandidate;
  channel = pc.createDataChannel('chat');
  channel.onmessage = (event) => console.log(`received: ${event.data}`);

  const offer = await pc.createOffer();
  // signaling.postMessage({type: 'offer', sdp: offer.sdp});
  await pc.setLocalDescription(offer);
  localSdp.value = offer.sdp;
};

const answer = async () => {
  pc = new RTCPeerConnection();
  pc.onicecandidate = handleIceCandidate;
  pc.ondatachannel = function (event) {
    console.log(`data channel received: ${event.channel.label}`);
    channel = event.channel;
    channel.onmessage = (event) => console.log(`received: ${event.data}`);
  };
  await pc.setRemoteDescription({type: 'offer', sdp: remoteSdp.value});
  await pc.addIceCandidate(JSON.parse(candidateElement.value));


  const answer = await pc.createAnswer();
  console.log(`answer: ${JSON.stringify(answer)}`);
  localSdp.value = answer.sdp;
  signaling.postMessage({ type: 'answer', sdp: answer.sdp }); ///////////////
  await pc.setLocalDescription(answer);
};


answerButton.onclick = answer;
