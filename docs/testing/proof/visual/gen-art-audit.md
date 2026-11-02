# Gen art angle audit (bugs 30, 31)

Rule: top-down, front side only, never iso or three-quarter (`docs/visual/visual.md`).
Files: 654 audited, plus the new `playground-slide.png`. Failed: 1 (`soccer-goal.png`, reworked once, now passes). The 30 spots layers were deleted by bug 33. Sheets: `.scratch/audit/sheet-props-before.png`, `sheet-pets-before.png`, after: `*-after.png`.
Pet layers were judged at 48, 32 and 16, front and back, for all five builds.

| File | Verdict | Why |
|---|---|---|
| birthday-balloon-blue.png | pass | flat icon or front view |
| birthday-balloon-gold.png | pass | flat icon or front view |
| birthday-balloon-red.png | pass | flat icon or front view |
| birthday-bunting.png | pass | flat icon or front view |
| birthday-cake.png | pass | front face with a little top, as the pack draws furniture |
| dance-floor-active.png | pass | flat ground tile |
| dance-floor-inactive.png | pass | flat ground tile |
| market-stall.png | pass | straight front; awning and counter have no side face |
| notice-board-empty.png | pass | straight front |
| notice-board-notes.png | pass | straight front |
| pets/pet-brute-body-base-16-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-brute-body-base-16-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-brute-body-base-32-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-brute-body-base-32-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-brute-body-base-48-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-brute-body-base-48-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-brute-ears-bunny-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-bunny-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-bunny-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-bunny-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-bunny-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-bunny-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-floppy-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-floppy-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-floppy-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-floppy-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-floppy-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-floppy-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-pointy-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-pointy-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-pointy-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-pointy-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-pointy-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-pointy-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-round-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-round-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-round-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-round-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-round-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-round-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-tuft-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-tuft-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-tuft-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-tuft-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-tuft-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-ears-tuft-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-face-eyes-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-face-eyes-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-face-eyes-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-face-eyes-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-face-eyes-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-face-eyes-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-antlers-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-antlers-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-antlers-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-antlers-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-antlers-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-antlers-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-none-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-none-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-none-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-none-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-none-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-none-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-nubs-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-nubs-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-nubs-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-nubs-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-nubs-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-nubs-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-unicorn-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-unicorn-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-unicorn-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-unicorn-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-unicorn-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-horns-unicorn-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-belly-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-belly-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-belly-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-belly-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-belly-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-belly-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-plain-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-plain-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-plain-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-plain-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-plain-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-plain-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-spots-16-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-brute-pattern-spots-16-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-brute-pattern-spots-32-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-brute-pattern-spots-32-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-brute-pattern-spots-48-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-brute-pattern-spots-48-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-brute-pattern-stripes-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-stripes-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-stripes-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-stripes-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-stripes-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-pattern-stripes-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-shadow-contact-16-front-idle.png | pass | flat contact shadow |
| pets/pet-brute-shadow-contact-32-front-idle.png | pass | flat contact shadow |
| pets/pet-brute-shadow-contact-48-front-idle.png | pass | flat contact shadow |
| pets/pet-brute-tail-curl-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-curl-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-curl-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-curl-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-curl-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-curl-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-fox-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-fox-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-fox-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-fox-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-fox-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-fox-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-none-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-none-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-none-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-none-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-none-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-none-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-nub-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-nub-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-nub-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-nub-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-nub-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-nub-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-puff-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-puff-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-puff-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-puff-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-puff-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-brute-tail-puff-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-body-base-16-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-bully-body-base-16-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-bully-body-base-32-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-bully-body-base-32-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-bully-body-base-48-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-bully-body-base-48-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-bully-ears-bunny-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-bunny-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-bunny-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-bunny-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-bunny-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-bunny-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-floppy-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-floppy-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-floppy-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-floppy-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-floppy-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-floppy-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-pointy-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-pointy-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-pointy-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-pointy-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-pointy-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-pointy-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-round-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-round-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-round-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-round-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-round-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-round-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-tuft-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-tuft-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-tuft-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-tuft-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-tuft-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-ears-tuft-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-face-eyes-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-face-eyes-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-face-eyes-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-face-eyes-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-face-eyes-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-face-eyes-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-antlers-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-antlers-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-antlers-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-antlers-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-antlers-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-antlers-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-none-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-none-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-none-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-none-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-none-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-none-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-nubs-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-nubs-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-nubs-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-nubs-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-nubs-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-nubs-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-unicorn-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-unicorn-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-unicorn-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-unicorn-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-unicorn-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-horns-unicorn-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-belly-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-belly-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-belly-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-belly-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-belly-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-belly-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-plain-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-plain-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-plain-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-plain-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-plain-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-plain-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-spots-16-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-bully-pattern-spots-16-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-bully-pattern-spots-32-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-bully-pattern-spots-32-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-bully-pattern-spots-48-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-bully-pattern-spots-48-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-bully-pattern-stripes-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-stripes-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-stripes-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-stripes-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-stripes-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-pattern-stripes-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-shadow-contact-16-front-idle.png | pass | flat contact shadow |
| pets/pet-bully-shadow-contact-32-front-idle.png | pass | flat contact shadow |
| pets/pet-bully-shadow-contact-48-front-idle.png | pass | flat contact shadow |
| pets/pet-bully-tail-curl-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-curl-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-curl-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-curl-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-curl-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-curl-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-fox-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-fox-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-fox-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-fox-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-fox-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-fox-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-none-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-none-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-none-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-none-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-none-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-none-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-nub-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-nub-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-nub-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-nub-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-nub-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-nub-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-puff-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-puff-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-puff-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-puff-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-puff-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-bully-tail-puff-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-body-base-16-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-pal-body-base-16-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-pal-body-base-32-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-pal-body-base-32-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-pal-body-base-48-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-pal-body-base-48-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-pal-ears-bunny-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-bunny-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-bunny-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-bunny-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-bunny-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-bunny-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-floppy-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-floppy-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-floppy-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-floppy-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-floppy-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-floppy-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-pointy-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-pointy-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-pointy-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-pointy-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-pointy-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-pointy-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-round-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-round-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-round-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-round-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-round-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-round-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-tuft-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-tuft-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-tuft-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-tuft-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-tuft-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-ears-tuft-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-face-eyes-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-face-eyes-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-face-eyes-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-face-eyes-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-face-eyes-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-face-eyes-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-antlers-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-antlers-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-antlers-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-antlers-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-antlers-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-antlers-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-none-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-none-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-none-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-none-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-none-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-none-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-nubs-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-nubs-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-nubs-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-nubs-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-nubs-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-nubs-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-unicorn-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-unicorn-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-unicorn-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-unicorn-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-unicorn-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-horns-unicorn-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-belly-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-belly-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-belly-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-belly-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-belly-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-belly-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-plain-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-plain-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-plain-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-plain-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-plain-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-plain-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-spots-16-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-pal-pattern-spots-16-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-pal-pattern-spots-32-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-pal-pattern-spots-32-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-pal-pattern-spots-48-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-pal-pattern-spots-48-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-pal-pattern-stripes-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-stripes-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-stripes-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-stripes-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-stripes-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-pattern-stripes-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-shadow-contact-16-front-idle.png | pass | flat contact shadow |
| pets/pet-pal-shadow-contact-32-front-idle.png | pass | flat contact shadow |
| pets/pet-pal-shadow-contact-48-front-idle.png | pass | flat contact shadow |
| pets/pet-pal-tail-curl-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-curl-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-curl-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-curl-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-curl-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-curl-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-fox-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-fox-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-fox-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-fox-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-fox-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-fox-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-none-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-none-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-none-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-none-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-none-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-none-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-nub-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-nub-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-nub-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-nub-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-nub-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-nub-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-puff-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-puff-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-puff-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-puff-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-puff-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-pal-tail-puff-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-body-base-16-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-skitter-body-base-16-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-skitter-body-base-32-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-skitter-body-base-32-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-skitter-body-base-48-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-skitter-body-base-48-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-skitter-ears-bunny-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-bunny-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-bunny-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-bunny-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-bunny-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-bunny-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-floppy-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-floppy-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-floppy-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-floppy-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-floppy-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-floppy-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-pointy-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-pointy-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-pointy-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-pointy-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-pointy-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-pointy-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-round-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-round-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-round-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-round-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-round-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-round-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-tuft-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-tuft-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-tuft-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-tuft-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-tuft-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-ears-tuft-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-face-eyes-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-face-eyes-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-face-eyes-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-face-eyes-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-face-eyes-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-face-eyes-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-antlers-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-antlers-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-antlers-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-antlers-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-antlers-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-antlers-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-none-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-none-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-none-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-none-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-none-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-none-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-nubs-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-nubs-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-nubs-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-nubs-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-nubs-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-nubs-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-unicorn-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-unicorn-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-unicorn-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-unicorn-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-unicorn-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-horns-unicorn-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-belly-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-belly-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-belly-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-belly-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-belly-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-belly-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-plain-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-plain-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-plain-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-plain-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-plain-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-plain-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-spots-16-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-skitter-pattern-spots-16-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-skitter-pattern-spots-32-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-skitter-pattern-spots-32-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-skitter-pattern-spots-48-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-skitter-pattern-spots-48-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-skitter-pattern-stripes-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-stripes-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-stripes-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-stripes-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-stripes-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-pattern-stripes-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-shadow-contact-16-front-idle.png | pass | flat contact shadow |
| pets/pet-skitter-shadow-contact-32-front-idle.png | pass | flat contact shadow |
| pets/pet-skitter-shadow-contact-48-front-idle.png | pass | flat contact shadow |
| pets/pet-skitter-tail-curl-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-curl-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-curl-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-curl-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-curl-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-curl-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-fox-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-fox-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-fox-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-fox-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-fox-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-fox-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-none-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-none-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-none-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-none-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-none-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-none-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-nub-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-nub-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-nub-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-nub-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-nub-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-nub-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-puff-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-puff-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-puff-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-puff-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-puff-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-skitter-tail-puff-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-body-base-16-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-turtle-body-base-16-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-turtle-body-base-32-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-turtle-body-base-32-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-turtle-body-base-48-back-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-turtle-body-base-48-front-idle.png | pass | front or back on; head light patch is bug 32, not angle |
| pets/pet-turtle-ears-bunny-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-bunny-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-bunny-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-bunny-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-bunny-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-bunny-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-floppy-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-floppy-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-floppy-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-floppy-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-floppy-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-floppy-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-pointy-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-pointy-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-pointy-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-pointy-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-pointy-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-pointy-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-round-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-round-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-round-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-round-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-round-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-round-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-tuft-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-tuft-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-tuft-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-tuft-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-tuft-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-ears-tuft-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-face-eyes-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-face-eyes-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-face-eyes-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-face-eyes-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-face-eyes-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-face-eyes-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-antlers-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-antlers-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-antlers-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-antlers-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-antlers-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-antlers-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-none-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-none-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-none-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-none-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-none-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-none-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-nubs-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-nubs-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-nubs-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-nubs-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-nubs-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-nubs-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-unicorn-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-unicorn-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-unicorn-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-unicorn-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-unicorn-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-horns-unicorn-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-belly-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-belly-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-belly-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-belly-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-belly-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-belly-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-plain-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-plain-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-plain-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-plain-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-plain-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-plain-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-spots-16-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-turtle-pattern-spots-16-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-turtle-pattern-spots-32-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-turtle-pattern-spots-32-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-turtle-pattern-spots-48-back-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-turtle-pattern-spots-48-front-idle.png | pass | angle fine; file deleted by bug 33 |
| pets/pet-turtle-pattern-stripes-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-stripes-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-stripes-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-stripes-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-stripes-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-pattern-stripes-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-shadow-contact-16-front-idle.png | pass | flat contact shadow |
| pets/pet-turtle-shadow-contact-32-front-idle.png | pass | flat contact shadow |
| pets/pet-turtle-shadow-contact-48-front-idle.png | pass | flat contact shadow |
| pets/pet-turtle-tail-curl-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-curl-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-curl-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-curl-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-curl-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-curl-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-fox-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-fox-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-fox-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-fox-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-fox-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-fox-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-none-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-none-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-none-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-none-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-none-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-none-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-nub-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-nub-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-nub-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-nub-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-nub-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-nub-48-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-puff-16-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-puff-16-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-puff-32-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-puff-32-front-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-puff-48-back-idle.png | pass | part of a front or back pet |
| pets/pet-turtle-tail-puff-48-front-idle.png | pass | part of a front or back pet |
| playground-slide.png | pass | new, straight-on, replaces the side view in the props sheet (bug 35) |
| plan-bubble-icon.png | pass | flat icon or front view |
| soccer-ball.png | pass | round, no angle to read |
| soccer-goal.png | pass after rework | was three-quarter; Codex redrew it straight-on, re-audited on `.scratch/audit/goal-8x.png` and in the game |
| thought-bubble-icon.png | pass | flat icon or front view |
| trade-icon.png | pass | flat icon or front view |
| wild/forest-sprig-16-back-idle.png | pass | symmetric front or back view; no side face |
| wild/forest-sprig-16-front-idle.png | pass | symmetric front or back view; no side face |
| wild/forest-sprig-32-back-idle.png | pass | symmetric front or back view; no side face |
| wild/forest-sprig-32-front-idle.png | pass | symmetric front or back view; no side face |
| wild/forest-sprig-48-back-idle.png | pass | symmetric front or back view; no side face |
| wild/forest-sprig-48-front-idle.png | pass | symmetric front or back view; no side face |
| wild/pond-glimmer-16-back-idle.png | pass | symmetric front or back view; no side face |
| wild/pond-glimmer-16-front-idle.png | pass | symmetric front or back view; no side face |
| wild/pond-glimmer-32-back-idle.png | pass | symmetric front or back view; no side face |
| wild/pond-glimmer-32-front-idle.png | pass | symmetric front or back view; no side face |
| wild/pond-glimmer-48-back-idle.png | pass | symmetric front or back view; no side face |
| wild/pond-glimmer-48-front-idle.png | pass | symmetric front or back view; no side face |
| wild/rock-prism-16-back-idle.png | pass | symmetric front or back view; no side face |
| wild/rock-prism-16-front-idle.png | pass | symmetric front or back view; no side face |
| wild/rock-prism-32-back-idle.png | pass | symmetric front or back view; no side face |
| wild/rock-prism-32-front-idle.png | pass | symmetric front or back view; no side face |
| wild/rock-prism-48-back-idle.png | pass | symmetric front or back view; no side face |
| wild/rock-prism-48-front-idle.png | pass | symmetric front or back view; no side face |
| wild/sky-wisp-16-back-idle.png | pass | symmetric front or back view; no side face |
| wild/sky-wisp-16-front-idle.png | pass | symmetric front or back view; no side face |
| wild/sky-wisp-32-back-idle.png | pass | symmetric front or back view; no side face |
| wild/sky-wisp-32-front-idle.png | pass | symmetric front or back view; no side face |
| wild/sky-wisp-48-back-idle.png | pass | symmetric front or back view; no side face |
| wild/sky-wisp-48-front-idle.png | pass | symmetric front or back view; no side face |
