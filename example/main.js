let pc;
let channel;

const offerButton = document.getElementById('offer');
const answerButton = document.getElementById('answer');
const sendButton = document.getElementById('sendButton');
const input = document.querySelector('textarea#input');

const candidateElement = document.querySelector('textarea#candidate');
const sdpElement = document.querySelector('textarea#sdp');

sendButton.onclick = () => channel.send(input.value);

const signaling = new BroadcastChannel('webrtc');
signaling.onmessage = async e => {
  switch (e.data.type) {
    case 'offer':
      answer(e.data.sdp);
      break;
    case 'answer':
      if (!pc) throw new Error('no peerconnection');
      await pc.setRemoteDescription(e.data);
      break;
    case 'candidate':
      await pc.addIceCandidate(e.data);
      break;
    default:
      console.log('unhandled', e);
      break;
  }
};

const handleIceCandidate = e => {
  console.log(JSON.stringify(e.candidate));
  signaling.postMessage({
    type: 'candidate',
    candidate: e.candidate?.candidate,
    sdpMid: e.candidate?.sdpMid,
    sdpMLineIndex: e.candidate?.sdpMLineIndex,
  });
};

offerButton.onclick = async () => {
  offerButton.disabled = true;
  pc = new RTCPeerConnection();
  pc.onicecandidate = handleIceCandidate;
  channel = pc.createDataChannel('sendDataChannel');
  channel.onmessage = (event) => console.log(`received: ${event.data}`);

  const offer = await pc.createOffer();
  signaling.postMessage({type: 'offer', sdp: offer.sdp});
  await pc.setLocalDescription(offer);
  sdpElement.value = offer.sdp;
};

const answer = async (sdp) => {
  pc = new RTCPeerConnection();
  pc.onicecandidate = handleIceCandidate;
  pc.ondatachannel = function (event) {
    console.log(`data channel received: ${event.channel.label}`);
    channel = event.channel;
    channel.onmessage = (event) => console.log(`received: ${event.data}`);
  };
  await pc.setRemoteDescription({type: 'offer', sdp: sdp});

  const answer = await pc.createAnswer();
  signaling.postMessage({ type: 'answer', sdp: answer.sdp });
  console.log(`answer: ${JSON.stringify(answer)}`);
  sdpElement.value = JSON.stringify(answer);
  await pc.setLocalDescription(answer);
};
