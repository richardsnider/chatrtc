let pc;
let sendChannel;
let receiveChannel;

const offerButton = document.getElementById('offer');
const answerButton = document.getElementById('answer');
const sendButton = document.getElementById('sendButton');
const input = document.querySelector('textarea#input');

const candidateElement = document.querySelector('textarea#candidate');
const sdpElement = document.querySelector('textarea#sdp');

sendButton.onclick = () => sendChannel ? sendChannel.send(input.value) : receiveChannel.send(input.value);

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

offerButton.onclick = async () => {
  offerButton.disabled = true;
  pc = new RTCPeerConnection();
  pc.onicecandidate = e => {
    console.log(JSON.stringify(e.candidate));
    signaling.postMessage({
      type: 'candidate',
      candidate: e.candidate?.candidate,
      sdpMid: e.candidate?.sdpMid,
      sdpMLineIndex: e.candidate?.sdpMLineIndex,
    });
  };
  sendChannel = pc.createDataChannel('sendDataChannel');
  sendChannel.onmessage = (event) => console.log(`received: ${event.data}`);

  const offer = await pc.createOffer();
  signaling.postMessage({type: 'offer', sdp: offer.sdp});
  await pc.setLocalDescription(offer);
};

const answer = async (sdp) => {
  if (pc) throw new Error('existing peerconnection');
  pc = new RTCPeerConnection();
  pc.onicecandidate = e => {
    console.log(JSON.stringify(e.candidate));
    signaling.postMessage({
      type: 'candidate',
      candidate: e.candidate?.candidate,
      sdpMid: e.candidate?.sdpMid,
      sdpMLineIndex: e.candidate?.sdpMLineIndex,
    });
  };
  pc.ondatachannel = function(event) {
    console.log('Receive Channel Callback');
    receiveChannel = event.channel;
    receiveChannel.onmessage = (event) => console.log(`received: ${event.data}`);
  };
  await pc.setRemoteDescription({type: 'offer', sdp: sdp});

  const answer = await pc.createAnswer();
  signaling.postMessage({type: 'answer', sdp: answer.sdp});
  await pc.setLocalDescription(answer);
};
