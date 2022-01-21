const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const canvasCtx = canvasElement.getContext('2d');
var showTracking = document.getElementById("showTracking");
const startSound = document.getElementById("startSound");
const stopSound = document.getElementById("stopSound");
const preview = document.getElementById("preview");
const download = document.getElementById("download");
const submit = document.getElementById("submit");

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

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 1280,
  height: 720
});
camera.start();

const actx = Tone.context;
const dest = actx.createMediaStreamDestination();
const recorder = new MediaRecorder(dest.stream);
let buffer = [];
let player2;
mic.connect(limiter);
limiter.connect(dest);

startSound.addEventListener("click", function(ev){
  mic.mute=false;
  recorder.start();
  recordStream();
  Tone.Transport.start();
  player.start(); 
});

stopSound.addEventListener("click", function(ev){
  Tone.Transport.stop();
  player.stop(); 
  mic.mute=true;
  recorder.stop();
  stopRecording();
  recorder.ondataavailable = ev => buffer.push(ev.data);
  recorder.onstop = ev => {
    let blob = new Blob(buffer, {type: 'audio/mp3; codecs=opus' });
    let audiofile = URL.createObjectURL(blob);
    let buffer1 = new Tone.Buffer(audiofile);
    player2 = new Tone.Player(buffer1);
    player2.connect(gainNode);
    let a = document.createElement('a');
    a.href = audiofile;
    a.download = 'audiofile.ogg';
    a.click();
    window.URL.revokeObjectURL(audiofile); 
  };
});

preview.addEventListener("change", function(){
  if (player2) {
    if (this.checked) {
    player2.start();
    } else {
     player2.stop();
    }
  };
});

//capture webcam & mic
async function captureMediaDevices(mediaConstraints = {
    video: {
      width: 1280,
      height: 720
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100
    }
  }) {
  const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
  
  videoElement.src = null
  videoElement.srcObject = stream
  videoElement.muted = true
  
  return stream
};

let screenrecorder = null

async function recordStream() {
  const stream = await captureMediaDevices()
  
  videoElement.src = null
  videoElement.srcObject = stream
  videoElement.muted = true
  
  screenrecorder = new MediaRecorder(stream)
  
  let chunks = [];

  screenrecorder.ondataavailable = event => {
    if (event.data.size > 0) {
      chunks.push(event.data)
    }
  }
  
  screenrecorder.onstop = () => {
    const blob2 = new Blob(chunks, {
      type: 'video/webm'
    })
    
    chunks = []
    const videofile = URL.createObjectURL(blob2)
    videoElement.srcObject = null
    videoElement.src = videofile
    videoElement.muted = false 
    let b = document.createElement('b');
    b.href = videofile;
    b.download = 'videofile.webm';
    b.click();
    window.URL.revokeObjectURL(videofile); 
   }
  
  screenrecorder.start()
};

function stopRecording() {
 screenrecorder.stream.getTracks().forEach(track => track.stop())
};
