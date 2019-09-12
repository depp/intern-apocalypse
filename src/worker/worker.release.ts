import { WorkerRequest, WorkerResponse } from './interface.release';
import { runProgram } from '../synth/engine';
import { renderScore } from '../score/score';
import { firstMusicTrack } from '../audio/sounds';

onmessage = evt => {
  const req = evt.data as WorkerRequest;
  const resp: WorkerResponse = req.map((code, index) => {
    if (index < firstMusicTrack) {
      return runProgram(code);
    } else {
      return renderScore(code, req);
    }
  });
  // @ts-ignore
  postMessage(resp);
};
