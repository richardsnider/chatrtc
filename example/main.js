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
    case 'answer':
      if (!pc) throw new Error('no peerconnection');
      remoteSdp.value = e.data.sdp; // manual copy task
      await pc.setRemoteDescription({type: 'answer', sdp: remoteSdp.value});
      break;
    default:
      console.log('unhandled', e);
      break;
  }
};

const handleIceCandidate = e => {
  console.log(`candidate: ${JSON.stringify(e.candidate)}`);
  if(e.candidate) candidateElement.value = e.candidate.candidate;
};

offerButton.onclick = async () => {
  offerButton.disabled = true;
  pc = new RTCPeerConnection();
  pc.onicecandidate = handleIceCandidate;
  channel = pc.createDataChannel('chat');
  channel.onmessage = (event) => console.log(`received: ${event.data}`);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  localSdp.value = offer.sdp;
};

answerButton.onclick = async () => {
  pc = new RTCPeerConnection();
  pc.onicecandidate = handleIceCandidate;
  pc.ondatachannel = function (event) {
    console.log(`data channel received: ${event.channel.label}`);
    channel = event.channel;
    channel.onmessage = (event) => console.log(`received: ${event.data}`);
  };

  await pc.setRemoteDescription({type: 'offer', sdp: remoteSdp.value});
  await pc.addIceCandidate({ candidate: candidateElement.value, sdpMid: '0', sdpMLineIndex: 0 });

  const answer = await pc.createAnswer();
  console.log(`answer: ${JSON.stringify(answer)}`);
  localSdp.value = answer.sdp;
  signaling.postMessage({ type: 'answer', sdp: answer.sdp }); ///////////////
  await pc.setLocalDescription(answer);
};
