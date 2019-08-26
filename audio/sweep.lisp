;; Simple filter sweep.
(multiply
 (lowPass2
  (sawtooth (oscillator (constant (frequency 48))))
  (expscale (frequency 0) (frequency 91) (envelope 90 54 45)))
 (envelope 45 35 90 54 90 35 45))
