;; Base oscillators.
(define osc (oscillator (note 0)))
(define osc2 (overtone 2 osc))
(define osc3 (overtone 3 osc))

;; Modulators.
(define mod1
  (* (sine osc3)
     (envelope (set 1.0) (lin 300ms 0.0))))
(define mod2
  (* (sine
      (phase-mod
       osc3
       -9dB mod1))
     (envelope (set 1.0) (lin 1000ms 0.3))))
(define mod3
  (* (sine osc2)
     (envelope (set 1.0) (lin 1000ms 0.3))))

;; Output.
(* (mix
    -6dB (sine
	  (phase-mod
	   osc
	   -12dB mod2))
    -6dB (sine
	  (phase-mod
	   osc
	   -12dB mod3)))
   (envelope (set 1) (lin 2s 0.0)))
