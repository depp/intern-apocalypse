;; Simple filter sweep.
(* (lowPass2
    (sawtooth 256Hz)
    (envelope 5.2kHz 1s 28Hz))
   (envelope 0 100ms 1 800ms 1 100ms 0))
