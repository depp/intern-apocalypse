;; Base oscillator
(define osc (oscillator (note -24)))

;; Simple filter sweep.
(* (lowPass2
    (mix
     -9dB (sawtooth (overtone 2 osc))
     -6dB (sawtooth osc))
    (frequency (envelope (set 0.2) (lin 1000ms -0.2)))
    1.6)
   (envelope (exp 0.5ms 1) (lin 50ms 0.5) (delay 600ms)
	     (gate) (exp 100ms 0)))
