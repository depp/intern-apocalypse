;; Simple filter sweep.
(saturate
 (* (lowPass2
     (mix
      -6dB (sawtooth (note 256Hz))
      -6dB (sawtooth (note 307Hz)))
     (frequency (envelope (set 1) (lin 1s -1)))
     5.0)
    (envelope (lin 100ms 1) (delay 800ms) (lin 100ms 0))))
