const offerButton = document.getElementById('offer');
const updateOffer = document.getElementById('update-offer');
const answerButton = document.getElementById('answer');
const sendButton = document.getElementById('sendButton');
const input = document.querySelector('textarea#input');

const candidateElement = document.querySelector('textarea#candidate');
const localSdp = document.querySelector('textarea#local-sdp');
const remoteSdp = document.querySelector('textarea#remote-sdp');

const pc = new RTCPeerConnection();
pc.onicecandidate = (e) => e.candidate ? candidateElement.value = e.candidate.candidate : null;
let channel;

const handleMessage = (event) => console.log(`received: ${event.data}`);

const getOfferSdp = async () => {
  channel = pc.createDataChannel('chat');
  channel.onmessage = handleMessage;
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return offer.sdp;
}

const getAnswerSdp = async (sdp, candidate) => {
  pc.ondatachannel = (event) => {
    channel = event.channel;
    channel.onmessage = handleMessage;
  };

  await pc.setRemoteDescription({type: 'offer', sdp: sdp});
  await pc.addIceCandidate({ candidate: candidate, sdpMid: '0', sdpMLineIndex: 0 });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer.sdp;
}

offerButton.onclick = async () => localSdp.value = await getOfferSdp();
answerButton.onclick = async () => localSdp.value = await getAnswerSdp(remoteSdp.value, candidateElement.value);
updateOffer.onclick = async () => await pc.setRemoteDescription({type: 'answer', sdp: remoteSdp.value});
sendButton.onclick = () => channel.send(input.value);
