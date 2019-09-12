import { WorkerRequest, WorkerResponse } from './interface.release';
import { runProgram } from '../synth/engine';
import { renderScore } from '../score/score';
import { firstMusicTrack } from '../audio/sounds';

onmessage = evt => {
  const req = evt.data as WorkerRequest;
  const lengths: number[] = [];
  const audioBuffers = req.map((code, index) => {
    if (index < firstMusicTrack) {
      return runProgram(code);
    } else {
      const [audioBuffer, length] = renderScore(code, req);
      lengths.push(length);
      return audioBuffer;
    }
  });
  const resp: WorkerResponse = [audioBuffers, lengths];
  // @ts-ignore
  postMessage(resp);
};
