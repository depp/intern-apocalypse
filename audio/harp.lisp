(* (mix
    -6dB
    (sine
     (phase-mod
      (note 256Hz)
      -12dB
      (* (sine
	  (phase-mod
	   (note 768Hz)
	   -9dB (* (sine (note 768Hz))
		   (envelope (set 1.0) (lin 300ms 0.0)))))
	 (envelope (set 1.0) (lin 1000ms 0.3)))))
    -6dB
    (sine
     (phase-mod
      (note 256Hz)
      -12dB
      (* (sine (phase-mod (note 512Hz)))
	 (envelope (set 1.0) (lin 1000ms 0.3))))))
   (envelope (set 1) (lin 2s 0.0)))
