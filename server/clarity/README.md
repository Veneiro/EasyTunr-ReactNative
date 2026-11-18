---
license: cc-by-sa-4.0
base_model:
- timm/davit_base.msft_in1k
pipeline_tag: image-to-text
tags:
- music
---
**EVALUATION :**

Here is a comparison benchmark with audiveris.

![omr_vs_audiveris](https://cdn-uploads.huggingface.co/production/uploads/68a8f07e16e4098ee93359be/6ZEiOtmrqUcfV5VpDh5ce.png)

Those results were produced with [mir-evaluation](https://github.com/mir-evaluation/mir_eval) software.
Here is the list of the piece use with the script used to compare the musicxml files :

[The Entertainer](https://musescore.com/user/23627/scores/7089193)
[Prelude in D-Major / Scriabin](https://musescore.com/user/22164946/scores/5331579)
[Six Dances in Bulgarian Rythm](https://musescore.com/user/37481236/scores/6734146)
[Gnosienne No.1](https://musescore.com/classicman/scores/4131536)
[Traumerei / Schumann](https://musescore.com/user/33397673/scores/5902660)
[La Campanella](https://musescore.com/classicman/scores/4131536)
[Sonate No. 14, “Moonlight” 3rd Movement](https://musescore.com/classicman/scores/33715)
[Clair de Lune](https://musescore.com/user/19710/scores/58553)
[Waltz No.7 in C sharp minor Op.64 No.2 / Frédéric Chopin](https://musescore.com/user/19710/scores/58553)
[Fugue No. 2 BWV 847 in C Minor](https://musescore.com/classicman/scores/231261)

Here is the python script used for the comparisons and scoring [here](https://gist.github.com/clquwu/9992cca340c9d7b07a2a3528fe2e946d)

A note on those results show clear sign of how the model can be good but the limitations it has too. On scores with no clean arrangment following the stave the model suffers a lot !
Beceause the model has been trained to recognize stave by stave it misses a lot if it's not proprely organized.
That's why i picked a variety of scores in the benchmark to show that without cherry picking the model performance can be very low.

**USING IT:**

On this [repo](https://github.com/clquwu/Clarity-OMR) you will find a tool to use the omr model as well as information on how to install it.
Since it's a model how fast it is depends a lot of your hardware too. On my gpu on normal mode it's 3* times faster than audiveris with an average of about 10 seconds per page.
Those exemples is with a rtx 3080 gpu. But it should run well on any gpu.

**And What?**

On this section i will be discussing as of how the model could be better with this approach of a davit base model with dora training for omr purposes and how it could get better right now.
First for a bit of context i am no scientist i am a student so i was limited in ressources for the training itself. So an individual or a proper team with the ressources could probably (like a cluster of gpu) produce a better model easily.
Second the model is quite slow and is part due to a choice i made during the choice of a dora rank for the model. Right now 64 is used but 32 would be enough and could lead to 30-40% improvments in inference speed.
I also think that the model can get extra better with help of vision where it struggles or just a different approach that my stave by stave basis.
Any training code i produced for training the model will be on [this repo](https://github.com/clquwu/Clarity-OMR-Train) there is also all my architecturals choices and the research papers i used.
I hope that a better model can be produced and/or someone implement the model x vision too make the accuracy even better !
