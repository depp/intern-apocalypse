import { WorkerRequest, WorkerResponse } from './interface.release';
import { runProgram } from '../synth/engine';
import { renderScore } from '../score/score';

onmessage = evt => {
  const req = evt.data as WorkerRequest;
  const [sounds, music] = req;
  const soundAudio = sounds.map(data => runProgram(data));
  const musicAudio = music.map(data => renderScore(data, sounds));
  const resp: WorkerResponse = [soundAudio, musicAudio];
  // @ts-ignore
  postMessage(resp);
};
