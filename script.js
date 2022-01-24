
const parts = [];
let mediaRecorder;
const video = document.getElementById('video');
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');

//Reset audio context
document.documentElement.addEventListener('mousedown', () => {
  if (Tone.context.state !== 'running') Tone.context.resume();
});

const gainNode = new Tone.Gain();
const vol = new Tone.Volume(-6);
const player = new Tone.Player("https://monlim.github.io/Handmutate/Audio.mp3");
const reverb = new Tone.Reverb(3);
const dist = new Tone.Distortion(0.8);
const filter = new Tone.Filter(1500, "lowpass")
const limiter = new Tone.Limiter(-0.03).toDestination();
const mic = new Tone.UserMedia(3);
player.loop = true; 
player.chain(vol, filter, dist, reverb, gainNode, limiter);
mic.open().then(() => {
  //alert("If using mic input, please make sure audio output and input are from different sources (e.g. wear headphones), or you will get feedback");
  console.log("mic open");
}).catch(e => {
  console.log("mic not open");
});
mic.mute = true;

function scaleValue(value, from, to) {
  var scale = (to[1] - to[0]) / (from[1] - from[0]);
  var capped = Math.min(from[1], Math.max(from[0], value)) - from[0];
  return (capped * scale + to[0]);
};

//Sound engine
function myMusic(leftIndex, rightIndex){ 
  if (leftIndex){
    let leftIndexX = leftIndex.x;
    let leftIndexY = leftIndex.y;
    player.playbackRate = scaleValue(leftIndexX, [0.15, 0.4], [4, 0.05]);
    let myFilter = scaleValue(leftIndexY, [0, 1], [10000, 100]);
    filter.frequency.rampTo(myFilter, 0.05);
    };
  if (rightIndex){
    let rightIndexX = rightIndex.x;
    let rightIndexY = rightIndex.y
    dist.distortion = 1 - (clamp(rightIndexY, 0, 1));
    };
  if (leftIndex && rightIndex){
    let leftIndexX = leftIndex.x;
    let leftIndexY = leftIndex.y;
    let rightIndexX = rightIndex.x;
    let rightIndexY = rightIndex.y;
    let distance = Math.sqrt(((leftIndexX - rightIndexX)**2)+((leftIndexY - rightIndexY)**2));
    vol.volume.rampTo((clamp(scaleValue(distance, [0, 1], [-16, 0]), -36, 0)), 0.1);
    reverb.wet.value = (clamp((distance), 0, 1));
  }
};

//Draw Hand landmarks on screen
function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
      results.image, 0, 0, canvasElement.width, canvasElement.height);
  if (results.multiHandLandmarks && results.multiHandedness) {
    for (let index = 0; index < results.multiHandLandmarks.length; index++) {
      const classification = results.multiHandedness[index];
      const isRightHand = classification.label === 'Right';
      const landmarks = results.multiHandLandmarks[index];
      var leftWrist, leftIndex, rightWrist, rightIndex;
      drawConnectors(
          canvasCtx, landmarks, HAND_CONNECTIONS,
          {color: isRightHand ? '#00FF00' : '#FF0000'}),
      drawLandmarks(canvasCtx, landmarks, {
        color: isRightHand ? '#00FF00' : '#FF0000',
        fillColor: isRightHand ? '#FF0000' : '#00FF00',
        radius: (x) => {
          return lerp(x.from.z, -0.15, .1, 10, 1);
        }
      });
    if (isRightHand === false){
      leftIndex = landmarks[8]} else {
      rightIndex = landmarks[8]
      }
    }
  canvasCtx.restore();
  myMusic(leftIndex, rightIndex);
  };
};

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.1/${file}`;
}});

hands.setOptions({
  selfieMode: true,
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(video, {
  onFrame: async () => {
    await hands.send({image: video});
  },
  width: 1280,
  height: 720
});
camera.start();

const actx = Tone.context;
const dest = actx.createMediaStreamDestination();
const recorder = new MediaRecorder(dest.stream);
let buffer = [];
mic.connect(limiter);
limiter.connect(dest);

//start sound & webcam recording
navigator.mediaDevices.getUserMedia({audio:true, video:true}).then(stream => {
	//video.srcObject = stream;
	document.getElementById("btn").onclick = function (){
		mic.mute=false;
    mediaRecorder = new MediaRecorder(stream);
		mediaRecorder.start(500);
    recorder.start();
    Tone.Transport.start();
    player.start();
		mediaRecorder.ondataavailable = function (e){
			parts.push(e.data);
		}
    recorder.ondataavailable = ev => buffer.push(ev.data);
	}
});

//record audio & webcam and download on stop
document.getElementById("stopbtn").onclick = function() {
	Tone.Transport.stop();
  player.stop();
  mic.mute=true;
  recorder.stop();
  recorder.onstop = ev => {
    let blob = new Blob(buffer, {type: 'audio/mp3; codecs=opus' });
    let audiofile = URL.createObjectURL(blob);
    let buffer1 = new Tone.Buffer(audiofile);
    let a = document.createElement('a');
    a.href = audiofile;
    a.download = 'audiofile.ogg';
    a.click();
    window.URL.revokeObjectURL(audiofile); 
  };
  mediaRecorder.stop();
	const blob = new Blob(parts, {
		type: "video/webm"
	});
	const url = URL.createObjectURL(blob);
	const b = document.createElement("a");
	document.body.appendChild(b);
	b.style = "display: none";
	b.href = url;
	b.download = "test.webm";
	b.click();
};
