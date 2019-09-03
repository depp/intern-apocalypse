;; Simple filter sweep.
(* (lowPass2
    (mix
     -9dB (sawtooth (note 128Hz))
     -6dB (sawtooth (note 64Hz)))
    (frequency (envelope (set 0.2) (lin 1000ms -0.2)))
    1.0)
   (envelope (lin 0.5ms 1) (lin 50ms 0.5) (delay 600ms) (lin 400ms 0)))
