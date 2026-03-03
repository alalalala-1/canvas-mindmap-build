# 4 The Propagation of Light 

## 4.1 Introduction

Our present concern is with the basic phenomena of transmission (p. 101), reflection (p. 104), and refraction (p. 108). These will be described classically in two ways: first, via the general notions of waves and rays (p. 116) and then from the more specific perspective of Electromagnetic Theory (p. 121). After that, we'll turn to a highly simplified treatment of Quantum Electrodynamics (QED) for a modern interpretation of what's happening (p. 149).

Most students have already studied these fundamental propagation phenomena in some introductory way and found ideas like the Laws of Reflection and Refraction to be straightforward and simple. But that's only because such treatments are from a macroscopic perspective that tends to be misleadingly superficial. For instance, reflection, which looks as obvious as light "bouncing off a surface," is a wonderfully subtle affair usually involving the coordinated behavior of countless atoms. The more deeply we explore these processes, the more challenging they become. Beyond that, many fascinating questions need to be addressed: How does light move through a material medium? What happens to it as it does? Why does light appear to travel at a speed other than $c$ when photons can exist only at $c$ ?

Each encounter of light with bulk matter can be viewed as a cooperative event arising when a stream of photons sails through, and interacts with, an array of atoms suspended (via electromagnetic fields) in the void. The details of that journey determine why the sky is blue and blood is red, why your cornea is transparent and your hand opaque, why snow is white and rain is not. At its core, this chapter is about ***scattering***, in particular, the absorption and prompt re-emission of EM-radiation by electrons associated with atoms and molecules. ***The processes of transmission, reflection, and refraction are macroscopic manifestations of scattering occurring on a submicroscopic level***.

To begin the analysis, let's first consider the propagation of radiant energy through various homogeneous media.

## 4.1 光的传播——简介
> [!光的传播——简介]-
> 
> ### 1. 三大宏观现象 (Macroscopic Phenomena)
> 文中首先明确了光学研究的三个基本现象，它们是我们日常生活中最直观的观测对象：
> *   **透射 (Transmission):** 光穿过介质继续传播的现象。
> *   **反射 (Reflection):** 光在两种介质界面上改变传播方向返回原介质的现象。
> *   **折射 (Refraction):** 光从一种介质进入另一种介质时，由于速度改变而导致传播方向发生偏折的现象。
> 
> ### 2. 三大理论描述工具 (Theoretical Frameworks)
> 为了解释上述现象，物理学提供了由浅入深的三套工具：
> * **几何光学与波动光学 (Rays and Waves):** 最基础的描述方式。将光简化为沿直线传播的“光线”或具有周期性的“波动”。这足以处理大部分工程问题（如透镜成像），但无法解释光与物质相互作用的本质。
> * **电磁理论 (Electromagnetic Theory):** 在经典物理框架下，将光视为交变的电磁场。通过麦克斯韦方程组描述电磁波在介质中的传播，能更严谨地推导出反射和折射定律。
> * **量子电动力学 (Quantum Electrodynamics, QED):** 最现代、最本质的理论。它将光视为**光子 (Photons)**，将物质视为原子阵列，通过量子力学描述光子与带电粒子（主要是电子）之间的相互作用。
> 
> ### 3. 核心微观机制：散射 (Scattering)
> 这是本文最关键的洞察: <mark style="background: #86BDCEA6;">所有的宏观光学现象本质上都是**散射**的结果</mark>。
> * **散射的定义:** 在微观层面，光（电磁辐射）被原子或分子中的电子**吸收 (Absorption)** 并随后**立即重新发射 (Prompt Re-emission)** 的过程。
> * **协同行为 (Cooperative Behavior):** 宏观上的反射或透射，并不是单一原子的行为，而是无数原子在电磁场作用下产生的协同效应。
> * **光速悖论:** 
>     * 在真空中，光子的速度恒为 $c$。
>     * 在介质中，光表现出的速度 $v < c$，这<mark style="background: #76AD62A6;">并非光子本身减速了，而是因为光子在不断被吸收和再发射的过程中产生了滞后，这种大量微观事件的统计结果在宏观上表现为速度的降低</mark>。
> 
> ### 4. 概念间的逻辑关系总结
> 我们可以用以下逻辑链条将这些术语串联起来：
> $$ \text{微观：光子} + \text{原子/电子} \xrightarrow{\text{相互作用}} \text{散射 (吸收与再发射)} $$
> $$ \downarrow (\text{大量粒子的协同效应}) $$
> $$ \text{宏观表现：透射、反射、折射} $$
> 
> **点评：**
> 需要掌握的最核心的一点是：**不要被宏观的简洁所误导**。虽然反射定律 $\theta_i = \theta_r$ 看起来非常简单，但其背后的物理本质是极其复杂的微观散射过程。
> * **工具选择：** 当我们讨论影子和成像时，用**光线**；讨论干涉和衍射时，用**波动**；讨论物质内部细节时，必须回归**散射**和**QED**。
> * **因果关系：** 散射是“因”，透射/反射/折射是“果”。介质的性质（如透明度、颜色）取决于原子阵列如何对入射光子进行散射。
> 
> 通过这种从微观到宏观的统一视角，你将能更深刻地理解为什么天空是蓝的，而雪是白的。

## 4.2 Rayleigh Scattering

Imagine a narrow beam of sunlight having a broad range of frequencies advancing through empty space. As it progresses, the beam spreads out very slightly, but apart from that, all the energy continues forward at $c$. There is no scattering, and the
beam cannot be seen from the side. Nor does the light tire or diminish in any way. When a star in a nearby galaxy $1.7 \times 10^{5}$ light-years away was seen to explode in 1987, the flash of light that reached Earth had been sailing through space for 170000 years before it got here. ***Photons are timeless***.

Now, suppose we mix a wisp of air into the void-some molecules of nitrogen, oxygen, and so forth. These molecules have no resonances in the visible, no one of them can be raised into an excited state by absorbing a quantum of light, and the gas is therefore transparent. Instead, each molecule behaves as a little oscillator whose electron cloud can be driven into a ground-state vibration by an incoming photon. Immediately upon being set vibrating, the molecule initiates the re-emission of light. A photon is absorbed, and without delay another photon of the same frequency (and wavelength) is emitted; the light is elastically scattered. The molecules are randomly oriented, and photons scatter out every which way (Fig. 4.1). Even when the light is fairly dim, the number of photons is immense, and it looks as if the molecules are scattering little classical spherical wavelets (Fig. 4.2)—energy streams out in every direction. Still, the scattering process is quite weak and the gas tenuous, so the beam is very little attenuated unless it passes through a tremendous volume of air.
(a)
![600](4-Optics/images/img-0.jpeg.png)
(b)
![400](4-Optics/images/img-1.jpeg.png)
> ecules. The light laterally scattered is mostly blue, and that's why the sky is blue. The unscattered light, which is rich in red, is viewed only when the Sun is low in the sky at sunrise and sunset. (b) Solar rays reach about $18^{\circ}$ beyond the daytime terminator because of atmospheric scattering. Over this twilight band the skylight fades to the complete darkness of night.

![300](4-Optics/images/img-2.jpeg.png)
> Figure 4.2 A plane wave, incident from the left, sweeps across an atom and spherical wavelets are scattered. The process is continuous, and hundreds of millions of photons per second stream out of the scattering atom in all directions.

The amplitudes of these ground-state vibrations, and therefore the amplitudes of the scattered light, increase with frequency because all the molecules have electronic resonances in the UV. The closer the driving frequency is to a resonance, the more vigorously the oscillator responds. So, violet light is strongly scattered laterally out of the beam, as is blue to a slightly lesser degree, as is green to a considerably lesser degree, as is yellow to a still lesser degree, and so on. The beam that traverses the gas will thus be strong in the red end of the spectrum, while the light scattered out (sunlight not having very much violet in it, in comparison to blue, in the first place) will abound in blue. The human eye also tends to average the broad cacophony of scattered frequencies-rich in violet, blue, and green-into a background of white plus a vivid $476-\mathrm{nm}$ blue, resulting in our familiar pale-blue sky[^sky].

[^sky]:    *G. S. Smith, "Human color vision and the unsaturated blue color of the daytime sky," Am. J. Phys. 73, 590 (2005).

Long before Quantum Mechanics, Lord Rayleigh (1871) analyzed scattered sunlight in terms of molecular oscillators. Using a simple argument based on dimensional analysis (see Problem 4.1), he correctly concluded that the intensity of the scattered light was proportional to $1 / \lambda^{4}$ and therefore increases with $\nu^{4}$. Before this work, it was widely believed that the sky was blue because of scattering from minute dust particles. Since that time, scattering involving particles smaller than a wavelength (i.e., less than about $\lambda / 10$ ) has been referred to as ***Rayleigh Scattering***, Atoms and ordinary molecules fit the bill since they are a few tenths of a nanometer in diameter, whereas light has a wavelength of around 500 nm . Additionally, non-uniformities, as long as they are small, will scatter light. Tiny fibers, bubbles, particles, and droplets all scatter. In Rayleigh Scattering the precise shape of the scatterers is usually of little consequence. The amount of scattering is proportional to the diameter of the scatterer divided by the wavelength of the incident radiation. Accordingly, the blue end of the spectrum is scattered most. A human's blue eyes, a bluejay's feathers, the blue-tailed skink's blue tail, and the baboon's blue buttocks are all colored via Rayleigh Scattering. Indeed, in the animal kingdom scattering is the cause of almost all the blue, much of the green, and even some of the purple coloration. Scattering from the tiny alveolar cells in the barbs of the jay's feathers make it blue, whereas a parrot's green is a blend of yellow arising from preferential absorption (p. 144) and blue via scattering. The blue appearance of veins is in part due to scattering.

As we will see in a moment, a dense uniform substance will not appreciably scatter laterally, and that applies to much of the lower atmosphere. After all, if blue light were strongly scattered out at sea level, a far-off mountain would appear reddish and that's not the case even over distances of tens of kilometers. In the middle regions of the atmosphere, the density is still great enough to suppress Rayleigh Scattering; something else must be contributing to the blue of the sky. What happens in the midatmosphere is that thermal motion of the air results in rapidly changing density fluctuations on a local scale. These momentary, fairly random microscopic fluctuations cause more molecules to be in one place than another and to radiate more in one direction than another. M. Smoluchowski (1908) and A. Einstein (1910) independently provided the basic ideas for the theory of scattering from these fluctuations, which gives similar results to those of Rayleigh. Scattering from inhomogeneities in density is of interest whenever light travels great distances in a medium, such as the glass fiber of a communications link (p. 208).

Sunlight streaming into the atmosphere from one direction is scattered in all directions-Rayleigh Scattering is the same in the forward and backward directions. Without an atmosphere, the daytime sky would be as black as the void of space, as black as the Moon sky. When the Sun is low over the horizon, its light passes through a great thickness of air (far more so than it does at noon). With the blue-end appreciably attenuated, the reds and yellows propagate along the line-of-sight from the Sun to produce Earth's familiar fiery sunsets.
![300](4-Optics/images/img-3.jpeg.png)
> Without an atmosphere to scatter sunlight, the Moon's sky is an eerie black. (DVIDS/NASA)

### 4.2.1 Scattering and Interference

In dense media, a tremendous number of close-together atoms or molecules contribute an equally tremendous number of scattered electromagnetic wavelets. These wavelets overlap and interfere in a way that does not occur in a tenuous medium. As a rule, ***the denser the substance through which light advances, the less the lateral scattering***, and to understand why that's so, we must examine the interference taking place.

Interference has already been discussed (p. 28) and will be treated in further detail in Chapters 7 and 9; here, the basics suffice. Recall that interference is the superposition of two or more waves producing a resultant disturbance that is the sum of the overlapping wave contributions. Figure 2.16 shows two harmonic waves of the same frequency traveling in the same direction. When such waves are precisely in-phase (Fig. 2.16a), the resultant at every point is the sum of the two wave-height values. This extreme case is called ***total constructive interference***. When the phase difference reaches $180^{\circ}$, the waves tend to cancel, and we have the other extreme, called ***total destructive interference*** (Fig. 2.16d).

The theory of Rayleigh Scattering has independent molecules randomly arrayed in space so that the phases of the secondary wavelets scattered off to the side have no particular relationship to one another and there is no sustained pattern of interference. That situation occurs when the separation between the molecular scatterers is roughly a wavelength or more, as it is in a tenuous gas. In Fig. 4.3a a parallel beam of light is incident from the left. This so-called primary light field (in this instance composed of plane waves) illuminates a group of widely spaced molecules. A continuing progression of primary wavefronts sweep over and successively energize and reenergize each molecule, which, in turn, scatters light in all directions, and in particular out to some lateral point $P$. Because the lengths of their individual paths to $P$ differ greatly in comparison to $\lambda$, some of the wavelets arriving at $P$ are ahead of others while some are behind, and that by substantial fractions of a wavelength (Fig. 4.3b). In other words, the phases of the wavelets at $P$ differ greatly. (Remember that the molecules are also moving around, and that changes the phases as well.) At any moment some wavelets interfere constructively, some destructively, and the shifting random hodgepodge of overlapping wavelets effectively averages away the interference. ***Random, widely spaced scatterers driven by an incident primary wave emit wavelets that are essentially independent of one another in all directions except forward. Laterally scattered light, unimpeded by interference, streams out of the beam***. This is approximately the situation existing about 100 miles up in the Earth's tenuous highaltitude atmosphere, where a good deal of blue-light scattering takes place.
![350](4-Optics/images/img-4.jpeg.png)
> Figure 4.3 Consider a plane wave entering from the left. (a) The scattering of light from a widely spaced distribution of molecules. (b) The wavelets arriving at a lateral point $P$ have a jumble of different phases and tend not to interfere in a sustained constructive fashion. (c) That can probably be appreciated most easily using phasors. As they arrive at $P$ the phasors have large phase-angle differences with respect to each other. When added tip-to-tail they therefore tend to spiral around keeping the resultant phasor quite small. Remember that we are really dealing with millions of tiny phasors rather than four substantial ones.

That the scattered irradiance should depend on $1 / \lambda^{4}$ is easily seen by returning to the concept of dipole radiation (Section 3.4.3). Each molecule is taken as an electron oscillator driveninto vibration by the incident field. Being far apart, they are assumed to be independent of one another and each radiates in accord with Eq. (3.56). The scattered electric fields are essentially independent, and there is no interference laterally. Accordingly, the net irradiance at $P$ is the algebraic sum of the scattered irradiances from each molecule (p. 73). For an individual scatterer the irradiance is given by Eq. (3.57), and it varies with $\omega^{4}$.

The advent of the laser has made it relatively easy to observe Rayleigh Scattering directly in low-pressure gases, and the results confirm the theory.

#### Forward Propagation

To see why the forward direction is special, why the wave advances in any medium, consider Fig. 4.4. Notice that for a forward point $P$ the light scattered first (by the atom on the far left) travels the longest path, whereas the light scattered last (from the atom on the right) travels the shortest path. A more detailed description is provided by Fig. 4.5. It depicts a sequence in time showing two molecules $A$ and $B$, interacting with an incoming primary plane wave-a solid arc represents a secondary wavelet peak (a positive maximum); a dashed arc corresponds to a trough (a negative maximum). In (a), the primary wavefront impinges on molecule $A$, which begins to scatter a spherical wavelet. For the moment, suppose the wavelet is $180^{\circ}$ out-of-phase with the incident wave. (A driven oscillator is usually out-of-phase with the driver: p. 102.) Thus $A$ begins to radiate a trough (a negative $E$-field) in response to being driven by a peak (a positive $E$-field). Part (b) shows the spherical wavelet and the plane wave overlapping, marching out-of-step but marching together. The incident wavefront impinges on $B$, and it, in turn, begins to reradiate a wavelet, which must also be out-of-phase by $180^{\circ}$. In (c) and (d), we see the point of all of this, namely, that both wavelets are moving forward-they are in-phase with each other. That condition would be true for all such wavelets regardless of both how many molecules there were and how they were distributed. Because of the asymmetry introduced by the beam itself, ***all the scattered wavelets add constructively with each other in the forward direction***.
![400](4-Optics/images/img-5.jpeg.png)
> Figure 4.4 Consider a plane wave entering from the left. Light is scattered more or less in the forward direction.

![200](4-Optics/images/img-6.jpeg.png)
> Figure 4.5 In the forward direction the scattered wavelets arrive in-phase on planar wave-fronts-trough with trough, peak with peak.

### 4.2.2 The Transmission of Light Through Dense Media

Now, suppose the amount of air in the region under consideration is increased. In fact, imagine that each little cube of air, one wavelength on a side, contains a great many molecules, whereupon it is said to have an appreciable optical density. (This usage probably derives from the fact that early experiments on gases indicated that an increase in density is accompanied by a proportionate increase in the index of refraction.) At the wavelengths of light, the Earth's atmosphere at STP has about 3 million molecules in such a $\lambda^{3}$-cube. The scattered wavelets ( $\lambda \approx 500 \mathrm{~nm}$ ) radiated by sources so close together $(\approx 3 \mathrm{~nm})$ cannot properly be assumed to arrive at some point $P$ with random phases-interference will be important. This is equally true in liquids and solids where the atoms are 10 times closer and arrayed in a far more orderly fashion. In such cases, the light beam effectively encounters a uniform medium with no discontinuities to destroy the symmetry. Again, the scattered wavelets interfere constructively in the forward direction (that much is independent of the arrangement of the molecules), but now destructive interference predominates in all other directions. ***Little or no light ends up scattered laterally or backwards in a dense homogeneous medium***.

To illustrate the phenomenon, Fig. 4.6 shows a beam moving through an ordered array of close-together scatterers. All along wavefronts throughout the beam, sheets of molecules are energized in-phase, radiate, and are reenergized, over and over again as the light sweeps past. Thus some molecule $A$ radiates spherically out of the beam, but because of the ordered close arrangement, there will be a molecule $B$, a distance $\approx \lambda / 2$ away, such that both wavelets cancel in the transverse direction. Here, where $\lambda$ is thousands of times larger than the scatterers and their spacing, there will likely always be pairs of molecules that tend to negate each other's wavelets in any given lateral direction. Even if the medium is not perfectly ordered, the net electric field at a point in any transverse direction will be the sum of a great many tiny scattered fields, each somewhat out-of-phase with the next, so that the sum (which will be different from point to point) will always be small (Fig. 4.7). This makes sense from the perspective of conservation of energy-we can't have constructive interference in every direction. ***Interference produces a redistribution of energy, out of the regions where it's destructive into the regions where it's constructive.***

![300](4-Optics/images/img-7.jpeg.png)
> Figure 4.6 A plane wave impinging from the left. The medium is composed of many closely spaced atoms. Among countless others, a wavefront stimulates two atoms, $A$ and $B$, that are very nearly one-half wavelength apart. The wavelets they emit interfere destructively. Trough overlaps crest, and they completely cancel each other in the direction perpendicular to the beam. That process happens over and over again, and little or no light is scattered laterally.

![400](4-Optics/images/img-8.jpeg.png)
> Figure 4.7 (a) When a great many tiny slightly shifted waves arrive at a point in space, there is generally as much positive $E$-field as negative, and the resultant disturbance is nearly zero. (b) The tiny phasors representing those waves form a very small circular figure, and the resultant (which oscillates in a way that depends on the number of waves) is never large.

The more dense, uniform, and ordered the medium is (the more nearly homogeneous), the more complete will be the lateral destructive interference and the smaller the amount of nonforward scattering. Thus most of the energy will go into the forward direction, and the beam will advance essentially undiminished (Fig. 4.8).
![400](4-Optics/images/img-10.jpeg.png)
> Figure 4.8 A downward plane wave incident on an ordered array of atoms. Wavelets scatter in all directions and overlap to form an ongoing secondary plane wave traveling downward. (E.H.)

Scattering on a per-molecule basis is extremely weak. In order to have half its energy scattered, a beam of green light will have to traverse $\approx 150 \mathrm{~km}$ of atmosphere. Since about 1000 times more molecules are in a given volume of liquid than in the same volume of vapor (at atmospheric pressure), we can expect to see an increase in scattering. Still, the liquid is a far more ordered state with much less pronounced density fluctuations, and that should suppress the nonforward scattering appreciably. Accordingly, an increased scattering per unit volume is observed in liquids, but it's more like 5 to 50 times as much rather than 1000 times. Molecule for molecule, liquids scatter substantially less than gases. Put a few drops of milk in a tank of water and illuminate it with a bright flashlight beam. A faint but unmistakable blue haze will scatter out laterally, and the direct beam will emerge decidedly reddened.

Transparent amorphous solids, such as glass and plastic, will also scatter light laterally, but very weakly. Good crystals, like quartz and mica, with their almost perfectly ordered structures, scatter even more faintly. Of course, imperfections of all sorts (dust and bubbles in liquids, flaws and impurities in solids) will serve as scatterers, and when these are small, as in the gem moonstone, the emerging light will be bluish.

In 1869 John Tyndall experimentally studied the scattering produced by small particles. He found that as the size of the particles increased (from a fraction of a wavelength), the amount of scattering of the longer wavelengths increased proportionately. Ordinary clouds in the sky testify to the fact that relatively large droplets of water scatter white light with no appreciable coloration. The same is true of the microscopic globules of fat and protein in milk.

When the number of molecules in a particle is small, they are all close to one another and act in unison; their wavelets interfere constructively, and the scattering is strong. As the size of the particle approaches a wavelength, the atoms at its extremities no longer radiate wavelets that are necessarily in-phase and the scattering begins to diminish. This happens first at the short wavelengths (blue), and so as the particle size increases, it scatters proportionately more of the red end of the spectrum (and it does so increasingly in the forward direction).

The theoretical analysis of scattering from spherical particles about the size of a wavelength or so was first published by Gustav Mie in 1908. ***Mie Scattering*** depends only weakly on wavelength and becomes independent of it (white light in, white light out) when the particle size exceeds $\lambda$. In Mie Scattering the theory requires that the scatterers be nearly spherical. The amount of scattering increases with the diameter of the transparent bubbles, crystals, fibers, and so on, doing the scattering. Unlike Rayleigh Scattering, Mie Scattering is stronger in the forward direction than in the backward direction. Reasonably enough, Rayleigh Scattering is the small-size limiting case of Mie Scattering.

On an overcast day, the sky looks hazy gray because of water droplets comparable in size to lightwaves. In the same way, some inexpensive plastic food containers and white garbage-bag plastic look pale blue-white in scattered light and are distinctly orange in transmitted light. The garbage bags, in order to be made opaque, contain ( $2-2.5 \%$ ) clear $\mathrm{TiO}_{2}$ spheres ( $n=2.76$ ) about 200 nm in diameter, and these Mie scatter bluish white[^white].*

[^white]:    *It has only recently been observed (and that was by chance) that inhomogeneous opaque materials, such as milk and white paint, can reduce the effective speed of light to as little as one-tenth the value anticipated for the medium. See S. John, "Localization of light," Phys. Today 44, 32 (1991).

When the transparent particle diameters exceed around 10 wavelengths the ordinary laws of geometrical optics work nicely and we might well refer to the process as ***geometrical scattering***.

### 4.2.3 Transmission and the Index of Refraction

The transmission of light through a homogeneous medium is an ongoing repetitive process of scattering and rescattering. Each such event introduces a phase shift into the light field, which ultimately shows up as a shift in the apparent phase velocity of the transmitted beam from its nominal value of $c$. That corresponds to an index of refraction for the medium $(n=c / v)$ that is other than one, even though ***photons exist only at a speed $c$***.

To see how this comes about, return to Fig. 4.5. Recall that the scattered wavelets all combine in-phase in the forward direction to form what might best be called the secondary wave. For empirical reasons alone we can anticipate that the secondary wave will combine with what is left of the primary wave to yield the only observed disturbance within the medium, namely, the ***transmitted wave***. Both the primary and secondary electromagnetic waves propagate through the interatomic void with the speed $c$. Yet the medium can certainly possess an index of refraction other than 1 . The refracted wave may appear to have a phase velocity less than, equal to, or even greater than $c$. The key to this apparent contradiction resides in the phase relationship between the secondary and primary waves.

The classical model predicts that the electron-oscillators will be able to vibrate almost completely in-phase with the driving force (i.e., the primary disturbance) only at relatively low frequencies. As the frequency of the electromagnetic field increases, the oscillators will fall behind, lagging in phase by a proportionately larger amount. A detailed analysis reveals that at resonance the phase lag will reach $90^{\circ}$, increasing thereafter to almost $180^{\circ}$, or half a wavelength, at frequencies well above the particular characteristic value. Problem 4.4 explores this phase lag for a damped driven oscillator, and Fig. 4.9 summarizes the results.

![350](4-Optics/images/img-11.jpeg.png)
> Figure 4.9 A schematic representation of (a) amplitude and (b) phase lag versus driving frequency for a damped oscillator. The dashed curves correspond to decreased damping. The corresponding index of refraction is shown in (c).

In addition to these lags there is another effect that must be considered. When the scattered wavelets recombine, the resultant secondary wave[^wavee] itself lags the oscillators by $90^{\circ}$.

[^wavee]:    *This point will be made more plausible when we consider the predictions of the Huygens-Fresnel Theory in the diffraction chapter. Most texts on E \& M treat the problem of radiation from a sheet of oscillating charges, in which case the $90^{\circ}$ phase lag is a natural result (see Problem 4.5).

The combined effect of both these mechanisms is that at frequencies below resonance, the secondary wave lags the primary (Fig. 4.10) by some amount between approximately $90^{\circ}$ and $180^{\circ}$, and at frequencies above resonance, the lag ranges from about $180^{\circ}$ to $270^{\circ}$. But a phase lag of $\delta \geq 180^{\circ}$ is equivalent to a phase lead of $360^{\circ}-\delta$,  e.g., $\cos (\theta -270^{\circ})=\cos (\theta +90^{\circ})$ . This much can be seen on the right side of Fig. 4.9b.

Within the transparent medium, the primary and secondary waves overlap and, depending on their amplitudes and relative phase, generate the net transmitted disturbance. Except for the fact that it is weakened by scattering, the primary wave travels into the material just as if it were traversing free space. By comparison to this free-space wave, which initiated the process, the resultant transmitted wave is phase shifted, and this phase difference is crucial.

![300](4-Optics/images/img-12.jpeg.png)
> Figure 4.10 A primary wave (a) and two possible secondary waves. In (b) the secondary lags the primary-it takes longer to reach any given value. In (c) the secondary wave reaches any given value before (at an earlier time than) the primary; that is, it leads.

When the secondary wave lags (or leads) the primary, the resultant transmitted wave must also lag (or lead) it by some amount (Fig. 4.11). This qualitative relationship will serve our purposes for the moment, although it should be noted that the phase of the resultant also depends on the amplitudes of the interacting waves [see Eq. (7.10)]. At frequencies below $\omega_{0}$ the transmitted wave lags the free-space wave, whereas at frequencies above $\omega_{0}$ it leads the free-space wave. For the special case in which $\omega=\omega_{0}$ the secondary and primary waves are out-of-phase by $180^{\circ}$. The former works against the latter, so that the refracted wave is appreciably reduced in amplitude although unaffected in phase.

As the transmitted wave advances through the medium, scattering occurs over and over again. Light traversing the substance is progressively retarded (or advanced) in phase. Evidently, since the speed of the wave is the rate of advance of the condition of constant phase, a change in the phase should correspond to a change in the speed.

We now wish to show that a phase shift is indeed tantamount to a difference in phase velocity. In free space, the resultant disturbance at some point $P$ may be written as
$$
E_{R}(t)=E_{0} \cos \omega t\tag{4.1}
$$

![300](4-Optics/images/img-13.jpeg.png)
> Figure 4.11 If the secondary leads the primary, the resultant will also lead it. That point is underscored by the phasor diagrams.

If $P$ is surrounded by a dielectric, there will be a cumulative phase shift $\varepsilon_{P}$, which was built up as the wave moved through the medium to $P$. At ordinary levels of irradiance the medium will behave linearly, and the frequency in the dielectric will be the same as that in vacuum, even though the wavelength and speed may differ. Once again, but this time in the medium, the disturbance at $P$ is
$$
E_{R}(t)=E_{0} \cos \left(\omega t-\varepsilon_{P}\right)\tag{4.2}
$$

where the subtraction of $\varepsilon_{P}$ corresponds to a phase lag. An observer at $P$ will have to wait a longer time for a given crest to arrive when she is in the medium than she would have had to wait in vacuum. That is, if you imagine two parallel waves of the same frequency, one in vacuum and one in the material, the vacuum wave will pass $P$ a time $\varepsilon_{P} / \omega$ before the other wave. Clearly then, a phase lag of $\varepsilon_{P}$ corresponds to a reduction in speed, $v<c$ and $n>1$. Similarly, a phase lead yields an increase in speed, $v>c$ and $n<1$. Again, the scattering process is a continuous one, and the cumulative phase shift builds as the light penetrates the medium. That is to say, $\varepsilon$ is a function of the length of dielectric traversed, as it must be if $v$ is to be constant (see Problem 4.5). In the vast majority of situations encountered in Optics $v<c$ and $n>1$; see Table 4.1. The important exception is the case of X-ray propagation, where $\omega>\omega_{0}$, $v>c$, and $n<1$.

| Air                                                                    | 1.00029 |
| :--------------------------------------------------------------------- | :------ |
| Ice                                                                    | 1.31    |
| Water                                                                  | 1.333   |
| Ethyl alcohol $\left(\mathrm{C}_{2} \mathrm{H}_{5} \mathrm{OH}\right)$ | 1.36    |
| Kerosene                                                               | 1.448   |
| Fused quartz $\left(\mathrm{SiO}_{2}\right)$                           | 1.4584  |
| Karo (sugar) syrup                                                     | 1.46    |
| Carbon tetrachloride $\left(\mathrm{CCl}_{4}\right)$                   | 1.46    |
| Olive oil                                                              | 1.47    |
| Turpentine                                                             | 1.472   |
| Old formula Pyrex                                                      | 1.48    |
| 41\% Benzene + 59\% carbon tetrachloride                               | 1.48    |
| Methyl methacrylate                                                    | 1.492   |
| Benzene $\left(\mathrm{C}_{6} \mathrm{H}_{6}\right)$                   | 1.501   |
| Plexiglas                                                              | 1.51    |
| Oil of cedarwood                                                       | 1.51    |
| Crown glass                                                            | 1.52    |
| Sodium chloride $(\mathrm{NaCl})$                                      | 1.544   |
| Light flint glass                                                      | 1.58    |
| Polycarbonate                                                          | 1.586   |
| Polystyrene                                                            | 1.591   |
| Carbon disulfide $\left(\mathrm{CS}_{2}\right)$                        | 1.628   |
| Dense flint glass                                                      | 1.66    |
| Sapphire                                                               | 1.77    |
| Lanthanum flint glass                                                  | 1.80    |
| Heavy flint glass                                                      | 1.89    |
| Zircon $\left(\mathrm{ZrO}_{2} \cdot \mathrm{SiO}_{2}\right)$          | 1.923   |
| Fabulite $\left(\mathrm{SrTiO}_{3}\right)$                             | 2.409   |
| Diamond (C)                                                            | 2.417   |
| Rutile $\left(\mathrm{TiO}_{2}\right)$                                 | 2.907   |
| Gallium phosphide                                                      | 3.50    |
> **TABLE 4.1** Approximate Indices of Refraction of Various Substances*
* Values vary with physical conditions-purity, pressure, etc. These correspond to a wavelength of 589 nm .

The overall form of $n(\omega)$, as depicted in Fig. 4.9c, can now be understood as well. At frequencies far below $\omega_{0}$ the amplitudes of the oscillators and therefore of the secondary waves are very small,
and the phase angles are approximately $90^{\circ}$. Consequently, the refracted wave lags only slightly, and $n$ is only slightly greater than 1 . As $\omega$ increases, the secondary waves have greater amplitudes and lag by greater amounts. The result is a gradually decreasing wave speed and an increasing value of $n>1$. Although the amplitudes of the secondary waves continue to increase, their relative phases approach $180^{\circ}$ as $\omega$ approaches $\omega_{0}$. Consequently, their ability to cause a further increase in the resultant phase lag diminishes. A turning point $\left(\omega=\omega^{\prime}\right)$ is reached where the refracted wave begins to experience a decreasing phase lag and an increasing speed $(d n / d \omega<0)$. That continues until $\omega=\omega_{0}$, whereupon the transmitted wave is appreciably reduced in amplitude but unaltered in phase and speed. At that point, $n=1, v=c$, and we are more or less at the center of the absorption band.

At frequencies just beyond $\omega_{0}$ the relatively large-amplitude secondary waves lead; the transmitted wave is advanced in phase, and its speed exceeds $c(n<1)$. As $\omega$ increases, the whole scenario is played out again in reverse (with some asymmetry due to frequency-dependent asymmetry in oscillator amplitudes and scattering). At even higher frequencies the secondary waves, which now have very small amplitudes, lead by nearly $90^{\circ}$. The resulting transmitted wave is advanced very slightly in phase, and $n$ gradually approaches 1 .

The precise shape of a particular $n(\omega)$ curve depends on the specific oscillator damping, as well as on the amount of absorption, which in turn depends on the number of oscillators participating.

A rigorous solution to the propagation problem is known as the Ewald-Oseen Extinction Theorem. Although the mathematical formalism, involving integro-differential equations, is far too complicated to treat here, the results are certainly of interest. It is found that the electron-oscillators generate an electromagnetic wave having essentially two terms. One of these precisely cancels the primary wave within the medium. The other, and only remaining disturbance, moves through the dielectric at a speed $v=c / n$ as the transmitted wave[^transmitted]. ***Henceforth we shall simply assume that a lightwave propagating through any substantive medium travels at a speed*** $v \neq c$. It should also be noted that the index of refraction varies with temperature (see Table 4.2), but the process is not well understood.

| $0^{\circ} \mathrm{C}$  | 1.3338 |
| :---------------------- | :----- |
| $20^{\circ} \mathrm{C}$ | 1.3330 |
| $40^{\circ} \mathrm{C}$ | 1.3307 |
| $60^{\circ} \mathrm{C}$ | 1.3272 |
| $80^{\circ} \mathrm{C}$ | 1.3230 |
> **TABLE 4.2** Temperature Dependence of the Index of Refraction of Water

[^transmitted]:  *For a discussion of the Ewald-Oseen Theorem, see Principles of Optics by Born and Wolf, Section 2.4.2; this is heavy reading. Also look at Reali, "Reflection from dielectric materials," Am. J. Phys. 50, 1133 (1982).

Apparently, any quantum-mechanical model we construct will somehow have to associate a wavelength with the photon. That's easily done mathematically via the expression $p=h / \lambda$, even if it's not clear at this point what is doing the waving. Still the wave nature of light seems inescapable; it will have to be infused into the theory one way or another. And once we have the ideaof a photon wavelength, it's natural to bring in the concept of relative phase. Thus ***the index of refraction arises when the absorption and emission process advances or retards the phases of the scattered photons, even as they travel at speed $c$***.


## 4.2 瑞利散射 (Rayleigh Scattering)
[!瑞利散射 (Rayleigh Scattering)]-

想象一下，一束包含了多种频率的狭窄太阳光束正在真空中传播。在前进的过程中，光束会发生极其微弱的扩散，但除此之外，所有的能量都以光速 $c$ 勇往直前。在空无一物的真空中，光不会被散射，因此我们无法从侧面“看到”这束光。光也不会“疲惫”，其能量在传播中不会有任何衰减。

这里有一个非常震撼的例子：1987年，天文学家观测到一颗位于17万光年外星系中的恒星发生了爆炸。这颗超新星爆发出的闪光，在抵达地球之前，已经在浩瀚的宇宙空间中航行了整整17万年。这告诉我们一个深刻的物理事实：**光子是永恒的 (Photons are timeless)**。<mark style="background: #86BDCEA6;">在真空中，一个 光子 ( Photon) 一旦被创造出来，除非它与物质发生相互作用，否则它将永远以光速 $c$ 运动下去，其能量和频率都不会改变。</mark>

现在，让我们往这片虚空中混入一缕空气——也就是一些氮气、氧气等气体分子。<mark style="background: #86BDCEA6;">这些分子在可见光波段没有 共振 ( Resonance) 频率</mark>。这意味着，它们无法通过吸收一个可见光光子，就从基态跃迁到一个能量更高的激发态。因此，对于可见光而言，这些气体是透明的。

那么，这些气体分子与光是如何相互作用的呢？它们表现得像一个个微小的振子。当入射光（电磁波）到来时，其交变的电场会驱动分子中的电子云，使其围绕原子核进行受迫振动。这种振动并非电子能级的跃迁，而是一种在基态附近的振动。

这个振动的电子云本身就构成了一个振荡的电偶极子，它会立即向外辐射电磁波——也就是重新发射出光。这个过程是：一个光子被吸收，紧接着，另一个频率（和波长）完全相同的光子被发射出来。我们称这种过程为 <mark style="background: #FF5582A6;">弹性散射 ( Elastic-Scattering)</mark>。由于气体分子是随机取向的，这些被重新发射的光子会朝向四面八方散射出去（如图 4.1 所示）。

即使光线相当昏暗，光子的数量也极其庞大。从宏观上看，就好像每个分子都在向各个方向散射出微小的经典球面子波（如图 4.2 所示），能量流向四面八方。尽管如此，单个分子的散射过程非常微弱，而且气体也相对稀薄，所以除非光束穿过极长距离的大气层，否则其能量衰减非常小。

![图 4.1 (a) 太阳光穿过大气层时，部分光被空气分子散射。侧向散射的光主要是蓝光，这就是天空呈蓝色的原因。未被散射的光中红色成分较多，只有当太阳位于地平线附近（日出和日落时）我们才能直视到它。(b) 由于大气的散射作用，太阳光可以照射到昼夜分界线以外约18度的区域。在这个暮色带中，天空的光线逐渐消逝，最终进入完全的黑夜。|700](4-Optics/images/img-0.jpeg.png)
> **图 4.1** (a) 太阳光穿过大气层时，部分光被空气分子散射。侧向散射的光主要是蓝光，这就是天空呈蓝色的原因。未被散射的光中红色成分较多，只有当太阳位于地平线附近（日出和日落时）我们才能直视到它。(b) 由于大气的散射作用，太阳光可以照射到昼夜分-界线以外约18度的区域。在这个暮色带中，天空的光线逐渐消逝，最终进入完全的黑夜。

![图 4.2 一束平面波从左侧入射，扫过一个原子，球形子波被散射出去。这个过程是连续的，每秒有数亿个光子从散射原子向各个方向流出。|400](4-Optics/images/img-2.jpeg.png)
> **图 4.2** 一束平面波从左侧入射，扫过一个原子，球形子波被散射出去。这个过程是连续的，每秒有数亿个光子从散射原子向各个方向流出。

### 4.2.1 散射强度与频率的关系：天空为何是蓝色的？

现在，我们来探讨一个核心问题：为什么散射的主要是蓝光？

这与我们前面提到的“振子模型”和“共振”概念密切相关。虽然空气分子在可见光区没有共振，但它们在能量更高的紫外（UV）区有电子共振频率。根据受迫振动的原理，驱动频率越接近一个系统的固有（共振）频率，振子的响应就越剧烈，振幅也越大。

* **类比：** 想象一下你在荡秋千。如果你的朋友按照秋千自身的摆动节奏（共振频率）来推你，你会被荡得很高（振幅大）。如果他以一个很慢或很快的节奏乱推，你就很难荡起来（振幅小）。

<mark style="background: #76AD62A6;">对于可见光来说，其频率从红光到紫光依次升高。紫光和蓝光的频率比红光和黄光的频率更高，因此它们更接近空气分子的紫外共振区。这意味着，当蓝光或紫光照射到空气分子上时，会比红光更能激发电子云产生剧烈的振动</mark>。

而<mark style="background: #86BDCEA6;">一个振动得越剧烈的电荷，它向外辐射的电磁波（也就是散射光）的强度就越大</mark>。早在量子力学诞生之前，瑞利勋爵（Lord Rayleigh）在1871年就通过基于量纲分析的简单论证，正确地得出了散射光强度 $I$ 与波长 $\lambda$ 的四次方成反比的结论，也就是与频率 $\nu$ 的四次方成正比：
$$
I \propto \nu^4 \propto \frac{1}{\lambda^4}
$$

这个公式是 #瑞利散射 ( #Rayleigh-Scattering) 的标志性关系。在瑞利的研究之前，人们普遍认为天空的蓝色是由于空气中微小尘埃颗粒的散射造成的。自那时起，凡是涉及<mark style="background: #86BDCEA6;">尺寸远小于波长的粒子</mark>（通常指小于 $\lambda/10$）的散射，都被称为<mark style="background: #FF5582A6;">瑞利散射</mark>。原子和普通分子的直径只有零点几纳米，而可见光的波长在400-700纳米左右，完全满足这个条件。

**详细推导解释 $I \propto 1/\lambda^4$：**
1.  **振子模型：** 入射光的电场 $E$ 对分子中的电子施加一个驱动力 $F = qE = eE_0 \cos(\omega t)$，其中 $\omega$ 是光的角频率。
2.  **受迫振动：** 电子的运动可以近似看作一个受迫阻尼振动。其运动方程为 $m\ddot{x} + \gamma\dot{x} + kx = eE_0 \cos(\omega t)$。在远离共振的低频区（可见光区），振动的稳态解的振幅 $A$ 近似正比于驱动力的振幅，即 $A \propto E_0$。更精确的分析表明，在驱动频率 $\omega$ 远小于固有频率 $\omega_0$ 时，振幅 $A$ 对频率的依赖性很小，但并非为零。
3.  **电偶极辐射：** 振动的电子形成了一个振荡的电偶极矩 $p = ex = eA\cos(\omega t + \delta)$。根据电动力学理论，一个振荡的电偶极子辐射的总功率（也就是散射光的总强度）与其加速度的平方成正比，也与角频率的四次方成正比。即：
$$
    P_{radiated} \propto \ddot{p}^2 \propto (\omega^2 A)^2 \propto \omega^4 A^2
    $$
    由于在可见光区振幅 $A$ 对频率的依赖性不强，我们可以近似认为散射强度主要由 $\omega^4$ 决定。
4.  **频率与波长的关系：** 我们知道角频率 $\omega$、频率 $\nu$ 和波长 $\lambda$ 之间的关系是 $\omega = 2\pi\nu$ 和 $\nu = c/\lambda$。因此：
$$
    I \propto \omega^4 = (2\pi\nu)^4 = \left(\frac{2\pi c}{\lambda}\right)^4 \propto \frac{1}{\lambda^4}
    $$
    这就得到了瑞利散射的核心结论。

**应用到天空颜色：**
* **蓝天：** 蓝光的波长（约475 nm）比红光的波长（约650 nm）短。根据公式，蓝光被散射的强度大约是红光的 $(650/475)^4 \approx (1.37)^4 \approx 3.5$ 倍。紫光（约400 nm）的散射更强，大约是红光的 $(650/400)^4 \approx (1.625)^4 \approx 7$ 倍！当你看向天空时，你看到的是从各个方向散射到你眼睛里的太阳光。由于短波长的光被散射得更强烈，所以天空呈现出蓝色。
* **为什么不是紫色？** 尽管紫光散射最强，但天空看起来是淡蓝色，原因有三：
    1.  太阳光谱本身在蓝光部分的能量就比紫光部分要多。
    2.  人眼对蓝光的敏感度高于紫光。
    3.  大气散射的宽广频率范围（富含紫、蓝、绿光）被人眼平均后，感知为白色背景上叠加了一层鲜艳的蓝色（约476 nm），最终形成我们熟悉的淡蓝色天空。
* **红色的日落：** 当太阳位于地平线附近时（日出或日落），阳光需要穿过非常厚的大气层才能到达你的眼睛。在这个漫长的路程中，大部分的蓝光和紫光都已经被散射到其他方向了，而散射较弱的红光和黄光则能“幸存”下来，沿着直线路径传播到你的眼中，因此太阳和周围的天空看起来是炽热的红色或橙色。

此外，只要介质中的不均匀性尺寸很小，它们就会散射光。微小的纤维、气泡、颗粒和液滴都会发生散射。<mark style="background: #86BDCEA6;">在瑞利散射中，散射体的精确形状通常无关紧要。散射的强度与散射体直径与入射辐射波长的比值有关</mark>。因此，光谱中的蓝色端总是被散射得最多。人的蓝眼睛、蓝鸟的羽毛、蓝尾石龙子的蓝色尾巴以及狒狒的蓝色臀部，其颜色都源于瑞利散射。事实上，<mark style="background: #86BDCEA6;">在动物王国中，几乎所有的蓝色、大部分绿色，甚至一些紫色都是由散射引起的</mark>。例如，蓝鸟羽毛中小羽枝内的微小肺泡细胞的散射使其呈现蓝色；而鹦鹉的绿色则是来自于选择性吸收产生的黄色（色素）和散射产生的蓝色的混合。我们看到的静脉呈蓝色，部分原因也是皮肤和组织的散射效应。

### 4.2.2 散射与干涉：从稀薄到致密
我们刚刚讨论了稀薄气体中的散射，但光在致密的介质（如水、玻璃）中又是如何传播的呢？为什么我们能透过一杯清水看东西，而它却不会像天空一样发出蓝光？

答案在于 干涉 ( Interference)。

#### 4.2.2.1 稀薄介质中的散射：无序与非相干
在稀薄的介质中（如高层大气），分子间的距离远大于光的波长，且它们的位置是随机、无序的。

想象一束平面波从左侧入射（图 4.3a）。光波扫过这些随机分布的分子，驱动它们振动并向外散射子波。我们来考察侧向某个点 $P$。由于分子位置是随机的，每个分子到 $P$ 点的路径长度都大不相同。这些路径长度的差异远大于波长 $\lambda$。

* **相位：** 波的 相位 ( Phase) 描述了它在周期中的位置（例如，是波峰还是波谷）。路径长度不同，意味着到达 $P$ 点的各个子波的相位是完全随机的、杂乱无章的（图 4.3b）。
* **干涉效果：** 在 $P$ 点，这些来自不同分子的子波叠加在一起。由于相位随机，在任何时刻，都有些子波是波峰与波峰相遇（ 相长干涉 ( Constructive-Interference)），有些是波峰与波谷相遇（ 相消干涉 ( Destructive-Interference)）。这种混乱的、不断变化的叠加效果，使得总体的干涉效应被平均掉了。
* **结果：** 我们可以认为，每个分子散射的光波在侧向是独立传播的，它们之间没有固定的相位关系（我们称之为 非相干 ( Incoherent)）。因此，在侧向的总光强就是所有单个分子散射光强的简单代数和。由于没有系统性的相消干涉来阻碍，光能流向侧方，我们就能从侧面看到散射光。

![图 4.3 (a) 光从一个稀疏分布的分子群中散射。(b) 到达侧向点P的子波具有混乱的相位，不会持续地相长干涉。(c) 用相量图可以更好地理解这一点。到达P点的相量彼此之间有很大的相位差。当它们首尾相加时，倾向于螺旋式盘绕，使得最终的合相量非常小。（实际上我们处理的是数百万个微小相量，而不是四个）。|500](4-Optics/images/img-4.jpeg.png)
> **图 4.3** (a) 光从一个稀疏分布的分子群中散射。(b) 到达侧向点P的子波具有混乱的相位，不会持续地相长干涉。(c) 用相量图可以更好地理解这一点。到达P点的相量彼此之间有很大的相位差。当它们首尾相加时，倾向于螺旋式盘绕，使得最终的合相量非常小。（实际上我们处理的是数百万个微小相量，而不是四个）。

#### 4.2.2.2 致密介质中的散射：有序与相干
现在，我们考虑致密介质，如液体或固体。在这里，原子或分子的间距远小于光的波长，并且排列得更加规则和紧密。例如，在标准状况下的空气中，一个边长为 $\lambda$ 的立方体里大约有300万个分子。

在这种情况下，散射子波之间的相位关系不再是随机的，干涉变得至关重要。
* **侧向相消干涉：** 如图 4.6 所示，想象光束穿过一个有序排列的散射体阵列。对于侧向的任何方向，由于原子排列紧密，我们几乎总能找到一个原子 $A$ 和另一个原子 $B$，它们到远处观察点的光程差恰好是半个波长 ($\lambda/2$) 的奇数倍。这意味着，从 $A$ 和 $B$ 发出的子波在那个方向上会发生相消干涉（波峰与波谷叠加），从而相互抵消。
* **宏观效果：** 在一个均匀的致密介质中，对于任何一个散射原子，周围都有大量的其他原子。在任何侧向方向上，来自所有这些原子的散射子波叠加起来，由于它们微小的、几乎连续变化的相位差异，正的电场和负的电场贡献会大量地相互抵消（如图 4.7）。
* **结论：** ***<mark style="background: #86BDCEA6;">在致密、均匀的介质中，侧向和后向的散射由于相消干涉而受到极大的抑制。</mark>*** <mark style="background: #86BDCEA6;">介质越致密、越均匀、越有序，侧向的相消干涉就越彻底，非前向散射的光就越少</mark>。

![图 4.6 一束平面波从左侧入射。介质由许多紧密排列的原子组成。一个波前同时激励了原子A和B，它们之间的距离近似为半个波长。它们发出的子波发生相消干涉。波谷与波峰重叠，在垂直于光束的方向上完全抵消。这个过程不断发生，因此几乎没有光被侧向散射。|450](4-Optics/images/img-7.jpeg.png)
> **图 4.6** 一束平面波从左侧入射。介质由许多紧密排列的原子组成。一个波前同时激励了原子A和B，它们之间的距离近似为半个波长。它们发出的子波发生相消干涉。波谷与波峰重叠，在垂直于光束的方向上完全抵消。这个过程不断发生，因此几乎没有光被侧向散射。

![图 4.7 (a) 当大量微小的、略有相移的波到达空间某点时，正的E场和负的E场贡献大致相等，合成的扰动几乎为零。(b) 代表这些波的微小相量会形成一个很小的圆形图形，其合相量（其振荡方式取决于波数）永远不会很大。|700](4-Optics/images/img-8.jpeg.png)
> **图 4.7** (a) 当大量微小的、略有相移的波到达空间某点时，正的E场和负的E场贡献大致相等，合成的扰动几乎为零。(b) 代表这些波的微小相量会形成一个很小的圆形图形，其合相量（其振荡方式取决于波数）永远不会很大。

这就是为什么清澈的水或玻璃不会像天空一样发出蓝光。它们太均匀了！不过，如果介质存在微观的密度不均匀性，比如液体中分子的热运动导致的瞬时密度涨落，这些涨落区域就会像稀薄气体一样成为散射中心，产生微弱的瑞利散射。这正是爱因斯坦和斯莫鲁霍夫斯基（Smoluchowski）对致密介质散射理论的贡献。

#### 4.2.2.3 前向传播的奥秘
既然侧向散射被抑制了，那能量去哪儿了？答案是：它们都在前向发生了相长干涉，使得光束得以继续前进。

让我们看看图 4.5。一束 原初波 ( Primary-Wave) 扫过分子A和B。
(a) 波前到达A，A开始散射一个子波。
(b) 子波向外扩散，同时原初波继续前进，到达B，B也开始散射一个子波。
(c) 和 (d) 显示了关键点：所有向前传播的子波，无论是由哪个分子在何时发出的，它们在前向的波阵面上总是同相的！例如，由同一主波前激发的分子A和B，B发出的子波虽然起步晚，但它到前方的路径也更短，正好补偿了时间上的延迟。

结果就是：***<mark style="background: #86BDCEA6;">所有散射子波在前向方向上总是相互加强，发生相长干涉。</mark>*** <mark style="background: #86BDCEA6;">这种前向的相长干涉与分子的排列方式（无论是稀疏还是致密）无关</mark>。

![图 4.5 在前向方向上，散射的子波在平面波阵面上同相到达——波谷与波谷相遇，波峰与波峰相遇。|270](4-Optics/images/img-6.jpeg.png)
> **图 4.5** 在前向方向上，散射的子波在平面波阵面上同相到达——波谷与波谷相遇，波峰与波峰相遇。

这些在前向同相叠加的子波，共同构成了一个新的波，我们称之为 次级波 ( Secondary-Wave)。正是这个次级波与原初波的叠加，构成了在介质中实际传播的 透射波 ( Transmitted-Wave)，并最终决定了介质的 折射率 ( Index-of-Refraction)。

### 4.2.3 从散射到折射率：光的传播速度之谜
这是一个非常深刻的联系。我们都知道，光在介质中的速度 $v$ 会变慢，其大小由折射率 $n=c/v$ 决定。但我们一开始就说，光子永远以速度 $c$ 运动。这难道不矛盾吗？

这个“表观上的矛盾”可以通过散射和干涉来完美解释。<mark style="background: #86BDCEA6;">光在介质中的“变慢”并不是单个光子飞得慢了，而是整个波的 **相位传播** 变慢了。这是由散射和再发射过程中的 **相位延迟** 造成的。</mark>

1.  **振子的相位滞后：** 让我们再次回到受迫振动的模型。一个被驱动的振子，其振动相位通常会滞后于驱动力的相位。滞后的程度取决于驱动频率与共振频率的相对关系（如图 4.9b 所示）。
    *   在远低于共振频率时（例如可见光对于玻璃），相位滞后接近90度。
    *   当频率接近共振时，相位滞后接近90度。
    *   在共振频率处，相位滞后为90度。
    *   在远高于共振频率时，相位滞后接近180度。

2.  **次级波的相位：** 所有的振子（分子）都在振动，它们共同产生的次级波，其相位又会相对于振子们的振动相位滞后90度（这是一个电动力学的结果，我们可以暂时接受这个结论）。

3.  **总相位滞后与折射率：** 综合以上两点，在透明介质（如玻璃）中，可见光的频率低于其紫外共振频率。因此，最终形成的次级波相对于原初波的相位滞后量在90度到180度之间。

4.  **波的叠加与表观速度：** 在介质中，我们观测到的透射波是原初波和次级波的叠加。如图 4.11 所示，当一个相位滞后的次级波与原初波叠加时，得到的合波（透射波）的相位也会相对于原初波发生滞后。
    * **什么是相位滞后？** 想象两列波，一列在真空中，一列在介质中。如果介质中的波相位滞后，就意味着它的波峰到达同一个位置的时间，比真空中的波要晚。
    * **相位滞后如何影响速度？** 波的速度是“相位状态”（比如波峰）传播的速度。如果波峰总是“迟到”，从宏观上看，这列波的传播速度就变慢了。
    * **结论：** 相位滞后 $\implies$ 表观相速度 $v < c \implies$ 折射率 $n = c/v > 1$。

![图 4.9 (a)受迫阻尼振子的振幅与驱动频率的关系。(b)相位滞后与驱动频率的关系。虚线对应于阻尼减小的情况。(c)相应的折射率曲线。|450](4-Optics/images/img-11.jpeg.png)
> **图 4.9** (a)受迫阻尼振子的振幅与驱动频率的关系。(b)相位滞后与驱动频率的关系。虚线对应于阻尼减小的情况。(c)相应的折射率曲线。

这个模型还能完美地解释 <mark style="background: #86BDCEA6;">色散 ( Dispersion) 现象，即折射率随频率（或波长）变化的现象</mark>。<mark style="background: #86BDCEA6;">从图 4.9c 可以看出，随着频率</mark> $\omega$ <mark style="background: #86BDCEA6;">的增加（从红光到蓝光），相位滞后变大，导致折射率 $n$ 也随之增加</mark>。<mark style="background: #76AD62A6;">这就是为什么棱镜可以把白光分解成彩虹——不同颜色的光在玻璃中有不同的折射率和折射角</mark>。

**Ewald-Oseen 消光定理**
对这个传播问题的严格数学处理，得出了所谓的<mark style="background: #86BDCEA6;">“Ewald-Oseen 消光定理”。这个定理的结论非常优美：介质中所有分子散射的次级波，可以分解成两部分。一部分恰好在介质内部与原初入射波完全抵消（“消光”）。另一部分则构成了一个新的波，这个波就是我们实际观测到的透射波</mark>，它以速度 $v=c/n$ 在介质中传播。

因此，我们<mark style="background: #76AD62A6;">看似简单的折射现象，其背后是介质中无数原子与光之间持续不断的、遵循干涉原理的散射与再散射过程</mark>。

### 4.2.4 超越瑞利散射：米氏散射与几何散射
瑞利散射适用于尺寸远小于波长的粒子。当散射粒子的尺寸逐渐增大，可与光的波长相比拟时，情况就变得不同了。
* **<mark style="background: #86BDCEA6;">米氏散射 ( Mie-Scattering):</mark>** 由古斯塔夫·米（Gustav Mie）在1908年提出，描述的是<mark style="background: #86BDCEA6;">尺寸与波长相当的球形粒子的散射</mark>。
    * **特点：** <mark style="background: #86BDCEA6;">米氏散射对波长的依赖性比瑞利散射弱得多。当粒子尺寸超过波长时，散射几乎与波长无关</mark>。
    * **方向性：** 与瑞利散射在前后方向上对称不同，<mark style="background: #86BDCEA6;">米氏散射的能量更多地集中在前向</mark>。
    * **例子：** <mark style="background: #76AD62A6;">云和雾由大小与可见光波长相当的小水滴组成。它们对所有颜色的光散射能力都差不多，因此云和雾看起来是白色的。牛奶中的脂肪和蛋白质微粒也是如此。一些白色塑料袋为了不透明，加入了直径约200 nm的二氧化钛微球，它们通过米氏散射发出蓝白色的光</mark>。

* **几何散射 ( Geometrical-Scattering):** <mark style="background: #86BDCEA6;">当粒子尺寸远大于光的波长时（例如大于10倍波长），光的传播可以用几何光学（光线追迹、反射、折射）来描述</mark>。<mark style="background: #76AD62A6;">雨滴形成的彩虹就是几何光学的典型例子</mark>。

---

### 关键结论与知识点总结
1.  **<mark style="background: #FF5582A6;">散射的本质：</mark>** <mark style="background: #86BDCEA6;">散射是光与物质相互作用，导致光向不同方向传播的过程</mark>。在<mark style="background: #86BDCEA6;">弹性散射中，散射光的频率与入射光相同</mark>。
2.  **<mark style="background: #FF5582A6;">瑞利散射：</mark>** <mark style="background: #86BDCEA6;">适用于尺寸远小于光波长的粒子（如空气分子）的散射。其核心特征是散射强度与波长的四次方成反比</mark> ($I \propto 1/\lambda^4$)。
3.  **天空的颜色：** 瑞利散射解释了天空为何是蓝色的（短波长的蓝光被更强地散射到各个方向），以及日落为何是红色的（长途跋涉后，直射光中只剩下散射较弱的红光和黄光）。
4.  **干涉是关键：**
    * 在**稀薄介质**中，散射体位置随机，侧向散射的子波相位随机，无系统性干涉，因此可以观测到侧向散射。
    * 在**致密均匀介质**中，散射体位置规则，侧向散射的子波会因相消干涉而极大减弱，导致介质透明。
5.  **前向传播：** 无论介质稀疏或致密，所有散射子波在前向总是相长干涉，使光束得以继续传播。
6.  **<mark style="background: #FF5582A6;">折射率的起源：</mark>** 折射率 $n>1$ <mark style="background: #86BDCEA6;">（光速变慢）的物理本质是，介质中散射再发射的次级波与原初波叠加时产生了**相位滞后**。这使得总的透射波的相位传播速度变慢，而并非单个光子的飞行速度变慢</mark>。
7.  **散射的分类：**
    *   **瑞利散射：** 粒子尺寸 $\ll \lambda$（蓝天）。
    *   **米氏散射：** 粒子尺寸 $\approx \lambda$（白云、白雾）。
    *   **几何散射：** 粒子尺寸 $\gg \lambda$（用几何光学处理）。

---

### 专业术语/关键词中英文对照表
*    #弹性散射 ( #Elastic-Scattering)
*    #瑞利散射 ( #Rayleigh-Scattering)
*    #干涉 ( #Interference)
*    #相长干涉 ( #Constructive-Interference)
*    #相消干涉 ( #Destructive-Interference)
*    #非相干 ( #Incoherent)
*    #原初波 ( #Primary-Wave)
*    #次级波 ( #Secondary-Wave)
*    #透射波 ( #Transmitted-Wave)
*    #色散 ( #Dispersion)
*    #米氏散射 ( #Mie-Scattering)
*    #几何散射 ( #Geometrical-Scattering)


[!补充解释： 光子是永恒的]-
## 为什么说：在真空中，一个 光子 ( Photon) 一旦被创造出来，除非它与物质发生相互作用，否则它将永远以光速 $c$ 运动下去，其能量和频率都不会改变。（两个角度的理解）

这是一个非常深刻的问题，它触及了现代物理学的两大基石——**狭义相对论**和**量子力学**的核心。您提出的这句话，几乎可以看作是这两大理论在一个微小粒子身上交汇时得出的必然结论。

---

### 1. 为什么光子永远以光速 $c$ 运动？——来自狭义相对论的规定

这要从爱因斯坦的 #狭义相对论 ( #Special-Relativity ) 说起。狭义相对论建立在两个基本公设之上，其中第二个公设就是：**在所有惯性参考系中，真空中的光速 $c$ 是一个恒定的、与光源运动无关的常数。**

但这只是一个“规定”，为什么这个规定是合理的？这与光子的一个根本属性有关：**光子没有静止质量 ($m_0 = 0$)**。

我们来看一下相对论中著名的质能关系式：
$$
E^2 = (pc)^2 + (m_0c^2)^2
$$
其中，$E$ 是总能量，$p$ 是动量，$m_0$ 是静止质量。

- **对于有静止质量的粒子（比如电子、质子、你我）：**
  它们的静止质量 $m_0 > 0$。这意味着它们在静止时（$p=0$）仍然拥有能量，即静止能量 $E_0 = m_0c^2$。为了让它们运动起来，你需要给它们能量，它们的速度会增加，但永远无法达到光速 $c$。因为如果速度 $v=c$，其能量 $E = \gamma m_0 c^2$（其中洛伦兹因子 $\gamma = 1/\sqrt{1-v^2/c^2}$）将变为无穷大，这是不可能的。

- **对于光子：**
  光子是一个没有静止质量的粒子，即 $m_0 = 0$。将这个条件代入质能关系式，我们得到：
  $$
  E^2 = (pc)^2 + 0 \quad \implies \quad E = pc
  $$
  这说明光子的能量完全由其动量决定。更重要的是，一个静止质量为零的粒子，它**不可能静止**，也**不可能以低于光速的速度运动**。它一旦被创造出来，就必须以光速 $c$ 运动。它没有“加速到光速”的过程，它“生来”就在光速。它也无法“减速”，除非它与物质相互作用并被完全吸收，从而“死亡”。

**结论一：光子没有静止质量，这是它必须以光速 $c$ 运动的根本原因。这是狭义相对论的内禀要求。**

---

### 2. 为什么它不会“疲惫”或“减速”？——来自能量和动量守恒

在真空中，我们理想化地认为空间是完全空无一物的——没有物质，没有原子，也没有电磁场。在这种情况下：

- **没有相互作用**：光子不会与任何东西发生碰撞或相互作用。没有“摩擦力”，也没有介质来吸收它的能量。
- **能量守恒**：根据 #能量守恒定律 ( #Law-of-Conservation-of-Energy )，在一个孤立系统中，总能量是守恒的。在空无一物的真空中，一个光子自身就是一个孤立系统，所以它的能量必须保持不变。
- **动量守恒**：同理，它的动量也必须保持不变。

“光会疲惫”是一个曾经被提出的假说（称为“疲劳光”假说），用来解释宇宙的红移现象。但这个假说已经被大量的观测证据所否定。宇宙的红移并非光子在漫长旅途中能量衰减所致，而是由于宇宙空间本身的膨胀，拉长了光的波长。

**结论二：在理想真空中，由于不存在相互作用的媒介，根据能量和动量守恒定律，光子的能量和动量必须保持恒定，因此它不会“减速”或“衰减”。**

---

### 3. 为什么它的能量和频率不变？——来自量子力学的规定

现在我们引入 #量子力学 ( #Quantum-Mechanics ) 的观点。普朗克和爱因斯坦告诉我们，光的能量是量子化的，一份一份的，每一份（一个光子）的能量 $E$ 与其频率 $\nu$（希腊字母nu）成正比：
$$
E = h\nu
$$
其中，$h$ 是 #普朗克常数 ( #Planck-s-Constant )，一个宇宙的基本常数。

这个公式像一座桥梁，将光的粒子性（能量 $E$）和波动性（频率 $\nu$）完美地联系在了一起。

既然我们从第二点已经知道，在真空中传播的光子，其能量 $E$ 是守恒的。而 $h$ 又是一个永恒不变的常数，那么从这个公式中我们可以立即推断出：**光子的频率 $\nu$ 也必须保持不变。**

**结论三：光子的能量和频率是同一枚硬币的两面。能量的守恒直接导致了频率的恒定。**

---

### 4. 为什么说光子是“永恒的 (timeless)”？——来自时间膨胀的极致

这是狭义相对论带来的一个最令人惊奇的推论。相对论告诉我们，运动的时钟会变慢，这种现象称为“时间膨胀”。一个物体运动的速度越快，其自身经历的时间流逝就越慢。

描述时间膨胀的公式是：
$$
\Delta t = \gamma \Delta t_0 = \frac{\Delta t_0}{\sqrt{1-v^2/c^2}}
$$
其中，$\Delta t_0$ 是物体自身参考系中流逝的时间（称为“固有时”），$\Delta t$ 是我们观察者参考系中流逝的时间。

现在，让我们把这个公式应用到光子上。光子的速度 $v=c$。代入公式：
$$
\sqrt{1 - c^2/c^2} = \sqrt{1-1} = 0
$$
分母为零，这意味着洛伦兹因子 $\gamma$ 是无穷大。这似乎让公式失去了意义，但它背后隐藏着一个深刻的物理事实：<mark style="background: #86BDCEA6;">对于以光速运动的光子来说，时间是静止的。</mark>

<mark style="background: #76AD62A6;">从光子自身的“视角”（这是一个不严谨但有助于理解的说法）来看，它从被恒星创造出来，到17万年后在地球上被我们观测到，这整个旅程是在**一瞬间**完成的。在它的参考系里，**时间没有流逝**。它被创造和被吸收是同一个“时刻”。</mark>

这就是为什么说“光子是永恒的”。它不经历时间，所以它不会“衰老”，也不会“变化”。它就像一幅被“冻结”在时间中的画，以光速划过宇宙，直到它与某物相互作用，将自己的全部信息（能量、动量）传递出去，然后消失。

---

### 总结

所以，回到您的问题：“在真空中，一个光子一旦被创造出来，除非它与物质发生相互作用，否则它将永远以光速 $c$ 运动下去，其能量和频率都不会改变。”——为什么？

- **因为它是一个没有静止质量的基本粒子**，根据**狭义相对论**，它必须以光速 $c$ 运动。
- **因为它在真空中不与任何东西相互作用**，根据**能量和动量守恒定律**，它的能量和动量不会无故减少。
- **因为它的能量与频率由 $E=h\nu$ 锁定**，根据**量子力学**，能量的守恒直接保证了频率的恒定。
- **因为它以光速运动，经历了极致的时间膨胀**，从它自身的“视角”看，时间是静止的，它不经历任何变化，是真正“永恒”的。

---
这是一个绝佳的问题，它将我们带到了现代物理学的最前沿，触及了我们理解宇宙的根基。上一个回答是从相对论和量子力学的“规则”层面来解释，现在，我们来探讨这些规则背后的“为什么”，也就是您提到的，从**时空**、**场**以及更深刻的**对称性**角度来阐述。

---

### 层面一：宇宙的“几何”——时空视角 (The Spacetime Perspective)

在爱因斯坦的 #广义相对论 ( #General-Relativity ) 中，宇宙不再是一个被动的、空洞的舞台，而是一个动态的、可被物质和能量弯曲的**四维时空几何体**。我们所感受到的引力，不过是物体在弯曲时空中沿“最直”路径运动的表象。

**1. 光子走的是时空的“最短路径”——测地线**

在弯曲的时空中，两点之间最直的路径被称为 #测地线 ( #Geodesic )。
- 对于有质量的物体（比如行星、你我），它们会沿着“类时”测地线运动。
- 对于没有质量的光子，它们会沿着一种特殊的测地线——**零测地线 (Null Geodesic)** 运动。

“零测地线”的本质特征是，沿着这条路径，时空间隔 $ds^2$ 恒等于零。这意味着什么？这意味着光子在时空中划出了一条“光之轨迹”，在这条轨迹上，空间上的行进与时间上的流逝以一种完美的方式相互抵消。

**关键洞察**：在真空中，一个不受引力场（或者说，在平直时空中）影响的光子，其零测地线就是一条**直线**。它没有理由偏离这条“最直”的路径，除非时空本身是弯曲的。因此，它会永远沿直线运动下去。

**2. 光速 $c$ 是时空的“结构常数”**

在时空几何的框架下，光速 $c$ 的角色发生了根本性的转变。它不再仅仅是一个速度的极限，而是**时空本身的内在属性**，一个将时间和空间两个维度联系起来的**基本换算因子**。

- 我们的宇宙就是这样被“设计”的：一米的空间等价于 $1/c$ 秒的时间。$c$ 是时空几何的“斜率”。
- 任何无质量的扰动，无论是引力波还是光子，只要它在时空中传播，就必须以这个结构常数 $c$ 的速度进行。这就像在一个棋盘上，棋子只能从一个格子移动到另一个格子，而不能停在格子的线上。光子作为时空本身的涟漪，它的传播速度是由时空这个“棋盘”的规则所决定的。

**3. 能量的变化源于与时空的“对话”**

那么，光子的能量和频率为什么不变呢？在一个**平直、静态**的真空中，时空本身是均匀且不随时间变化的。光子在其中穿行，时空没有理由去改变它的能量。

但是，如果时空是弯曲或动态的呢？
- **引力红移/蓝移**：当一个光子从一个强引力场（比如恒星表面）向外传播时，它需要“爬出”引力势阱。在这个过程中，它会与弯曲的时空发生“能量交换”，导致其能量降低，频率变小，波长变长——这就是 #引力红移 ( #Gravitational-Redshift )。反之，落入引力场的光子会发生 #引力蓝移 ( #Gravitational-Blueshift )。
- **宇宙学红移**：一个从遥远星系传来的光子，在它长达数十亿年的旅程中，宇宙空间本身在不断膨胀。这种膨胀会“拉伸”时空，从而也拉伸了在其中传播的光子的波长，使其能量降低。

**深刻结论一**：光子在真空中以恒定速度 $c$ 沿直线传播，其能量和频率保持不变，这本质上是**平直时空几何的内在要求**。它的速度是时空的结构常数，它的路径是时空的最短路径。只有当光子与**弯曲或动态的时空**（即引力场）相互作用时，它的能量和频率才会发生改变。

---

### 层面二：宇宙的“基底”——场论视角 (The Field Perspective)

#量子场论 ( #Quantum-Field-Theory, QFT) 是我们目前描述基本粒子最成功的理论。它告诉我们一个更深刻的图景：

**1. 宇宙的本质是场，粒子是场的激发**

宇宙最基本的构成不是一个个孤立的粒子，而是**弥漫在整个时空中的各种量子场**。比如，有电子场、夸克场，当然，还有 #电磁场 ( #Electromagnetic-Field )。
- 当这些场处于最低能量状态（基态）时，我们称之为“真空”。
- 当一个场被激发，从基态跃迁到一个能量更高的状态时，这个能量的“量子化”的激发，在我们看来就是一个**粒子**。

**关键洞察**：光子不是一个在电磁场中传播的“小球”。**光子本身就是电磁场这个“海洋”中的一个最小的、不可再分的涟漪或波包。**

**2. 场的属性决定了粒子的行为**

一个场的性质，由描述它的数学方程（拉格朗日量）所决定。
- **为什么光子没有质量？** 因为在描述电磁场的方程中，没有包含赋予其静止质量的项（不像赋予电子质量的希格斯机制）。
- **为什么光子以速度 $c$ 传播？** 因为描述无质量场的波动方程（麦克斯韦方程组就是其经典形式）的解，其传播速度就是一个由场的基本常数（介电常数 $\epsilon_0$ 和磁导率 $\mu_0$）决定的特征速度，这个速度恰好就是 $c = 1/\sqrt{\epsilon_0 \mu_0}$。一个无质量场的激发（即光子），它别无选择，只能以这个特征速度传播。
- **为什么光子是稳定的？** 因为没有比光子更轻的带电荷的粒子可以让它衰变成。同时，电磁相互作用的规范对称性（我们稍后会谈到）也保证了它的稳定性。

**深刻结论二**：光子之所以具有这些恒定的属性，是因为它不是一个独立的“东西”，而是**电磁场这个基本物理实在的内在激发模式**。它的速度、质量、能量等所有性质，都由电磁场的根本数学结构所决定。在真空中，电磁场这个“海洋”是均匀的，所以它的涟漪（光子）一旦产生，就会以固有的方式永恒地传播下去，直到这个涟漪与其他场的涟漪（其他粒子）相互作用。

---

### 层面三：宇宙的“法则”——对称性视角 (The Symmetry Perspective)

这是最深刻、最本质的层面。物理学家艾米·诺特（Emmy Noether）提出了一个贯穿整个物理学的、无比优美的定理—— #诺特定理 ( #Noether-s-Theorem )。

**诺特定理**：**物理定律中每一种连续的对称性，都对应着一个守恒量。**

“对称性”在这里指的是，当你对系统做一个变换（比如平移、旋转、时间推移）后，描述这个系统的物理定律保持不变。

**1. 能量守恒源于时间平移对称性**

- **对称性**：物理定律在时间上是均匀的。也就是说，今天做的实验和明天做的实验，如果条件完全相同，其结果也必然相同。物理定律不随时间的流逝而改变。这就是**时间平移对称性**。
- **守恒量**：根据诺特定理，这个对称性对应的守恒量就是**能量**。

**关键洞察**：一个在真空中自由传播的光子，它所遵循的物理定律（电磁场方程）不随时间改变。因此，它的能量必须守恒。又因为 $E=h\nu$，所以它的频率也必须守恒。

**2. 动量守恒源于空间平移对称性**

- **对称性**：物理定律在空间上是均匀的。也就是说，在这里做的实验和在一米之外做的实验，如果条件完全相同，其结果也必然相同。物理定律不随空间位置的改变而改变。这就是**空间平移对称性**。
- **守恒量**：这个对称性对应的守恒量就是**动量**。

**关键洞察**：一个在真空中自由传播的光子，它所处的空间是均匀的。因此，它的动量必须守恒。动量守恒意味着它的运动状态（包括方向和速度大小）保持不变，所以它会沿直线永恒运动下去。

**深刻结论三**：光子之所以在真空中保持其属性不变，最根本的原因是**我们的宇宙在时空上具有基本的对称性**。能量守恒、动量守恒这些我们习以为常的定律，并非凭空而来，它们是时空对称性的深刻体现。光子作为一个基本粒子，它的行为忠实地反映了它所处的时空舞台的基本规则。

---

### 最终总结

将这三个层面融会贯通，我们可以得到一幅关于光子本性的、层层递进的深刻图景：

1.  **最表层（规则层面）**：光子是无质量粒子，根据**相对论**必须以光速运动；在真空中无相互作用，根据**守恒定律**能量和动量不变；能量与频率挂钩，根据**量子论**频率也不变。

2.  **中间层（几何与场的层面）**：光子是**电磁场**的量子化激发，其运动速度 $c$ 是场的内在特征速度。它在时空中传播，遵循由**时空几何**决定的“最短路径”（零测地线）。它的能量是否变化，取决于它是否与弯曲的**时空**（引力）发生“对话”。

3.  **最深层（对称性层面）**：光子能量和动量的守恒，根植于宇宙时空的基本**对称性**。**时间平移对称性**保证了其能量（频率）的恒定，而**空间平移对称性**保证了其动量（运动状态）的恒定。光子的“永恒不变”，是我们宇宙基本法则“永恒不变”的一个直接写照。

所以，您提出的那句话，不仅仅是对一个粒子行为的描述，它实际上是对我们宇宙最深层次结构——平直时空的几何特性、量子场的内在属性以及时空对称性的精炼概括。




## 4.3 Reflection

When a beam of light impinges on the surface of a transparent material, such as a sheet of glass, the wave "sees" a vast array of closely spaced atoms that will somehow scatter it. Remember that the wave may be $\approx 500 \mathrm{~nm}$ long, whereas the atoms and their separations $(\approx 0.2 \mathrm{~nm})$ are thousands of times smaller. In the case of transmission through a dense medium, the scattered wavelets cancel each other in all but the forward direction, and just the ongoing beam is sustained. But that can only happen if there are no discontinuities. This is not the case at an interface between two different transparent media (such as air and glass), which is a jolting discontinuity. When a beam of light strikes such an interface, some light is always scattered backward, and we call this phenomenon ***reflection***.

If the transition between two media is gradual-that is, if the dielectric constant (or the index of refraction) changes from that of one medium to that of the other over a distance of a wavelength or more-there will be very little reflection; the interface effectively vanishes. On the other hand, a transition from one medium to the other over a distance of $1 / 4$ wavelength or less behaves very much like a totally discontinuous change.

### Internal and External Reflection

Imagine that light is traveling across a large homogeneous block of glass (Fig. 4.12). Now, suppose that the block is sheared in half perpendicular to the beam. The two segments are then separated, exposing the smooth, flat surfaces depicted in Fig. 4.12b. Just before the cut was made, there was no lightwave traveling to the left inside the glass-we know the beam only advances. Now there must be a wave (beam-I) moving to the left, reflected from the surface of the right-hand block. The implication is that a region of scatterers on and beneath the exposed surface of the right-hand block is now "unpaired," and the backward radiation they emit can no longer be canceled. The region of oscillators that was adjacent to these, prior to the cut, is now on the section of the glass that is to the left. When the two sections were together, these scatterers presumably also emitted wavelets in the backward direction that were $180^{\circ}$ out-of-phase with, and canceled, beam-I. Now they produce reflected beam-II. Each molecule scatters light in the backward direction, and, in principle, ***each and every molecule contributes to the reflected wave***.
![700](4-Optics/images/img-14.jpeg.png)
> Figure 4.12 (a) A lightbeam propagating through a dense homogeneous medium such as glass. (b) when the block of glass is cut and parted, the light is reflected backward at the two new interfaces. Beam-I is externally reflected, and beam-II is internally reflected. Ideally, when the two pieces are pressed back together, the two reflected beams cancel one another.

Nonetheless, in practice, it is a thin layer ( $\approx \lambda / 2$ deep) of unpaired atomic oscillators near the surface that is effectively responsible for the reflection. For an air-glass interface, about $4 \%$ of the energy of an incident beam falling perpendicularly in air on glass will be reflected straight back out by this layer of unpaired scatterers (p. 126). And that's true whether the glass is 1.0 mm thick or 1.00 m thick.

Beam-I reflects off the right-hand block, and because light was initially traveling from a less to a more optically dense medium, this is called ***external reflection***. In other words, the index of the incident medium $\left(n_{i}\right)$ is less than the index of the transmitting medium $\left(n_{t}\right)$. Since the same thing happens to the unpaired layer on the section that was moved to the left, it, too, reflects backwards. With the beam incident perpendicularly in glass on air, $4 \%$ must again be reflected, this time as beam-II. This process is referred to as ***internal reflection*** because $n_{i}>n_{t}$. If the two glass regions are made to approach one another increasingly closely (so that we can imagine the gap to be a thin film of, say, air-p. 416), the reflected light will diminish until it ultimately vanishes as the two faces merge and disappear and the block becomes continuous again. In other words, beam-I cancels beam-II; they must have been $180^{\circ}$ out-of-phase. Remember this ***$180^{\circ}$ relative phase shift between internally and externally reflected light*** (see Section 4.10 for a more rigorous treatment)-we will come back to it later on.

Experience with the common mirror makes it obvious that white light is reflected as white-it certainly isn't blue. To see why, first remember that the layer of scatterers responsible for the reflection is effectively about $\lambda / 2$ thick (per Fig. 4.6). Thus the larger the wavelength, the deeper the region contributing (typically upward of a thousand atom layers), and the more scatterers there are acting together. This tends to balance out the fact that each scatterer is less efficient as $\lambda$ increases (remember $1 / \lambda^{4}$ ). The combined result is that ***the surface of a transparent medium reflects all wavelengths about equally and doesn't appear colored in any way***. That, as we will see, is why this page looks white under white-light illumination.

### 4.3.1 The Law of Reflection

Figure 4.13 shows a beam composed of plane wavefronts impinging at some angle on the smooth, flat surface of an optically dense medium (let it be glass). Assume that the surrounding environment is vacuum. Follow one wavefront as it sweeps in and across the molecules on the surface (Fig. 4.14). For the sake of simplicity, in Fig. 4.15 we have omitted everything but a few molecular layers at the interface. As the wavefront descends, it energizes and reenergizes one scatterer after another, each of which radiates a stream of photons that can be regarded as a hemispherical wavelet in the incident medium. Because the wavelength is so much greater than the separation between the molecules, the wavelets emitted back into the incident medium advance together and add constructively in only one direction, and there is one well-defined reflected beam. That would not be true if the incident radiation was short-wavelength X-rays, in which circumstance there would be several reflected beams. And it would not be true if the scatterers were far apart compared to $\lambda$, as they are for a diffraction grating (p. 496), in which case there would also be several reflected beams. The direction of the reflected beam is determined by the constant phase difference between the atomic scatterers. That, in turn, is determined by the angle made by the incident wave and the surface, the so-called ***angle-of-incidence***.

![450](4-Optics/images/img-15.jpeg.png)
> Figure 4.13 A beam of plane waves incident on a distribution of molecules constituting a piece of clear glass or plastic. Part of the incident light is reflected and part refracted.

![450](4-Optics/images/img-16.jpeg.png)
> Figure 4.14 A plane wave sweeps in stimulating atoms across the interface. These radiate and reradiate, thereby giving rise to both the reflected and transmitted waves. In reality the wavelength of light is several thousand times the atomic size and spacing.

![350](4-Optics/images/img-17.jpeg.png)
> Figure 4.15 The reflection of a wave as the result of scattering.

In Fig. 4.16, the line $\overline{A B}$ lies along an incoming wavefront, while $\overline{C D}$ lies on an outgoing wavefront-in effect, $\overline{A B}$ transforms on reflection into $\overline{C D}$. With Fig. 4.15 in mind, we see that the wavelet emitted from $A$ will arrive at $C$ in-phase with the wavelet just being emitted from $D$ (as it is stimulated by $B$ ), as long as the distances $\overline{A C}$ and $\overline{B D}$ are equal. In other words, if all the wavelets emitted from all the surface scatterers are to overlap in-phase and form a single reflected plane wave, it must be that $\overline{A C}=\overline{B D}$. Then, since the two triangles have a common hypotenuse
		$$
		\frac{\sin \theta_{i}}{\overline{B D}}=\frac{\sin \theta_{r}}{\overline{A C}}
		$$

All the waves travel in the incident medium with the same speed $v_{i}$. It follows that in the time $(\Delta t)$ it takes for point $B$ on the wavefront to reach point $D$ on the surface, the wavelet emitted from $A$ reaches point $C$. In other words, $\overline{B D}=v_{i} \Delta t=\overline{A C}$, and so from the above equation, $\sin \theta_{i}=\sin \theta_{r}$, which means that
$$
\boxed{\theta_{i}=\theta_{r}}\tag{4.3}
$$

![450](4-Optics/images/img-18.jpeg.png)
> Figure 4.16 Plane waves enter from the left and are reflected off to the right. The reflected wavefront $\overline{C D}$ is formed of waves scattered by the atoms on the surface from $A$ to $D$. Just as the first wavelet arrives at $C$ from $A$, the atom at $D$ emits, and the wavefront along $\overline{C D}$ is completed.


***The angle-of-incidence equals the angle-of-reflection***. This equation is the first part of the Law of Reflection. It initially appeared in the book Catoptrics, which was purported to have been written by Euclid. We say that a beam is normally incident when $\theta_{i}=0^{\circ}$, in which case $\theta_{r}=0^{\circ}$ and for a mirror the beam reflects back on itself. Similarly, glancing incidence corresponds to $\theta_{l} \approx 90^{\circ}$ and perforce $\theta_{r}=90^{\circ}$.
![450](4-Optics/images/img-19.jpeg.png)
> A modern phased-array radar system. The field of individual small antennas behaves very much like the atoms on a smooth surface. By introducing a proper phase shift between adjacent rows the antenna can "look" in any direction. A reflecting surface has a similar phase shift determined by $\theta_{i}$ as the incident wave sweeps over the array of atoms. (Kaytheon Corp.)

#### Rays

Drawing wavefronts can get things a bit cluttered, so we introduce another convenient scheme for visualizing the progression of light. The imagery of antiquity was in terms of straight-line streams of light, a notion that got into Latin as "radii" and reached English as "rays." ***A ray is a line drawn in space corresponding to the direction of flow of radiant energy***. It is a mathematical construct and not a physical entity. In a medium that is uniform (homogeneous), rays are straight. If the medium behaves in the same manner in every direction (isotropic), ***the rays are perpendicular to the wavefronts***. Thus for a point source emitting spherical waves, the rays, which are perpendicular to them, point radially outward from the source. Similarly, the rays associated with plane waves are all parallel. Rather than sketching bundles of rays, we can simply draw one incident ray and one reflected ray (Fig. 4.17a). All the angles are now measured from the perpendicular (or normal) to the surface, and $\theta_{l}$ and $\theta_{r}$ have the same numerical values as before (Fig. 4.16).
![450](4-Optics/images/img-20.jpeg.png)
> Figure 4.17 (a) Select one ray to represent the beam of plane waves. Both the angle-of-incidence $\theta_{l}$ and the angle-of-reflection $\theta_{r}$ are measured from a perpendicular drawn to the reflecting surface. (b) The incident ray and the reflected ray define the plane-of-incidence, perpendicular to the reflecting surface.

![450](4-Optics/images/img-21.jpeg.png)
> The cruiser Aurora, which played a key role in the Communist Revolution (1917), docked in St. Petersburg. Where the water is still, the reflection is specular. The image blurs where the water is rough and the reflection more diffuse. (г.и.)

The ancient Greeks knew the Law of Reflection. It can be deduced by observing the behavior of a flat mirror, and nowadays that observation can be done most simply with a flashlight or, even better, a low-power laser. The second part of the Law of Reflection maintains that ***the incident ray, the perpendicular to the surface, and the reflected ray all lie in a plane*** called the ***plane-of-incidence*** (Fig. 4.17b)—this is a threedimensional business. Try to hit some target in a room with a flashlight beam by reflecting it off a stationary mirror, and the importance of this second part of the law becomes obvious!

Figure $4.18 a$ shows a beam of light incident upon a reflecting surface that is smooth (one for which any irregularities are small compared to a wavelength). In that case, the light reemitted by millions upon millions of atoms will combine to form a single well-defined beam in a process called ***specular reflection*** (from the word for a common mirror alloy in ancient times, speculum). Provided the ridges and valleys are small compared to $\lambda$, the scattered wavelets will still arrive more or less in-phase when $\theta_{l}=\theta_{r}$. This is the situation assumed in Figs. 4.13, 4.15, 4.16, and 4.17. On the other hand, when the surface is rough in comparison to $\lambda$, although the angle-of-incidence will equal the angle-of-reflection for each ray, the whole lot of rays will emerge every which way, constituting what is called ***diffuse reflection*** (see photo). Both of these conditions are extremes; the reflecting behavior of most surfaces lies somewhere between them. Thus, although the paper of this page was deliberately manufactured to be a fairly diffuse scatterer, the cover of the book reflects in a manner that is somewhere between diffuse and specular.
![350](4-Optics/images/img-22.jpeg.png)
> The F-117A Stealth fighter has an extremely small radar profile, that is, it returns very little of the incoming microwaves back to the station that sent them. That's accomplished mostly by constructing the aircraft with flat tilted-planes that use the Law of Reflection to scatter the radar waves away from their source. One wants to avoid $\theta_{l}=\theta_{r} \approx 0$. (US Dept of Defense)

![550](4-Optics/images/img-23.jpeg.png)
> Figure 4.18 (a) Specular reflection. (b) Diffuse reflection. (Donald Dunitz) (c) Specular and diffuse are the extremes of reflection. This schematic drawing represents a range of reflections between the two that are likely to be encountered.

## 4.3 反射 (Reflection)
[!反射 (Reflection)]-

#### 4.3.1 什么是反射？一个直观的开始
当我们说“反射”，最直接的理解就是：当一束光照射到物体表面时，一部分光会“弹”回来。这个“弹”回来的过程，就是反射。

在物理学中，我们更精确地描述这个过程。光是一种电磁波。当光波从一种介质（比如空气）传播到另一种不同的介质（比如玻璃或水）的 界面 ( Interface ) 时，总会有一部分光波从这个界面返回到原来的介质中，这种现象就被称为 **反射**。

这个界面是关键。想象一下，光在均匀的空气中传播，畅通无阻。但当它突然遇到玻璃表面时，就好像一个跑步的运动员突然撞上了一堵墙。这个“墙”就是一个**不连续性 (discontinuity)**，它迫使光的传播发生改变。

值得注意的是，在界面上，通常会同时发生三种情况：
1.  **反射 (Reflection)**：一部分光被弹回原介质。
2.  **折射 (Refraction)**：一部分光穿过界面，进入第二种介质，但传播方向通常会发生偏折（我们将在后续章节详细讨论）。
3.  **吸收 (Absorption)**：一部分光的能量被介质吸收，转化为内能等其他形式的能量。

我们今天的焦点，就是第一种情况——反射。

首先，让我们深入微观世界，理解反射的根源。当一束光照射到玻璃等透明材料表面时，一场微观的“舞蹈”开始了。
* **悬殊的尺度**：光的波长（$\lambda$）约为 $500 \mathrm{~nm}$，而物质中原子的间距仅约 $0.2 \mathrm{~nm}$。对于光波而言，原子就像一个极其密集的阵列。

* **散射是基础**：当光波（电磁波）扫过原子时，其电场会驱动原子中的电子以相同的频率振荡。根据电磁理论，加速运动的电荷会向外辐射电磁波。这些振荡的电子就像无数个微型天线，向四面八方发射次级波（Wavelets）。这个过程被称为 **散射 ( Scattering )**。

* **均匀介质内的“和谐”**：在玻璃内部，远离界面的地方，任何一个原子发出的散射波，在后向和侧向都会被其他原子发出的波精准地抵消掉（相消干涉）。只有在前向，所有散射波会与主光波同相叠加，形成我们看到的透射光束。这就是为什么在均匀介质中，光看起来是直线传播的。

* **界面处的“不和谐”**：反射的秘密在于 **不连续性 ( Discontinuity )**。
    * 当光从空气进入玻璃时，介质的性质（如 折射率）发生了突变（在界面处，原子排列突然中断）。
    * 原本应该与后向散射波相互抵消的那部分波，现在缺失了（因为界面另一边没有原子了，或者原子密度变了）。
    * 对于界面处的原子，它们在空气一侧没有“伙伴”来产生可以抵消其后向散射的波。
    * 这些“未配对”的原子发出的后向散射波无法被抵消，它们会相干地叠加起来，在宏观上形成了一束方向确定的 **反射 ( Reflection )** 光。

> **教授的补充思考**：
> 这里的“不连续性”是关键。如果介质性质的变化是渐变的（变化距离 $\ge \lambda$），反射会极弱。只有当变化发生在极短距离内（$\le \lambda/4$），这种突变才会导致我们通常所见的明显反射。
> 
> 这里的“不连续性”有一个量化标准。如果介质性质（如 **介电常数 ( Dielectric-Constant )** 或 **折射率 ( Refractive-Index )** ）的变化是渐变的（变化距离 $\ge \lambda$），反射会极弱，界面仿佛不存在。只有当变化发生在极短距离内（$\le \lambda/4$），这种突变才会导致强烈的反射。

---

#### 4.3.2 反射的宏观规律：反射定律
在深入探讨为什么会发生反射之前，我们先来学习一下反射现象遵循的、可以通过简单实验验证的宏观规律—— #反射定律 ( #The-Law-of-Reflection )。为了描述这个定律，我们需要引入一个非常有用的工具——光线。

##### 4.3.2.1 描述光的工具：光线与波前
* **波前 (Wavefront)**：想象一下向平静的湖面扔一块石头，会产生一圈圈向外扩散的水波。在任意时刻，水波的波峰（或波谷）连接成的线就是一个圆。在三维空间中，这个概念就是 #波前 ( #Wavefront )。对于一个点光源（比如一个微小的灯泡），它向四周发出的光波，其波前就是一个个同心球面。对于来自遥远光源（如太阳）的光，在局部可以近似为平面，其波前就是一系列平行的平面，我们称之为平面波。

* **光线 (Ray)**：虽然光本质上是波，但总画出波前会很繁琐。为了方便地表示光的传播路径和方向，我们引入了 光线 (Ray ) 的概念。**光线是垂直于波前的、代表光能传播方向的假想直线**。
    *   对于点光源的球面波，光线就是从点源出发的无数条径向直线。
    *   对于平面波，光线就是一组互相平行的直线。

##### 4.3.2.2 反射定律的内容
现在，我们用“光线”这个工具来描述反射定律。想象一束光线射向一个光滑的平面，比如镜面。

![[img-20.jpeg.png|500]]
> *图示：反射定律的几何关系。所有角度都相对于法线测量。*

1.  **入射光线 (Incident Ray)**：射向界面的光线。
2.  **反射光线 (Reflected Ray)**：从界面反射回来的光线。
3.  **法线 (Normal)**：过入射点，并**垂直于**反射平面的直线。这是一个非常重要的参考线。
4.  #入射角 ( #Angle-of-Incidence ) ($\theta_{i}$): 入射光线与法线之间的夹角。
5.  #反射角 ( #Angle-of-Reflection ) ($\theta_{r}$): 反射光线与法线之间的夹角。

反射定律包含两个部分：
* **第一部分：反射角等于入射角。**
$$
    \theta_{i} = \theta_{r}
    $$
    这是一个非常简洁而优美的关系。你以什么角度入射，就以完全相同的角度反射出去。
    * **示例1：** 如果光线垂直射向镜面（称为**正入射**），此时入射角 $\theta_{i} = 0^{\circ}$。根据定律，$\theta_{r} = 0^{\circ}$，所以光线会原路返回。
    * **示例2：** 如果光线几乎是贴着镜面射入（称为**掠射**），此时入射角 $\theta_{i} \approx 90^{\circ}$，那么反射角 $\theta_{r} \approx 90^{\circ}$，光线也会几乎贴着镜面反射出去。

* **第二部分：入射光线、反射光线和法线，这三条线位于同一个平面内。**
    这个平面被称为 #入射平面 ( #Plane-of-Incidence )。这个规定看似理所当然，但它在三维空间中是至关重要的。它告诉你，反射光线不会“拐”到其他方向去。你可以做一个简单的实验：用一个手电筒照射桌上的镜子，试着让反射光斑照到墙上某个特定的点。你会发现，你不仅要调整手电筒的俯仰角（改变 $\theta_{i}$），还要调整它的左右方位，这正是在确定入射平面。

#### 4.3.3 反射的类型：镜面反射与漫反射
我们现在知道，光在光滑表面上的反射遵循着简单的定律。但这引出了一个问题：为什么我们能看到一个物体，比如这本书的纸页？它本身不发光，我们能看到它，是因为它反射了环境中的光。但为什么它不像镜子一样，形成一个清晰的像呢？

这取决于反射表面的**平滑程度**，这里的“平滑”是相对于光的波长而言的。
* **镜面反射 ( Specular-Reflection )**
    当反射表面非常光滑（其表面的起伏远小于光的波长，光的波长大约是 500 纳米）时，一束平行的入射光线，其反射光线也会是平行的。所有的光都以同样的方式被“整齐地”反射出去。这种反射能够形成像，镜子、平静的水面发生的就属于镜面反射。

* **漫反射 ( Diffuse-Reflection )**
    当反射表面非常粗糙（其表面的起伏可以与光的波长相比，甚至更大）时，情况就不同了。虽然对于每一条极细微的光线，在它所照射到的那个微小局部，仍然遵循着“反射角等于入射角”的规律，但是由于表面凹凸不平，每个点的法线方向都各不相同。因此，一束平行的入射光线，其反射光线会射向四面八方。
    我们能从各个角度看到不发光的物体（如书本、墙壁、衣服），正是因为它们表面发生了漫反射，将光散射到了我们眼睛所在的位置。

![[img-23.jpeg.png|600]]
> *图示：(a) 镜面反射：平行入射，平行反射。(b) 漫反射：平行入射，反射向四面八方。*

大多数物体表面的反射行为介于纯粹的镜面反射和漫反射之间。比如，一本杂志的封面，你既能看清上面的图画（漫反射），又能看到灯管模糊的倒影（镜面反射的成分）。

> **生活实例：湿滑的路面为何更“黑”？**
> -  **干燥时**：柏油路面粗糙，发生漫反射。车灯光被散射到各个方向，包括你的眼睛，所以你能看清路面。
> -  **下雨后**：水膜填平了路面的坑洼，使其变得光滑，主要发生镜面反射。车灯光被整齐地反射到前方远处，很少光线进入你的眼睛，因此路面看起来是黑的、看不清的。

#### 4.3.4 反射的物理本质：原子散射理论
现在，让我们深入到微观世界，探究反射现象的根本原因。为什么光一碰到介质界面就会被反射回来？
1.  **光的电磁本性与原子相互作用**
    光是电磁波，它携带着振荡的电场和磁场。当光波进入一种介质（如玻璃）时，其电场会作用于介质中的原子，特别是原子核外的电子，迫使它们以与光波相同的频率进行受迫振动。

2.  **振动的电子成为新的光源**
    根据电磁理论，加速运动的电荷会向外辐射电磁波。因此，这些受迫振动的电子就如同一个个微型的天线，向四面八方辐射出新的电磁波（称为**散射子波**）。这些子波的频率与入射光完全相同。

3.  **相干叠加决定最终结果**
    那么，我们最终观测到的光（无论是透射光还是反射光），其实是入射光与所有原子散射的子波**相干叠加**（即考虑相位关系地叠加）的结果。

    * **在均匀介质内部：** 想象一下在玻璃内部，远离界面的地方。对于任何一个原子，它的散射子波在“后向”（与光传播方向相反）会被其后方原子的散射子波所抵消（严格来说是相消干涉）。而在“前向”，所有子波会与主光波同相叠加，使得光波继续向前传播。这就是为什么在均匀的玻璃块中，我们只看到光束一路向前，而看不到向后或向旁的散射光。

    * **在介质界面处：** 界面的情况就不同了。对于界面上以及界面附近浅层（大约半个波长深度）的原子，它们在介质外部（例如空气中）没有“伙伴”原子来产生可以抵消它们后向散射的子波。这些“未配对”的原子层发出的后向散射子波无法被完全抵消，它们会进行相干叠加，最终在宏观上形成了一束方向确定的**反射光**。

    **一个绝佳的比喻：切开的玻璃块**
    想象一束光正在一大块完整的、均匀的玻璃中传播（图a）。此时，内部没有反射光。现在，我们沿着垂直于光束的方向，将这块玻璃“切”成两半，然后将两半稍微分开（图b）。
![[img-14.jpeg.png]]
> *图示：(a) 光在完整玻璃中传播，无反射。(b) 玻璃被切开并分开后，在两个新的界面上都产生了反射光。*

在切割的瞬间，原本在玻璃内部的原子，现在暴露在了新的表面上。
* 对于右边的玻璃块，其左表面上的原子现在成了“未配对”的原子，它们产生的后向散射波叠加形成了反射光束I。
* 同理，对于左边的玻璃块，其右表面上的原子也成了“未配-对”的原子，它们也产生了反射光束II。

    **本质上，每一个被光照到的原子都参与了向后散射，但只有界面附近一个薄层（约半个波长厚度）的原子产生的后向散射波能够有效地、相干地叠加形成我们观测到的反射波。**

#### 4.3.5 从微观理论推导宏观定律
宏观的反射定律（$\theta_{i} = \theta_{r}$）其实是微观散射子波相干叠加的必然结果。我们可以借助 惠更斯原理 ( Huygens-Principle ) 来进行几何推导。惠更斯原理可以看作是上述散射理论的一个简化模型，它指出：**波前上的每一点都可以看作是产生球面子波的新波源，这些子波的包络面就构成了下一时刻的新波前。**

让我们来看一下这个经典的推导过程：

![[img-18.jpeg.png|500]]
> *图示：利用惠更斯原理推导反射定律。*

1.  如图所示，让一条倾斜的平面波前 $\overline{AB}$ 入射到反射面上。点 $A$ 已经到达反射面，而点 $B$ 还在空中。

2.  根据惠更斯原理，点 $A$ 立即成为一个新的子波源，开始向原介质（上方）发出一个半球形的子波。

3.  在点 $B$ 到达反射面上的点 $D$ 所需的时间 $\Delta t$ 内，这个子波传播的距离是多少呢？设光在入射介质中的速度为 $v_{i}$，则点 $B$ 走过的距离为 $\overline{BD} = v_{i} \Delta t$。

4.  在同样的时间 $\Delta t$ 内，从点 $A$ 发出的子波也传播了相同的距离，因为它也在同一个介质中。这个子波的波前会到达点 $C$，因此 $\overline{AC} = v_{i} \Delta t$。

5.  所以，我们得到了一个关键的等式：$\overline{AC} = \overline{BD}$。

6.  当点 $B$ 刚好到达点 $ D $ 时，从点 $A$ 发出的子波波前刚好到达点 $C$。同理，在 $A$ 和 $D$ 之间的所有点发出的子波，在这一时刻的包络面（也就是新的反射波前）正是直线 $\overline{CD}$。

7.  现在我们来考察图中的两个直角三角形：$\triangle ABD$ 和 $\triangle ADC$。它们共享一个斜边 $\overline{AD}$。
    *   在 $\triangle ABD$ 中，我们有 $\sin \theta_{i} = \frac{\overline{BD}}{\overline{AD}}$。
    *   在 $\triangle ADC$ 中，我们有 $\sin \theta_{r} = \frac{\overline{AC}}{\overline{AD}}$。

8.  将步骤5的结论 $\overline{AC} = \overline{BD}$ 代入，我们得到：
$$
    \overline{AD} \sin \theta_{i} = \overline{AD} \sin \theta_{r}
    $$
$$
    \sin \theta_{i} = \sin \theta_{r}
    $$

9.  由于入射角和反射角都在 $0^{\circ}$ 到 $90^{\circ}$ 之间，因此上述等式成立的唯一条件就是：
$$
    \boxed{\theta_{i} = \theta_{r}}
    $$
    我们就这样从光的波动性和散射理论出发，严格地推导出了反射定律的第一部分！这也完美地展示了物理学中宏观现象与微观本质的统一。

#### 4.3.6 内反射、外反射与一个重要的相位突变
现在我们回到之前“切开玻璃块”的比喻，并引入两个新概念。我们假设玻璃是光密介质，空气是光疏介质。“光密”和“光疏”是根据 折射率 ( Index-of-Refraction ) $n$ 的大小来区分的，折射率越大的介质越“光密”。
* **外反射 ( External-Reflection )**：当光从光疏介质射向光密介质时发生的反射（例如，从空气到玻璃，$n_{i} < n_{t}$）。在我们的比喻中，射向右边玻璃块的**光束I**就是外反射。

* **内反射 ( Internal-Reflection )**：当光从光密介质射向光疏介质时发生的反射（例如，从玻璃到空气，$n_{i} > n_{t}$）。在我们的比喻中，从左边玻璃块反射回来的**光束II**就是内反射。

实验和理论都表明一个极其重要的事实：如果我们将分开的两个玻璃块重新紧密地压合在一起，界面消失，反射光束I和II也随之消失。

光束I和II要完全抵消，必须满足两个条件：振幅相等，且相位**正好相反**（相差180°或 $\pi$ 弧度）。振幅相等是好理解的（对于空气-玻璃界面，垂直入射时反射率约为4%）。那么“相位相反”这个条件从何而来呢？

这揭示了一个深刻的物理规律：
**外反射和内反射之间存在一个 180度相对相移 ( 180-Degree-Relative-Phase-Shift )。**

更具体地说（这一点非常重要，请大家务必记住）：
* 当光发生**外反射**（从光疏到光密介质）时，反射波的相位会相对于入射波**突变180° ($\pi$)**。
* 当光发生**内反射**（从光密到光疏介质，且入射角小于全反射临界角时）时，反射波的相位相对于入射波**没有相位突变**。

因此，光束I（外反射）有180°的相位突变，而光束II（内反射）没有。它们之间天然就存在180°的相位差，所以当它们振幅相等时，叠加后便会完美抵消。这个相位突变的知识点，对于我们后续学习薄膜干涉等现象至关重要。

> **教授的比喻：甩动的绳子**
> *   **外反射** 就像绳子末端固定在墙上（从轻的绳子到重的墙）。当波传到墙上，反射回来的波会上下颠倒（波峰变波谷），这就是 **180°相位突变**。
> *   **内反射** 就像绳子末端是自由的（从重的绳子到轻的空气）。反射回来的波不会颠倒（波峰还是波峰），**没有相位突变**。
> 这个相位知识是理解薄膜干涉（如肥皂泡的彩色）的关键。


#### 4.3.7 反射与波长的关系：为什么镜子不是彩色的？
我们知道，像瑞利散射（天空为什么是蓝色的）这样的现象，其散射强度与波长的四次方成反比（$1/\lambda^4$），即蓝光比红光更容易被散射。那么，反射既然源于散射，为什么镜子反射白光时，看到的还是白光，而不是偏蓝色呢？

这里有两个相互制衡的因素在起作用：
1.  **单个原子的散射效率**：确实，单个原子对短波长光（如蓝光）的散射效率要高于长波长光（如红光）。

2.  **参与相干叠加的原子数量**：我们之前提到，产生反射的有效原子层厚度大约是半个波长（$\lambda/2$）。这意味着，对于波长更长的红光，会有更深、更多层的原子参与到有效的相干叠加中来，共同形成反射波。而对于波长较短的蓝光，有效层较浅，参与的原子数量也较少。

**“更多数量的原子”** 这一因素，补偿了 **“单个原子较低的散射效率”** 这一因素。两者综合作用的结果是，对于透明电介质的表面（如玻璃），在可见光范围内，其对所有波长的光的反射率（反射的能量比例）大致是相同的。

因此，反射是 **消色差 ( Achromatic )** 的。当一束包含各种颜色的白光照射到镜面上时，各种颜色的光被等比例地反射回来，我们看到的反射光自然也就是白色的。这也就是为什么这张白纸在白光下看起来是白色的原因（它对各种色光都进行了高效的漫反射）。

---

### 关键结论与知识点总结
1.  **反射的定义**：光在两种不同介质的界面上返回原介质的现象。其物理根源在于界面处原子散射的电磁波在后向的相干叠加。

2.  **反射定律**：
    *   反射角等于入射角 ($\theta_{i} = \theta_{r}$)。
    *   入射光线、反射光线和法线共面（位于入射平面内）。

3.  **两种反射类型**：
    *   **镜面反射**：发生在光滑表面，能形成像。
    *   **漫反射**：发生在粗糙表面，使我们能从各个方向看到不发光的物体。

4.  **反射的微观模型**：入射光使介质原子中的电子振动，振动的电子再辐射出电磁波（子波）。在均匀介质内部，后向散射被抵消；在界面处，“未配对”的原子层产生的后向散射叠加形成反射波。

5.  **惠更斯原理**：可用于从波动光学角度推导出反射定律，证明了宏观规律与微观本质的统一。

6.  **内、外反射与相位突变**：
    *   **外反射**（光疏 → 光密）：反射光有 **180° ($\pi$)** 的相位突变。
    *   **内反射**（光密 → 光疏）：反射光**没有**相位突变。
    *   这是理解干涉现象的关键。

7.  **反射的颜色**：透明介质（如玻璃）表面的反射通常是消色差的（白光进，白光出。其反射率在可见光范围内与波长关系不大），这是单原子散射效率（$1/\lambda^4$）与有效散射体积（$\propto \lambda$）平衡的结果。

---

### 专业术语/关键词中英对照表
*    #界面 ( #Interface )
*    #反射定律 ( #The-Law-of-Reflection )
*    #波前 ( #Wavefront )
*    #光线 ( #Ray )
*    #法线 ( #Normal )
*    #入射角 ( #Angle-of-Incidence )
*    #反射角 ( #Angle-of-Reflection )
*    #入射平面 ( #Plane-of-Incidence )
*    #镜面反射 ( #Specular-Reflection )
*    #漫反射 ( #Diffuse-Reflection )
*    #惠更斯原理 ( #Huygens-Principle )
*    #折射率 ( #Index-of-Refraction )
*    #外反射 ( #External-Reflection )
*    #内反射 ( #Internal-Reflection )




## 4.4 Refraction

Figure 4.13 shows a beam of light impinging on an interface at some angle $\left(\theta_{I} \neq 0\right)$. The interface corresponds to a major inhomogeneity, and the atoms that compose it scatter light both backward, as the reflected beam, and forward, as the transmitted beam. The fact that the incident rays are bent or "turned out of their way," as Newton put it, is called ***refraction***.

Examine the transmitted or refracted beam. Speaking classically, each energized molecule on the interface radiates wavelets into the glass that expand out at speed $c$. These can be imagined as combining into a secondary wave that then recombines with the unscattered remainder of the primary wave, to form the net transmitted wave. The process continues over and over again as the wave advances in the transmitting medium.
![350](4-Optics/images/img-24.jpeg.png)
> By placing a pair of pins in front of a flat mirror and aligning their images with another pair of pins, you can easily verify that $\theta_{I}=\theta_{T}$. (E.H.)

However we visualize it, immediately on entering the transmitting medium, there is a single net field, a single net wave. As we have seen, this transmitted wave usually propagates with an effective speed $v_{f}<c$. It's essentially as if the atoms at the interface scattered "slow wavelets" into the glass that combine to form the "slow transmitted wave." We'll come back to this imagery when we talk about Huygens's Principle. In any event, because the cooperative phenomenon known as the transmitted electromagnetic wave is slower than the incident electromagnetic wave, the transmitted wavefronts are refracted, displaced (turned with respect to the incident wavefronts), and the beam bends.

### 4.4.1 The Law of Refraction

![420](4-Optics/images/img-25.jpeg.png)
> Figure 4.19 The refraction of waves. The atoms in the region of the surface of the transmitting medium reradiate wavelets that combine constructively to form a refracted beam. For simplicity the reflected wave has not been drawn.

Figure 4.19 picks up where we left off with Figs. 4.13 and 4.16. The diagram depicts several wavefronts, all shown at a single instant in time. Remember that each wavefront is a surface of constant phase, and, to the degree that the phase of the net field is retarded by the transmitting medium, each wavefront is held back, as it were. The wavefronts "bend" as they cross the boundary because of the speed change. Alternatively, we can envision Fig. 4.19 as a multiple-exposure picture of a single wavefront, showing it after successive equal intervals of time. Notice that in the time $\Delta t$, which it takes for point $B$ on a wavefront (traveling at speed $v_{t}$ ) to reach point $D$, the transmitted portion of that same wavefront (traveling at speed $v_{t}$ ) has reached point $E$. If the glass $\left(n_{t}=1.5\right)$ is immersed in an incident medium that is vacuum $\left(n_{t}=1\right)$ or air $\left(n_{t}=1.0003\right)$ or anything else where $n_{t}>n_{i}, v_{t}<v_{i}$, and $\overline{A E}<\overline{B D}$, the wavefront bends. The refracted wavefront extends from $E$ to $D$, making an angle with the interface of $\theta_{i}$. As before, the two triangles $A B D$ and $A E D$ in Fig. 4.19 share a common hypotenuse $(\overline{A D})$, and so
$$
\frac{\sin \theta_{i}}{\overline{B D}}=\frac{\sin \theta_{t}}{\overline{A E}}
$$

where $\overline{B D}=v_{i} \Delta t$ and $\overline{A E}=v_{t} \Delta t$. Hence
$$
\frac{\sin \theta_{i}}{v_{i}}=\frac{\sin \theta_{t}}{v_{t}}
$$

Multiply both sides by $c$, and since $n_{i}=c / v_{i}$ and $n_{t}=c / v_{t}$
$$
\boxed{n_{i} \sin \theta_{i}=n_{t} \sin \theta_{t}}\tag{4.4}
$$

Keep in mind that because of dispersion (Section 3.5.1) $n_{i}, n_{t}, \theta_{i}$, and $\theta_{t}$ are generally frequency dependent. This equation works for every frequency, but each will "bend" differently.

This expression is the first portion of the ***Law of Refraction***, also known as ***Snell's Law*** after the man who proposed it (1621), Willebrord Snel van Royen (1591-1626). Snel's analysis has been lost, but contemporary accounts follow the treatment shown in Fig. 4.20. What was found through observation was that the bending of the rays could be quantified via the ratio of $x_{i}$ to $x_{t}$ which was constant for all $\theta_{i}$. That constant was naturally enough called the index of refraction. 
$$
\frac{x_{i}}{x_{t}} \equiv n_{t}
$$

![400](4-Optics/images/img-26.jpeg.png)
> Figure 4.20 Descartes's arrangement for deriving the Law of Refraction. The circle is drawn with a radius of 1.0 .

![300](4-Optics/images/img-27.jpeg.png)
> When light passes from one medium into another some portion is usually reflected back at the interface. At normal incidence that portion is given by Eq. (4.47). In this case the clear plastic film and the adhesive coating both have the same index of refraction and so, as far as light is concerned, each one of the hundreds of interfaces simply vanishes. No light is reflected at any of the plastic-adhesive interfaces, and the entire multilayered roll is transparent. (E.H.)

In other words, and in air since $x_{i}=\sin \theta_{i}$ and $x_{t}=\sin \theta_{t}$ that's equivalent to Eq. (4.4). We now know that the Englishman Thomas Harriot had come to the same conclusion before 1601, but he kept it to himself.

At first, the indices of refraction were simply experimentally determined constants of the physical media. Later, Newton was actually able to derive Snell's Law using his own corpuscular theory. By then, the significance of $n$ as a measure of the speed of light was evident. Still later, Snell's Law was shown to be a natural consequence of Maxwell's Electromagnetic Theory (p. 121).

It is again convenient to transform the diagram into a ray representation (Fig. 4.21) wherein all the angles are measured from the perpendicular. Along with Eq. (4.4), there goes the understanding that the incident, reflected, and refracted rays all lie in the plane-of-incidence. In other words, the respective unit propagation vectors $\hat{\mathbf{k}}_{i}, \hat{\mathbf{k}}_{r}$, and $\hat{\mathbf{k}}_{t}$ are coplanar (Fig. 4.22).
![450](4-Optics/images/img-28.jpeg.png)
> Figure 4.21 The incident, reflected, and transmitted beams each lie in the plane-of-incidence.

![400](4-Optics/images/img-29.jpeg.png)
> Figure 4.22 Refraction at various angles of incidence. Notice that the bottom surface is cut circular so that the transmitted beam within the glass always lies along a radius and is normal to the lower surface in every case. (PSSC College Physics, D. C. Heath \& Co., 1968.)

#### EXAMPLE 4.1

A ray of light in air having a specific frequency is incident on a sheet of glass. The glass has an index of refraction at that frequency of 1.52 . If the transmitted ray makes an angle of $19.2^{\circ}$ with the normal, find the angle at which the light impinges on the interface.

#### SOLUTION

From Snell's Law
$$
\begin{aligned}
\sin \theta_{i} & =\frac{n_{i}}{n_{i}} \sin \theta_{i} \\
\sin \theta_{i} & =\frac{1.52}{1.00} \sin 19.2^{\circ}=0.4999 \\
\text{and}~~~~~~~~~~& \theta_{i}=30^{\circ}
\end{aligned}
$$

---
When $n_{i}<n_{i}$ (that is, when the light is initially traveling within the lower-index medium), it follows from Snell's Law that $\sin \theta_{i}>\sin \theta_{r}$, and since the same function is everywhere positive between $0^{\circ}$ and $90^{\circ}$, then $\theta_{i}>\theta_{r}$. Rather than going straight through, ***the ray entering a higher-index medium bends toward the normal*** (Fig. 4.23a). The reverse is also true (Fig. 4.23b); that is, ***on entering a medium having a lower index, the ray, rather than going straight through, will bend away from the normal*** (see photo above). Notice that this implies that the rays will traverse the same path going either way, into or out of either medium. The arrows can be reversed and the resulting picture is still true.
![400](4-Optics/images/img-30.jpeg.png)
> The image of a pen seen through a thick block of clear plastic. The displacement of the image arises from the refraction of light toward the normal at the air-plastic interface. If this arrangement is set up with a narrow object (e.g., an illuminated slit) and the angles are carefully measured, one can confirm Snell's Law directly. (E.H.)

![300](4-Optics/images/img-31.jpeg.png)
> Figure 4.23 The bending of rays at an interface. (a) When a beam of light enters a more optically dense medium, one with a greater index of refraction $\left(n_{i}<n_{f}\right)$, it bends toward the perpendicular. (b) When a beam goes from a more dense to a less dense medium $\left(n_{i}>n_{f}\right)$, it bends away from the perpendicular.

It's fairly common to talk about the optical density of a transparent medium. The concept no doubt came from the widely held, although somewhat erroneous, notion that the indices of refraction of various media are always proportional to their mass densities. As can be seen in Fig. 4.25, which shows the data for a random selection of dense transparent materials, the correlation is there but it's inconsistent. For example, acrylic has a specific gravity of 1.19 and an index of 1.491 , whereas styrene has a lower specific gravity (1.06) and a higher index of refraction (1.590). Still, the term optical density-referring to index of refraction, and not mass density-is useful when comparing media.

![300](4-Optics/images/img-33.jpeg.png)
> Figure 4.24 A beam of light enters from the bottom moving upward. (a) Here there are two Plexiglas blocks widely separated in air. (b) By making the air gap thin, two of the reflected beams overlap to form the bright middle beam traveling to the right. (c) By replacing the air film with castor oil the interface between the blocks essentially vanishes, as does that reflected beam. (d) And it behaves just like a single solid block. (G. Calzà, T. López-Arias, L.M. Gratton, and S. Oss, reprinted with permission from The Physics Teacher 48, 270 (2010). Copyright 2010, American Association of Physics Teachers)

![400](4-Optics/images/img-34.jpeg.png)
> Figure 4.25 Index of refraction versus specific gravity for a random selection of dense transparent materials.

Snell's Law can be rewritten in the form
$$
\frac{\sin \theta_{I}}{\sin \theta_{I}}=n_{H}\tag{4.5}
$$

where $n_{H} \equiv n_{I} / n_{I}$ is the ***relative index of refraction*** of the two media. Note that $n_{H}=v_{I} / v_{I}$; moreover, $n_{H}=1 / n_{H}$. For air-towater $n_{w a} \approx 4 / 3$, and for air-to-glass $n_{g a} \approx 3 / 2$. As a mnemonic think of $n_{g a}=n_{g} / n_{a}$ as dividing "air into glass," just as light goes from "air into glass."

#### EXAMPLE 4.2

A narrow laserbeam traveling in water having an index of 1.33 impinges at $40.0^{\circ}$ with respect to the normal on a water-glass interface. If the glass has an index of 1.65 (a) determine the relative index of refraction. (b) What is the beam's transmission angle in the glass?

#### SOLUTION

(a) From the defining equation
$$
\begin{gathered}
n_{H}=\frac{n_{I}}{n_{I}} \\
n_{G W}=\frac{n_{G}}{n_{W}}=\frac{1.65}{1.33}=1.24
\end{gathered}
$$

(b) Using Snell's Law
$$
\begin{gathered}
\sin \theta_{I}=\left(\sin \theta_{I}\right) / n_{H} \\
\sin \theta_{I}=\left(\sin 40.0^{\circ}\right) / 1.24=0.5184 \\
\text{and}~~~~~~~~~~~\theta_{I}=31.2^{\circ}
\end{gathered}
$$
---
Let $\hat{\mathbf{u}}_{n}$ be a unit vector normal to the interface pointing in the direction from the incident to the transmitting medium (Fig. 4.26). As you will have the opportunity to prove in Problem 4.33, the complete statement of the Law of Refraction can be written vectorially as
$$
n_{i}\left(\hat{\mathbf{k}}_{i} \times \hat{\mathbf{u}}_{n}\right)=n_{i}\left(\hat{\mathbf{k}}_{i} \times \hat{\mathbf{u}}_{n}\right)\tag{4.6}
$$

or alternatively,
$$
n_{i} \hat{\mathbf{k}}_{i}-n_{i} \hat{\mathbf{k}}_{i}=\left(n_{i} \cos \theta_{i}-n_{i} \cos \theta_{i}\right) \hat{\mathbf{u}}_{n}\tag{4.7}
$$

![500](4-Optics/images/img-35.jpeg.png)
> Figure 4.26 The ray geometry.

#### Refraction of Light from a Point Source

All the usual sources of light are actually multiple-point sources, and so it's appropriate now to study the refraction of a diverging bundle of rays from a single point. Think of two homogeneous dielectric media separated by a flat interface, as depicted in Fig. 4.27. A luminous point $S$ on the left sends out light, some of which arrives at the interface where it is refracted; in $4.27 a$ converging a bit more toward the axis, and in $4.27 b$ diverging somewhat from it. 
![430](4-Optics/images/img-36.jpeg.png)
> Figure 4.27 The bending of light as it enters and leaves two different transparent materials across a planar interface. Now imagine that $S$ in (b) is underwater-rotate the diagram $90^{\circ}$ counterclockwise. An observer in the air would see $S$ imaged at $P$.

The rays making different angles will bend differently and although they all came from the same axial point $S$ they will generally not project back to the same point on the axis in either diagram. However, if we limit the light to a narrow cone the rays will refract only a little, being nearly normal to the interface, and then will indeed appear to come from a single point $P$, as shown in both Fig. $4.27 a$ and $b$ (where the cone angles are exaggeratedly large to allow for the nomenclature to be drawn in). Thus, if $S$ in Fig $4.27 b$ is a spot on a fish reflecting skylight back out of the water (here to the right), the cone of rays entering the tiny pupil of the eye of an observer will be so narrow that a fairly sharp image of $S$ will be formed on the retina. And since the eye-brain system has learned to process light by perceiving it as if it flowed in straight lines, the spot, and hence that part of the fish, will appear at $P$.

The locations $S$ and $P$ are said to be ***conjugate points***. The object at $S$ is at an "object distance" from the interface, symbolized as $s_{o}$, and the image at $P$ is a distance $s_{i}$, the "image distance" from $O$. Using triangles $S A O$ and $P A O$ in Fig. 4.27b
$$
s_{o} \tan \theta_{i}=s_{i} \tan \theta_{i}
$$

Because the ray cone is narrow, $\theta_{i}$ and $\theta_{i}$ are small and we can replace the tangents with sines, whereupon Snell's Law yields
$$
s_{i} / s_{o}=n_{i} / n_{i}
$$

Look straight down (i.e., to the left in Fig. 4.27b) on a fish (where $n_{i}=1, n_{i}=4 / 3$, and $n_{i} / n_{i}=3 / 4$ ), which is 4.0 m beneath the surface and it will appear to be only 3.0 m below. On the other hand, if you are 3.0 m above the surface the fish, looking straight up, will see you 4.0 m above it.

When the cone of rays from the point $S$ is broad, things get more complicated, as pictured in the slice perpendicular to the surface shown in Fig 4.28. When viewed at appreciable angles off the normal the transmitted rays will again appear to come from many different points. Each of these rays when extended back will be tangent to a curve called the ***caustic***. In other words, different rays will seem to pass through different points $(P)$, all of which lie on the caustic; the greater the initial angle of the ray from $S$, the greater the angle of refraction, and the higher up the caustic will be $P$.
![380](4-Optics/images/img-37.jpeg.png)
> Figure 4.28 A point source embedded in an optically dense material—a fish in a pool. The observer will see $S$ located somewhere along the curve depending on which rays they view. As shown, the ray entering the observer's eye appears to come from $P$.

A cone of rays from $S$, narrow enough to enter the eye, will be seen to come from $P$ (Fig. 4.29). That point is both higher and displaced horizontally toward the observer (i.e., shifted along the caustic). All of that has the effect of bending the image of the pencil (see photo on page 114), and making spear fishing rather tricky. Figure 4.29 suggests a little demonstration: put a coin in an opaque mug and, looking down into it, move away horizontally until the lip of the mug just blocks the direct view of the coin. Now without moving your eye, slowly fill the mug with water and the coin will come into view as its image rises.
![380](4-Optics/images/img-38.jpeg.png)
> Figure 4.29 Seeing an object beneath the surface of a quantity of water.

#### EXAMPLE 4.3

A ray impinges on a block of glass of index 1.55 , as shown in the accompanying illustration.
![580](4-Optics/images/img-39.jpeg.png)

Determine the angles $\theta_{1}, \theta_{2}, \theta_{3}, \theta_{4}, \theta_{5}, \theta_{6}, \theta_{7}$, and $\theta_{8}$.

#### SOLUTION

From the Law of Reflection $\theta_{1}=35.0^{\circ}$. From Snell's Law

$$
\begin{gathered}
1 \sin 35.0^{\circ}=1.55 \sin \theta_{2} \\
\sin \theta_{2}=\frac{\sin 35.0^{\circ}}{1.55}=0.3700
\end{gathered}
$$

and $\theta_{2}=21.719^{\circ}$, or $21.7^{\circ}$. Since $\theta_{2}+\theta_{3}=90^{\circ}, \theta_{3}=68.281^{\circ}$, or $68.3^{\circ}$. From the Law of Reflection $\theta_{3}=\theta_{4}=68.3^{\circ}=\theta_{5}=\theta_{6}$.

Thus since $\theta_{6}+\theta_{7}=90^{\circ}, \theta_{7}=90^{\circ}-\theta_{6}=21.7^{\circ}$. And so Snell's Law at the far-right interface yields

$$
\begin{gathered}
1.55 \sin 21.719^{\circ}=1.00 \sin \theta_{8} \\
0.5736=\sin \theta_{8}
\end{gathered}
$$

and $\theta_{8}=35.0^{\circ}$; the ray emerges at the same angle it entered.

---

Fig. 4.19 illustrates the three important changes that occur in the beam traversing the interface. (1) It changes direction. Because the leading portion of the wavefront in the glass slows down, the part still in the air advances more rapidly, sweeping past and bending the wave toward the normal. (2) The beam in the glass has a broader cross section than the beam in the air; hence, the transmitted energy is spread thinner. (3) The wavelength decreases because the frequency is unchanged while the speed decreases; $\lambda=v / \nu=c / n \nu$ and
$$
\boxed{\lambda=\frac{\lambda_{0}}{n}}\tag{4.8}
$$

This latter notion suggests that the color aspect of light is better thought of as associated with its frequency (or energy, $\mathscr{E}=h \nu$ ) than its wavelength, since the wavelength changes with the medium through which the light moves. Color is so much a physiopsychological phenomenon (p. 142) that it must be treated rather gingerly. Still, even though it's a bit simplistic, it's useful to remember that blue photons are more energetic than red photons. When we talk about wavelengths and colors, we should always be referring to ***vacuum wavelengths*** (henceforth to be represented as $\lambda_{0}$ ).

In all the situations treated thus far, it was assumed that the reflected and refracted beams always had the same frequency as the incident beam, and that's ordinarily a reasonable assumption. Light of frequency $\nu$ impinges on a medium and presumably drives the molecules into simple harmonic motion. That's certainly the case when the amplitude of the vibration is fairly small, as it is when the electric field driving the molecules is small. The $E$-field for bright sunlight is only about $1000 \mathrm{~V} / \mathrm{m}$ (while the $B$-field is less than a tenth of the Earth's surface field). This isn't very large compared to the fields keeping a crystal together, which are of the order of $10^{11} \mathrm{~V} / \mathrm{m}$-just about the same magnitude as the cohesive field holding the electron in an atom. We can usually expect the oscillators to vibrate in simple harmonic motion, and so the frequency will remain constant-the medium will ordinarly respond linearly. That will not be true, however, if the incident beam has an exceedingly large-amplitude $E$-field, as can be the case with a high-power laser. So driven, at some frequency $\nu$ the medium can behave in a nonlinear fashion, resulting in reflection and refraction of harmonics $(2 \nu, 3 \nu$, etc.) in addition to $\nu$. Nowadays, second-harmonic generators (p. 668) are available commercially. You shine red light ( 694.3 nm ) into an appropriately oriented transparent nonlinear crystal (of, for example, potassium dihydrogen phosphate, KDP, or ammonium dihydrogen phosphate, ADP) and out will come a beam of UV ( 347.15 nm ).

![200](4-Optics/images/img-40.jpeg.png)
> Rays from the submerged portion of the pencil bend on leaving the water as they rise toward the viewer. (E.H.)

One feature of the above treatment merits some further discussion. It was reasonably assumed that each point on the interface in Fig. 4.13a coincides with a particular point on each of the incident, reflected, and transmitted waves. In other words, there is a fixed phase relationship between each of the waves at all points along the interface. As the incident front sweeps across the interface, every point on it in contact with the interface is also a point on both a corresponding reflected front and a corresponding transmitted front. This situation is known as ***wavefront continuity***, and it will be justified in a more mathematically rigorous treatment in Section 4.6.1. Interestingly, Sommerfeld[^Sommerfeld] has shown that the Laws of Reflection and Refraction (independent of the kind of wave involved) can be derived directly from the requirement of wavefront continuity and the solution to Problem 4.30 demonstrates as much.

[^Sommerfeld]:  *A. Sommerfeld, Optics, p. 151. See also J. J. Sein, Am. J. Phys. 50, 180 (1982).

#### Negative Refraction

Though still in its infancy the blossoming technology of meta-materials raises several interesting issues, one of the more fascinating being the notion of negative refraction. One cannot yet go to a catalogue and order a sheet of left-handed material, so we are not concerned with practicalities here. Instead we'll focus on the physics, which is quite extraordinary. In general, energy flows in the direction of the Poynting vector, which is the direction of the rays. A wave travels in the direction of the propagation vector, which is perpendicular to the wavefronts. In a homogeneous isotropic dielectric like glass all of these directions are the same. That's not the case for a left-handed material.

![250](4-Optics/images/img-41.jpeg.png)
> A refractive turtle. (Anya Levinson and Tom Woosnam)

In the simulation presented in Fig. 4.30 we see a horizontal plate of material having a negative index of refraction surrounded by air or glass or water, some commonplace medium. A beam with fairly flat wavefronts approaches the upper interface from the top left, traveling in an ordinary positive-index material and therefore spreading out slightly as it advances. The beam enters the negative-index plate and instead of bending toward the normal in the fourth quadrant, it propagates into the third quadrant at an angle nonetheless in accord with Snell's Law. Notice that the wavefronts now converge instead of diverging; in the steady state the wavelets are actually traveling backward, up and to the right, back to the first interface. They have a negative phase velocity.
![300](4-Optics/images/img-42.jpeg.png)
> Figure 4.30 A beam of light incident from above on a plate of negativeindex material immersed in air top and bottom.

In the negative material the propagation vector points up and to the right, while the rays point down and to the left. The phase velocity of the wavelets is up to the right even though the Poynting vector (the ray direction) is down to the left. Energy flows as usual in the direction of the advancing beam, albeit down to the left.

At the lower interface the wave, entering back into the ordinary material, flips around the normal into the fourth quadrant, propagating parallel to the original incoming beam much as if it had traversed a sheet of glass. Everything is back to normal and the transmitted beam diverges as usual as it propagates down to the right.

### 4.4.2 Huygens's Principle

Suppose that light passes through a nonuniform sheet of glass, as in Fig. 4.31, so that the wavefront $\Sigma$ is distorted. How can we determine its new form $\Sigma^{\prime}$ ? Or for that matter, what will $\Sigma^{\prime}$ look like at some later time, if it is allowed to continue unobstructed?

A preliminary step toward the solution of this problem appeared in print in 1690 in the work titled Traité de la Lumière, which had been written 12 years earlier by the Dutch physicist Christiaan Huygens. It was there that he enunciated what has since become known as ***Huygens's Principle: every point on a propagating wavefront serves as the source of spherical secondary wavelets, such that the wavefront at some later time is the envelope of these wavelets***.

A further crucial point is that ***if the propagating wave has a frequency $v$, and is transmitted through the medium at a speed $v_{t}$, then the secondary wavelets have that same frequency and speed[^speed]***. Huygens was a brilliant scientist, and this is the basis of a remarkably insightful, though quite naive, scattering theory. It's a very early treatment and naturally has several shortcomings, one of which is that it doesn't overtly incorporate the concept of interference and perforce cannot deal with lateral scattering. Moreover, the idea that the secondary wavelets propagate at a speed determined by the medium (a speed that may even be anisotropic, e.g., p. 354) is a happy guess. Nonetheless, Huygens's Principle can be used to arrive at Snell's Law in a way that's similar to the treatment that led to Eq. (4.4). As we'll see later, Huygens's Principle is closely related to the more mathematically sophisticated technique known as Fourier analysis.

[^speed]:  *SOURCE: Christiaan Huygens, 1690, Traite de la Lumiere (Treatise on Light).

![400](4-Optics/images/img-43.jpeg.png)
> Figure 4.31 Distortion of a portion of a wavefront on passing through a material of nonuniform thickness.

It's probably best not to fuss over the physical details (such as how to rationalize propagation in vacuum) and just use the principle as a tool-a highly useful fiction that works. After all, if Einstein is right, there are only scattered photons; the wavelets themselves are a theoretical construct.

If the medium is homogeneous, the wavelets may be constructed with finite radii, whereas if it is inhomogeneous, the wavelets must have infinitesimal radii. Figure 4.32 should make this fairly clear; it shows a view of a wavefront $\Sigma$, as well as a number of spherical secondary wavelets, which, after a time $t$, have propagated out to a radius of $v t$. The envelope of all these wavelets is then asserted to correspond to the advanced wave $\Sigma^{\prime}$. It is easy to visualize the process in terms of mechanical vibrations of an elastic medium. Indeed, this is the way that Huygens envisioned it within the context of an all-pervading aether, as is evident from his comment:

_We have still to consider, in studying the spreading out of these waves, that each particle of matter in which a wave proceeds not only communicates its motion to the next particle to it, which is on the straight line drawn from the luminous point, but that it also necessarily gives a motion to all the others which touch it and which oppose its motion. The result is that around each particle there arises a wave of which this particle is a center. (Christiaan Huygens, 1690, Traite de la Lumiere [Treatise on Light])_

Fresnel, in the 1800s, successfully modified Huygens's Principle, mathematically adding in the concept of interference. A little later on, Kirchhoff showed that the Huygens-Fresnel Principle was a direct consequence of the differential wave equation [Eq. (2.60)], thereby putting it on a firm mathematical base. That there was a need for a reformulation of the principle is evident from Fig. 4.32, where we deceptively only drew hemispherical wavelets[^wavelets]. Had we drawn them as spheres, there would have been a backwave moving toward the source something that is not observed. Since this difficulty was taken care of theoretically by Fresnel and Kirchhoff, we need not be disturbed by it.

[^wavelets]:  *See E. Hecht, Phys. Teach. 18, 149 (1980).

![500](4-Optics/images/img-44.jpeg.png)
> Figure 4.32 According to Huygens's Principle, a wave propagates as if the wavefront were composed of an array of point sources, each emitting a spherical wave.

#### Huygens's Ray Construction

Huygens was one of the great scientific figures of his era, and in addition to promoting the wave theory of light he devised a technique for graphing refracted rays. Along with his wavelet construction this ray scheme is extremely useful for determining how light propagates in anisotropic crystal media like those we will encounter in Chapter 8. With that in mind consider Fig. 4.33, which illustrates a ray striking an interface between two transparent, homogeneous, isotropic, dielectric materials of indices $n_{i}$ and $n_{t}$ at point $O$. With $O$ as the center, draw two circles of radii $1 / n_{i}$ for the incident circle and $1 / n_{t}$ for the refracted circle; those radii correspond to the speeds divided by $c$ in the two media. Now extend the line of the incident ray until it intersects the larger incident circle. Construct a tangent to the incident circle at that point and extend it back until it intersects the interface at point $Q$. That line corresponds to a planar incident wavefront. Now draw a line from $Q$ tangent to the refracted (or transmitted) circle. From this tangent point draw a line back to $O$ and that will be the refracted ray. At this juncture Huygens's method is mostly of pedagogical value, so we leave the proof that it corresponds to Snell's Law for Problem 4.10.

### 4.4.3 Light Rays and Normal Congruence

In practice, one can produce very narrow beams or pencils of light (e.g., a laserbeam), and we might imagine a ray to be the unattainable limit on the narrowness of such a beam. Bear in mind that in an isotropic medium (i.e., one whose properties are the same in all directions) ***rays are orthogonal trajectories of the wavefronts***. That is to say, they are lines normal to the wavefronts at every point of intersection. Evidently, in such a medium a ray is parallel to the propagation vector $\overrightarrow{\mathbf{k}}$. 
![380](4-Optics/images/img-45.jpeg.png)
> Figure 4.33 Huygens's method for constructing the refracted ray.

As you might suspect, this is not true in anisotropic substances, which we will consider later (see Section 8.4.1). Within homogeneous isotropic materials, rays will be straight lines, since by symmetry they cannot bend in any preferred direction, there being none. Moreover, because the speed of propagation is identical in all directions within a given medium, the spatial separation between two wavefronts, measured along rays, must be the same everywhere[^everywhere]. Points where a single ray intersects a set of wavefronts are called corresponding points, for example, $A, A^{\prime}$, and $A^{\prime \prime}$ in Fig. 4.34. Evidently, the separation in time between any two corresponding points on any two sequential wavefronts is identical. If wavefront $\Sigma$ is transformed into $\Sigma^{\prime \prime}$ after a time $t^{\prime \prime}$, the distance between corresponding points on any and all rays will be traversed in that same time $t^{\prime \prime}$. This will be true even if the wavefronts pass from one homogeneous isotropic medium into another. This just means that each point on $\Sigma$ can be imagined as following the path of a ray to arrive at $\Sigma^{\prime \prime}$ in the time $t^{\prime \prime}$.

[^everywhere]:  *When the material is inhomogeneous or when there is more than one medium involved, it will be the optical path length (see Section 4.5) between the two wavefronts that is the same.

If a group of rays is such that we can find a surface that is orthogonal to each and every one of them, they are said to form a ***normal congruence***. For example, the rays emanating from a point source are perpendicular to a sphere centered at the source and consequently form a normal congruence.

We can now briefly consider a scheme that will also allow us to follow the progress of light through various isotropic media. The basis for this approach is the ***Theorem of Malus and Dupin*** (introduced in 1808 by E. Malus and modified in 1816 by C. Dupin), according to which ***a group of rays will preserve its normal congruence after any number of reflections and refractions*** (as in Fig. 4.34). From our present vantage point of the wave theory, this is equivalent to the statement that rays remain orthogonal to wavefronts throughout all propagation processes in isotropic media. As shown in Problem 4.32, the theorem can be used to derive the Law of Reflection as well as Snell's Law. It is often most convenient to carry out a ray trace through an optical system and then reconstruct the wavefronts using the idea of equal transit times between corresponding points and the orthogonality of the rays and wavefronts.
![450](4-Optics/images/img-46.jpeg.png)
> Figure 4.34 Wavefronts and rays.

## 4.4 折射 (Refraction)
[!折射 (Refraction)]-

想象一下，一束光，比如手电筒发出的光束，正以一个不为零的角度（$\theta_I \neq 0$）照射到一个两种不同透明物质的交界面上，例如从空气射入水中。这个 #界面 ( #Interface ) 代表了物质性质的一个突变区域。构成这个界面的原子会与入射光发生相互作用，它们吸收了光的能量后会向各个方向重新辐射光，这个过程我们称之为“散射”。这些被散射的光，一部分会向后传播，形成我们之前讨论过的反射光束；另一部分则会向前传播，进入第二种介质，形成透射光束。

牛顿曾将这种现象描述为光线“被弯折”或“偏离了原来的路径”，这个现象就是我们今天要学习的 #折射 ( #Refraction )。

### 4.4.0 物理本质：为什么光会发生折射？
在深入研究折射定律之前，我们必须先回答一个根本问题：**为什么光在穿过不同介质的界面时会发生偏折？**
答案的核心在于：**光在不同介质中的传播速度是不同的。**
* **光速的变化**：光在真空中的速度是宇宙中最快的速度，我们用 $c$ 表示（约等于 $3 \times 10^8$ 米/秒）。当光进入像水、玻璃这样的介质时，它会与介质中的原子发生复杂的相互作用（吸收和再辐射）。这个过程宏观上表现为光在介质中的“有效”传播速度变慢了。我们用 $v$ 来表示光在介质中的速度，并且总是有 $v \le c$。
* **折射率的引入**：为了方便地描述光在介质中速度变慢的程度，物理学家引入了一个非常重要的概念—— #折射率 ( #Index-of-Refraction )，用符号 $n$ 表示。它的定义是：
$$
    n = \frac{c}{v}
    $$
    其中，$c$ 是真空光速，$v$ 是光在介质中的速度。
    * 根据定义，真空的折射率 $n_{vacuum} = c/c = 1$。
    * 对于任何其他介质，由于 $v < c$，所以其折射率 $n$ 总是大于1。例如，水的折射率约为1.33，普通玻璃的折射率约为1.5。
    * 折射率越大的介质，光在其中传播的速度就越慢。我们通常称折射率较高的介质为 #光密介质 ( #Optically-Denser-Medium )，折射率较低的介质为 #光疏介质 ( #Optically-Rarer-Medium )。**请注意**，这里的“密”和“疏”指的是“光学密度”，与物质的物理密度（质量/体积）不完全是一回事，尽管通常正相关。

* **从速度变化到路径弯折：一个生动的比喻**
    想象一个军乐队排着整齐的队列（代表光的 #波前 ( #Wavefront )，即相位相同的点构成的面），从平坦的水泥地（代表空气，光速快）斜着走向一片松软的沙滩（代表玻璃，光速慢）。
    
    当队列的前缘接触到沙滩时，先踏上沙滩的士兵速度会立刻变慢，而还在水泥地上的士兵则保持原速。结果是什么呢？还在水泥地上的士兵会“赶超”已经慢下来的同伴，导致整个队列的行进方向发生偏转，偏向沙滩这边。
    
    > **比喻**：军乐队的队列（波前）从水泥地（介质1，速度$v_i$）进入沙滩（介质2，速度$v_t$）。由于速度变化，队列行进方向发生偏折。

    光的折射与此完全类似。当一个倾斜的波前进入一个光速较慢的介质时，先进入介质的部分被“拖慢”，而仍在原介质中的部分则继续以较快速度前进，导致整个波前发生“扭转”，从而使光的传播方向发生弯折。这就是折射现象的物理本质。

### 4.4.1 折射定律 (The Law of Refraction)
现在我们已经理解了折射的成因，接下来让我们用几何的方法来精确地描述这种偏折的程度。这个精确的数学关系被称为 #折射定律 ( #Law-of-Refraction )，也称为 #斯涅尔定律 ( #Snell-s-Law )，以纪念在1621年提出它的荷兰科学家威理博·斯涅尔（Willebrord Snel van Royen）。

#### 4.4.1.1 基于波前分析的推导
让我们仔细分析下图（源自原文图4.19），这张图是理解斯涅尔定律的关键。
![420](4-Optics/images/img-25.jpeg.png)
> **图 4.19 的解析**：光的折射。为简化起见，图中未画出反射波。入射波前（如AB）在介质1中以速度 $v_i$ 传播，折射波前（如ED）在介质2中以速度 $v_t$ 传播。

这张图展示了在某个瞬间，一系列波前的状态。
1.  **初始状态**：我们考虑一个沿直线传播的平面波前，它正从介质1（入射介质，折射率为 $n_i$，光速为 $v_i$）射向介质2（透射介质，折射率为 $n_t$，光速为 $v_t$）。图中的线段 $AB$ 代表入射波前的一部分。

2.  **传播过程**：让我们追踪波前上 $B$ 点的运动。在一段时间 $\Delta t$ 内，$B$ 点在介质1中沿直线传播，到达界面上的 $D$ 点。它走过的距离是：
$$
    \overline{BD} = v_i \Delta t
    $$

3.  **关键转折**：在同一段时间 $\Delta t$ 内，波前上最早接触界面的 $A$ 点，已经作为新的波源开始在介质2中传播。由于介质2的光速是 $v_t$，$A$ 点在介质2中传播的距离是：
$$
    \overline{AE} = v_t \Delta t
    $$
    此时，新的波前就由 $E$ 点和 $D$ 点连线而成，即线段 $ED$。

4.  **几何分析**：现在我们来分析图中的两个直角三角形：$\triangle ABD$ 和 $\triangle AED$。
    *   它们共享同一条斜边 $\overline{AD}$。
    *   在 $\triangle ABD$ 中，角 $\angle ADB$ 的对边是 $\overline{AB}$，角 $\angle BAD$ 是入射角 $\theta_i$。根据正弦定义： 
$$
        \sin \theta_i = \frac{\overline{BD}}{\overline{AD}}
        $$
    *   在 $\triangle AED$ 中，角 $\angle AED$ 是直角，角 $\angle ADE$ 是折射角 $\theta_t$。根据正弦定义： 
$$
        \sin \theta_t = \frac{\overline{AE}}{\overline{AD}}
        $$

5.  **推导定律**：从上述两个正弦表达式中，我们可以分别得到：
$$
    \overline{AD} = \frac{\overline{BD}}{\sin \theta_i} \quad \text{和} \quad \overline{AD} = \frac{\overline{AE}}{\sin \theta_t}
    $$
    因为斜边是共用的，所以：
$$
    \frac{\overline{BD}}{\sin \theta_i} = \frac{\overline{AE}}{\sin \theta_t}
    $$
    将我们之前得到的 $\overline{BD} = v_i \Delta t$ 和 $\overline{AE} = v_t \Delta t$ 代入上式：
$$
    \frac{v_i \Delta t}{\sin \theta_i} = \frac{v_t \Delta t}{\sin \theta_t}
    $$
    消去 $\Delta t$，并整理得到：
$$
    \frac{\sin \theta_i}{v_i} = \frac{\sin \theta_t}{v_t}
    $$
    这个公式已经揭示了角度和速度之间的关系！为了让它更通用，我们用折射率来表达。回忆折射率的定义 $n = c/v$，所以 $v = c/n$。代入上式：
$$
    \frac{\sin \theta_i}{c/n_i} = \frac{\sin \theta_t}{c/n_t}
    $$
    $$
    n_i \sin \theta_i = n_t \sin \theta_t
    $$
    这就是大名鼎鼎的 **斯涅尔定律**！
$$
    \boxed{n_{i} \sin \theta_{i}=n_{t} \sin \theta_{t}} \tag{4.4}
    $$

    **重要补充**：
    * **共面性**：折射定律还有一个重要的部分，即**入射光线、反射光线、折射光线以及界面的法线，都位于同一个平面内**。这个平面被称为 #入射面 ( #Plane-of-Incidence )。
    * **色散**：光的折射率通常与光的频率（或颜色）有关，这种现象称为 #色散 ( #Dispersion )。这意味着，一束白光（包含多种颜色）射入棱镜时，不同颜色的光会以略微不同的角度折射，从而被分开形成彩虹。因此，斯涅尔定律中的 $n_i$ 和 $n_t$ 都是频率的函数。

#### 4.4.1.2 应用斯涅尔定律
让我们通过一个例子来练习使用这个强大的公式。

#### 示例 4.1
> 一束特定频率的光线在空气中入射到一块玻璃板上。该频率下玻璃的折射率为 1.52。如果透射光线与法线的夹角为 $19.2^{\circ}$，求光线在界面上的入射角。
>
#### 详细解答
> 1.  **识别已知和未知量**：
>     *   入射介质是空气，其折射率 $n_i$ 非常接近1，我们取 $n_i = 1.00$。
>     *   透射介质是玻璃，其折射率 $n_t = 1.52$。
>     *   折射角 $\theta_t = 19.2^{\circ}$。
>     *   我们需要求解的是入射角 $\theta_i$。
>
> 2.  **应用斯涅尔定律**：
>    $$
>     n_i \sin \theta_i = n_t \sin \theta_t
>     $$
>
> 3.  **代入数值并求解** $\sin \theta_i$：
>    $$
>     1.00 \times \sin \theta_i = 1.52 \times \sin 19.2^{\circ}
>     $$
>     首先计算 $\sin 19.2^{\circ}$：
>    $$
>     \sin 19.2^{\circ} \approx 0.3289
>     $$
>     所以：
>     $$
>     \sin \theta_i = 1.52 \times 0.3289 \approx 0.4999
>     $$
>
> 4.  **求出角度** $\theta_i$：
>    $$
>     \theta_i = \arcsin(0.4999) \approx 30.0^{\circ}
>     $$
>     所以，入射角为 $30^{\circ}$。

#### 4.4.1.3 光线偏折方向的规律
斯涅尔定律 $n_i \sin \theta_i = n_t \sin \theta_t$ 蕴含了一个非常直观的规律：
* **进入光密介质** ($n_t > n_i$)：
    此时，为了维持等式成立，必然有 $\sin \theta_t < \sin \theta_i$。由于在 $0^{\circ}$ 到 $90^{\circ}$ 范围内，正弦函数是单调递增的，所以 $\theta_t < \theta_i$。
    **结论：当光从光疏介质射入光密介质时，光线会向法线方向偏折。** (如图4.23a)

* **进入光疏介质** ($n_i > n_t$)：
    此时，必然有 $\sin \theta_t > \sin \theta_i$，因此 $\theta_t > \theta_i$。
    **结论：当光从光密介质射入光疏介质时，光线会远离法线方向偏折。** (如图4.23b)

* **光路可逆性**：仔细观察斯涅尔定律，你会发现如果交换入射和透射的角色（即光线反向传播），公式依然成立。这意味着光线会沿着完全相同的路径返回。这被称为光路可逆原理。

#### 4.4.1.4 相对折射率
有时，为了简化表达，我们会使用 #相对折射率 ( #Relative-Index-of-Refraction ) 的概念，记为 $n_{ti}$。它定义为两种介质折射率的比值：
$$
n_{ti} \equiv \frac{n_t}{n_i}
$$
这样，斯涅尔定律可以写成：
$$
\frac{\sin \theta_i}{\sin \theta_t} = n_{ti} \tag{4.5}
$$
这个记法有一个助记技巧：$n_{ti}$ 可以理解为光从介质 "i" (into) "t"，即 $n_t / n_i$。例如，从空气(air)到玻璃(glass)的相对折射率是 $n_{ga} = n_g / n_a$。

#### 示例 4.2
> 一束窄激光束在折射率为1.33的水中，以与法线成 $40.0^{\circ}$ 的角度入射到水-玻璃界面上。如果玻璃的折射率为1.65，(a) 确定相对折射率。(b) 光束在玻璃中的透射角是多少？
>
#### 详细解答
> (a) **计算相对折射率**：
>     *   入射介质是水 (Water)，$n_i = n_W = 1.33$。
>     *   透射介质是玻璃 (Glass)，$n_t = n_G = 1.65$。
>     *   相对折射率 $n_{GW}$ (从水到玻璃) 是：
>    $$
>     n_{GW} = \frac{n_G}{n_W} = \frac{1.65}{1.33} \approx 1.24
>     $$
>
> (b) **计算透射角**：
>     *   我们使用斯涅尔定律：$n_W \sin \theta_i = n_G \sin \theta_t$。
>     *   已知 $\theta_i = 40.0^{\circ}$。
>     *   整理公式求解 $\sin \theta_t$：
>    $$
>     \sin \theta_t = \frac{n_W}{n_G} \sin \theta_i = \frac{1}{n_{GW}} \sin \theta_i
>     $$
>     *   代入数值：
>    $$
>     \sin \theta_t = \frac{\sin 40.0^{\circ}}{1.24} \approx \frac{0.6428}{1.24} \approx 0.5184
>     $$
>     *   求出角度 $\theta_t$：
>     $$
    \theta_t = \arcsin(0.5184) \approx 31.2^{\circ}
>     $$
>    由于光从水 ($n=1.33$) 进入玻璃 ($n=1.65$)，是从光疏介质进入光密介质，所以折射角 $31.2^{\circ}$ 小于入射角 $40.0^{\circ}$，光线向法线偏折，这与我们的结论一致。

#### 4.4.1.5 折射现象的几个重要推论
1.  **光束变宽**：当光束倾斜入射时，由于偏折，透射光束在介质中的横截面积会比入射光束更宽。这意味着能量被分散到更大的区域，单位面积的能量强度（光强）会降低。

2.  **波长变化**：这是个非常重要的概念！当光从一种介质进入另一种介质时，它的**频率 $\nu$ 是保持不变的**。频率由光源决定，介质中的原子只是被动地以相同的频率振动和再辐射。然而，光速 $v$ 改变了。根据基本波动关系式 $v = \nu \lambda$，如果 $v$ 变化而 $\nu$ 不变，那么波长 $\lambda$ 必须改变！
    *   在真空中，$\lambda_0 = c/\nu$。
    *   在介质中，$\lambda = v/\nu$。
    *   结合 $n=c/v$，我们得到 $v=c/n$，代入 $\lambda$ 的表达式：
$$
        \lambda = \frac{c/n}{\nu} = \frac{1}{n} \left(\frac{c}{\nu}\right) = \frac{\lambda_0}{n}
        $$
$$
    \boxed{\lambda = \frac{\lambda_0}{n}} \tag{4.8}
    $$
    其中 $\lambda_0$ 是 #真空波长 ( #Vacuum-Wavelength )。这意味着，在光密介质中 ($n>1$)，光的波长会变短。因此，当我们谈论光的颜色时，用频率或能量（$\mathscr{E}=h\nu$）来描述比用波长更根本，因为波长是随介质变化的。

#### 4.4.1.6 点光源的折射：我们看到的世界为何是“扭曲”的？
现在考虑一个更实际的情景：观察水下的物体。
![430](4-Optics/images/img-36.jpeg.png)
> **图 4.27b 的解析**：一个点光源S（比如水里的一条鱼）发出的光线在水-空气界面发生折射。观察者的眼睛接收到一小束发散的光线，大脑会认为这些光线是沿直线传播的，因此会感觉光源位于这些光线反向延长线的交点P处。

* **近轴近似下的成像**：当我们从水面上方垂直向下看时，来自水下物体 $S$ 的光线束接近于垂直入射（即入射角 $\theta_i$ 很小）。在这种情况下，我们可以使用小角度近似：$\tan\theta \approx \sin\theta \approx \theta$。
    *   从几何关系看，物距 $s_o$ 和像距 $s_i$ 满足：$s_o \tan\theta_i = s_i \tan\theta_t$。
    *   使用小角度近似：$s_o \sin\theta_i \approx s_i \sin\theta_t$。
    *   根据斯涅尔定律：$n_i \sin\theta_i = n_t \sin\theta_t$，所以 $\sin\theta_t = (n_i/n_t)\sin\theta_i$。
    *   代入上式：$s_o \sin\theta_i \approx s_i (n_i/n_t)\sin\theta_i$。
    *   消去 $\sin\theta_i$，得到：    
$$
        \frac{s_i}{s_o} = \frac{n_t}{n_i}
        $$
    * **例子**：一条鱼在水下4米深处 ($s_o=4$ m, $n_i=1.33$)，我们在空气中 ($n_t=1.00$) 观看。我们看到的鱼的深度（像距）是 $s_i = s_o \times (n_t/n_i) = 4 \times (1.00/1.33) \approx 3$ 米。鱼看起来比实际位置要浅！S和P被称为 #共轭点 ( #Conjugate-Points )，$s_o$ 是 #物距 ( #Object-Distance )，$s_i$ 是 #像距 ( #Image-Distance )。

* **大角度下的焦散线**：如果我们从一个较大的角度观察，不同角度出射的光线反向延长后不会交于同一点。这些延长线会形成一条包络线，称为 #焦散线 ( #Caustic )。我们看到的像就在这条焦散线上的某一点，这就是为什么把筷子插入水中，水下部分看起来会“折断”并且“上浮”的原因。

#### 4.4.1.7 负折射：一个颠覆常识的新概念
近年来，随着超材料（metamaterials）技术的发展，一个令人着迷的概念出现了—— #负折射 ( #Negative-Refraction )。
想象一种材料，其折射率 $n_t$ 是负数。根据斯涅尔定律 $n_i \sin \theta_i = n_t \sin \theta_t$：
* 如果 $n_i > 0$, $\theta_i > 0$，那么 $n_i \sin \theta_i$ 是正数。
* 为了等式成立，$n_t \sin \theta_t$ 也必须是正数。但由于 $n_t$ 是负数，$\sin \theta_t$ 必须是负数，这意味着折射角 $\theta_t$ 是一个负角！

**物理意义**：这意味着折射光线会弯折到法线的“错误”一侧。普通材料的折射光线和入射光线在法线的两侧，而负折射材料的折射光线和入射光线在法线的同一侧。

在这种奇特的材料中，能量的传播方向（由 #坡印廷矢量 ( #Poynting-Vector ) 描述，即光线方向）与波前传播的方向（由 #波矢 ( #Wave-Vector ) 描述，垂直于波前）是相反的。这是一个非常深刻且反直觉的物理现象，在完美透镜等前沿领域有潜在应用。

### 4.4.2 惠更斯原理 (Huygens's Principle)
我们之前用波前的概念成功推导了斯涅尔定律。那么，我们如何预测一个任意形状的波前在传播后会变成什么样子呢？1690年，荷兰物理学家克里斯蒂安·惠更斯提出了一个天才的几何作图法，即 **#惠更斯原理** ( #Huygens-s-Principle )：

> **传播中的波前上的每一点，都可以看作是产生球面 #次级子波 ( #Secondary-Wavelets ) 的新波源。在稍后的某一时刻，所有这些次级子波的公共 #包络面 ( #Envelope ) 就构成了新的波前。**
![500](4-Optics/images/img-44.jpeg.png)
> **图 4.32 的解析**：根据惠更斯原理，一个平面波前（左侧）上的每一点（A, B, C...）都发出球形子波。经过时间 $t$ 后，这些子波的半径为 $vt$。这些子波的公共包络面（切线）就形成了新的平面波前（右侧）。

* **核心思想**：这个原理将复杂的波的传播问题，简化成了一个几何问题。你可以想象在平静的湖面上投入一排小石子，每个石子都会激起一圈涟漪（次级子波），而这些涟漪向前传播的共同前沿就形成了新的总波前。
* **速度**：惠更斯天才地假设，这些次级子波在介质中的传播速度就是光在该介质中的速度 $v$。
* **局限与发展**：惠更斯原理是一个非常直观且强大的工具，但它有一个小缺陷：它无法解释为什么没有“背向波”（即为什么波只向前传播）。后来，菲涅尔和基尔霍夫在数学上对其进行了完善，引入了干涉和衍射的概念，证明了惠更斯原理是波动方程的自然结果，并解决了背向波的问题。

我们可以用惠更斯原理同样推导出反射定律和折射定律，其几何构造过程与我们4.4.1.1节的分析本质上是相同的。

### 4.4.3 光线与法线同余 (Light Rays and Normal Congruence)
最后，我们来统一一下波和光线的概念。

* **光线与波前的关系**：在均匀的各向同性介质中（即性质不随方向改变的介质，如空气、水、普通玻璃），光线是波前的 #正交轨迹 ( #Orthogonal-Trajectories )。也就是说，光线在每一点都与该点的波前垂直。光线方向与波的传播矢量 $\vec{k}$ 方向一致。

* **法线同余**：如果一束光线可以找到一个曲面，这个曲面处处与这束光线中的每一条光线都垂直，那么这束光线就构成一个 #法线同余 ( #Normal-Congruence )。例如，点光源发出的发散光线束，其波前是球面，光线沿半径方向，它们就构成了法线同余。

* **马吕斯-杜平定理**：一个非常深刻的定理，称为 #马吕斯-杜平定理 ( #Theorem-of-Malus-and-Dupin )，它指出：**一束构成法线同余的光线，在经过任意次数的反射和折射后，仍然保持其法线同余的性质。**
    这从波动理论的角度看是显而易见的：因为光线始终垂直于波前，而波前在传播过程中始终是存在的，所以光线束自然保持了法线同余的特性。这个定理为几何光学（光线追踪）和物理光学（波动理论）之间架起了一座桥梁。

---

### 关键结论和知识点总结
1.  **折射的本质**：光在不同介质中传播速度不同，这是导致折射的根本原因。
2.  **折射率 ($n$)**：衡量介质光学性质的核心参数，定义为 $n = c/v$。$n \ge 1$，$n$ 越大，光速越慢，介质越“光密”。
3.  **斯涅尔定律 (折射定律)**：精确定量描述折射现象的公式：$n_i \sin \theta_i = n_t \sin \theta_t$。入射光线、折射光线和法线共面。
4.  **偏折规律**：
    * 光从光疏介质到光密介质 ($n_i < n_t$)，向法线偏折 ($\theta_i > \theta_t$)。
    * 光从光密介质到光疏介质 ($n_i > n_t$)，远离法线偏折 ($\theta_i < \theta_t$)。
5.  **频率与波长**：折射过程中，光的频率 $\nu$ 不变，波长 $\lambda$ 改变，满足 $\lambda = \lambda_0 / n$。
6.  **视觉深度**：由于折射，从一种介质观察另一种介质中的物体时，其视深度（像距 $s_i$）与物深度（物距 $s_o$）不同，满足 $s_i/s_o = n_t/n_i$（近轴近似）。
7.  **惠更斯原理**：一个强大的几何工具，用于预测波前的传播。波前上每一点都是次级子波的波源，新波前是这些子波的包络面。
8.  **光线与波前**：在各向同性介质中，光线是波前的正交轨迹（处处垂直）。

---

### 专业术语/关键词中英文对照表
*    #界面 ( #Interface )
*    #折射 ( #Refraction )
*    #折射率 ( #Index-of-Refraction )
*    #光密介质 ( #Optically-Denser-Medium )
*    #光疏介质 ( #Optically-Rarer-Medium )
*    #波前 ( #Wavefront )
*    #折射定律 ( #Law-of-Refraction )
*    #斯涅尔定律 ( #Snell-s-Law )
*    #入射面 ( #Plane-of-Incidence )
*    #色散 ( #Dispersion )
*    #相对折射率 ( #Relative-Index-of-Refraction )
*    #真空波长 ( #Vacuum-Wavelength )
*    #共轭点 ( #Conjugate-Points )
*    #物距 ( #Object-Distance )
*    #像距 ( #Image-Distance )
*    #焦散线 ( #Caustic )
*    #负折射 ( #Negative-Refraction )
*    #坡印廷矢量 ( #Poynting-Vector )
*    #波矢 ( #Wave-Vector )
*    #惠更斯原理 ( #Huygens-s-Principle )
*    #次级子波 ( #Secondary-Wavelets )
*    #包络面 ( #Envelope )
*    #正交轨迹 ( #Orthogonal-Trajectories )
*    #法线同余 ( #Normal-Congruence )
*    #马吕斯-杜平定理 ( #Theorem-of-Malus-and-Dupin )



## 4.5 Fermat's Principle

The laws of reflection and refraction, and indeed the manner in which light propagates in general, can be viewed from an entirely different and intriguing perspective afforded us by Fermat's Principle. The ideas that will unfold presently have had a tremendous influence on the development of physical thought in and beyond the study of Classical Optics.

Hero of Alexandria, who lived sometime between 150 в.C.E. and 250 C.E., was the first to propose what has since become known as a variational principle. In his treatment of reflection, he asserted that the path taken by light in going from some point $S$ to a point $P$ via a reflecting surface was the shortest possible one. This can be seen rather easily in Fig. 4.35, which depicts a point source $S$ emitting a number of rays that are then "reflected" toward $P$. Presumably, only one of these paths will have any physical reality. If we draw the rays as if they emanated from $S^{\prime}$ (the image of $S$ ), none of the distances to $P$ will have been altered (i.e., $S A P=S^{\prime} A P, S B P=S^{\prime} B P$, etc.). But obviously the straightline path $S^{\prime} B P$, which corresponds to $\theta_{t}=\theta_{r}$, is the shortest possible one. The same kind of reasoning (Problem 4.35) makes it evident that points $S, B$, and $P$ must lie in what has previously been defined as the plane-of-incidence.

For over fifteen hundred years Hero's curious observation stood alone, until in 1657 Fermat propounded his celebrated Principle of Least Time, which encompassed both reflection and refraction. A beam of light traversing an interface does not take a straight line or minimum spatial path between a point in the incident medium and one in the transmitting medium. Fermat consequently reformulated Hero's statement to read: the actual path between two points taken by a beam of light is the one that is traversed in the least time. As we shall see, even this form of the statement is incomplete and a bit erroneous at that. For the moment then, let us embrace it but not passionately.
![580](4-Optics/images/img-47.jpeg.png)
> Figure 4.35 Minimum path from the source $S$ to the observer's eye at $P$.

![500](4-Optics/images/img-48.jpeg.png)
> Figure 4.36 Fermat's Principle applied to refraction.

As an example of the application of the principle to the case of refraction, refer to Fig. 4.36, where we minimize $t$, the transit time from $S$ to $P$, with respect to the variable $x$. In other words, changing $x$ shifts point $O$, changing the ray from $S$ to $P$. The smallest transit time will then presumably coincide with the actual path. Hence
$$
t=\frac{\overline{S O}}{v_{i}}+\frac{\overline{O P}}{v_{t}}
$$
or
$$
t=\frac{\left(h^{2}+x^{2}\right)^{1 / 2}}{v_{i}}+\frac{\left[b^{2}+(a-x)^{2}\right]^{1 / 2}}{v_{t}}
$$
To minimize $t(x)$ with respect to variations in $x$, we set $d t / d x=0$, that is,

$$
\frac{d t}{d x}=\frac{x}{v_{i}\left(h^{2}+x^{2}\right)^{1 / 2}}+\frac{-(a-x)}{v_{i}\left[b^{2}+(a-x)^{2}\right]^{1 / 2}}=0
$$

Using the diagram, we can rewrite the expression as
$$
\frac{\sin \theta_{t}}{v_{t}}=\frac{\sin \theta_{t}}{v_{t}}
$$

which is no less than Snell's Law (Eq. 4.4). If a beam of light is to advance from $S$ to $P$ in the least possible time, it must comply with the Law of Refraction.

Suppose that we have a stratified material composed of $m$ layers, each having a different index of refraction, as in Fig. 4.37. The transit time from $S$ to $P$ will then be
$$
t=\frac{x_{1}}{v_{1}}+\frac{x_{2}}{v_{2}}+\cdots+\frac{x_{m}}{v_{m}}
$$
or
$$
t=\sum_{i=1}^{m} x_{i} / v_{i}
$$

![400](4-Optics/images/img-49.jpeg.png)
> Figure 4.37 A ray propagating through a layered material.

where $s_{i}$ and $v_{i}$ are the path length and speed, respectively, associated with the $i$ th contribution. Thus

$$
t=\frac{1}{c} \sum_{i=1}^{m} n_{i} s_{i}\tag{4.9}
$$

in which the summation is known as the ***optical path length $(O P L)$*** traversed by the ray, in contrast to the spatial path length $\sum_{i=1}^{m} s_{i}$. Clearly, for an inhomogeneous medium where $n$ is a function of position, the summation must be changed to an integral:

$$
O P L=\int_{S}^{P} n(s) d s\tag{4.10}
$$

***The optical path length corresponds to the distance in vacuum equivalent to the distance traversed ( $s$ ) in the medium of index $\boldsymbol{n}$***. That is, the two will correspond to the same number of wavelengths, $(O P L) / \lambda_{0}=s / \lambda$, and the same phase change as the light advances.

Inasmuch as $t=(O P L) / c$, we can restate Fermat's Principle: light, in going from point $S$ to $P$, traverses the route having the smallest optical path length.

#### Fermat and Mirages

When light rays from the Sun pass through the inhomogeneous atmosphere of the Earth, as shown in Fig. 4.38, they bend so as to traverse the lower, denser regions as abruptly as possible, minimizing the $O P L$. Ergo, one can still see the Sun after it has actually passed below the horizon.

![550](4-Optics/images/img-50.jpeg.png)
> Figure 4.38 The bending of rays through inhomogeneous media. Because the rays bend as they pass through the atmosphere the Sun appears higher in the sky.

In the same way, a road viewed at a glancing angle, as in Fig. 4.39, appears to reflect the environs as if it were covered with a sheet of water. The air near the roadway is warmer and less dense than that farther above it. It was established experimentally by Gladstone and Dale that for a gas of density $\rho$

$$
(n-1) \propto \rho
$$

It follows from the Ideal Gas Law that at a fixed pressure, since $\rho \propto P / T,(n-1) \propto 1 / T$; the hotter the road, the lower the index of refraction of the air immediately above it.

According to Fermat's Principle, a ray leaving a branch in Fig. 4.39a heading somewhat downward would take a route that minimized the $O P L$. Such a ray would bend upward, passing through more of the less dense air than if it had traveled straight. To appreciate how that works, imagine the air divided into an infinite number of infinitesimally thin constant- $n$ horizontal layers. A ray passing from layer to layer would bend (via Snell's Law) slightly upward at each interface (much as in Fig. 4.36 held upside down with the ray run backwards). Of course, if the ray comes down nearly vertically it makes a small angle-of-incidence at each interface between layers, only bends slightly, and soon strikes the ground where no one will "see" it.

![580](4-Optics/images/img-51.jpeg.png)
> Figure 4.39 (a) At very low angles the rays appear to be coming from beneath the road as if reflected in a puddle. (b) A photo of this puddle effect. (Matt Malloy and Dan MacIsaac, Northern Arizona University, Physics \& Astronomy)

On the other hand, it is possible that a light ray that comes in at a shallow enough angle to begin with could ultimately approach an interface at glancing incidence (p. 127). It would then be completely reflected (p. 131), thereby starting its climb back up into the more dense air (much as in Fig. 4.36 held upside down with the ray run forwards).

Any viewer, off on the left in Fig. 4.39, who receives these bent rays naturally projects them straight backward as if they were reflected from a mirrored surface. Depending on where you stand, you'll see a different mirage puddle, but it will always be far from you and so will always disappear as you approach it. The effect is particularly easy to view on long modern highways. The only requirement is that you look at the road at near glancing incidence, because the rays bend very gradually[^gradually].

[^gradually]:  *See, for example, T. Kosa and P. Palffy-Muhoray, "Mirage mirror on the wall," Am. J. Phys. 68 (12), 1120 (2000).

The same effect is well known as it applies to sound. Figure 4.40 depicts the alternative understanding in terms of waves. The wavefronts bend because of temperature-induced changes in speed and therefore in wavelength. (The speed of sound is proportional to the square root of the temperature.) The noises of people on a hot beach climb up and away, and the place can seem strangely quiet. The opposite occurs in the evening when the ground cools before the upper air and distant sounds can clearly be heard.
![500](4-Optics/images/img-52.jpeg.png)
> Figure 4.40 The puddle mirage can be understood via waves; the speed, and therefore the wavelength, increase in the less dense medium. That bends the wavefronts and the rays. The same effect is common with sound waves, (a) when the surface air is cold, sounds can be heard much farther than normal. (b) And when it's warm, sounds seem to vanish into the air.

#### The Modern Formulation of Fermat's Principle

The original statement of Fermat’s Principle of Least Time has some serious failings and is in need of alteration. To that end, recall that if we have a function, say $f(x)$, we can determine the specific value of the variable $x$ that causes $f(x)$ to have a stationary value by setting $\frac{df}{dx} = 0$ and solving for $x$. By a stationary value, we mean one for which the slope of $f(x)$ versus $x$ is zero or equivalently where the function has a maximum $\nearrow \nwarrow$, minimum $\swarrow \searrow$, or a point of inflection with a horizontal tangent $\bowtie$.

Fermat's Principle in its modern form reads: ***a light ray in going from point $S$ to point $P$ must traverse an optical path length that is stationary with respect to variations of that path***. In essence what that means is that the curve of the $O P L$ versus $x$ will have a somewhat flattened region in the vicinity of where the slope goes to zero. The zero-slope point corresponds to the actual path taken. In other words, the $O P L$ for the true trajectory will equal, to a first approximation, the $O P L$ of paths immediately adjacent to it. $\dagger$ For example, in a situation where the $O P L$ is a minimum, as with the refraction illustrated in Fig. 4.36, the $O P L$ curve will look something like Fig. 4.41. A small change in $x$ in the vicinity of $O$ has little effect on the $O P L$, but a similar change in $x$ anywhere well away from $O$ results in a substantial change in $O P L$. Thus there will be many paths neighboring the actual one that would take nearly the same time for the light to traverse. This latter insight makes it possible to begin to understand how light manages to be so clever in its meanderings.

Suppose that a beam of light advances through a homogeneous isotropic medium (Fig. 4.42) so that a ray passes from points $S$ to $P$. Atoms within the material are driven by the incident disturbance, and they reradiate in all directions. Wavelets progressing along paths in the immediate vicinity of a stationary straight-line path will reach $P$ by routes that differ only slightly in $O P L$ (as with group-I in Fig. 4.42b). They will therefore arrive nearly in-phase and reinforce each other. Think of each wavelet represented by a tiny phasor that rotates once around as the wave advances one wavelength (p. 31) along any ray path. Because the OPLs are all about the same, the phasors at $P$ all point in more or less the same direction, and even though they're all small they combine to make the dominant contribution.
![280](4-Optics/images/img-53.jpeg.png)
> Figure 4.41 In the situation shown in Fig. 4.36 the actual location of point $O$ corresponds to a path of minimum $O P L$.

$\dagger$ The first derivative of the $O P L$ vanishes in its Taylor series expansion, since the path is stationary.

Wavelets taking other paths far from the stationary one (as with group-II in Fig. 4.42b) will arrive at $P$ appreciably out-ofphase with each other and will therefore tend to cancel. In other words, there will be large angles between the little phasors; placed tip-to-tail they'll spiral around, producing only a tiny net contribution. Keep in mind that we've just drawn three ray paths-the argument would be better made with millions of them in each group.

We can conclude that energy will effectively propagate along the ray from $S$ to $P$ that satisfies Fermat's Principle. And this is true whether we're talking about interfering electromagnetic waves or photon probability amplitudes (p. 148).

We can expect that this same logic holds for all propagation processes[^processes],* such as, for example, reflection from a plane mirror (Fig. 4.35). There, spherical waves leaving $S$ sweep across the entire mirror, and yet an observer at $P$ sees a well-defined point source and not a great blotch of light covering the whole surface. Only rays for which $\theta_{i} \approx \theta_{e}$ (as with group-I in Fig. 4.43) have a stationary $O P L$; the associated wavelets will arrive at $P$ nearly in-phase and reinforce each other. All other rays (e.g., group-II in Fig. 4.43) will make negligible contributions to the energy reaching $P$.
![400](4-Optics/images/img-54.jpeg.png)
> Figure 4.42 (a) Light can presumably take any number of paths from $S$ to $P$, but it apparently takes only the one that corresponds to a stationary OPL. All other routes effectively cancel out. (b) For example, if some light takes each of the three upper paths in the diagram, it arrives at $P$ with three very different phases and interferes more or less destructively.

![400](4-Optics/images/img-55.jpeg.png)
> Figure 4.43 Rays reflecting off a plane mirror. Only those in group-I for which the OPL is stationary will correspond to waves that arrive at point $P$ more or less in-phase. There phasors will add along an almost straight line, producing a substantial resultant wave amplitude (going from the tail of 1 to the tip of 3). The phasors for group-II have large phase-angle differences and so when added they essentially spiral around, producing a very small resultant wave amplitude (going from the tail of 1 to the tip of 3). Of course, we should really be drawing millions of very tiny phasors in each group and not just three relatively large ones.

[^processes]:  *We'll come back to these ideas when we consider QED in this chapter and the Fresnel zone plate in Chapter 10.


#### Stationary Paths

To see that the $O P L$ for a ray need not always be a minimum, examine Fig. 4.44, which depicts a segment of a hollow threedimensional ellipsoidal mirror. If the source $S$ and the observer $P$ are at the foci of the ellipsoid, then by definition the length $S Q P$ will be constant, regardless of where on the perimeter $Q$ happens to be. It is also a geometrical property of the ellipse that $\theta_{i} \approx \theta_{e}$ for any location of $Q$. All optical paths from $S$ to $P$ via a reflection are therefore precisely equal. None is a minimum, and the $O P L$ is clearly stationary with respect to variations. Rays leaving $S$ and striking the mirror will arrive at the focus $P$. From another viewpoint we can say that radiant energy emitted by $S$ will be scattered by electrons in the mirrored surface such that the wavelets will substantially reinforce each other only at $P$, where they have traveled the same distance and have the same phase. In any case, if a plane mirror was tangent to the ellipse at $Q$, the exact same path $S Q P$ traversed by a ray would then be a relative minimum. That was shown in relation to Fig. 4.35.

At the other extreme, if the mirrored surface conformed to a curve lying within the ellipse, like the dashed one shown in Fig. 4.44c, that same ray along $S Q P$ would now negotiate a relative maximum $O P L$. To see that, examine Fig. 4.44c

![380](4-Optics/images/img-56.jpeg.png)
> Figure 4.44 Reflection off an ellipsoidal surface. Observe the reflection of waves using a frying pan filled with water. Even though these are usually circular, it is well worth playing with. (PSSC College Physics, D. C. Heath \& Co., 1968.)

wherein for every point $B$ there is a corresponding point $C$. We know that
$$
\overline{S Q}+\overline{P Q}=\overline{S B}+\overline{P B}
$$

since both $Q$ and $B$ are on the ellipse. But $\overline{S B}>\overline{S C}$ and $\overline{P B}>\overline{P C}$ and so
$$
\overline{S Q}+\overline{P Q}>\overline{S C}+\overline{P C}
$$

and that's true wherever $C$ is, other than at $Q$. Hence $\overline{S Q}+\overline{P Q}$ is a maximum for the curve within the ellipse. This is the case even though other unused paths (where $\theta_{l} \neq \theta_{r}$ ) would actually be shorter (i.e., apart from inadmissible curved paths). Thus in all cases the rays travel a stationary $O P L$ in accord with the reformulated Fermat's Principle. Note that since the principle speaks only about the path and not the direction along it, a ray going from $P$ to $S$ will trace the same route as one from $S$ to $P$. This is the very useful Principle of Reversibility.

Fermat's achievement stimulated a great deal of effort to supersede Newton's laws of mechanics with a similar variational formulation. The work of many men, notably Pierre de Maupertuis (1698-1759) and Leonhard Euler, finally led to the mechanics of Joseph Louis Lagrange (1736-1813) and hence to the Principle of Least Action, formulated by William Rowan Hamilton (1805-1865). The striking similarity between the principles of Fermat and Hamilton played an important part in Schrödinger's development of Quantum Mechanics. In 1942 Richard Phillips Feynman (1918-1988) showed that Quantum Mechanics can be fashioned in an alternative way using a variational approach. The continuing evolution of variational principles brings us back to Optics via the modern formalism of Quantum Optics.

Fermat's Principle is not so much a computational device as it is a concise way of thinking about the propagation of light. It is a statement about the grand scheme of things without any concern for the contributing mechanisms, and as such it will yield insights under a myriad of circumstances.




## 4.5 费马原理 (Fermat's Principle)
[!费马原理 (Fermat's Principle)]-

我们知道，光在传播过程中会遵循特定的规律，例如我们已经学过的反射定律和折射定律。费马原理为我们提供了一个全新的、引人入胜的视角来审视这些规律，乃至光的一切传播行为。它不直接回答光“如何”传播（比如一步步追踪光线），而是试图回答光“为何”选择这样一条路径。这种思想，我们称之为 #变分原理  ( #Variational-Principle )，它在物理学思想的发展中扮演了至关重要的角色。

### 4.5.1 历史溯源：从最短路径到最短时间
在正式介绍费马原理之前，我们有必要追溯其思想的源头。

#### 4.5.1.1 亚历山大里亚的希罗与“最短路径”
早在公元前150年到公元250年之间，古希腊的数学家和工程师——亚历山大里亚的希罗 (Hero of Alexandria)，在研究光的反射现象时，提出了一个天才般的论断：**光从S点出发，经由一个反射面到达P点，它所走的是所有可能路径中最短的那一条。**

让我们借助图 4.35 来理解这个论断。
![580](4-Optics/images/img-47.jpeg.png)
> **图 4.35** 从光源 S 到观察者眼睛 P 的最短路径。

想象一下，一个点光源 $S$ 向四面八方发射光线，这些光线照射到一面镜子上，然后“反射”向一个观察点 $P$。在无数条可能的路径中（例如图中的 $SAP$, $SBP$, $SCP$ 等），究竟哪一条才是真实世界中光所走的路径呢？

希罗巧妙地利用了镜像的几何关系来解决这个问题。让我们画出点光源 $S$ 关于镜面的 #像点  ( #Image-Point ) $S'$。根据平面镜成像的性质，任何从 $S$ 点出发经镜面反射到达 $P$ 的路径长度，都等于从像点 $S'$ 出发直接到达 $P$ 的路径长度。例如：
*   路径 $SAP$ 的长度等于 $S'AP$ 的长度。
*   路径 $SBP$ 的长度等于 $S'BP$ 的长度。

现在问题就变得非常简单了：在所有连接 $S'$ 和 $P$ 的折线路径中（$S'AP$, $S'BP$, $S'CP$ ...），哪一条最短？答案显而易见：**连接 $S'$ 和 $P$ 的直线路径 $S'BP$ 是最短的。**

当路径是 $S'BP$ 这条直线时，我们可以从几何关系中轻易看出，入射角 $\theta_i$ 等于反射角 $\theta_r$。这恰好就是我们熟知的 #反射定律  ( #Law-of-Reflection )！

因此，希罗的“最短路径原理”成功地解释了光的反射现象。这个原理还有一个重要的推论：光源 $S$、反射点 $B$ 和观察点 $P$ 这三点，必定位于同一个平面内，这个平面就是我们之前定义过的 #入射面  ( #Plane-of-Incidence )。因为只有三点共面，才能保证路径最短。

#### 4.5.1.2 费马的修正：“最短时间原理”
希罗的发现虽然巧妙，但在长达一千五百年的时间里都只是一个孤立的结论。直到1657年，法国数学家皮埃尔·德·费马 (Pierre de Fermat) 将其推广，提出了一个更具普适性的原理，这个原理同时涵盖了反射和折射现象，这就是著名的 **费马最短时间原理 (Fermat's Principle of Least Time)**。

费马注意到，当光线从一种介质进入另一种介质（例如从空气进入水中）时，它的路径不再是一条直线，发生了弯折。显然，这条折线路径并不是空间上最短的。因此，希罗的“最短路径”描述并不完整。

费马敏锐地意识到，光在不同介质中的传播速度是不同的！他因此重新阐述了希罗的论断，提出了：**光从一点到另一点所遵循的真实路径，是所有可能路径中耗时最短的那一条。**

这个“最短时间”的思想是费马原理的第一次飞跃。对于反射而言，由于光在同一均匀介质中传播，速度恒定，因此“最短时间”等价于“最短路径”。而对于折射，情况就变得有趣起来了。

* **一个生动的比喻**：
想象一下，你是一名海滩上的救生员（在点 $S$），看到海里有人溺水（在点 $P$）。你需要在最短的时间内到达 $P$ 点。你在沙滩上跑的速度（对应光在空气中的速度 $v_i$）比在水里游泳的速度（对应光在水中的速度 $v_t$）要快得多。你会怎么选择路线？
1.  直接沿直线 $SP$ 跑过去？这样你在水里游的距离会很长，总时间不一定最短。
2.  先在沙滩上跑到离 $P$ 点最近的岸边，再下水？这样你在沙滩上跑的距离最长，但可能不是最优选择。

你凭直觉就会知道，最优策略应该是在沙滩上多跑一段距离，以减少在水里游泳的距离，从而使得总时间最短。这正是光在折射时所做的“聪明”选择！

### 4.5.2 从最短时间原理推导折射定律
现在，让我们用数学工具来验证一下费马最短时间原理的威力。我们将证明，从这个原理出发，可以完美地推导出 #斯涅尔定律  ( #Snells-Law ) (Snell's Law)。

请看图 4.36，光线从介质1中的点 $S(0, h)$ 出发，经过介质1和介质2的交界面上的点 $O(x, 0)$，最终到达介质2中的点 $P(a, -b)$。
![500](4-Optics/images/img-48.jpeg.png)
> **图 4.36** 费马原理应用于折射现象。

设光在介质1中的速度为 $v_i$，在介质2中的速度为 $v_t$。光线从 $S$ 到 $P$ 所需的总时间 $t$ 是两段路程所需时间的总和：
$$
t = t_{SO} + t_{OP} = \frac{\overline{S O}}{v_{i}}+\frac{\overline{O P}}{v_{t}}
$$

利用勾股定理，我们可以将两段路程的长度用变量 $x$ 表示出来：
*   $\overline{S O} = \sqrt{h^2 + x^2} = (h^2 + x^2)^{1/2}$
*   $\overline{O P} = \sqrt{b^2 + (a-x)^2} = [b^2 + (a-x)^2]^{1/2}$

将它们代入时间表达式，我们得到总时间 $t$ 作为变量 $x$ 的函数 $t(x)$：
$$
t(x) = \frac{\left(h^{2}+x^{2}\right)^{1 / 2}}{v_{i}}+\frac{\left[b^{2}+(a-x)^{2}\right]^{1 / 2}}{v_{t}}
$$

根据费马原理，真实的路径应该使总时间 $t$ 最短。在微积分中，为了找到一个函数的最小值，我们通常需要找到该函数导数为零的点。因此，我们对 $t(x)$ 求关于 $x$ 的导数，并令其等于零：
$$
\frac{d t}{d x}=0
$$

现在我们来执行求导计算。这里需要用到链式法则：
$$
\frac{d t}{d x} = \frac{d}{dx} \left( \frac{(h^2+x^2)^{1/2}}{v_i} \right) + \frac{d}{dx} \left( \frac{[b^2+(a-x)^2]^{1/2}}{v_t} \right)
$$
对第一项求导：
$$
\frac{1}{v_i} \cdot \frac{1}{2}(h^2+x^2)^{-1/2} \cdot (2x) = \frac{x}{v_i(h^2+x^2)^{1/2}}
$$
对第二项求导：
$$
\frac{1}{v_t} \cdot \frac{1}{2}[b^2+(a-x)^2]^{-1/2} \cdot [2(a-x) \cdot (-1)] = \frac{-(a-x)}{v_t[b^2+(a-x)^2]^{1/2}}
$$
将两项相加并令其为零：
$$
\frac{d t}{d x}=\frac{x}{v_{i}\left(h^{2}+x^{2}\right)^{1 / 2}} - \frac{a-x}{v_{t}\left[b^{2}+(a-x)^{2}\right]^{1 / 2}}=0
$$
整理后得到：
$$
\frac{x}{v_{i}\left(h^{2}+x^{2}\right)^{1 / 2}} = \frac{a-x}{v_{t}\left[b^{2}+(a-x)^{2}\right]^{1 / 2}}
$$

现在，我们再回头看看图 4.36 中的几何关系。我们可以发现：
*   $\sin\theta_i = \frac{x}{\overline{SO}} = \frac{x}{(h^2+x^2)^{1/2}}$
*   $\sin\theta_t = \frac{a-x}{\overline{OP}} = \frac{a-x}{[b^2+(a-x)^2]^{1/2}}$

将这两个三角函数关系代入我们刚刚推导出的等式，就得到了：
$$
\frac{\sin \theta_{i}}{v_{i}}=\frac{\sin \theta_{t}}{v_{t}}
$$

这正是斯涅尔定律的表达式！我们知道，介质的 #折射率  ( #Refractive-Index ) $n$ 定义为真空中的光速 $c$ 与介质中的光速 $v$之比，即 $n = c/v$ 或 $v = c/n$。代入上式：
$$
\frac{\sin \theta_{i}}{c/n_i} = \frac{\sin \theta_{t}}{c/n_t} \implies n_i \sin\theta_i = n_t \sin\theta_t
$$
这便是我们更为熟悉的斯涅尔定律的形式。这个推导雄辩地证明了，光在折射时确实遵循着“最短时间”这一深刻的物理原则。

### 4.5.3 光程：一个更普适的度量
为了让费马原理的表述更加简洁和普适，我们需要引入一个非常重要的概念—— #光程  ( #Optical-Path-Length )，缩写为 OPL。

想象一下光线穿过一系列不同介质的薄层（如图 4.37）。
![400](4-Optics/images/img-49.jpeg.png)
> **图 4.37** 一束光线穿过分层介质。

光线从 $S$ 到 $P$ 的总时间为：
$$
t=\frac{s_{1}}{v_{1}}+\frac{s_{2}}{v_{2}}+\cdots+\frac{s_{m}}{v_{m}} = \sum_{i=1}^{m} \frac{s_{i}}{v_{i}}
$$
其中 $s_i$ 是在第 $i$ 层介质中走过的几何路径长度，$v_i$ 是在其中的光速。
将 $v_i = c/n_i$ 代入，我们得到：
$$
t = \sum_{i=1}^{m} \frac{s_{i}}{c/n_i} = \frac{1}{c} \sum_{i=1}^{m} n_{i} s_{i} \tag{4.9}
$$
我们把上式中的求和部分 $\sum n_i s_i$ 定义为总的光程 (OPL)。

**光程的物理本质是什么？**
***光程 (OPL) 是光在折射率为 $n$ 的介质中走过距离 $s$ 时，等效于在真空中走过的距离。***
也就是说，光走完这段光程所需的时间，恰好等于它在真空中走完 OPL 这么长距离所需的时间。因为 $t = \frac{OPL}{c}$。

光程还有一个更深刻的物理意义，它与光的 #相位  ( #Phase ) 变化直接相关。光是一种波，它在传播时相会不断变化。在真空中，波长为 $\lambda_0$，走过距离 $L$ 后，相位变化量与 $L/\lambda_0$ (波的个数) 成正比。在折射率为 $n$ 的介质中，波长会缩短为 $\lambda = \lambda_0/n$，走过几何距离 $s$ 后，经历的波的个数为 $s/\lambda = s/(\lambda_0/n) = ns/\lambda_0$。这个 $ns$ 正是光程！
因此，**光程正比于光波在传播路径上所经历的总相位变化**。两条路径如果光程相等，意味着光走过这两条路径后相位变化相同。

对于一个折射率连续变化的非均匀介质，求和就变成了积分：
$$
OPL=\int_{S}^{P} n(s) d s\tag{4.10}
$$
这里的 $s$ 是沿着路径的弧长微元。

有了光程的概念，我们可以将费马原理重新表述为：
**光从 $S$ 点到 $P$ 点，会选择光程 (OPL) 最短的那条路径。**
由于 $t = OPL/c$，这个表述与“最短时间原理”是完全等价的，但形式上更优雅，计算上也更方便。

### 4.5.4 费马原理的应用：海市蜃楼的奥秘
费马原理能够解释许多奇妙的自然现象，其中最著名的就是海市蜃楼 (Mirage)。

#### 4.5.4.1 天边的太阳与路面的“水洼”
* **日落幻象**：当太阳光穿过地球大气层时（图 4.38），由于大气密度从外太空到地面是逐渐增加的，所以折射率 $n$ 也是逐渐增大的。根据费马原理，光线为了走一条光程最短的路径，会选择一条弯曲的轨迹，它会尽可能快地穿过折射率较高的低层稠密大气。这种弯曲使得我们看到的太阳视位置比它的实际位置要高。因此，当太阳的实际位置已经落到地平线以下时，我们依然能够看到它。
![550](4-Optics/images/img-50.jpeg.png)
> **图 4.38** 光线穿过非均匀介质时的弯曲。由于光线穿过大气层时发生弯曲，太阳看起来比实际位置要高。

* **路面“水洼”**：在炎热的夏天，柏油马路被太阳晒得滚烫，路面上方的空气温度比更高处的空气要高。对于气体，有一个近似的实验关系（Gladstone-Dale 关系）：$(n-1) \propto \rho$，其中 $\rho$ 是气体密度。根据理想气体定律，在压强基本不变的情况下，密度 $\rho$ 与绝对温度 $T$ 成反比，即 $\rho \propto 1/T$。因此，我们得到 $(n-1) \propto 1/T$。这意味着：**温度越高的空气，密度越小，折射率也越低**。
![550](4-Optics/images/img-50.jpeg.png)
> **图 4.39** (a) 在非常低的角度下，光线看起来像是从路面下方反射而来，如同路面有一滩水。(b) 这种“水洼”效应的照片。

现在，让我们用费马原理来分析图 4.39a 中的情况。一棵树上的一点发出的光，如果以一个比较倾斜的角度朝地面射来，它会怎么走？为了使总光程（或总时间）最短，光线会倾向于在折射率更低（速度更快）的近地面热空气中多走一段路程。这导致光线的路径向上弯曲。

我们可以把空气想象成无数个折射率不同的水平薄层，越靠近地面 $n$ 越小。光线从上往下穿过一层层分界面时，根据斯涅尔定律，它会不断地向远离法线的方向偏折（因为是从高 $n$ 区域到低 $n$ 区域），弯曲的程度越来越大。当光线以足够大的 #掠射角  ( #Glancing-Angle ) 入射到某一层空气时，甚至可能发生 #全反射  ( #Total-Internal-Reflection )，然后开始向上弯曲返回到折射率较高的冷空气中。

对于远处的观察者来说，我们的大脑习惯于认为光是沿直线传播的。当这些向上弯曲的光线进入我们的眼睛时，我们会自然地将它们反向延长，感觉它们像是从路面下方的一个虚像点发射出来的，就好像路面上有一滩水反射了树的倒影一样。这就是我们在高速公路上经常看到的“湿路幻景”。当你走近时，观察角度变大，这种效应就消失了。

#### 4.5.4.2 声波的类似现象
这种现象不仅限于光。声波的传播也遵循类似的规律。声音在空气中的传播速度与温度的平方根成正比（$v \propto \sqrt{T}$）。
* **夜晚声音传得远** (图 4.40a)：傍晚，地面冷却得比高空空气快，导致近地面的空气温度低、声速慢。从远处传来的声音会被向下弯曲，沿着地面传播，所以我们能听到很远地方的声音。
* **白天声音“消失”** (图 4.40b)：白天，地面温度高，近地面声速快。声音会向上弯曲，远离地面，所以声音好像“消失”在空气中了。
![500](4-Optics/images/img-52.jpeg.png)
> **图 4.40** “水洼”海市蜃楼可以用波来理解；在密度较小的介质中，速度和波长都会增加，这使得波前和光线发生弯曲。同样的效果在声波中也很常见，(a) 当近地面空气寒冷时，声音可以比正常情况传播得更远。(b) 当近地面空气温暖时，声音似乎会消失在空气中。

### 4.5.5 费马原理的现代形式：平稳光程
我们之前一直说的“最短时间”或“最短光程”，其实是不完整的，甚至在某些情况下是错误的。现在，我们需要将费马原理升级到它的最终、最精确的现代形式。

回忆一下微积分知识：当我们说一个函数 $f(x)$ 的导数 $\frac{df}{dx} = 0$ 时，这只意味着函数在该点取得了一个 #驻值  ( #Stationary-Value )。这个驻值可能是一个**最小值** (minimum)，也可能是一个**最大值** (maximum)，或者是一个**拐点** (inflection point)。

费马原理的现代形式正是：
***光从 S 点到 P 点所遵循的真实路径，其光程(OPL)相对于路径的微小变化是平稳的（取驻值）。***

这意味着，真实路径的光程与它邻近的无限多条虚拟路径的光程相比，或者是一个极小值，或者是一个极大值，或者是一个恒定值。从数学上讲，真实路径的 OPL 对路径变化的“一阶导数”为零。

* **光程为最小值**：这是最常见的情况，比如我们前面讨论的平面镜反射和两种介质间的折射（图 4.36）。真实路径的光程确实是所有可能路径中最小的。如图 4.41 所示，OPL 关于路径变量 $x$ 的函数图像呈现一个山谷的形状，谷底对应着真实路径。
![280](4-Optics/images/img-53.jpeg.png)
> **图 4.41** 在图 4.36 所示的折射情况中，点 O 的实际位置对应于一条光程最短的路径。

* **光程为最大值或恒定值**：让我们看一个更精巧的例子——椭球反射面（图 4.44）。
![330](4-Optics/images/img-56.jpeg.png)
> **图 4.44** 在椭球面的反射。

一个椭球有两个 #焦点  ( #Foci )。根据椭球的几何定义，从一个焦点 $S$ 出发，经椭球面上任意一点 $Q$ 反射后到达另一个焦点 $P$ 的总路程长度 $\overline{SQ} + \overline{QP}$ 是一个**常数**。由于光在同一介质中传播，这意味着所有这样的路径光程都**完全相等**。因此，光程既不是最大值也不是最小值，但它显然是“平稳的”。从 $S$ 发出的所有光线经椭球镜反射后都会精确地汇聚到 $P$ 点。

现在，如果我们把反射面换成一个位于该椭球内部的曲面（图 4.44c 中的虚线），那么对于同样的入射点和出射点 $S$ 和 $P$，经由点 $Q$ 的反射路径 $SQP$ 的光程将是一个**相对最大值**。因为对于虚线上的任何其他点 $C$，它对应的椭球面上的点 $B$ 满足 $\overline{SB}+\overline{PB} = \overline{SQ}+\overline{PQ}$。而几何上显然有 $\overline{SB} > \overline{SC}$ 和 $\overline{PB} > \overline{PC}$，所以 $\overline{SQ}+\overline{PQ} > \overline{SC}+\overline{PC}$。

因此，无论是最小值、最大值还是恒定值，光所选择的路径都满足“光程是平稳的”这一条件。这才是费马原理最完整、最普适的表述。

这个原理还有一个非常实用的推论，即 #光路可逆原理  ( #Principle-of-Reversibility )。因为原理只关心路径本身的光程，而没有规定方向，所以光线从 $P$ 到 $S$ 的路径与从 $S$ 到 $P$ 的路径是完全相同的。

### 4.5.6 物理本质的深刻洞见：为什么是平稳光程？
到目前为止，我们似乎把光描绘成了一个能够预知未来、会做微积分的“智能体”。它到底是如何“知道”哪条路径的光程是平稳的呢？这背后深刻的物理图像与光的波动性有关。

这个问题的答案，需要我们引入 #惠更斯原理  ( #Huygens-Principle ) 和 #相量  ( #Phasor ) 的思想。
根据惠更斯原理，波阵面上的每一点都可以看作是发射次级子波的新波源。而光的传播，正是所有这些子波叠加（干涉）的结果。

现在，想象光从 $S$ 点传播到 $P$ 点，它实际上“探索”了所有可能的路径（图 4.42a）。
![400](4-Optics/images/img-54.jpeg.png)
> **图 4.42** (a) 光可以从 S 传播到 P 的路径有无数条，但它只选择光程是平稳的那一条。所有其他路径都因干涉而有效地抵消了。(b) 例如，如果一些光走了图中的三条上方路径，它们以三个非常不同的相位到达 P 点，并发生或多或少的相消干涉。

* **对于平稳光程路径附近的路径 (图 4.43, 组-I)**：
    这些路径的几何长度非常接近，因此它们的光程也几乎相等。这意味着，沿着这些路径传播的子波到达 $P$ 点时，它们的相位几乎相同（“同心协力”）。我们可以用相量来表示这些子波。相量是一个旋转的矢量，其长度代表振幅，角度代表相位。当这些相位几乎相同的子波在 $P$ 点叠加时，它们的相量几乎指向同一个方向。将它们首尾相连，会得到一个很长的合成矢量，代表着很强的光强。这便是 #相长干涉  ( #Constructive-Interference )。

* **对于远离平稳光程路径的路径 (图 4.43, 组-II)**：
    这些路径的光程变化非常剧烈。这意味着，沿着这些路径传播的子波到达 $P$ 点时，它们的相位差异巨大，杂乱无章。当这些子波叠加时，它们的相量指向四面八方。将它们首尾相连，会形成一个蜷缩起来的、类似随机游走的图形，其最终的合成矢量非常小，几乎为零。这便是 #相消干涉  ( #Destructive-Interference )。
![400](4-Optics/images/img-55.jpeg.png)
> **图 4.43** 从平面镜反射的光线。只有那些光程是平稳的组-I中的光线，其对应的波到达 P 点时才会或多或少地同相。它们的相量会沿着一条近乎直线的方向相加，产生一个显著的合成波振幅。组-II的相量具有很大的相位差，因此相加时它们基本上会螺旋式地缠绕起来，产生一个非常小的合成波振幅。

**结论**：光之所以看起来只沿着那条光程平稳的路径传播，并不是因为它有智能，而是因为**只有这条路径及其近邻路径对最终的光场有显著贡献，而其他所有路径的贡献都因相消干涉而几乎完全抵消了！**

能量，实际上是沿着那条满足费马原理的路径有效传播的。这个思想极其深刻，它不仅适用于电磁波，也适用于量子力学中光子的 #概率幅  ( #Probability-Amplitude )。

### 4.5.7 费马原理的深远影响
费马原理的成功，极大地激发了物理学家们的热情，他们试图用类似的变分原理来重构整个牛顿力学体系。经过几代科学巨匠的努力，最终由拉格朗日 (Lagrange) 和哈密顿 (Hamilton) 建立了分析力学，其核心就是著名的 #最小作用量原理  ( #Principle-of-Least-Action )。

费马原理和哈密顿的最小作用量原理在形式上的惊人相似性，为薛定谔 (Schrödinger) 发展 #量子力学  ( #Quantum-Mechanics ) 提供了重要启示。后来，物理学家理查德·费曼 (Richard Feynman) 更是基于这一思想，发展出了量子力学的路径积分表述，认为一个粒子从A到B，会经历所有可能的路径，而每条路径贡献一个概率幅。这正是费马思想在量子世界的回响。

总而言之，费马原理与其说是一个计算工具，不如说是一种思考光传播方式的宏大而简洁的哲学。它从一个全局的、目的论的视角揭示了自然规律的内在和谐与统一，让我们得以窥见物理世界深层次的奥秘。

---

### 关键结论与知识点总结
1.  **历史演进**：费马原理的思想起源于希罗的**最短路径原理**（适用于反射），后被费马发展为**最短时间原理**（适用于反射和折射），最终完善为现代的**平稳光程原理**。

2.  **核心概念：光程 (OPL)**：光程 $OPL = n \times s$，是光在介质中传播时等效的真空距离。物理上，它正比于光波经历的**总相位变化**。这是连接几何光学和波动光学的桥梁。

3.  **费马原理的现代表述**：光从一点到另一点所走的真实路径，其**光程是平稳的**（即取驻值：最小值、最大值或恒定值）。

4.  **数学推导**：利用“最短时间”和微积分，可以从费马原理严格推导出**斯涅尔折射定律** ($n_i \sin\theta_i = n_t \sin\theta_t$) 和**反射定律** ($\theta_i = \theta_r$)。

5.  **物理本质**：费马原理的背后是光的**波动性**和**干涉现象**。光“探索”所有路径，但只有在平稳光程路径及其近邻，子波才能发生**相长干涉**，从而形成宏观上可观测到的光路；其他路径的贡献因**相消干涉**而抵消。

6.  **应用**：费马原理可以优美地解释**海市蜃楼**、**日落幻象**等大气光学现象，其核心在于非均匀介质中折射率的变化导致光线弯曲以寻求平稳光程。

7.  **深远意义**：费马原理是物理学中第一个重要的**变分原理**，它启发了分析力学中的**最小作用量原理**，并与现代物理，如**量子力学**的路径积分思想，有着深刻的联系。

---

### 专业术语/关键词中英文对照表
*    #变分原理  ( #Variational-Principle )
*    #像点  ( #Image-Point )
*    #反射定律  ( #Law-of-Reflection )
*    #入射面  ( #Plane-of-Incidence )
*    #斯涅尔定律  ( #Snells-Law )
*    #折射率  ( #Refractive-Index )
*    #光程  ( #Optical-Path-Length )
*    #掠射角  ( #Glancing-Angle )
*    #全反射  ( #Total-Internal-Reflection )
*    #驻值  ( #Stationary-Value )
*    #焦点  ( #Foci )
*    #光路可逆原理  ( #Principle-of-Reversibility )
*    #惠更斯原理  ( #Huygens-Principle )
*    #相量  ( #Phasor )
*    #相长干涉  ( #Constructive-Interference )
*    #相消干涉  ( #Destructive-Interference )
*    #概率幅  ( #Probability-Amplitude )
*    #最小作用量原理  ( #Principle-of-Least-Action )
*    #量子力学  ( #Quantum-Mechanics )



## 4.6 The Electromagnetic Approach

Thus far, we have studied reflection and refraction from the perspectives of Scattering Theory, the Theorem of Malus and Dupin, and Fermat's Principle. Yet another and even more powerful approach is provided by Electromagnetic Theory. Unlike the previous techniques, which say nothing about the incident, reflected, and transmitted radiant flux densities (i.e., $I_{l}, I_{r}, I_{l}$, respectively), Electromagnetic Theory treats these within the framework of a far more complete description.

### 4.6.1 Waves at an Interface

Suppose that the incident monochromatic lightwave is planar, so that it has the form
$$
\overrightarrow{\mathbf{E}}_{i}=\overrightarrow{\mathbf{E}}_{0 i} \exp \left[i\left(\overrightarrow{\mathbf{k}}_{i} \cdot \overrightarrow{\mathbf{r}}-\omega_{i} t\right)\right]\tag{4.11}
$$

or, more simply,
$$
\overrightarrow{\mathbf{E}}_{i}=\overrightarrow{\mathbf{E}}_{0 i} \cos \left(\overrightarrow{\mathbf{k}}_{i} \cdot \overrightarrow{\mathbf{r}}-\omega_{i} t\right)\tag{4.12}
$$

where the surfaces of constant phase are those for which $\overrightarrow{\mathbf{k}} \cdot \overrightarrow{\mathbf{r}}=$ constant. Assume that $\overrightarrow{\mathbf{E}}_{0 i}$ is constant in time; that is, the wave is linearly or plane polarized. We'll find in Chapter 8 that any form of light can be represented by two orthogonal linearly polarized waves, so that this doesn't actually represent a restriction. Note that just as the origin in time, $t=0$, is arbitrary, so too is the origin $O$ in space, where $\overrightarrow{\mathbf{r}}=0$. Thus, making no assumptions about their directions, frequencies, wavelengths, phases, or amplitudes, we can write the reflected and transmitted waves as
$$
\overrightarrow{\mathbf{E}}_{r}=\overrightarrow{\mathbf{E}}_{0 r} \cos \left(\overrightarrow{\mathbf{k}}_{r} \cdot \overrightarrow{\mathbf{r}}-\omega_{r} t+\varepsilon_{r}\right)\tag{4.13}
$$
and
$$
\overrightarrow{\mathbf{E}}_{t}=\overrightarrow{\mathbf{E}}_{0 t} \cos \left(\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}-\omega_{t} t+\varepsilon_{t}\right)\tag{4.14}
$$

Here $\varepsilon_{r}$ and $\varepsilon_{t}$ are phase constants relative to $\overrightarrow{\mathbf{E}}_{t}$ and are introduced because the position of the origin is not unique. Figure 4.45 depicts the waves in the vicinity of the planar interface between two homogeneous lossless dielectric media of indices $n_{i}$ and $n_{t}$.

The laws of Electromagnetic Theory (Section 3.1) lead to certain requirements that must be met by the fields, and they are referred to as the boundary conditions. Specifically, one of these is that the component of the electric field $\overrightarrow{\mathbf{E}}$ that is tangent to the interface must be continuous across it. To see how this comes about consider Fig. 4.46, which depicts the interface between two different dielectrics. An electromagnetic wave impinges from above on the interface, and the arrows represent either the incident and transmitted $\overrightarrow{\mathbf{E}}$-fields or the corresponding $\overrightarrow{\mathbf{B}}$-fields. For the moment we'll focus on the $\overrightarrow{\mathbf{E}}$-fields. We draw a narrow closed (dashed) path $C$ that runs parallel to the interface inside both media. Faraday's Induction Law [Eq. (3.5)] tells us that if we add up (via a line integral) the components of $\overrightarrow{\mathbf{E}}$ parallel to the path elements $\overrightarrow{d \ell}$, each one times $\overrightarrow{d \ell}$, over the whole path $C$, the result (a voltage difference) will equal the time rate-of-change of the magnetic flux through the area bounded by $C$. But if we make the dashed loop very narrow there will be no flux through $C$, and the contribution to the line integral (moving right) along the top of the loop must cancel the contribution along the bottom (moving left). 

![490](4-Optics/images/img-57.jpeg.png)
> Figure 4.45 Plane waves incident on the boundary between two homogeneous, isotropic, lossless dielectric media.

![300](4-Optics/images/img-58.jpeg.png)
> Figure 4.46 Boundary conditions at the interface between two dielectrics

That way the net voltage drop around $C$ will be zero. If the tangential components of $\overrightarrow{\mathbf{E}}_{t}$ and $\overrightarrow{\mathbf{E}}_{t}$ in the immediate vicinity of the interface are equal (e.g., both pointing to the right), because the paths reverse direction above and below the interface, the integral around $C$ will indeed go to zero. In other words, the total tangential component of $\overrightarrow{\mathbf{E}}$ on one side of the surface must equal that on the other.

Since $\overrightarrow{\mathbf{u}}_{n}$ is the unit vector normal to the interface, regardless of the direction of the electric field within the wavefront, the cross-product of it with $\overrightarrow{\mathbf{u}}_{n}$ will be perpendicular to $\overrightarrow{\mathbf{u}}_{n}$ and therefore tangent to the interface. Hence
$$
\overrightarrow{\mathbf{u}}_{n} \times \overrightarrow{\mathbf{E}}_{t}+\overrightarrow{\mathbf{u}}_{n} \times \overrightarrow{\mathbf{E}}_{r}=\overrightarrow{\mathbf{u}}_{n} \times \overrightarrow{\mathbf{E}}_{t}\tag{4.15}
$$

or
$$
\begin{aligned}
& \overrightarrow{\mathbf{u}}_{n} \times \overrightarrow{\mathbf{E}}_{0 i} \cos \left(\overrightarrow{\mathbf{k}}_{i} \cdot \overrightarrow{\mathbf{r}}-\omega_{i} t\right) \\
& +\overrightarrow{\mathbf{u}}_{n} \times \overrightarrow{\mathbf{E}}_{0 r} \cos \left(\overrightarrow{\mathbf{k}}_{r} \cdot \overrightarrow{\mathbf{r}}-\omega_{r} t+\varepsilon_{r}\right) \\
& \quad=\overrightarrow{\mathbf{u}}_{n} \times \overrightarrow{\mathbf{E}}_{0 t} \cos \left(\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}-\omega_{t} t+\varepsilon_{t}\right)
\end{aligned}\tag{4.16}
$$

This relationship must obtain at any instant in time and at any point on the interface $(y=b)$. Consequently, $\overrightarrow{\mathbf{E}}_{t}, \overrightarrow{\mathbf{E}}_{r}$, and $\overrightarrow{\mathbf{E}}_{t}$ must have precisely the same functional dependence on the variables $t$ and $r$, which means that
$$
\begin{gathered}
\left.\left(\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}-\omega_{t} t\right)\right|_{y=b}=\left.\left(\overrightarrow{\mathbf{k}}_{r} \cdot \overrightarrow{\mathbf{r}}-\omega_{r} t+\varepsilon_{r}\right)\right|_{y=b} \\
=\left.\left(\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}-\omega_{r} t+\varepsilon_{t}\right)\right|_{y=b}
\end{gathered}\tag{4.17}
$$

With this as the case, the cosines in Eq. (4.16) cancel, leaving an expression independent of $t$ and $r$, as indeed it must be. Inasmuch as this has to be true for all values of time, the coefficients of $t$ must be equal, to wit
$$
\omega_{i}=\omega_{r}=\omega_{t}\tag{4.18}
$$

Recall that the electrons within the media are undergoing (linear) forced vibrations at the frequency of the incident wave. Whatever light is scattered has that same frequency. Furthermore,
$$
\left.\left(\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}\right)\right|_{y=b}=\left.\left(\overrightarrow{\mathbf{k}}_{r} \cdot \overrightarrow{\mathbf{r}}+\varepsilon_{r}\right)\right|_{y=b}=\left.\left(\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}+\varepsilon_{t}\right)\right|_{y=b}\tag{4.19}
$$

wherein $\overrightarrow{\mathbf{r}}$ terminates on the interface. The values of $\varepsilon_{r}$ and $\varepsilon_{t}$ correspond to a given position of $O$, and thus they allow the relation to be valid regardless of that location. (For example, the

origin might be chosen such that $\overrightarrow{\mathbf{r}}$ was perpendicular to $\overrightarrow{\mathbf{k}}_{i}$ but not to $\overrightarrow{\mathbf{k}}_{r}$ or $\overrightarrow{\mathbf{k}}_{r}$.) From the first two terms we obtain
$$
\left[\left(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{r}\right) \cdot \overrightarrow{\mathbf{r}}\right]_{y=b}=\varepsilon_{r}\tag{4.20}
$$

Recalling Eq. (2.43), this expression simply says that the endpoint of $\overrightarrow{\mathbf{r}}$ sweeps out a plane (which is of course the interface) perpendicular to the vector $\left(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{r}\right)$. To phrase it slightly differently, $\left(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{r}\right)$ is parallel to $\overrightarrow{\mathbf{u}}_{n}$. Notice, however, that since the incident and reflected waves are in the same medium, $k_{i}=k_{r}$. From the fact that $\left(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{r}\right)$ has no component in the plane of the interface, that is, $\overrightarrow{\mathbf{u}}_{n} \times\left(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{r}\right)=0$, we conclude that
$$
k_{i} \sin \theta_{i}=k_{r} \sin \theta_{r}
$$

Hence we have the Law of Reflection; that is,
$$
\theta_{i}=\theta_{r}
$$

Furthermore, since $\left(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{r}\right)$ is parallel to $\overrightarrow{\mathbf{u}}_{n}$ all three vectors, $\overrightarrow{\mathbf{k}}_{i}$, $\overrightarrow{\mathbf{k}}_{r}$, and $\overrightarrow{\mathbf{u}}_{n}$, are in the same plane, the plane-of-incidence. Again, from Eq. (4.19)
$$
\left[\left(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{r}\right) \cdot \overrightarrow{\mathbf{r}}\right]_{y=b}=\varepsilon_{t}\tag{4.21}
$$

and therefore $\left(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{r}\right)$ is also normal to the interface. Thus $\overrightarrow{\mathbf{k}}_{i}$, $\overrightarrow{\mathbf{k}}_{r}, \overrightarrow{\mathbf{k}}_{r}$, and $\overrightarrow{\mathbf{u}}_{n}$ are all coplanar. As before, the tangential components of $\overrightarrow{\mathbf{k}}_{i}$ and $\overrightarrow{\mathbf{k}}_{r}$ must be equal, and consequently
$$
k_{i} \sin \theta_{i}=k_{t} \sin \theta_{t}\tag{4.22}
$$

But because $\omega_{i}=\omega_{r}$, we can multiply both sides by $c / \omega_{i}$ to get
$$
n_{i} \sin \theta_{i}=n_{t} \sin \theta_{t}
$$

which is Snell's Law. Finally, if we had chosen the origin $O$ to be in the interface, it is evident from Eqs. (4.20) and (4.21) that $\varepsilon_{r}$ and $\varepsilon_{t}$ would both have been zero. That arrangement, though not as instructive, is certainly simpler, and we'll use it from here on.

### 4.6.2 The Fresnel Equations

We have just found the relationship that exists among the phases of $\overrightarrow{\mathbf{E}}_{i}(\vec{r}, t), \overrightarrow{\mathbf{E}}_{r}(\vec{r}, t)$, and $\overrightarrow{\mathbf{E}}_{r}(\vec{r}, t)$ at the boundary. There is still an interdependence shared by the amplitudes $\overrightarrow{\mathbf{E}}_{0 i}, \overrightarrow{\mathbf{E}}_{0 r}$, and $\overrightarrow{\mathbf{E}}_{0 r}$, which can now be evaluated. To that end, suppose that a plane monochromatic wave is incident on the planar surface separating two isotropic media. Whatever the polarization of the wave, we shall resolve its $\overrightarrow{\mathbf{E}}$ - and $\overrightarrow{\mathbf{B}}$-fields into components parallel and perpendicular to the plane-of-incidence and treat these constituents separately.

***Case 1: $\overrightarrow{\mathbf{E}}$ perpendicular to the plane-of-incidence***. Assume that $\overrightarrow{\mathbf{E}}$ is perpendicular to the plane-of-incidence and that $\overrightarrow{\mathbf{B}}$ is
parallel to it (Fig. 4.47). Recall that $E=v B$, so that
$$
\overrightarrow{\mathbf{k}} \times \overrightarrow{\mathbf{E}}=v \overrightarrow{\mathbf{B}}\tag{4.23}
$$

and
$$
\overrightarrow{\mathbf{k}} \cdot \overrightarrow{\mathbf{E}}=0\tag{4.24}
$$

(i.e., $\overrightarrow{\mathbf{E}}, \overrightarrow{\mathbf{B}}$, and the unit propagation vector $\overrightarrow{\mathbf{k}}$ form a right-handed system). Again, making use of the continuity of the tangential components of the $\overrightarrow{\mathbf{E}}$-field, we have at the boundary at any time and any point
$$
\overrightarrow{\mathbf{E}}_{0 i}+\overrightarrow{\mathbf{E}}_{0 r}=\overrightarrow{\mathbf{E}}_{0 r}\tag{4.25}
$$

where the cosines cancel. Realize that the field vectors as shown really ought to be envisioned at $y=0$ (i.e., at the surface), from which they have been displaced for the sake of clarity. Note too that although $\overrightarrow{\mathbf{E}}_{r}$ and $\overrightarrow{\mathbf{E}}_{t}$ must be normal to the plane-ofincidence by symmetry, we are guessing that they point outward at the interface when $\overrightarrow{\mathbf{E}}_{i}$ does. The directions of the $\overrightarrow{\mathbf{B}}$-fields then follow from Eq. (4.23).
![500](4-Optics/images/img-59.jpeg.png)
> Figure 4.47 An incoming wave whose $\overrightarrow{\mathbf{E}}$-field is normal to the plane-ofincidence. The fields shown are those at the interface; they have been displaced so the vectors could be drawn without confusion.

We will need to invoke another of the boundary conditions in order to get one more equation. The presence of material substances that become electrically polarized by the wave has a definite effect on the field configuration. Thus, although the tangential component of $\overrightarrow{\mathbf{E}}$ (i.e., tangent to the interface) is continuous across the boundary, its normal component is not. Instead, the normal component of the product $\epsilon \overrightarrow{\mathbf{E}}$ is the same on either side of the interface. Similarly, the normal component of $\overrightarrow{\mathbf{B}}$ is continuous, as is the tangential component of $\mu^{-1} \overrightarrow{\mathbf{B}}$. To illustrate that, return to Fig. 4.46 and Ampère's Law [Eq. (3.13)], where this time the arrows stand for the $\overrightarrow{\mathbf{B}}$-fields. Because the permeability may be different in the two media, divide both sides of the equation by $\mu$. Letting the dashed loop become vanishingly narrow, the area $A$ bounded by $C$ disappears and the right side of Eq. (3.13) vanishes. That means that if we add up (via a line integral) the components of $\overrightarrow{\mathbf{B}} / \mu$ parallel to the path elements $\overparen{d \ell}$-each one times $\overparen{d \ell}$-over the whole path $C$, the result must be zero. Hence the net value of $\overrightarrow{\mathbf{B}} / \mu$ immediately above the interface must equal the net value immediately beneath the interface. Here the magnetic effect of the two media appears via their permeabilities $\mu_{t}$ and $\mu_{t}$. This boundary condition will be the simplest to use, particularly as applied to reflection from the surface of a conductor[^conductor].* Thus the continuity of the tangential component of $\overrightarrow{\mathbf{B}} / \mu$ requires that
$$
-\frac{B_{t}}{\mu_{t}} \cos \theta_{t}+\frac{B_{r}}{\mu_{t}} \cos \theta_{r}=-\frac{B_{t}}{\mu_{t}} \cos \theta_{t}\tag{4.26}
$$

[^conductor]:  *In keeping with our intent to use only the $\overrightarrow{\mathbf{E}}$ - and $\overrightarrow{\mathbf{B}}$-fields, at least in the early part of this exposition, we have avoided the usual statements in terms of $\overrightarrow{\mathbf{B}}$, where $$\vec H=\mu ^{-1}\vec B\tag{A1.14}$$
When the tangential component of the $B$-field points in the negative $x$-direction, as it does for the incident wave, it is entered with a minus sign. The left and right sides of the equation are the total magnitudes of $\overrightarrow{\mathbf{B}} / \mu$ parallel to the interface in the incident and transmitting media, respectively. The positive direction is that of increasing $x$, so that the scalar components of $\overrightarrow{\mathbf{B}}_{i}$ and $\overrightarrow{\mathbf{B}}_{t}$ appear with minus signs. From Eq. (4.23) we have
$$
B_{t}=E_{i} / v_{t}\tag{4.27}
$$
$$
B_{r}=E_{t} / v_{r}\tag{4.28}
$$
and
$$
B_{t}=E_{t} / v_{t}\tag{4.29}
$$

Since $v_{i}=v_{r}$ and $\theta_{i}=\theta_{r}$, Eq. (4.26) can be written as
$$
\frac{1}{\mu_{t} v_{i}}\left(E_{i}-E_{r}\right) \cos \theta_{i}=\frac{1}{\mu_{t} v_{t}} E_{t} \cos \theta_{t}\tag{4.30}
$$

Making use of Eqs. (4.12), (4.13), and (4.14) and remembering that the cosines therein equal one another at $y=0$, we obtain
$$
\frac{n_{t}}{\mu_{t}}\left(E_{0 i}-E_{0 r}\right) \cos \theta_{i}=\frac{n_{t}}{\mu_{t}} E_{0 r} \cos \theta_{t}\tag{4.31}
$$

Combined with Eq. (4.25), this yields
$$
\left(\frac{E_{0 r}}{E_{0 i}}\right)_{\perp}=\frac{\frac{n_{t}}{\mu_{t}} \cos \theta_{i}-\frac{n_{t}}{\mu_{t}} \cos \theta_{t}}{\frac{n_{i}}{\mu_{t}} \cos \theta_{i}+\frac{n_{t}}{\mu_{t}} \cos \theta_{t}}\tag{4.32}
$$
and
$$
\left(\frac{E_{0 r}}{E_{0 i}}\right)_{\perp}=\frac{2 \frac{n_{t}}{\mu_{t}} \cos \theta_{i}}{\frac{n_{i}}{\mu_{t}} \cos \theta_{i}+\frac{n_{t}}{\mu_{t}} \cos \theta_{t}}\tag{4.33}
$$

The $\perp$ subscript serves as a reminder that we are dealing with the case in which $\overrightarrow{\mathbf{E}}$ is perpendicular to the plane-of-incidence. These two expressions, which are completely general statements applying to any linear, isotropic, homogeneous media, are two of the **Fresnel Equations**. Most often one deals with dielectrics for which $\mu_{t} \approx \mu_{t} \approx \mu_{0}$; consequently, the common form of these equations is simply
$$
\boxed{r_{\perp} \equiv\left(\frac{E_{0 r}}{E_{0 i}}\right)_{\perp}=\frac{n_{i} \cos \theta_{i}-n_{t} \cos \theta_{t}}{n_{i} \cos \theta_{i}+n_{t} \cos \theta_{t}}}\tag{4.34}
$$

and
$$
\boxed{t_{\perp} \equiv\left(\frac{E_{0 r}}{E_{0 i}}\right)_{\perp}=\frac{2 n_{i} \cos \theta_{i}}{n_{i} \cos \theta_{i}+n_{t} \cos \theta_{t}}}\tag{4.35}
$$

Here $r_{\perp}$ denotes the ***amplitude reflection coefficient***, and $t_{\perp}$ is the ***amplitude transmission coefficient***.

***Case 2: $\overrightarrow{\mathbf{E}}$ parallel to the plane-of-incidence***. A similar pair of equations can be derived when the incoming $\overrightarrow{\mathbf{E}}$-field lies in the plane-of-incidence, as shown in Fig. 4.48. Continuity of the tangential components of $\overrightarrow{\mathbf{E}}$ on either side of the boundary leads to
$$
E_{0 i} \cos \theta_{i}-E_{0 r} \cos \theta_{r}=E_{0 t} \cos \theta_{t}\tag{4.36}
$$

In much the same way as before, continuity of the tangential components of $\overrightarrow{\mathbf{B}} / \mu$ yields
$$
\frac{1}{\mu_{t} v_{i}} E_{0 i}+\frac{1}{\mu_{r} v_{r}} E_{0 r}=\frac{1}{\mu_{t} v_{t}} E_{0 t}\tag{4.37}
$$

![460](4-Optics/images/img-60.jpeg.png)
> Figure 4.48 An incoming wave whose $\overrightarrow{\mathbf{E}}$-field is in the plane-ofincidence.

Using the fact that $\mu_{i}=\mu_{r}$ and $\theta_{i}=\theta_{r}$, we can combine these formulas to obtain two more of the Fresnel Equations:
$$
r_{\|} \equiv\left(\frac{E_{0 i}}{E_{0 i}}\right)_{\|}=\frac{\frac{n_{i}}{\mu_{i}} \cos \theta_{i}-\frac{n_{i}}{\mu_{i}} \cos \theta_{i}}{\frac{n_{i}}{\mu_{i}} \cos \theta_{i}+\frac{n_{i}}{\mu_{i}} \cos \theta_{i}}\tag{4.38}
$$

and
$$
t_{\|}=\left(\frac{E_{0 i}}{E_{0 i}}\right)_{\|}=\frac{2 \frac{n_{i}}{\mu_{i}} \cos \theta_{i}}{\frac{n_{i}}{\mu_{i}} \cos \theta_{i}+\frac{n_{i}}{\mu_{i}} \cos \theta_{i}}\tag{4.39}
$$

When both media forming the interface are dielectrics that are essentially "nonmagnetic" (p. 76), the amplitude coefficients become
$$
\boxed{r_{\|}=\frac{n_{i} \cos \theta_{i}-n_{i} \cos \theta_{i}}{n_{i} \cos \theta_{i}+n_{i} \cos \theta_{i}}}\tag{4.40}
$$

and
$$
\boxed{t_{\|}=\frac{2 n_{i} \cos \theta_{i}}{n_{i} \cos \theta_{i}+n_{i} \cos \theta_{i}}}\tag{4.41}
$$

One further notational simplification can be made using Snell's Law, whereupon the Fresnel Equations for dielectric media become (Problem 4.43)
$$
r_{\perp}=-\frac{\sin \left(\theta_{i}-\theta_{t}\right)}{\sin \left(\theta_{i}+\theta_{t}\right)}\tag{4.42}
$$
$$
r_{\|}=+\frac{\tan \left(\theta_{i}-\theta_{t}\right)}{\tan \left(\theta_{i}+\theta_{t}\right)}\tag{4.43}
$$
$$
t_{\perp}=+\frac{2 \sin \theta_{i} \cos \theta_{t}}{\sin \left(\theta_{i}+\theta_{t}\right)}\tag{4.44}
$$
$$
t_{\|}=+\frac{2 \sin \theta_{i} \cos \theta_{t}}{\sin \left(\theta_{i}+\theta_{t}\right) \cos \left(\theta_{i}-\theta_{t}\right)}\tag{4.45}
$$

A note of caution must be introduced here. Bear in mind that the directions (or more precisely, the phases) of the fields in Figs. 4.47 and 4.48 were selected rather arbitrarily. For example, in Fig. 4.47 we could have assumed that $\overrightarrow{\mathbf{E}}_{r}$ pointed inward, whereupon $\overrightarrow{\mathbf{B}}_{r}$ would have had to be reversed as well. Had we done that, the sign of $r_{\perp}$ would have turned out to be positive, leaving the other amplitude coefficients unchanged. The signs appearing in Eqs. (4.42) through (4.45), which are positive except for the first, correspond to the particular set of field directions selected. The minus sign in Eq. (4.42), as we will see, just means that we didn't guess correctly concerning $\overrightarrow{\mathbf{E}}_{r}$ in Fig. 4.47. Nonetheless, be aware that the literature is not standardized, and all possible sign variations have been labeled the Fresnel Equations. To avoid confusion they must be related to the specific field directions from which they were derived.

#### EXAMPLE 4.4

An electromagnetic wave having an amplitude of $1.0 \mathrm{~V} / \mathrm{m}$ arrives at an angle of $30.0^{\circ}$ to the normal in air on a glass plate of index 1.60. The wave's electric field is entirely perpendicular to the plane-of-incidence. Determine the amplitude of the reflected wave.

#### SOLUTION

Since $\left(E_{0 r}\right)_{\perp}=r_{\perp}\left(E_{0 i}\right)_{\perp}=r_{\perp}(1 \mathrm{~V} / \mathrm{m})$ we have to find
$$
r_{\perp}=-\frac{\sin \left(\theta_{i}-\theta_{t}\right)}{\sin \left(\theta_{i}+\theta_{t}\right)}\tag{4.42}
$$

But first we'll need $\theta_{t}$, and so from Snell's Law
$$
\begin{gathered}
n_{i} \sin \theta_{i}=n_{i} \sin \theta_{t} \\
\sin \theta_{t}=\frac{n_{i}}{n_{i}} \sin \theta_{i} \\
\sin \theta_{t}=\frac{1}{1.60} \sin 30.0^{\circ}=0.3125 \\
\theta_{t}=18.21^{\circ}
\end{gathered}
$$

Hence
$$
\begin{gathered}
r_{\perp}=-\frac{\sin \left(30.0^{\circ}-18.2^{\circ}\right)}{\sin \left(30.0^{\circ}+18.2^{\circ}\right)}=-\frac{\sin 11.8^{\circ}}{\sin 48.2^{\circ}} \\
r_{\perp}=-\frac{0.2045}{0.7455}=-0.274
\end{gathered}
$$

and so
$$
\begin{gathered}
\left(E_{0 r}\right)_{\perp}=r_{\perp}\left(E_{0 i}\right)_{\perp}=r_{\perp}(1.0 \mathrm{~V} / \mathrm{m}) \\
\left(E_{0 r}\right)_{\perp}=-0.27 \mathrm{~V} / \mathrm{m}
\end{gathered}
$$

### 4.6.3 Interpretation of the Fresnel Equations

This section examines the physical implications of the Fresnel Equations. In particular, we are interested in determining the fractional amplitudes and flux densities that are reflected and refracted. In addition we shall be concerned with any possible phase shifts that might be incurred in the process.

#### Amplitude Coefficients

Let's briefly examine the form of the amplitude coefficients over the entire range of $\theta_{i}$ values. At nearly normal incidence $\left(\theta_{i} \approx 0\right)$ the tangents in Eq. (4.43) are essentially equal to sines, in which case
$$
\left[r_{i}\right]_{\theta_{i}=0}=\left[-r_{\perp}\right]_{\theta_{i}=0}=\left[\frac{\sin \left(\theta_{i}-\theta_{t}\right)}{\sin \left(\theta_{i}+\theta_{t}\right)}\right]_{\theta_{i}=0}
$$

![450](4-Optics/images/img-61.jpeg.png)
> Undyed paper is a mat of thin transparent fibers that have an index of refraction (of about 1.56) substantially different from that of the surrounding air. Hence paper scatters appreciable amounts of white light and appears bright opaque white-see Eq. (4.46). If we now "wet" the paper, coating each fiber with something (e.g., mineral oil, aka baby oil) whose index (1.46) is between that of air and the fibers, it will cut the amount of back-scattered light and the treated area will become essentially transparent. (E.H.)

We will come back to the physical significance of the minus sign presently. After expanding the sines and using Snell's Law, this expression becomes
$$
\left[r_{i}\right]_{\theta_{i}=0}=\left[-r_{\perp}\right]_{\theta_{i}=0}=\left[\frac{n_{t} \cos \theta_{i}-n_{i} \cos \theta_{t}}{n_{t} \cos \theta_{i}+n_{i} \cos \theta_{t}}\right]_{\theta_{i}=0}\tag{4.46}
$$

which follows as well from Eqs. (4.34) and (4.40). In the limit, as $\theta_{i}$ goes to $0, \cos \theta_{i}$ and $\cos \theta_{t}$ both approach 1 , and consequently
$$
\boxed{\left[r_{i}\right]_{\theta_{i}=0}=\left[-r_{\perp}\right]_{\theta_{i}=0}=\frac{n_{t}-n_{i}}{n_{t}+n_{i}}}\tag{4.47}
$$

This equality of the reflection coefficients arises because the plane-of-incidence is no longer specified when $\theta_{t}=0$. Thus, for example, at an air $\left(n_{i}=1\right)$-glass $\left(n_{t}=1.5\right)$ interface at nearly normal incidence, the amplitude reflection coefficients equal $\pm 0.2$. (See Problem 4.58.)

When $n_{t}>n_{i}$ it follows from Snell's Law that $\theta_{i}>\theta_{t}$, and $r_{\perp}$ is negative for all values of $\theta_{i}$ (Fig. 4.49). In contrast, Eq. (4.43) tells us that $r_{i}$ starts out positive at $\theta_{i}=0$ and decreases gradually until it equals zero when $\left(\theta_{i}+\theta_{t}\right)=90^{\circ}$, since there $\tan \pi / 2$ is infinite. The particular value of the incident angle for which this occurs is denoted by $\theta_{p}$ and referred to as the ***polarization angle*** (see Section 8.6.1). Notice that $r_{i} \rightarrow 0$ at $\theta_{p}$, just when the phase shifts $180^{\circ}$. That means we won't see the $\mathbf{E}$-field do any flipping when $\theta_{i}$ approaches $\theta_{p}$ from either side. As $\theta_{i}$ increases beyond $\theta_{p}, r_{i}$ becomes progressively more negative, reaching -1.0 at $90^{\circ}$.

If you place a single sheet of glass, a microscope slide, on this page and look straight down into it $\left(\theta_{i}=0\right)$, the region beneath the glass will seem decidedly grayer than the rest of the paper, because the slide will reflect at both its interfaces, and the light reaching and returning from the paper will be diminished appreciably. 
![200](4-Optics/images/img-62.jpeg.png)
> A glass rod and a wooden rod immersed in benzene. Since the index of refraction of benzene is very nearly that of glass, the rod on the left seems to vanish in the liquid. (E.H.)

Now hold the slide near your eye and again view the page through it as you tilt it, increasing $\theta_{i}$. The amount of light reflected will increase, and it will become more difficult to see the page through the glass. When $\theta_{i} \approx 90^{\circ}$ the slide will look like a perfect mirror as the reflection coefficients (Fig. 4.49) go to -1.0 . Even a poor surface (see photo), such as the cover of this book, will be mirrorlike at glancing incidence. Hold the book horizontally at the level of the middle of your eye and face a bright light; you will see the source reflected nicely in the cover. This suggests that X-rays could be mirror-reflected at glancing incidence (p. 254), and modern X-ray telescopes are based on that very fact.

At normal incidence Eqs. (4.35) and (4.41) lead straightforwardly to
$$
\left[t_{0}\right]_{\theta_{i}=0}=\left[t_{\perp}\right]_{\theta_{i}=0}=\frac{2 n_{i}}{n_{i}+n_{t}}\tag{4.48}
$$

It will be shown in Problem 4.63 that the expression
$$
t_{\perp}+\left(-r_{\perp}\right)=1\tag{4.49}
$$

holds for all $\theta_{i}$, whereas
$$
t_{\|}+r_{\|}=1\tag{4.50}
$$

is true only at normal incidence.

The foregoing discussion, for the most part, was restricted to the case of ***external reflection*** (i.e., $n_{t}>n_{i}$ ). The opposite situation of ***internal reflection***, in which the incident medium is the more dense $\left(n_{i}>n_{t}\right)$, is of interest as well. 
![490](4-Optics/images/img-63.jpeg.png)
> Figure 4.49 The amplitude coefficients of reflection and transmission as a function of incident angle. These correspond to external reflection $n_{t}>n_{i}$ at an air-glass interface $\left(n_{0}=1.5\right)$.

![350](4-Optics/images/img-64.jpeg.png)
> At near-glancing incidence the walls and floor are mirrorlike this despite the fact that the surfaces are rather poor reflectors at $\theta_{i}=0^{\circ}$. (E.H.)

In that instance $\theta_{t}>\theta_{i}$, and $r_{\perp}$, as described by Eq. (4.42), will always be positive. Figure 4.50 shows that $r_{\perp}$ increases from its initial value [Eq. (4.47)] at $\theta_{i}=0$, reaching +1 at what is called the ***critical angle***, $\theta_{c}$. Specifically, $\theta_{c}$ is the special value of the incident angle (p. 133) for which $\theta_{t}=\pi / 2$. Likewise, $r_{\|}$starts off negatively [Eq. (4.47)] at $\theta_{i}=0$ and thereafter increases, reaching +1 at $\theta_{i}=\theta_{c}$, as is evident from the Fresnel Equation (4.40). Again, $r_{\|}$passes through zero at the polarization angle $\theta_{p}^{\prime}$. It is left for Problem 4.68 to show that the polarization angles $\theta_{p}^{*}$ and $\theta_{p}$ for internal and external reflection at the interface between the same media are simply the complements of each other. We will return to internal reflection in Section 4.7, where it will be shown that $r_{\perp}$ and $r_{\|}$are complex quantities for $\theta_{I}>\theta_{c}$.

![490](4-Optics/images/img-65.jpeg.png)
> Figure 4.50 The amplitude coefficients of reflection as a function of incident angle. These correspond to internal reflection $n_{t}<n_{i}$ at an air-glass interface $\left(n_{0}=1 / 1.5\right)$.

#### Phase Shifts

It should be evident from Eq. (4.42) that $r_{\perp}$ is negative regardless of $\theta_{I}$ when $n_{I}>n_{i}$. Yet we saw earlier that had we chosen $\left[\overrightarrow{\mathbf{E}}_{r}\right]_{\perp}$ in Fig. 4.47 to be in the opposite direction, the first Fresnel Equation (4.42) would have changed signs, causing $r_{\perp}$ to become a positive quantity. The sign of $r_{\perp}$ is associated with the relative directions of $\left[\overrightarrow{\mathbf{E}}_{0 i}\right]_{\perp}$ and $\left[\overrightarrow{\mathbf{E}}_{0 r}\right]_{\perp}$. Bear in mind that a reversal of $\left[\overrightarrow{\mathbf{E}}_{0 r}\right]_{\perp}$ is tantamount to introducing a phase shift, $\Delta \varphi_{\perp}$, of $\pi$ radians into $\left[\overrightarrow{\mathbf{E}}_{r}\right]_{\perp}$. Hence at the boundary $\left[\overrightarrow{\mathbf{E}}_{i}\right]_{\perp}$ and $\left[\overrightarrow{\mathbf{E}}_{r}\right]_{\perp}$ will be antiparallel and therefore $\pi$ out-of-phase with each other, as indicated by the negative value of $r_{\perp}$. When we consider components normal to the plane-of-incidence, there is no confusion as to whether two fields are in-phase or $\pi$ radians out-of-phase: if parallel, they're in-phase; if antiparallel, they're $\pi$ out-of-phase. In summary, then, ***the component of the electric field normal to the plane-of-incidence undergoes a phase shift of $\pi$ radians upon reflection when the incident medium has a lower index than the transmitting medium***. Similarly, $t_{\perp}$ and $t_{\|}$are always positive and $\Delta \varphi=0$. Furthermore, when $n_{I}>n_{t}$ no phase shift in the normal component results on reflection, that is, $\Delta \varphi_{\perp}=0$ so long as $\theta_{I}<\theta_{c}$.

Things are a bit less obvious when we deal with $\left[\overrightarrow{\mathbf{E}}_{i}\right]_{3}$, $\left[\overrightarrow{\mathbf{E}}_{r}\right]_{3}$, and $\left[\overrightarrow{\mathbf{E}}_{i}\right]_{1}$. It now becomes necessary to define more explicitly what is meant by in-phase, since the field vectors are coplanar but generally not colinear. The field directions were chosen in Figs. 4.47 and 4.48 such that if you looked down any one of the propagation vectors toward the direction from which the light was coming, $\overrightarrow{\mathbf{E}}, \overrightarrow{\mathbf{B}}$, and $\overrightarrow{\mathbf{k}}$ would appear to have the same relative orientation whether the ray was incident, reflected, or transmitted. We can use this as the required condition for two $\overrightarrow{\mathbf{E}}$-fields to be in-phase. Equivalently, but more simply, ***two fields in the incident plane are in-phase if their $y$-components are parallel and are out-of-phase if the components are antiparallel***. Notice that when two $\overrightarrow{\mathbf{E}}$-fields are out-of-phase so too are their associated $\overrightarrow{\mathbf{B}}$-fields and vice versa. With this definition we need only look at the vectors normal to the plane-of-incidence, whether they be $\overrightarrow{\mathbf{E}}$ or $\overrightarrow{\mathbf{B}}$, to determine the relative phase of the accompanying fields in the incident plane. Thus in Fig. $4.51 a \overrightarrow{\mathbf{E}}_{i}$ and $\overrightarrow{\mathbf{E}}_{i}$ are in-phase, as are $\overrightarrow{\mathbf{B}}_{i}$ and $\overrightarrow{\mathbf{B}}_{r}$, whereas $\overrightarrow{\mathbf{E}}_{i}$ and $\overrightarrow{\mathbf{E}}_{r}$ are out-of-phase, along with $\overrightarrow{\mathbf{B}}_{i}$ and $\overrightarrow{\mathbf{B}}_{r}$. Similarly, in Fig. $4.51 b \overrightarrow{\mathbf{E}}_{r}, \overrightarrow{\mathbf{E}}_{r}$, and $\overrightarrow{\mathbf{E}}_{i}$ are in-phase, as are $\overrightarrow{\mathbf{B}}_{i}, \overrightarrow{\mathbf{B}}_{r}$, and $\overrightarrow{\mathbf{B}}_{r}$.

Now, the amplitude reflection coefficient for the parallel component is given by
$$
r_{\|}=\frac{n_{I} \cos \theta_{I}-n_{I} \cos \theta_{r}}{n_{I} \cos \theta_{I}+n_{I} \cos \theta_{I}}
$$

![450](4-Optics/images/img-66.jpeg.png)
> Figure 4.51 Field orientations and phase shifts.

which is positive $\left(\Delta \varphi_{\|}=0\right)$ as long as
$$
n_{I} \cos \theta_{I}-n_{I} \cos \theta_{I}>0
$$

that is, if
$$
\sin \theta_{I} \cos \theta_{I}-\cos \theta_{I} \sin \theta_{I}>0
$$

or equivalently
$$
\sin \left(\theta_{I}-\theta_{I}\right) \cos \left(\theta_{I}+\theta_{I}\right)>0\tag{4.51}
$$

This will be the case for $n_{I}<n_{t}$ if
$$
\left(\theta_{I}+\theta_{I}\right)<\pi / 2\tag{4.52}
$$

and for $n_{I}<n_{t}$ when
$$
\left(\theta_{I}+\theta_{I}\right)>\pi / 2\tag{4.53}
$$

Thus when $n_{I}<n_{t},\left[\overrightarrow{\mathbf{E}}_{0 r}\right]_{3}$ and $\left[\overrightarrow{\mathbf{E}}_{0 i}\right]_{1}$ will be in-phase $\left(\Delta \varphi_{\|}=0\right)$ until $\theta_{I}=\theta_{p}$ and out-of-phase by $\pi$ radians thereafter. The transition is not actually discontinuous, since $\left[\overrightarrow{\mathbf{E}}_{0 r}\right]_{\|}$goes to zero at $\theta_{p}$. In contrast, for internal reflection $r_{\|}$is negative until $\theta_{p}^{*}$, which means that $\Delta \varphi_{\|}=\pi$. From $\theta_{p}^{*}$ to $\theta_{c}, r_{\|}$is positive and $\Delta \varphi_{\|}=0$. Beyond $\theta_{c}, r_{\|}$becomes complex, and $\Delta \varphi_{\|}$gradually increases to $\pi$ at $\theta_{I}=90^{\circ}$.

Figure 4.52, which summarizes these conclusions, will be of continued use to us. The actual functional form of $\Delta \varphi_{\|}$and $\Delta \varphi_{\perp}$ for internal reflection in the region where $\theta_{I}>\theta_{c}$ can be found in the literature[^literature],* but the curves depicted here will suffice for our purposes. Figure $4.52 e$ is a plot of the relative phase shift between the parallel and perpendicular components, that is, $\Delta \varphi_{\|}-\Delta \varphi_{\perp}$. It is included here because it will be useful later on (e.g., when we consider polarization effects). Finally, the essential features of this discussion are illustrated in Figs. 4.53 and 4.54. The amplitudes of the reflected vectors are in accord with those of Figs. 4.49 and 4.50 (for an air-glass interface), and the phase shifts agree with those of Fig. 4.52.

[^literature]:  *Born and Wolf, Principles of Optics, p. 49.

Many of these conclusions can be verified with the simplest experimental equipment, namely, two linear polarizers, a piece of glass, and a small source, such as a flashlight or high-intensity lamp. 

![480](4-Optics/images/img-67.jpeg.png)
> Figure 4.52 Phase shifts for the parallel and perpendicular components of the $\overrightarrow{\mathbf{E}}$-field corresponding to internal and external reflection.

By placing one polarizer in front of the source (at $45^{\circ}$ to the plane-of-incidence), you can easily duplicate the conditions of Fig. 4.53. For example, when $\theta_{i}=\theta_{p}$ (Fig. 4.53b) no light will pass through the second polarizer if its transmission axis is parallel to the plane-of-incidence. In comparison, at near-glancing incidence the reflected beam will vanish when the axes of the two polarizers are almost normal to each other.

#### Reflectance and Transmittance

Consider a circular beam of light incident on a surface, as shown in Fig. 4.55, such that there is an illuminated spot of area $A$. Recall that the power per unit area crossing a surface in vacuum whose normal is parallel to $\overrightarrow{\mathbf{S}}$, the Poynting vector, is given by
$$
\overrightarrow{\mathbf{S}}=c^{2} \epsilon_{0} \overrightarrow{\mathbf{E}} \times \overrightarrow{\mathbf{B}}\tag{3.40}
$$

Furthermore, the radiant flux density $\left(\mathrm{W} / \mathrm{m}^{2}\right)$ or irradiance is
$$
I=\langle S\rangle_{\mathrm{T}}=\frac{c \epsilon_{0}}{2} E_{0}^{2}\tag{3.44}
$$

This is the average energy per unit time crossing a unit area normal to $\overrightarrow{\mathbf{S}}$ (in isotropic media $\overrightarrow{\mathbf{S}}$ is parallel to $\overrightarrow{\mathbf{k}}$ ). In the case at hand (Fig. 4.55), let $I_{t}, I_{r}$, and $I_{i}$ be the incident, reflected, and transmitted flux densities, respectively. The cross-sectional areas of the incident, reflected, and transmitted beams are, respectively, $A \cos \theta_{i}, A \cos \theta_{r}$, and $A \cos \theta_{i}$. Accordingly, the incident power is $I_{r} A \cos \theta_{i}$; this is the energy per unit time flowing in the incident beam, and it's therefore the power arriving on the surface over $A$. Similarly, $I_{r} A \cos \theta_{r}$ is the power in the reflected beam, and $I_{r} A \cos \theta_{i}$ is the power being transmitted through $A$. We define the ***reflectance*** $R$ to be the ratio of the reflected power (or flux) to the incident power:
$$
R \equiv \frac{I_{r} A \cos \theta_{r}}{I_{i} A \cos \theta_{i}}=\frac{I_{r}}{I_{i}}\tag{4.54}
$$

In the same way, the ***transmittance $T$*** is defined as the ratio of the transmitted to the incident flux and is given by
$$
T \equiv \frac{I_{t} \cos \theta_{i}}{I_{i} \cos \theta_{i}}\tag{4.55}
$$

The quotient $I_{t} / I_{i}$ equals $\left(v_{r} \epsilon_{r} E_{0 r}^{2} / 2\right) /\left(v_{i} \epsilon_{i} E_{0 i}^{2} / 2\right)$, and since the incident and reflected waves are in the same medium, $v_{r}=$ $v_{i}, \epsilon_{r}=\epsilon_{i}$, and
$$
R=\left(\frac{E_{0 r}}{E_{0 i}}\right)^{2}=r^{2}\tag{4.56}
$$

In like fashion (assuming $\mu_{i}=\mu_{r}=\mu_{0}$ ),
$$
T=\frac{n_{t} \cos \theta_{i}}{n_{i} \cos \theta_{i}}\left(\frac{E_{0 r}}{E_{0 i}}\right)^{2}=\left(\frac{n_{t} \cos \theta_{i}}{n_{i} \cos \theta_{i}}\right) r^{2}\tag{4.57}
$$

where use was made of the fact that $\mu_{0} \epsilon_{t}=1 / v_{t}^{2}$ and $\mu_{0} v_{t} \epsilon_{t}=$ $n_{t} / c$. Notice that at normal incidence, which is a situation of great practical interest, $\theta_{t}=\theta_{i}=0$, and the transmittance [Eq. (4.55)], like the reflectance [Eq. (4.54)], is then simply the ratio of the appropriate irradiances. Since $R=r^{2}$, we need not worry about the sign of $r$ in any particular formulation, and that makes reflectance a convenient notion. Observe that in Eq. (4.57) $T$ is not simply equal to $t^{2}$, for two reasons. First, the ratio of the indices of refraction must be there, since the speeds at which energy is transported into and out of the interface are different, in other words, $I \propto v$, from Eq. (3.47). 

![img-68.jpeg](4-Optics/images/img-68.jpeg.png)
> Figure 4.53 The reflected $\overrightarrow{\mathbf{E}}$-field at various angles concomitant with external reflection. The fields all occur at the interface. They have been displaced a bit so the vectors could be drawn without confusion.

Second, the crosssectional areas of the incident and refracted beams are different. The energy flow per unit area is affected accordingly, and that manifests itself in the presence of the ratio of the cosine terms.

Let's now write an expression representing the conservation of energy for the configuration depicted in Fig. 4.55. In other words, the total energy flowing into area $A$ per unit time must equal the energy flowing outward from it per unit time:
$$
I_{i} A \cos \theta_{i}=I_{r} A \cos \theta_{r}+I_{i} A \cos \theta_{i}\tag{4.58}
$$

When both sides are multiplied by $c$, this expression becomes
$$
n_{i} E_{0 i}^{2} \cos \theta_{i}=n_{i} E_{0 i}^{2} \cos \theta_{i}+n_{i} E_{0 i}^{2} \cos \theta_{i} \\
$$
or
$$
1=\left(\frac{E_{0 i}}{E_{0 i}}\right)^{2}+\left(\frac{n_{i} \cos \theta_{i}}{n_{i} \cos \theta_{i}}\right)\left(\frac{E_{0 i}}{E_{0 i}}\right)^{2}\tag{4.59}
$$

![650](4-Optics/images/img-69.jpeg.png)
> Figure 4.54 The reflected $\overrightarrow{\mathbf{E}}$-field at various angles concomitant with internal reflection.

But this is simply
$$
R+T=1\tag{4.60}
$$

where there was no absorption.

The electric field is a vector field and, as in the Fresnel analysis, we can again think of light as being composed of two orthogonal components whose $E$-fields are either parallel or perpendicular to the plane-of-incidence. In fact, for ordinary "unpolarized" light, half oscillates parallel to that plane and half oscillates perpendicular to it. Thus if the incoming net irradiance is, say, $500 \mathrm{~W} / \mathrm{m}^{2}$ the amount of light oscillating perpendicular to the incident plane is $250 \mathrm{~W} / \mathrm{m}^{2}$. 
![400](4-Optics/images/img-70.jpeg.png)
> Figure 4.55 Reflection and transmission of an incident beam.

![400](4-Optics/images/img-71.jpeg.png)
> Figure 4.56 Reflectance and transmittance versus incident angle.

It follows from Eqs. (4.56) and (4.57) that
$$
R_{\perp}=r_{\perp}^{2}\tag{4.61}
$$
$$
R_{\|}=r_{\|}^{2}\tag{4.62}
$$
$$
T_{\perp}=\left(\frac{n_{t} \cos \theta_{t}}{n_{i} \cos \theta_{i}}\right) t_{\perp}^{2}\tag{4.63}
$$

and
$$
T_{\|}=\left(\frac{n_{t} \cos \theta_{t}}{n_{i} \cos \theta_{i}}\right) t_{\|}^{2}\tag{4.64}
$$
which are illustrated in Fig. 4.56. Furthermore, it can be shown (Problem 4.73) that
$$
R_{\|}+T_{\|}=1\tag{4.65a}
$$

and
$$
R_{\perp}+T_{\perp}=1\tag{4.65b}
$$

![400](4-Optics/images/img-72.jpeg.png)
> Looking down into a puddle (that's melting snow on the right) we see a reflection of the surrounding trees. At normal incidence water reflects about $2 \%$ of the light. As the viewing angle increases-here it's about $40^{\circ}$-that percentage increases. (E.H.)

Notice that $R_{\perp}$ is the fraction of $I_{i \perp}$ that is reflected, and not the fraction of $I_{i}$ reflected. Accordingly, both $R_{\perp}$ and $R_{\|}$ can equal 1 , and so the total reflectance for natural light is given by
$$
R=\frac{1}{2}\left(R_{\|}+R_{\perp}\right)\tag{4.66}
$$

For a rigorous proof of this equation see Section 8.6.1.

#### EXAMPLE 4.5

Light impinges on a slab of glass in air at the polarization angle $\theta_{p}$. Assume that the net transmittance is known to be 0.86 , and the incoming light is unpolarized. (a) Determine the percent of the incident power that is reflected. (b) If 1000 W comes in, how much power is transmitted with its $E$-field perpendicular to the plane-of-incidence?

#### SOLUTION

(a) We are given that $T=0.86$ and that since the beam is unpolarized half the light is perpendicular to the plane of incidence and half is parallel to it. Hence since both $T_{\|}$and $T_{\perp}$ can be 1.0 , for unpolarized light
$$
T=\frac{1}{2}\left(T_{\|}+T_{\perp}\right)
$$

Here $\theta_{i}=\theta_{p}$ and so from Fig. $4.56 T_{\|}=1.0$; all the light whose electric field is parallel to the plane of incidence is transmitted. Hence
$$
T=\frac{1}{2}\left(1+T_{\perp}\right)=0.86
$$

and for the perpendicular light
$$
T_{\perp}=1.72-1=0.72
$$

Since
$$
\begin{gathered}
R_{\perp}+T_{\perp}=1 \\
R_{\perp}=1-T_{\perp}=0.28
\end{gathered}
$$

and the net reflected fraction is
$$
\begin{gathered}
R=\frac{1}{2}\left(R_{\|}+R_{\perp}\right)=\frac{1}{2} R_{\perp} \\
R=0.14=14 \%
\end{gathered}
$$

(b) Given 1000 W incoming, half of that, or 500 W , is perpendicular to the incident plane. Of this $72 \%$ is transmitted, since $T_{\perp}=0.72$. Hence the power transmitted with its $E$-field perpendicular to the plane-of-incidence is
$$
0.72 \times 500 \mathrm{~W}=360 \mathrm{~W}
$$

When $\theta_{i}=0$, the incident plane becomes undefined, and any distinction between the parallel and perpendicular components of $R$ and $T$ vanishes. 

![400](4-Optics/images/img-73.jpeg.png)
> At near-normal incidence about $4 \%$ of the light is reflected back off each air-glass interface. Here because it's a lot brighter outside than inside the building, you have no trouble seeing the photographer who is outside looking in. (E.H.)

In this case Eqs. (4.61) through (4.64), along with (4.47) and (4.48), lead to
$$
R=R_{S}=R_{\perp}=\left(\frac{n_{t}-n_{i}}{n_{t}+n_{i}}\right)^{2}\tag{4.67}
$$

and
$$
T=T_{S}=T_{\perp}=\frac{4 n_{t} n_{i}}{\left(n_{t}+n_{i}\right)^{2}}\tag{4.68}
$$

Thus $4 \%$ of the light incident normally on an air-glass $\left(n_{g}=1.5\right)$ interface will be reflected back, whether internally, $n_{i}>n_{t}$, or externally, $n_{i}<n_{t}$ (Problem 4.70). This will be of concern to anyone who is working with a complicated lens system, which might have 10 or 20 such air-glass boundaries. Indeed, if you look perpendicularly into a stack of about 50 microscope slides (cover-glass sliders are much thinner and easier to handle in large quantities), most of the light will be reflected. The stack will look very much like a mirror (see photo). Roll up a thin sheet of clear plastic into a multiturned cylinder and it too will look like shiny metal. 
![400](4-Optics/images/img-74.jpeg.png)
> Near-normal reflection off a stack of microscope slides. You can see the image of the camera that took the picture. (E.H.)

![470](4-Optics/images/img-75.jpeg.png)
> Figure 4.57 Reflectance at normal incidence in air $\left(n_{i}=1.0\right)$ at a single interface.

The many interfaces produce a large number of closely spaced specular reflections that send much of the light back into the incident medium, more or less, as if it had undergone a single frequency-independent reflection. A smooth gray-metal surface does pretty much the same thing-it has a large, frequency-independent specular reflectance-and looks shiny (that's what "shiny" is). If the reflection is diffuse, the surface will appear gray or even white if the reflectance is large enough.

Figure 4.57 is a plot of the reflectance at a single interface, assuming normal incidence for various transmitting media in air. Figure 4.58 depicts the corresponding dependence of the transmittance at normal incidence on the number of interfaces and the index of the medium. Of course, this is why you can't see through a roll of "clear" smooth-surfaced plastic tape, and it's also why the many elements in a periscope must be coated with antireflection films (Section 9.9.2).
![530](4-Optics/images/img-76.jpeg.png)
> Figure 4.58 Transmittance through a number of surfaces in air $\left(n_{i}=1.0\right)$ at normal incidence.

#### EXAMPLE 4.6

Consider a beam of unpolarized light in air arriving at the flat surface of a glass sheet $(n=1.50)$ at the polarization angle $\theta_{p}$. Considering Fig. 4.49 and the $E$-field oscillating parallel to the incident plane, determine $R_{\|}$and then show by direct computation that $T_{\|}=1.0$. Since $r_{\|}=0$, why is $t_{\|} \neq 1$ ?

#### SOLUTION

From Eq. (4.62)
$$
R_{\|}=r_{\|}^{2} \quad \text { and } \quad r_{\|}=0
$$
hence
$$
R_{\|}=0
$$
and no light is reflected. On the other hand, from Eq. (4.64)
$$
T_{\|}=\left(\frac{n_{I} \cos \theta_{I}}{n_{I} \cos \theta_{I}}\right) r_{\|}^{2}
$$
Using Fig. 4.49 and Eq. $4.41 t_{\|}=0.667$ at $\theta_{I}=\theta_{p}=56.3^{\circ}$, and since $\theta_{I}+\theta_{I}=90.0^{\circ}, \theta_{I}=33.7^{\circ}$, consequently
$$
\begin{gathered}
T_{\|}=\frac{1.5 \cos 33.7^{\circ}}{1.0 \cos 56.3^{\circ}}(0.667)^{2} \\
T_{\|}=1.00
\end{gathered}
$$

All the light is transmitted. Conservation of energy in a lossless medium tells us that $R_{\|}+T_{\|}=1$; it does not say that $r_{\|}+t_{\|}=1$.

---


## 4.6 电磁理论方法 (The Electromagnetic Approach)
[!电磁理论方法 (The Electromagnetic Approach)]-

到目前为止，我们已经从散射理论、马吕斯-杜平定理以及费马原理等不同角度研究了光的反射和折射。然而， #电磁理论 ( #Electromagnetic-Theory ) 提供了一种更强大、更根本的分析方法。与之前那些无法告诉我们入射、反射和透射的 #辐射通量密度 ( #Radiant-Flux-Density )（即各自的光强度 $I_i, I_r, I_t$）之间具体关系的理论不同，电磁理论在一个远为完备的框架内，将这些问题一并解决了。它不仅能告诉我们光走向何方，还能精确计算出有多少光被反射、有多少光被透射，以及它们各自的相位变化。

### 4.6.1 介质交界面上的波 (Waves at an Interface)
#### 4.6.1.1 波函数的数学描述
想象一束理想的单色光波，它是一种 #平面波 ( #Plane-Wave )，正向一个两种介质的平滑交界面传播。我们可以用一个数学函数来精确描述这束光的电场。在物理学中，我们通常用复数指数形式来表示波动，因为它在数学处理上（尤其是在求微分和积分时）比用余弦函数方便得多。

这束入射光的电场可以写为：
$$
\overrightarrow{\mathbf{E}}_{i}=\overrightarrow{\mathbf{E}}_{0 i} \exp \left[i\left(\overrightarrow{\mathbf{k}}_{i} \cdot \overrightarrow{\mathbf{r}}-\omega_{i} t\right)\right]\tag{4.11}
$$

我们来逐一拆解这个公式的物理含义：
- $\overrightarrow{\mathbf{E}}_{i}$：表示在空间位置 $\overrightarrow{\mathbf{r}}$ 和时间 $t$ 的**瞬时电场矢量**。
- $\overrightarrow{\mathbf{E}}_{0 i}$：表示电场的**振幅矢量**，它是一个常数矢量，决定了这束光的最大电场强度和偏振方向。我们假设这束光是 #线性偏振 ( #Linearly-Polarized ) 或 #平面偏振 ( #Plane-Polarized ) 的，这意味着电场振动的方向始终在一个固定的平面内。我们将在第8章学到，任何偏振状态的光都可以分解为两个正交的线性偏振光，所以这个假设并不失一般性。
- $\exp[\dots]$：这是包含相位信息的振荡项。
- $\overrightarrow{\mathbf{k}}_{i}$：这是入射波的 #波矢量 ( #Wave-Vector )。它的方向指向波传播的方向，其大小 $k = 2\pi/\lambda$（其中 $\lambda$ 是波长），代表了**空间频率**，即每单位长度上波经历了多少个周期的相位变化。
- $\overrightarrow{\mathbf{r}}$：是从坐标原点 $O$ 指向空间某一点的**位置矢量**。
- $\omega_{i}$：是入射波的 #角频率 ( #Angular-Frequency )，它与频率 $f$ 的关系是 $\omega = 2\pi f$，代表了**时间频率**，即每单位时间内相位变化的快慢。
- $\overrightarrow{\mathbf{k}}_{i} \cdot \overrightarrow{\mathbf{r}}-\omega_{i} t$：这是波的**相位**。所有相位相同的点构成的面，我们称之为 #波前 ( #Wavefront ) 或等相面。对于平面波，等相面就是垂直于波矢量 $\overrightarrow{\mathbf{k}}$ 的一个个平面。

当然，电场是真实存在的物理量，所以我们实际上取的是这个复数表达式的实部。这等价于用余弦函数来描述：
$$
\overrightarrow{\mathbf{E}}_{i}=\overrightarrow{\mathbf{E}}_{0 i} \cos \left(\overrightarrow{\mathbf{k}}_{i} \cdot \overrightarrow{\mathbf{r}}-\omega_{i} t\right)\tag{4.12}
$$

当这束入射光到达介质交界面时，一部分光会被反射回来，另一部分会进入第二种介质并发生折射（透射）。我们同样可以用类似的形式来描述反射波和透射波的电场，但暂时对它们的振幅、频率、波矢、相位等一无所知：
$$
\overrightarrow{\mathbf{E}}_{r}=\overrightarrow{\mathbf{E}}_{0 r} \cos \left(\overrightarrow{\mathbf{k}}_{r} \cdot \overrightarrow{\mathbf{r}}-\omega_{r} t+\varepsilon_{r}\right)\tag{4.13}
$$
$$
\overrightarrow{\mathbf{E}}_{t}=\overrightarrow{\mathbf{E}}_{0 t} \cos \left(\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}-\omega_{t} t+\varepsilon_{t}\right)\tag{4.14}
$$
这里，$\varepsilon_{r}$ 和 $\varepsilon_{t}$ 是相对于入射波的 #相位常数 ( #Phase-Constants )。引入它们是因为我们选择的坐标原点是任意的，不同的原点选择会导致初始相位的不同。这些常数确保了无论原点在哪里，物理关系都成立。

下图描绘了这一物理过程：

![490](4-Optics/images/img-57.jpeg.png)
> 图 4.45 平面波入射到两种均匀、各向同性、无损耗的电介质的交界面上。

#### 4.6.1.2 边界条件：连接两个世界的桥梁
电磁理论的精髓——麦克斯韦方程组——告诉我们，电场和磁场在通过不同介质的交界面时，并不是随心所欲的，它们必须满足特定的 #边界条件 ( #Boundary-Conditions )。这些条件就像是连接两个介质世界的“法律”，确保了场在界面两侧的平滑过渡。

**边界条件1：电场切向分量连续**
这个条件源于法拉第电磁感应定律。我们来看下图：

![300](4-Optics/images/img-58.jpeg.png)
> 图 4.46 两种电介质交界面上的边界条件

想象在交界面的两侧画一个非常非常扁的矩形闭合回路 $C$（图中的虚线框）。法拉第感应定律告诉我们，沿这个回路对电场 $\overrightarrow{\mathbf{E}}$ 进行线积分（即 $\oint_C \overrightarrow{\mathbf{E}} \cdot d\overrightarrow{\ell}$），其结果等于穿过这个回路面积的磁通量随时间的变化率的负值。

现在，关键来了：如果我们让这个矩形回路的高度趋近于零，那么穿过它的面积也就趋近于零，因此磁通量也为零，磁通量的变化率自然也是零。这意味着电场的环路积分为零。

$\oint_C \overrightarrow{\mathbf{E}} \cdot d\overrightarrow{\ell} = (E_{1, \text{tan}} \cdot L) - (E_{2, \text{tan}} \cdot L) = 0$

其中 $E_{1, \text{tan}}$ 和 $E_{2, \text{tan}}$ 分别是界面上方和下方的电场切向分量，L是回路的长度。这个等式成立的唯一可能是 $E_{1, \text{tan}} = E_{2, \text{tan}}$。

也就是说，**在介质交界面的任意一点，紧贴界面上方的电场切向分量必须等于紧贴界面下方的电场切向分量**。

在我们的问题中，界面两侧的总电场分别是：
- 介质1 (入射介质): $\overrightarrow{\mathbf{E}}_{i} + \overrightarrow{\mathbf{E}}_{r}$
- 介质2 (透射介质): $\overrightarrow{\mathbf{E}}_{t}$

它们的切向分量必须相等。一个方便表示切向分量的方法是使用叉乘。如果 $\overrightarrow{\mathbf{u}}_{n}$ 是界面的单位法向量，那么任意矢量 $\overrightarrow{\mathbf{A}}$ 与 $\overrightarrow{\mathbf{u}}_{n}$ 的叉乘 $\overrightarrow{\mathbf{u}}_{n} \times \overrightarrow{\mathbf{A}}$ 得到的结果必然是平行于界面的（即切向的）。因此，这个边界条件可以写成：
$$
\overrightarrow{\mathbf{u}}_{n} \times \overrightarrow{\mathbf{E}}_{i}+\overrightarrow{\mathbf{u}}_{n} \times \overrightarrow{\mathbf{E}}_{r}=\overrightarrow{\mathbf{u}}_{n} \times \overrightarrow{\mathbf{E}}_{t}\tag{4.15}
$$
把波函数表达式代入，我们得到：
$$
\begin{aligned}
& \overrightarrow{\mathbf{u}}_{n} \times \overrightarrow{\mathbf{E}}_{0 i} \cos \left(\overrightarrow{\mathbf{k}}_{i} \cdot \overrightarrow{\mathbf{r}}-\omega_{i} t\right) \\
& +\overrightarrow{\mathbf{u}}_{n} \times \overrightarrow{\mathbf{E}}_{0 r} \cos \left(\overrightarrow{\mathbf{k}}_{r} \cdot \overrightarrow{\mathbf{r}}-\omega_{r} t+\varepsilon_{r}\right) \\
& \quad=\overrightarrow{\mathbf{u}}_{n} \times \overrightarrow{\mathbf{E}}_{0 t} \cos \left(\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}-\omega_{t} t+\varepsilon_{t}\right)
\end{aligned}\tag{4.16}
$$

#### 4.6.1.3 从边界条件到光学定律
这个等式 (4.16) 是我们推导一切的出发点。它必须在**任何时间 $t$** 和**界面上的任何位置 $\overrightarrow{\mathbf{r}}$** 都成立。这是一个非常强的约束！

为了让这个等式恒成立，唯一的可能性是所有余弦函数里的相位部分必须完全相同。如果它们的相位不同，那么随着时间和位置的变化，三个余弦函数会以不同的方式振荡，它们的和（或差）就不可能永远保持相等。

因此，我们必然得出结论：
$$
\begin{gathered}
\left.\left(\overrightarrow{\mathbf{k}}_{i} \cdot \overrightarrow{\mathbf{r}}-\omega_{i} t\right)\right|_{y=b}=\left.\left(\overrightarrow{\mathbf{k}}_{r} \cdot \overrightarrow{\mathbf{r}}-\omega_{r} t+\varepsilon_{r}\right)\right|_{y=b}
\\
=\left.\left(\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}-\omega_{t} t+\varepsilon_{t}\right)\right|_{y=b}
\end{gathered}\tag{4.17}
$$
这里的 $y=b$ 表示这个关系式是在界面上成立的。

**1. 频率不变**
首先，让我们关注相位中与时间 $t$ 相关的部分。为了让等式对所有 $t$ 都成立， $t$ 的系数必须相等：
$$
\omega_{i}=\omega_{r}=\omega_{t}\tag{4.18}
$$
**物理理解**：这个结论非常重要，它说明**反射和折射过程不会改变光的频率**。这很好理解：入射光就像一个驱动力，迫使界面处的介质原子（电子）以入射光的频率 $\omega_i$ 进行受迫振动。这些振动的原子继而向四面八方辐射电磁波，其中一部分形成了反射波，另一部分形成了透射波。由于这些原子本身就是以 $\omega_i$ 的频率在振动，它们辐射出的光自然也都是这个频率。所以，你看红色的玻璃，它透过的光依然是红光，频率没有变。

**2. 相位匹配与反射、折射定律**
既然频率相同，那么相位关系就只剩下与空间位置 $\overrightarrow{\mathbf{r}}$ 相关的部分了：
$$
\left.\left(\overrightarrow{\mathbf{k}}_{i} \cdot \overrightarrow{\mathbf{r}}\right)\right|_{y=b}=\left.\left(\overrightarrow{\mathbf{k}}_{r} \cdot \overrightarrow{\mathbf{r}}+\varepsilon_{r}\right)\right|_{y=b}=\left.\left(\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}+\varepsilon_{t}\right)\right|_{y=b}\tag{4.19}
$$
这个等式被称为**相位匹配条件**。它意味着在交界面上，入射波、反射波和透射波的波前必须“步调一致”。

* **推导反射定律**
    我们先看前两项：
    $$
    \left[\left(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{r}\right) \cdot \overrightarrow{\mathbf{r}}\right]_{y=b}=\varepsilon_{r}\tag{4.20}
    $$
    这个式子告诉我们，对于界面上所有的点 $\overrightarrow{\mathbf{r}}$，它们与矢量 $(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{r})$ 的点积都是一个常数。这在几何上意味着矢量 $(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{r})$ 必须垂直于交界面，也就是说，它与法向量 $\overrightarrow{\mathbf{u}}_{n}$ 平行。

    这个结论包含两个重要信息：
    a. **共面**：既然 $(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{r})$ 与法向量 $\overrightarrow{\mathbf{u}}_{n}$ 平行，那么 $\overrightarrow{\mathbf{k}}_{i}$、$\overrightarrow{\mathbf{k}}_{r}$ 和 $\overrightarrow{\mathbf{u}}_{n}$ 这三个矢量必然位于同一个平面内。这个平面就是我们所说的 #入射面 ( #Plane-of-Incidence )。这就是反射定律的第一部分：**入射线、反射线和法线在同一平面内**。

    b. **角度相等**：由于 $(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{r})$ 垂直于界面，它在界面内的切向分量为零。这意味着 $\overrightarrow{\mathbf{k}}_{i}$ 的切向分量和 $\overrightarrow{\mathbf{k}}_{r}$ 的切向分量必须相等。从几何上看，波矢量的切向分量大小为 $k \sin\theta$。所以：
    $$
    k_{i} \sin \theta_{i}=k_{r} \sin \theta_{r}
    $$
    因为入射波和反射波在同一种介质中，它们的波速相同，频率也相同，所以波长 $\lambda$ 和波矢量大小 $k=2\pi/\lambda$ 也必然相同，即 $k_i = k_r$。因此，上式简化为 $\sin \theta_{i} = \sin \theta_{r}$，从而得到：
    $$
    \theta_{i}=\theta_{r}
    $$
    这就是反射定律的第二部分：**反射角等于入射角**。

* **推导折射定律 (斯涅尔定律)**
    同理，我们考察入射波和透射波的关系：
    $$
    \left[\left(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{t}\right) \cdot \overrightarrow{\mathbf{r}}\right]_{y=b}=\varepsilon_{t}\tag{4.21}
    $$
    这同样意味着矢量 $(\overrightarrow{\mathbf{k}}_{i}-\overrightarrow{\mathbf{k}}_{t})$ 也必须垂直于交界面。
    a. **共面**：因此，$\overrightarrow{\mathbf{k}}_{i}$、$\overrightarrow{\mathbf{k}}_{t}$ 和法向量 $\overrightarrow{\mathbf{u}}_{n}$ 也都在同一个平面内，即**折射线（透射线）也在入射面内**。

    b. **角度关系**：$\overrightarrow{\mathbf{k}}_{i}$ 和 $\overrightarrow{\mathbf{k}}_{t}$ 的切向分量必须相等：
    $$
    k_{i} \sin \theta_{i}=k_{t} \sin \theta_{t}\tag{4.22}
    $$
    这次，入射波和透射波在不同的介质中，它们的波速不同 ($v_i \neq v_t$)，所以波矢量大小也不同 ($k_i \neq k_t$)。我们知道波矢量大小与折射率的关系是 $k = \frac{\omega}{v} = \frac{n\omega}{c}$。将这个关系代入上式：
    $$
    \frac{n_i \omega_i}{c} \sin \theta_{i} = \frac{n_t \omega_t}{c} \sin \theta_{t}
    $$
    因为我们已经知道 $\omega_i = \omega_t$，所以两边的 $\omega/c$ 可以消掉，最终得到：
    $$
    n_{i} \sin \theta_{i}=n_{t} \sin \theta_{t}
    $$
    这就是大名鼎鼎的 #斯涅尔定律 ( #Snell-s-Law )。

最后，如果我们聪明地把坐标原点 $O$ 就选在交界面上，那么当 $\overrightarrow{\mathbf{r}}=0$ 时，从式 (4.20) 和 (4.21) 就可以看出 $\varepsilon_r$ 和 $\varepsilon_t$ 都会等于零。这样做虽然不如之前的推导有启发性，但能让后续计算大大简化。从现在开始，我们就采用这种简化设定。

至此，我们已经从电磁理论最基本的边界条件出发，成功地推导出了几何光学的两大基本定律。这展示了电磁理论的强大威力。但它的能力远不止于此，接下来，我们要用它来计算反射和透射光的振幅。

### 4.6.2 菲涅尔方程 (The Fresnel Equations)
我们已经搞清楚了入射、反射、透射波在边界上的相位关系。现在，我们要来确定它们振幅 $\overrightarrow{\mathbf{E}}_{0i}, \overrightarrow{\mathbf{E}}_{0r}, \overrightarrow{\mathbf{E}}_{0t}$ 之间的定量关系。

解决这个问题的策略是：将入射光的电场分解为两个相互垂直的分量，一个**垂直于入射面**，另一个**平行于入射面**。然后我们分别对这两个分量进行分析，最后再把结果合起来。这种分解处理是物理学中解决矢量问题的常用技巧。

#### 4.6.2.1 情况1：电场 $\overrightarrow{\mathbf{E}}$ 垂直于入射面 (s-偏振)
我们首先考虑电场 $\overrightarrow{\mathbf{E}}$ 完全垂直于入射面的情况。在很多教材中，这被称为 **s-偏振** (s-polarization)，"s" 来自德语的 "senkrecht"，意为“垂直”。

![500](4-Optics/images/img-59.jpeg.png)
> 图 4.47 入射波的$\overrightarrow{\mathbf{E}}$场垂直于入射面。图中所示的场是界面处的场，为了看得清楚，将矢量画得稍微分开了些。

在这种情况下，入射、反射、透射波的电场矢量都指向纸外（或纸内）。根据电磁波的性质，磁场 $\overrightarrow{\mathbf{B}}$、电场 $\overrightarrow{\mathbf{E}}$ 和波矢 $\overrightarrow{\mathbf{k}}$ 构成一个右手螺旋关系，即 $\overrightarrow{\mathbf{k}} \times \overrightarrow{\mathbf{E}}$ 的方向就是 $\overrightarrow{\mathbf{B}}$ 的方向。因此，磁场 $\overrightarrow{\mathbf{B}}$ 必然位于入射面内。

现在我们应用边界条件：

1.  **电场切向分量连续**：
    由于所有电场矢量都垂直于入射面，它们本身就是切向分量（因为入射面是法线所在的平面，垂直于入射面的矢量必然平行于交界面）。因此，在界面上（$y=0$），总的电场必须连续：
    $$
    E_{0i} + E_{0r} = E_{0t}\tag{4.25}
    $$
    这里我们假设在某个瞬间，入射电场 $E_{0i}$ 指向纸外，并猜测反射电场 $E_{0r}$ 和透射电场 $E_{0t}$ 也指向纸外。如果我们的猜测是错的，最终计算出的结果会是一个负值，代表实际方向相反。

2.  **磁场相关量的切向分量连续**：
    除了电场，磁场也需要满足边界条件。对于非磁性材料，更普适的边界条件是**磁场强度 $\overrightarrow{\mathbf{H}} = \overrightarrow{\mathbf{B}}/\mu$ 的切向分量连续**。（这里的 $\mu$ 是 #磁导率 ( #Permeability )）。
    
    我们来看图 4.47 中各个磁场矢量在界面上的切向分量（即 x 分量）：
    - 入射磁场 $\overrightarrow{\mathbf{B}}_i$ 的切向分量是 $-B_i \cos\theta_i$。（负号是因为它指向 x 轴负方向）
    - 反射磁场 $\overrightarrow{\mathbf{B}}_r$ 的切向分量是 $B_r \cos\theta_r$。
    - 透射磁场 $\overrightarrow{\mathbf{B}}_t$ 的切向分量是 $-B_t \cos\theta_t$。

    根据 $\overrightarrow{\mathbf{H}}$ 切向分量连续的边界条件，我们有：
    $$
    \frac{1}{\mu_i}(-B_i \cos\theta_i + B_r \cos\theta_r) = \frac{1}{\mu_t}(-B_t \cos\theta_t)
    $$
    整理一下符号：
    $$
    -\frac{B_{i}}{\mu_{i}} \cos \theta_{i}+\frac{B_{r}}{\mu_{i}} \cos \theta_{r}=-\frac{B_{t}}{\mu_{t}} \cos \theta_{t}\tag{4.26}
    $$
    我们知道，在电磁波中，电场和磁场的振幅关系为 $B = E/v = nE/c$，其中 $v$ 是波速，$n$ 是折射率。将 $B_i=E_i/v_i$, $B_r=E_r/v_r$, $B_t=E_t/v_t$ 代入上式，并注意到 $v_i=v_r$ 和 $\theta_i=\theta_r$：
    $$
    \frac{1}{\mu_{i} v_{i}}\left(E_{i}-E_{r}\right) \cos \theta_{i}=\frac{1}{\mu_{t} v_{t}} E_{t} \cos \theta_{t}\tag{4.30}
    $$
    再利用 $v=c/n$，上式变为：
    $$
    \frac{n_{i}}{\mu_{i} c}\left(E_{0i}-E_{0r}\right) \cos \theta_{i}=\frac{n_{t}}{\mu_{t} c} E_{0t} \cos \theta_{t}\tag{4.31}
    $$
    现在我们有两个方程 (4.25) 和 (4.31)，以及三个未知振幅 $E_{0i}, E_{0r}, E_{0t}$。我们可以解出反射振幅和透射振幅与入射振幅的比值。将 (4.25) 的 $E_{0t} = E_{0i} + E_{0r}$ 代入 (4.31)：
    $$
    \frac{n_{i}}{\mu_{i}}\left(E_{0i}-E_{0r}\right) \cos \theta_{i}=\frac{n_{t}}{\mu_{t}} (E_{0i} + E_{0r}) \cos \theta_{t}
    $$
    展开并整理，把含 $E_{0r}$ 的项移到一边，含 $E_{0i}$ 的项移到另一边：
    $$
    E_{0i} \left( \frac{n_i}{\mu_i}\cos\theta_i - \frac{n_t}{\mu_t}\cos\theta_t \right) = E_{0r} \left( \frac{n_i}{\mu_i}\cos\theta_i + \frac{n_t}{\mu_t}\cos\theta_t \right)
    $$
    于是我们得到了反射振幅与入射振幅的比值，即 #振幅反射系数 ( #Amplitude-Reflection-Coefficient )：
    $$
    \left(\frac{E_{0 r}}{E_{0 i}}\right)_{\perp}=\frac{\frac{n_{i}}{\mu_{i}} \cos \theta_{i}-\frac{n_{t}}{\mu_{t}} \cos \theta_{t}}{\frac{n_{i}}{\mu_{i}} \cos \theta_{i}+\frac{n_{t}}{\mu_{t}} \cos \theta_{t}}\tag{4.32}
    $$
    同样，我们也可以解出 #振幅透射系数 ( #Amplitude-Transmission-Coefficient )：
    $$
    \left(\frac{E_{0 t}}{E_{0 i}}\right)_{\perp}=\frac{2 \frac{n_{i}}{\mu_{i}} \cos \theta_{i}}{\frac{n_{i}}{\mu_{i}} \cos \theta_{i}+\frac{n_{t}}{\mu_{t}} \cos \theta_{t}}\tag{4.33}
    $$
    在光学中，我们遇到的大多数材料都是电介质，它们的磁导率非常接近真空磁导率 $\mu_0$，即 $\mu_i \approx \mu_t \approx \mu_0$。在这种常见情况下，公式可以简化为：
    $$
    \boxed{r_{\perp} \equiv\left(\frac{E_{0 r}}{E_{0 i}}\right)_{\perp}=\frac{n_{i} \cos \theta_{i}-n_{t} \cos \theta_{t}}{n_{i} \cos \theta_{i}+n_{t} \cos \theta_{t}}}\tag{4.34}
    $$
    $$
    \boxed{t_{\perp} \equiv\left(\frac{E_{0 t}}{E_{0 i}}\right)_{\perp}=\frac{2 n_{i} \cos \theta_{i}}{n_{i} \cos \theta_{i}+n_{t} \cos \theta_{t}}}\tag{4.35}
    $$
    这里的 $r_{\perp}$ 和 $t_{\perp}$ 就是s-偏振光（电场垂直于入射面）的菲涅尔系数。

#### 4.6.2.2 情况2：电场 $\overrightarrow{\mathbf{E}}$ 平行于入射面 (p-偏振)
现在我们分析第二种情况：电场 $\overrightarrow{\mathbf{E}}$ 位于入射面内。这被称为 **p-偏振** (p-polarization)，"p" 代表 "parallel"（平行）。

![460](4-Optics/images/img-60.jpeg.png)
> 图 4.48 入射波的$\overrightarrow{\mathbf{E}}$场在入射面内。

此时，磁场 $\overrightarrow{\mathbf{B}}$ 将完全垂直于入射面，指向纸外或纸内。我们再次应用边界条件：

1.  **电场切向分量连续**：
    这次电场矢量本身并不完全是切向的，我们需要取它们在界面上的投影。
    - 入射电场切向分量: $E_{0i} \cos\theta_i$
    - 反射电场切向分量: $-E_{0r} \cos\theta_r$ (注意图中 $E_{0r}$ 的方向，其水平分量指向x轴负方向)
    - 透射电场切向分量: $E_{0t} \cos\theta_t$
    
    为了与原文的推导保持一致，我们观察图4.48中作者对反射电场方向的假定。作者假定其切向分量与入射电场的切向分量方向相反。然而，原文的公式(4.36) `E_0i cos(theta_i) - E_0r cos(theta_r) = E_0t cos(theta_t)` 暗示了作者将 $E_{0r}$ 定义为图示方向的**大小**，并且其切向分量与 $E_{0i}$ 的切向分量方向相反。为了更清晰，我们重新定义矢量方向。让我们假设所有场的切向分量都指向+x方向。那么在边界上，总的切向场应该是： $(E_{i, \text{tan}} + E_{r, \text{tan}}) = E_{t, \text{tan}}$。
    根据图4.48，
    $E_{i, \text{tan}} = E_{0i} \cos\theta_i$
    $E_{r, \text{tan}} = E_{0r} \cos\theta_r$ (注意，这里的 $E_{0r}$ 是振幅大小，图示方向的切向分量是正的)
    $E_{t, \text{tan}} = E_{0t} \cos\theta_t$
    
    然而，为了与原文公式(4.36)和最终结果(4.40)的符号一致，我们必须严格遵循原文的隐含约定。原文在图4.48中画出的$\overrightarrow{\mathbf{E}}_{0r}$方向，其切向分量是向右的。但是公式(4.36)中却写作 $E_{0i} \cos \theta_{i}-E_{0r} \cos \theta_{r}=E_{0t} \cos \theta_{t}$。这表明作者在代数处理时，将 $E_{0r}$ 前面放了一个负号，这意味着他预设的 $E_{0r}$ 的“正方向”的切向分量是指向左的。这是一个非常容易混淆的地方！让我们遵循原文的公式，它实际上是正确的，只是矢量方向的定义有些不直观。
    
    正确的边界条件是：左侧总切向场 = 右侧总切向场。
    $ (E_{0i} \cos\theta_i) + (-E_{0r} \cos\theta_r) = E_{0t} \cos\theta_t $
    这里的 $E_{0r}$ 是反射波振幅的大小，负号表示其切向分量与入射波的切向分量相反（根据图示，这显然是错误的，但这是为了得到标准菲涅尔方程的一种符号约定）。一个更清晰的理解是：我们始终坚持 $E_{i,tan} + E_{r,tan} = E_{t,tan}$。如果最终算出的 $E_{0r}$ 是负值，就说明其切向分量与我们最初假设的方向相反。让我们采用原文的公式，并记住这个符号约定。
    $$
    E_{0 i} \cos \theta_{i}-E_{0 r} \cos \theta_{r}=E_{0 t} \cos \theta_{t}\tag{4.36}
    $$

2.  **磁场相关量的切向分量连续**：
    这次磁场 $\overrightarrow{\mathbf{B}}$ 垂直于入射面，所以它们本身就是切向分量。根据图示和右手定则，$\overrightarrow{\mathbf{B}}_i, \overrightarrow{\mathbf{B}}_r, \overrightarrow{\mathbf{B}}_t$ 都指向纸外（正z方向）。
    $$
    \frac{B_{0i}}{\mu_i} + \frac{B_{0r}}{\mu_r} = \frac{B_{0t}}{\mu_t}
    $$
    代入 $B=E/v=nE/c$ 和 $\mu_i=\mu_r$：
    $$
    \frac{n_i}{\mu_i c}E_{0i} + \frac{n_i}{\mu_i c}E_{0r} = \frac{n_t}{\mu_t c}E_{0t}
    $$
    $$
    \frac{n_i}{\mu_i}(E_{0i} + E_{0r}) = \frac{n_t}{\mu_t}E_{0t}\tag{4.37}
    $$
    
    联立求解方程 (4.36) 和 (4.37)，经过类似的代数运算，我们可以得到 p-偏振光的菲涅尔系数：
    $$
    r_{\|} \equiv\left(\frac{E_{0 r}}{E_{0 i}}\right)_{\|}=\frac{n_{t} \cos \theta_{i}-n_{i} \cos \theta_{t}}{n_{i} \cos \theta_{t}+n_{t} \cos \theta_{i}}\tag{4.38}
    $$
    $$
    t_{\|}=\left(\frac{E_{0 t}}{E_{0 i}}\right)_{\|}=\frac{2 n_{i} \cos \theta_{i}}{n_{i} \cos \theta_{t}+n_{t} \cos \theta_{i}}\tag{4.39}
    $$
    *注意：这里的 $E_{0r}$ 和 $E_{0i}$ 指的是电场振幅的大小。$r_\|$ 的符号取决于分子。*
    
    同样，对于常见的非磁性电介质（$\mu_i \approx \mu_t \approx \mu_0$），公式简化为：
    $$
    \boxed{r_{\|}=\frac{n_{t} \cos \theta_{i}-n_{i} \cos \theta_{t}}{n_{i} \cos \theta_{t}+n_{t} \cos \theta_{i}}}\tag{4.40}
    $$
    $$
    \boxed{t_{\|}=\frac{2 n_{i} \cos \theta_{i}}{n_{i} \cos \theta_{t}+n_{t} \cos \theta_{i}}}\tag{4.41}
    $$

#### 4.6.2.3 菲涅尔方程的三角函数形式
利用斯涅尔定律 $n_i \sin\theta_i = n_t \sin\theta_t$，上述四个核心的菲涅尔方程可以被改写成一种更简洁、更优美的三角函数形式。这个推导过程本身是很好的三角函数练习（见问题4.43）。
$$
r_{\perp}=-\frac{\sin \left(\theta_{i}-\theta_{t}\right)}{\sin \left(\theta_{i}+\theta_{t}\right)}\tag{4.42}
$$
$$
r_{\|}=+\frac{\tan \left(\theta_{i}-\theta_{t}\right)}{\tan \left(\theta_{i}+\theta_{t}\right)}\tag{4.43}
$$
$$
t_{\perp}=+\frac{2 \sin \theta_{t} \cos \theta_{i}}{\sin \left(\theta_{i}+\theta_{t}\right)}\tag{4.44}
$$
$$
t_{\|}=+\frac{2 \sin \theta_{t} \cos \theta_{i}}{\sin \left(\theta_{i}+\theta_{t}\right) \cos \left(\theta_{i}-\theta_{t}\right)}\tag{4.45}
$$
**一个重要的提醒**：这些公式中的正负号与我们最初假设的电场方向（图4.47和4.48）密切相关。例如，在图4.47中，我们假设 $\overrightarrow{\mathbf{E}}_{0r}$ 指向纸外，但计算出的 $r_{\perp}$ (式4.42) 对于常见情况（如光从空气射入玻璃）总是负的。这说明我们猜错了，实际的反射电场方向是**指向纸内**的，与入射电场方向相反，存在一个180度的相位差。不同的教科书可能会采用不同的初始方向假设，从而得到符号略有不同的菲涅尔方程。因此，在使用这些公式时，一定要清楚它们是基于哪种场方向定义推导出来的。

#### 示例 4.4
一束电磁波振幅为 1.0 V/m，在空气中以与法线成 30.0° 的角度入射到折射率为 1.60 的玻璃板上。波的电场完全垂直于入射面。求反射波的振幅。

**解答**
这是一个典型的s-偏振问题。我们要求的是 $(E_{0r})_\perp$。
根据公式 $(E_{0r})_\perp = r_\perp (E_{0i})_\perp$，我们首先需要计算振幅反射系数 $r_\perp$。
使用三角函数形式的菲涅尔方程最为方便：
$$
r_{\perp}=-\frac{\sin \left(\theta_{i}-\theta_{t}\right)}{\sin \left(\theta_{i}+\theta_{t}\right)}\tag{4.42}
$$
已知：
- 入射介质是空气, $n_i \approx 1.00$
- 透射介质是玻璃, $n_t = 1.60$
- 入射角, $\theta_i = 30.0^\circ$
- 入射振幅, $(E_{0i})_\perp = 1.0 \text{ V/m}$

首先，我们需要用斯涅尔定律计算折射角 $\theta_t$：
$$
n_{i} \sin \theta_{i}=n_{t} \sin \theta_{t}
$$
$$
\sin \theta_{t}=\frac{n_{i}}{n_{t}} \sin \theta_{i} = \frac{1.00}{1.60} \sin 30.0^{\circ} = \frac{1}{1.60} \times 0.5 = 0.3125
$$
$$
\theta_{t}=\arcsin(0.3125) \approx 18.21^{\circ}
$$
现在，将角度代入 $r_\perp$ 的公式：
$$
r_{\perp}=-\frac{\sin \left(30.0^{\circ}-18.21^{\circ}\right)}{\sin \left(30.0^{\circ}+18.21^{\circ}\right)}=-\frac{\sin 11.79^{\circ}}{\sin 48.21^{\circ}}
$$
$$
r_{\perp}=-\frac{0.2044}{0.7455} \approx -0.274
$$
最后，计算反射波的振幅：
$$
(E_{0r})_{\perp}=r_{\perp} (E_{0i})_{\perp} = -0.274 \times (1.0 \text{ V/m}) = -0.274 \text{ V/m}
$$
**结果解读**：反射波的振幅大小是 0.274 V/m。负号的物理意义非常重要，它表示反射波的电场方向与我们最初在图4.47中假设的方向相反。如果入射电场指向纸外，那么反射电场就指向纸内。这相当于一个 $\pi$ (180°) 的 #相位反转 ( #Phase-Reversal )。

---

### 4.6.3 菲涅尔方程的物理解读 (Interpretation of the Fresnel Equations)
菲涅尔方程不仅是数学公式，它们蕴含着丰富的物理现象。现在，我们来深入解读这些方程，看看它们如何描述反射和透射的振幅、能量分配以及相位变化。

#### 4.6.3.1 振幅系数随角度的变化
让我们来考察振幅系数 $r_\perp$ 和 $r_\|$ 如何随着入射角 $\theta_i$ 从 0° (垂直入射) 变化到 90° (掠射)。

* **近乎垂直入射 ($\theta_i \approx 0$)**

    当 $\theta_i$ 非常小时，$\theta_t$ 也非常小。根据斯涅尔定律 $n_i\theta_i \approx n_t\theta_t$。此时，$\sin x \approx \tan x \approx x$。
    我们来看 $r_\|$ 和 $r_\perp$ 的三角形式在 $\theta_i \to 0$ 时的极限：
    $$
    [r_{\|}]_{\theta_i=0} = \left[\frac{\tan(\theta_i-\theta_t)}{\tan(\theta_i+\theta_t)}\right]_{\theta_i=0} \approx \frac{\theta_i-\theta_t}{\theta_i+\theta_t} = \frac{\theta_i - (n_i/n_t)\theta_i}{\theta_i + (n_i/n_t)\theta_i} = \frac{1-n_i/n_t}{1+n_i/n_t} = \frac{n_t-n_i}{n_t+n_i}
    $$
    $$
    [-r_{\perp}]_{\theta_i=0} = \left[\frac{\sin(\theta_i-\theta_t)}{\sin(\theta_i+\theta_t)}\right]_{\theta_i=0} \approx \frac{\theta_i-\theta_t}{\theta_i+\theta_t} = \frac{n_t-n_i}{n_t+n_i}
    $$
    所以，在垂直入射时：
    $$
    \boxed{\left[r_{\|}\right]_{\theta_{i}=0}=\left[-r_{\perp}\right]_{\theta_{i}=0}=\frac{n_{t}-n_{i}}{n_{t}+n_{i}}}\tag{4.47}
    $$
    这个结果说明，在垂直入射时，p-偏振和s-偏振的反射系数大小相等，但符号相反。这仅仅是由于我们定义场矢量方向的约定造成的。物理上，由于此时入射面不确定，两种偏振之间没有区别。例如，对于空气($n_i=1$)到玻璃($n_t=1.5$)的垂直入射，反射系数 $r$ 的大小为 $(1.5-1)/(1.5+1) = 0.5/2.5 = 0.2$。这意味着大约20%的电场振幅被反射。

![450](4-Optics/images/img-61.jpeg.png)
> 未染色的纸张是大量细小透明纤维的集合，其折射率（约1.56）与周围空气的折射率显著不同。因此，纸张会大量散射白光，呈现出明亮不透明的白色——参见公式(4.46)。如果我们现在用某种折射率介于空气和纤维之间的液体（例如矿物油，婴儿油，折射率约1.46）浸湿纸张，它会减少反向散射的光量，处理过的区域会变得基本透明。(E.H.)

* **外部反射 ($n_t > n_i$)**

    这是光从“稀疏”介质射向“稠密”介质的情况，例如从空气到水或玻璃。我们来看下图：

    ![490](4-Optics/images/img-63.jpeg.png)
    > 图 4.49 反射和透射的振幅系数随入射角的变化。对应于外部反射 $n_t > n_i$，例如空气-玻璃界面 ($n_t/n_i = 1.5$)。

    - **$r_{\perp}$ (s-偏振)**: 从图上可以看出，$r_\perp$ 从垂直入射时的负值开始，随着 $\theta_i$ 增大，其绝对值逐渐增大，到 $\theta_i=90^\circ$ (掠射) 时达到 -1。它始终是负的，意味着对于任意角度的外部反射，s-偏振光总会经历一个 $\pi$ 的相位反转。
    - **$r_{\|}$ (p-偏振)**: $r_\|$ 的行为更有趣。它从一个正值开始，随着 $\theta_i$ 增大而减小。在某个特定的角度，它会减小到**零**！这个特殊的角度被称为 #偏振角 ( #Polarization-Angle ) 或 #布儒斯特角 ( #Brewster-s-Angle )，记为 $\theta_p$ 或 $\theta_B$。当 $\theta_i = \theta_p$ 时，$\tan(\theta_i+\theta_t) \to \infty$，即 $\theta_i+\theta_t = 90^\circ$。此时，p-偏振光将完全透射，没有任何反射！这个现象是制造偏振片的原理之一。当 $\theta_i$ 超过 $\theta_p$ 后，$r_\|$ 变为负值，并逐渐趋近于 -1。

    **生活中的观察**：拿一片玻璃（比如手机屏幕），正对着它看，你会看到自己的倒影，但不是很亮。现在，把玻璃倾斜，让你的视线以一个很大的角度（接近掠射）看过去，你会发现玻璃变得像一面镜子，反射非常强烈。这就是因为当 $\theta_i \to 90^\circ$ 时，$|r_\perp|$ 和 $|r_\||$ 都趋近于1。

![350](4-Optics/images/img-64.jpeg.png)
> 在近乎掠射的角度下，墙壁和地板变得像镜子一样。尽管这些表面在$\theta_{i}=0^{\circ}$时是相当差的反射体。(E.H.)

* **内部反射 ($n_i > n_t$)**

    这是光从“稠密”介质射向“稀疏”介质的情况，例如从水或玻璃射向空气。

    ![490](4-Optics/images/img-65.jpeg.png)
    > 图 4.50 反射的振幅系数随入射角的变化。对应于内部反射 $n_t < n_i$，例如玻璃-空气界面 ($n_t/n_i = 1/1.5$)。

    - **临界角 (Critical Angle, $\theta_c$)**: 在这种情况下，由于 $n_i > n_t$，折射角 $\theta_t$ 会大于入射角 $\theta_i$。当 $\theta_i$ 增大到某个值使得 $\theta_t = 90^\circ$ 时，这个入射角就是 #临界角 ( #Critical-Angle ) $\theta_c$。根据斯涅尔定律，$\sin\theta_c = n_t/n_i$。
    - **全内反射 (Total Internal Reflection, TIR)**: 当入射角 $\theta_i > \theta_c$ 时，斯涅尔定律要求 $\sin\theta_t = (n_i/n_t)\sin\theta_i > 1$，这对于实数角 $\theta_t$ 是不可能的。这意味着光无法透射出去，所有的能量都被反射回第一介质，这种现象称为 #全内反射 ( #Total-Internal-Reflection )。此时，反射系数 $r_\perp$ 和 $r_\|$ 的模都等于1，但它们变成了复数，表示反射光相对于入射光有了一个非 0 或 $\pi$ 的相位偏移。
    - **$r_\perp$ 和 $r_\|$ 的行为**: 从图4.50可以看出，在 $\theta_i < \theta_c$ 的范围内，$r_\perp$ 始终为正，而 $r_\|$ 从负值开始，在某个角度 $\theta_p'$ (内部反射的布儒斯特角) 穿过零点变为正值，最后在 $\theta_c$ 处，$r_\perp$ 和 $r_\|$ 都达到了 +1。

#### 4.6.3.2 相位移动 (Phase Shifts)
振幅系数的正负号直接关系到反射和透射过程中的相位变化。
- **正号**：表示反射波（或透射波）的场矢量方向与我们最初假设的方向一致，相位变化为0。
- **负号**：表示实际的场矢量方向与假设相反，相位变化为 $\pi$ (180°)。

下图总结了外部反射和内部反射中，s-偏振($\perp$)和p-偏振($\|$)分量的相位移动 $\Delta\varphi$。

![480](4-Optics/images/img-67.jpeg.png)
> 图 4.52 对应于外部和内部反射的$\overrightarrow{\mathbf{E}}$场平行和垂直分量的相移。

**外部反射 ($n_i < n_t$)**:
- $\Delta\varphi_\perp$ (s-偏振): 始终为 $\pi$。
- $\Delta\varphi_\|$ (p-偏振): 在 $0 \le \theta_i < \theta_p$ 范围内为 0；在 $\theta_i > \theta_p$ 范围内为 $\pi$。在 $\theta_p$ 处，振幅为0，相位发生突变。

**内部反射 ($n_i > n_t$)**:
- $\Delta\varphi_\perp$ (s-偏振): 在 $0 \le \theta_i < \theta_c$ 范围内为 0。当 $\theta_i > \theta_c$ (TIR) 时，相位从0开始平滑地增加到 $\pi$。
- $\Delta\varphi_\|$ (p-偏振): 在 $0 \le \theta_i < \theta_p'$ 范围内为 $\pi$；在 $\theta_p' < \theta_i < \theta_c$ 范围内为 0。当 $\theta_i > \theta_c$ (TIR) 时，相位从 $-\pi$ (或等效的 $+\pi$) 开始平滑地减小到 0。

下图直观地展示了在不同入射角下，反射波电场矢量的方向和相对大小。

![img-68.jpeg](4-Optics/images/img-68.jpeg.png)
> 图 4.53 外部反射下，不同角度的反射$\overrightarrow{\mathbf{E}}$场。所有场都发生在界面上，为了清晰起见，它们被稍微分开了。

![650](4-Optics/images/img-69.jpeg.png)
> 图 4.54 内部反射下，不同角度的反射$\overrightarrow{\mathbf{E}}$场。

#### 4.6.3.3 反射率与透射率 (Reflectance and Transmittance)
振幅系数描述的是电场振幅的比值，但我们通常更关心能量的分配。能量与振幅的平方成正比。

我们定义 #反射率 ( #Reflectance ) $R$ 为反射的功率与入射的功率之比，#透射率 ( #Transmittance ) $T$ 为透射的功率与入射的功率之比。

![400](4-Optics/images/img-70.jpeg.png)
> 图 4.55 入射光束的反射和透射。

功率等于 #辐照度 ( #Irradiance )（或光强，$I$）乘以垂直于传播方向的截面积。从图中可以看出，入射和反射光束的截面积是 $A\cos\theta_i$，而透射光束的截面积是 $A\cos\theta_t$。
- 入射功率: $P_i = I_i (A \cos\theta_i)$
- 反射功率: $P_r = I_r (A \cos\theta_r) = I_r (A \cos\theta_i)$ (因为 $\theta_r=\theta_i$)
- 透射功率: $P_t = I_t (A \cos\theta_t)$

所以，反射率 $R$ 定义为：
$$
R \equiv \frac{P_r}{P_i} = \frac{I_r A \cos\theta_i}{I_i A \cos\theta_i} = \frac{I_r}{I_i}
$$
辐照度 $I$ 与电场振幅平方的关系是 $I = \frac{1}{2}v\epsilon E_0^2 = \frac{1}{2}c\epsilon_0 n E_0^2$。由于入射和反射波在同一介质中 ($n_i=n_r, v_i=v_r, \epsilon_i=\epsilon_r$)，所以：
$$
R = \frac{I_r}{I_i} = \frac{\frac{1}{2}v_i\epsilon_i E_{0r}^2}{\frac{1}{2}v_i\epsilon_i E_{0i}^2} = \left(\frac{E_{0r}}{E_{0i}}\right)^2 = r^2\tag{4.56}
$$
**反射率就是振幅反射系数的平方**。

透射率 $T$ 定义为：
$$
T \equiv \frac{P_t}{P_i} = \frac{I_t A \cos\theta_t}{I_i A \cos\theta_i} = \frac{I_t}{I_i} \frac{\cos\theta_t}{\cos\theta_i}
$$
这次 $I_t$ 和 $I_i$ 所在的介质不同：
$$
\frac{I_t}{I_i} = \frac{\frac{1}{2}v_t\epsilon_t E_{0t}^2}{\frac{1}{2}v_i\epsilon_i E_{0i}^2} = \frac{n_t}{n_i} \left(\frac{E_{0t}}{E_{0i}}\right)^2 = \frac{n_t}{n_i} t^2
$$
（这里假设 $\mu_i=\mu_t=\mu_0$）
所以，透射率 $T$ 为：
$$
T = \left(\frac{n_t \cos\theta_t}{n_i \cos\theta_i}\right) t^2\tag{4.57}
$$
**注意**：$T$ 不等于 $t^2$！它包含了折射率比和角度因子，这反映了能量流速和光束截面积的变化。

对于无吸收的介质，能量是守恒的，即入射功率等于反射功率与透射功率之和：
$P_i = P_r + P_t$
两边同除以 $P_i$：
$$
1 = \frac{P_r}{P_i} + \frac{P_t}{P_i} \implies \boxed{R+T=1}\tag{4.60}
$$

对于s-偏振和p-偏振，我们可以分别定义它们的反射率和透射率：
$$
R_{\perp}=r_{\perp}^{2}\tag{4.61}
$$
$$
R_{\|}=r_{\|}^{2}\tag{4.62}
$$
$$
T_{\perp}=\left(\frac{n_{t} \cos \theta_{t}}{n_{i} \cos \theta_{i}}\right) t_{\perp}^{2}\tag{4.63}
$$
$$
T_{\|}=\left(\frac{n_{t} \cos \theta_{t}}{n_{i} \cos \theta_{i}}\right) t_{\|}^{2}\tag{4.64}
$$
并且它们各自满足能量守恒：$R_\perp + T_\perp = 1$ 和 $R_\| + T_\| = 1$。

下图展示了反射率和透射率随入射角的变化。

![400](4-Optics/images/img-71.jpeg.png)
> 图 4.56 反射率和透射率与入射角的关系。

对于自然光或 #非偏振光 ( #Unpolarized-Light )，我们可以认为它是由50%的s-偏振光和50%的p-偏振光混合而成。因此，总的反射率是两者的平均值：
$$
R=\frac{1}{2}\left(R_{\|}+R_{\perp}\right)\tag{4.66}
$$

* **垂直入射的反射率**

在垂直入射时 ($\theta_i=0$)，s和p偏振没有区别，$R_\perp = R_\|$。利用之前的结论 $r = (n_t-n_i)/(n_t+n_i)$：
$$
R = \left(\frac{n_{t}-n_{i}}{n_{t}+n_{i}}\right)^{2}\tag{4.67}
$$
例如，光从空气($n_i=1$)垂直入射到普通玻璃($n_g=1.5$)，反射率为：
$R = \left(\frac{1.5-1}{1.5+1}\right)^2 = \left(\frac{0.5}{2.5}\right)^2 = (0.2)^2 = 0.04 = 4\%$。
这意味着在每个空气-玻璃界面上，大约有4%的光被反射回来。这就是为什么我们看一块厚玻璃或一叠玻璃片时，会看到很多重影，而且透过玻璃看东西会变暗的原因。

![400](4-Optics/images/img-74.jpeg.png)
> 从近乎垂直的角度看一叠显微镜载玻片。你可以看到拍摄照片的相机的影像。(E.H.)

![470](4-Optics/images/img-75.jpeg.png)
> 图 4.57 在空气中($n_i=1.0$)单个界面上垂直入射的反射率。

---
### 关键结论与知识点总结
1.  **电磁理论的优越性**：与几何光学等早期理论相比，电磁理论能够从麦克斯韦方程组出发，不仅预测光的传播路径（反射和折射定律），还能定量计算反射和透射光的振幅、强度（能量）和相位。

2.  **边界条件是核心**：电磁场在介质交界面上必须满足特定边界条件（切向分量连续），这是推导出所有现象的物理基础。

3.  **相位匹配原理**：在界面上，入射波、反射波和透射波的相位必须时刻保持同步。由此直接推导出：
    - **频率不变**：$\omega_i = \omega_r = \omega_t$。
    - **反射定律**：$\theta_i = \theta_r$，且三线共面。
    - **折射定律（斯涅尔定律）**：$n_i \sin\theta_i = n_t \sin\theta_t$，且三线共面。

4.  **菲涅尔方程是定量工具**：通过求解边界条件，我们得到菲涅尔方程，它给出了振幅反射系数 ($r$) 和透射系数 ($t$) 作为入射角和折射率的函数。
    - 求解策略是**分解偏振**：将光分解为垂直于入射面的 **s-偏振** ($r_\perp, t_\perp$) 和平行于入射面的 **p-偏振** ($r_\|, t_\|$)。

5.  **重要的物理现象**：
    - **布儒斯特角 ($\theta_p$)**：在外部反射中，当入射角为布儒斯特角时，p-偏振光完全透射，$r_\|=0$。这是获得线偏振光的重要方法。
    - **全内反射 (TIR)**：当光从光密介质射向光疏介质，且入射角大于临界角 ($\theta_c$) 时，光被100%反射回来。此时反射系数的模为1，但会引入特定的相位移动。
    - **相位移动**：反射过程通常会引入相位变化。最典型的是外部反射中的s-偏振光，总是有 $\pi$ 的相位反转。这些相位变化在干涉、薄膜光学等领域至关重要。

6.  **能量关系**：
    - **反射率 $R = r^2$**，是反射能量与入射能量之比。
    - **透射率 $T \neq t^2$**，它还依赖于折射率和角度，是透射能量与入射能量之比。
    - **能量守恒**：对于无损介质，$R+T=1$。
    - **非偏振光**的反射率是s-偏振和p-偏振反射率的平均值：$R = (R_\perp + R_\|)/2$。

7.  **垂直入射**：一个非常实用的特例，反射率 $R = \left(\frac{n_t-n_i}{n_t+n_i}\right)^2$。对于空气-玻璃界面，约为4%。这个看似不大的数值在多镜片光学系统中会造成显著的光能损失。

---
### 专业术语/关键词汇编 (Glossary of Terms)
-  #辐射通量密度 ( #Radiant-Flux-Density )
-  #平面波 ( #Plane-Wave )
-  #线性偏振 ( #Linearly-Polarized )
-  #平面偏振 ( #Plane-Polarized )
-  #波矢量 ( #Wave-Vector )
-  #角频率 ( #Angular-Frequency )
-  #波前 ( #Wavefront )
-  #相位常数 ( #Phase-Constants )
-  #边界条件 ( #Boundary-Conditions )
-  #入射面 ( #Plane-of-Incidence )
-  #斯涅尔定律 ( #Snell-s-Law )
-  #磁导率 ( #Permeability )
-  #振幅反射系数 ( #Amplitude-Reflection-Coefficient )
-  #振幅透射系数 ( #Amplitude-Transmission-Coefficient )
-  #偏振角 ( #Polarization-Angle )
-  #布儒斯特角 ( #Brewster-s-Angle )
-  #临界角 ( #Critical-Angle )
-  #全内反射 ( #Total-Internal-Reflection )
-  #反射率 ( #Reflectance )
-  #透射率 ( #Transmittance )
-  #辐照度 ( #Irradiance )
-  #非偏振光 ( #Unpolarized-Light )


## 4.7 Total Internal Reflection

In the previous section it was evident that something rather interesting was happening in the case of internal reflection $\left(n_{i}>n_{f}\right)$ when $\theta_{I}$ was equal to or greater than $\theta_{c}$, the so-called critical angle. Let's now return to that situation for a closer look.
![600](4-Optics/images/img-77-1.jpeg.png)

![350](4-Optics/images/img-82.jpeg.png)
> Figure 4.59 Internal reflection and the critical angle. (Educational Services, Inc.)

Suppose that we have a source embedded in an optically dense medium, and we allow $\theta_{I}$ to increase gradually, as indicated in Fig. 4.59. We know from the preceding section (Fig. 4.50) that $r_{\|}$ and $r_{\perp}$ increase with increasing $\theta_{I}$, and therefore $t_{\|}$and $t_{\perp}$ both decrease. Moreover $\theta_{I}>\theta_{I}$, since
$$
\sin \theta_{I}=\frac{n_{I}}{n_{I}} \sin \theta_{I}
$$

and $n_{i}>n_{f}$, in which case $n_{H}<1$. Thus as $\theta_{I}$ becomes larger, the transmitted ray gradually approaches tangency with the boundary, and as it does more and more of the available energy appears in the reflected beam. Finally, when $\theta_{I}=90^{\circ}, \sin \theta_{I}=1$ and
$$
\boxed{\sin \theta_{r}=n_{H}}\tag{4.69}
$$

As noted earlier, the critical angle is that special value of $\theta_{I}$ for which $\theta_{I}=90^{\circ}$. The larger $n_{I}$ is, the smaller $n_{H}$ is, and the smaller $\theta_{c}$ is. For incident angles greater than or equal to $\theta_{c}$, all the incoming energy is reflected back into the incident medium in the process known as ***total internal reflection*** (see photo at top of next page).

It should be stressed that the transition from the conditions depicted in Fig. $4.59 a$ to those of $4.59 d$ takes place without any discontinuities. As $\theta_{I}$ becomes larger, the reflected beam grows stronger and stronger while the transmitted beam grows weaker, until the latter vanishes and the former carries off all the energy at $\theta_{r}=\theta_{c}$. It's an easy matter to observe the diminution of the transmitted beam as $\theta_{I}$ is made larger. Just place a glass microscope slide on a printed page, this time blocking out any specularly reflected light. At $\theta_{I} \approx 0, \theta_{I}$ is roughly zero, and the page as seen through the glass is fairly bright and clear. But if you move your head, allowing $\theta_{I}$ (the angle at which you view the interface) to increase, the region of the printed page covered by the glass will appear darker and darker, indicating that $T$ has indeed been markedly reduced.

The critical angle for our air-glass interface is roughly $42^{\circ}$ (see Table 4.3). Consequently, a ray incident normally on the left face of either of the prisms in Fig. 4.60 will have a $\theta_{I}>42^{\circ}$ and therefore be internally reflected. This is a convenient way to reflect nearly $100 \%$ of the incident light without having to worry about the deterioration that can occur with metallic surfaces (see photo).
![300](4-Optics/images/img-83.jpeg.png)
> Notice that you can't see the two front flames through the water along a bright horizontal band. That's due to total internal reflection. Look at the bottom of a drinking glass through its side. Now add a few inches of water. What happens? (E.H.)


| $n_{i t}$ | $\theta_{c}$ <br> (degrees) | $\theta_{c}$ <br> (radians) | $n_{i t}$ | $\theta_{c}$ <br> (degrees) | $\theta_{c}$ <br> (radians) |
| :-------: | :-------------------------: | :-------------------------: | :-------: | :-------------------------: | :-------------------------: |
|   1.30    |           50.2849           |           0.8776            |   1.50    |           41.8103           |           0.7297            |
|   1.31    |           49.7612           |           0.8685            |   1.51    |           41.4718           |           0.7238            |
|   1.32    |           49.2509           |           0.8596            |   1.52    |           41.1395           |           0.7180            |
|   1.33    |           48.7535           |           0.8509            |   1.53    |           40.8132           |           0.7123            |
|   1.34    |           48.2682           |           0.8424            |   1.54    |           40.4927           |           0.7067            |
|   1.35    |           47.7946           |           0.8342            |   1.55    |           40.1778           |           0.7012            |
|   1.36    |           47.3321           |           0.8261            |   1.56    |           39.8683           |           0.6958            |
|   1.37    |           46.8803           |           0.8182            |   1.57    |           39.5642           |           0.6905            |
|   1.38    |           46.4387           |           0.8105            |   1.58    |           39.2652           |           0.6853            |
|   1.39    |           46.0070           |           0.8030            |   1.59    |           38.9713           |           0.6802            |
|   1.40    |           45.5847           |           0.7956            |   1.60    |           38.6822           |           0.6751            |
|   1.41    |           45.1715           |           0.7884            |   1.61    |           38.3978           |           0.6702            |
|   1.42    |           44.7670           |           0.7813            |   1.62    |           38.1181           |           0.6653            |
|   1.43    |           44.3709           |           0.7744            |   1.63    |           37.8428           |           0.6605            |
|   1.44    |           43.9830           |           0.7676            |   1.64    |           37.5719           |           0.6558            |
|   1.45    |           43.6028           |           0.7610            |   1.65    |           37.3052           |           0.6511            |
|   1.46    |           43.2302           |           0.7545            |   1.66    |           37.0427           |           0.6465            |
|   1.47    |           42.8649           |           0.7481            |   1.67    |           36.7842           |           0.6420            |
|   1.48    |           42.5066           |           0.7419            |   1.68    |           36.5296           |           0.6376            |
|   1.49    |           42.1552           |           0.7357            |   1.69    |           36.2789           |           0.6332            |
> **TABLE 4.3** Critical Angles

Another useful way to view the situation is via Fig. 4.61, which shows a simplified representation of scattering off atomic oscillators. We know that the net effect of the presence of the homogeneous isotropic media is to alter the speed of the light from $c$ to $v_{i}$ and $v_{f}$, respectively (p. 101). The resultant wave is the superposition of these wavelets propagating at the appropriate speeds. 

![600](4-Optics/images/img-84.jpeg.png)
> Figure 4.60 Total internal reflection.

In Fig. $4.61 a$ an incident wave results in the emission of wavelets successively from scattering centers $A$ and $B$. 
![500](4-Optics/images/img-85.jpeg.png)
> Figure 4.61 An examination of the transmitted wave in the process of total internal reflection from a scattering perspective. Here we keep $\theta_{c}$ and $n_{i}$ constant and in successive parts of the diagram decrease $n_{t}$, thereby increasing $v_{t}$. The reflected wave $\left(\theta_{c}=\theta_{t}\right)$ is not drawn.

![350](4-Optics/images/img-86.jpeg.png)
> The prism behaves like a mirror and reflects a portion of the pencil (reversing the lettering on it). The operating process is total internal reflection. (E.H.)

These overlap to form the transmitted wave. The reflected wave, which comes back down into the incident medium as usual $\left(\theta_{t}=\theta_{r}\right)$, is not shown. In a time $t$ the incident front travels a distance $v_{i} t=\overline{C B}$, while the transmitted front moves a distance $v_{i} t=\overline{A D}>\overline{C B}$. Since one wave moves from $A$ to $E$ in the same time that the other moves from $C$ to $B$, and since they have the same frequency and period, they must change phase by the same amount in the process. Thus the disturbance at point $E$ must be in-phase with that at point $B$; both of these points must be on the same transmitted wavefront (remember Section 4.4.2).

It can be seen that the greater $v_{t}$ is in comparison to $v_{i}$, the more tilted the transmitted front will be (i.e., the larger $\theta_{t}$ will be). That much is depicted in Fig. 4.61b, where $n_{t i}$ has been taken to be smaller by assuming $n_{t}$ to be smaller. The result is a higher speed $v_{t}$, increasing $\overline{A D}$ and causing a greater transmission angle. In Fig. 4.61c a special case is reached: $\overline{A D}=\overline{A B}=v_{t} t$, and the wavelets will overlap in-phase only along the line of the interface, $\theta_{t}=90^{\circ}$. From triangle $A B C, \sin \theta_{i}=v_{i} t / v_{t} t=n_{t} / n_{i}$, which is Eq. (4.69). For the two given media (i.e., for the particular value of $n_{t i}$ ), the direction in which the scattered wavelets will add constructively in the transmitting medium is along the interface. The resulting disturbance $\left(\theta_{t}=90^{\circ}\right)$ is known as a surface wave.

### 4.7.1 The Evanescent Wave

Because the frequency of X-rays is higher than the resonance frequencies of the atoms of the medium, Eq. (3.70) suggests, and experiments confirm, that the index of refraction of X-rays is less than 1.0. Thus the wave velocity of X-rays (i.e., the phase speed) in matter exceeds its value (c) in vacuum, although it usually does so by less than 1 part in 10000 , even in the densest solids. When X-rays traveling in air enter a dense material like glass, the beam bends ever so slightly away from the normal rather than toward it. With the above discussion of total internal reflection in mind, we should expect that X-rays will be totally "externally" reflected when, for example, $n_{t}=n_{\text {air }}$ and $n_{t}=n_{\text {glass }}$. This is the way it's often spoken of in the literature, but that's a misnomer; since for X-rays $n_{\text {air }}>n_{\text {glass }}$ and therefore $n_{i}>n_{t}$ (even though
glass is physically more dense than air), the process is actually still internal reflection. In any event, because $n_{t}$ is less than, but very nearly equal to, 1 the index ratio $n_{t i} \approx 1$ and $\theta_{c} \approx 90^{\circ}$.

In 1923 A. H. Compton reasoned that even though X-rays incident on a sample at ordinary angles are not specularly reflected, they should be totally "externally" reflected at glancing incidence. He shined $0.128-\mathrm{nm}$ X-rays on a glass plate and got a critical angle of about 10 minutes of arc $\left(0.167^{\circ}\right)$ measured with respect to the surface. That yielded an index of refraction for glass that differed from 1 by $-4.2 \times 10^{-6}$.

We'll come back to some important practical applications of both total internal and total "external" reflection later on (p. 201).

If we assume in the case of total internal reflection that there is no transmitted wave, it becomes impossible to satisfy the boundary conditions using only the incident and reflected waves-things are not at all as simple as they might seem. Furthermore, we can reformulate Eqs. (4.34) and (4.40) (Problem 4.77) such that
$$
r_{\perp}=\frac{\cos \theta_{i}-\left(n_{t i}^{2}-\sin ^{2} \theta_{i}\right)^{1 / 2}}{\cos \theta_{i}+\left(n_{t i}^{2}-\sin ^{2} \theta_{i}\right)^{1 / 2}}\tag{4.70}
$$

and
$$
r_{\parallel}=\frac{n_{t i}^{2} \cos \theta_{i}-\left(n_{t i}^{2}-\sin ^{2} \theta_{i}\right)^{1 / 2}}{n_{t i}^{2} \cos \theta_{i}+\left(n_{t i}^{2}-\sin ^{2} \theta_{i}\right)^{1 / 2}}\tag{4.71}
$$

Since $\sin \theta_{c}=n_{t i}$ when $\theta_{i}>\theta_{c}, \sin \theta_{i}>n_{t i}$, and both $r_{\perp}$ and $r_{\|}$ become complex quantities. Despite this (Problem 4.78), $r_{\perp} r_{\perp}^{*}=r_{i} r_{i}^{*}=1$ and $R=1$, which means that $I_{r}=I_{i}$ and $I_{t}=0$. Thus, although there must be a transmitted wave, it cannot, on the average, carry energy across the boundary. We shall not perform the complete and rather lengthy computation needed to derive expressions for all the reflected and transmitted fields, but we can get an appreciation of what's happening in the following way. The wavefunction for the transmitted electric field is
$$
\begin{gathered}
\overrightarrow{\mathbf{E}}_{t}=\overrightarrow{\mathbf{E}}_{0 t} \exp i\left(\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}-\omega t\right) \\
\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}=k_{t x} x+k_{t y} y
\end{gathered}
$$

where
$$
\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}=k_{t x} x+k_{t y} y
$$

there being no $z$-component of $\overrightarrow{\mathbf{k}}$. But
$$
\begin{aligned}
& k_{t x}=k_{t} \sin \theta_{t} \\
& k_{t y}=k_{t} \cos \theta_{t}
\end{aligned}
$$

and
$$
k_{t y}=k_{t} \cos \theta_{t}
$$

as seen in Fig. 4.62. Once again using Snell's Law,
$$
k_{t} \cos \theta_{t}= \pm k_{t}\left(1-\frac{\sin ^{2} \theta_{t}}{n_{t i}^{2}}\right)^{1 / 2}\tag{4.72}
$$

or, since we are concerned with the case where $\sin \theta_{i}>n_{t i}$,
$$
k_{t y}= \pm i k_{t}\left(\frac{\sin ^{2} \theta_{i}}{n_{t i}^{2}}-1\right)^{1 / 2} \equiv \pm i \beta
$$

![500](4-Optics/images/img-87.jpeg.png)

Figure 4.62 Propagation vectors for internal reflection.
and
$$
k_{i x}=\frac{k_{i}}{n_{i i}} \sin \theta_{i}
$$

Hence
$$
\overrightarrow{\mathbf{E}}_{i}=\overrightarrow{\mathbf{E}}_{0 e} e^{ \mp \beta r} e^{i\left(k_{i} x \sin \theta_{i} / n_{i i}-\omega t\right)}\tag{4.73}
$$

Neglecting the positive exponential, which is physically untenable, we have a wave whose amplitude drops off exponentially as it penetrates the less dense medium. The disturbance advances in the $x$-direction as a surface or ***evanescent wave***. Notice that the wavefronts or surfaces of constant phase (parallel to the $y z$ plane) are perpendicular to the surfaces of constant amplitude (parallel to the $x z$-plane), and as such the wave is inhomogeneous (p. 34). Its amplitude decays rapidly in the $y$-direction, becoming negligible at a distance into the second medium of only a few wavelengths.

The quantity $\beta$ in Eq. (4.73) is the attenuation coefficient given by
$$
\beta=\frac{2 \pi n_{i}}{\lambda_{0}}\left[\left(\frac{n_{i}}{n_{i}}\right)^{2} \sin ^{2} \theta_{i}-1\right]^{1 / 2}
$$

The strength of the evanescent $E$-field drops exponentially from its maximum value at the interface $(y=0)$ to $1 / e$ of that value at a distance into the optically less dense medium of $y=1 / \beta=\delta$, which is called the penetration depth. Figure $4.63 a$ shows the incoming and reflected waves and it's easy to see that although both are moving to the right at the same speed (which is the speed of the evanescent wave), there is an upward component of the incident wave and an equal downward component of the totally reflected wave. Where these overlap there is a so-called standing wave (p. 296) set up in the optically more dense incident medium. We'll see in Section 7.1, where the mathematical analysis will be done, that whenever two waves of the same frequency traveling in opposite directions exist in the same region a stationary energy distribution is established, which is called a standing wave (even though it isn't formally a wave). 
![500](4-Optics/images/img-88.jpeg.png)
> Figure 4.63 Total internal reflection (a) depicts the incoming and outgoing waves. (b) The standing $E$-field in both media.

The black circles in the drawing correspond to maxima and the open circles to minima, all of which stay fixed in space as the waves rush by. The locations of these antinodes and nodes are repeated in the cosinusoidally oscillating graph of the standing $E$-field in the incident medium $\left(E_{i}\right)$ depicted in Fig. 4.63b. The situation should remind us of the standing sound wave pattern set up in an organ pipe open at one end. Notice that the first row of black circles, or maxima, occurs somewhat beneath the interface and that's where the cosine in Fig. 4.63b peaks. This happens because there is a phase shift between the incident and reflected waves (Fig. 4.52e). The magnitude of the standing wave at the boundary $(y=0)$ matches the magnitude of the evanescent wave, which drops off from there exponentially.

Increasing the incident angle beyond $\theta_{c}$ decreases the angle between the overlapping planar wavefronts, increases the distance between successive nodes in the standing wave pattern, decreases the magnitude of the standing wave at the boundary, decreases the magnitude of the $E$-field in the less dense medium, and decreases the penetration depth.

If you are still concerned about the conservation of energy, a more extensive treatment would have shown that energy actually circulates back and forth across the interface, resulting on the average in a zero net flow through the boundary into the second medium. In other words, energy flows from the incident wave to the evanescent wave and back to the reflected wave. Yet one puzzling point remains, inasmuch as there is still a bit of energy to be accounted for, namely, that associated with the evanescent wave that moves along the boundary in the plane-ofincidence. Since this energy could not have penetrated into the less dense medium under the present circumstances (so long as $\theta_{i} \geq \theta_{c}$ ), we must look elsewhere for its source. Under actual experimental conditions the incident beam would have a finite

cross section and therefore would obviously differ from a true plane wave. This deviation gives rise (via diffraction) to a slight transmission of energy across the interface, which is manifested in the evanescent wave.

Incidentally, it is clear from (c) and (d) in Fig. 4.52 that the incident and reflected waves (except at $\theta_{i}=90^{\circ}$ ) do not differ in phase by $\pi$ and cannot therefore cancel each other. It follows from the continuity of the tangential component of $\overrightarrow{\mathbf{E}}$ that there must be an oscillatory field in the less dense medium, with a component parallel to the interface having a frequency $\omega$ (i.e., the evanescent wave).

The exponential decay of the surface wave, or boundary wave, as it is also called, was confirmed experimentally at optical frequencies some time ago[^ago].

[^ago]:  *Take a look at the fascinating article by K. H. Drexhage, "Monomolecular layers and light," Sci. Am. 222, 108 (1970).

#### The Goos-Hänchen Shift

In 1947 Fritz Goos and Hilda Lindberg-Hänchen showed experimentally that ***a light beam, which is totally internally reflected, undergoes a minute lateral shift from the position where the beam strikes the interface***. Even though we usually draw rays reflecting from the surface, we know that in general the reflection of light does not take place precisely at the interface. The process is not the same as a ball bouncing off the surface. Instead many layers of atoms (p. 104) contribute to the reflected wave. In the case of total internal reflection the incoming beam behaves as if it enters the less dense medium reflecting off a virtual plane set in at a distance $\delta$, the penetration depth, from the interface (Fig. 4.64). The resulting lateral displacement $\Delta x$, in the propagation direction of the evanescent wave, is called the ***Goos-Hänchen shift*** and it's slightly different depending on the polarization of the light, via the Fresnel Equations. From the diagram the offset is approximately $\Delta x \approx 2 \delta \tan \theta_{i}$ and it turns out to be of the order of the wavelength of the incident light. Thus, though the shift is of little concern when we draw ray diagrams it has become a subject of considerable interest to many researchers.

![400](4-Optics/images/img-89.jpeg.png)
> Figure 4.64 Under conditions of total internal reflection a beam of light experiences what appears to be a lateral shift $\Delta x$.

#### Frustrated Total Internal Reflection

Imagine that a beam of light traveling within a block of glass is internally reflected at a boundary. Presumably, if you pressed another piece of glass against the first, the air-glass interface could be made to vanish, and the beam would then propagate onward undisturbed. Furthermore, you might expect this transition from total to no reflection to occur gradually as the air film thinned out. In much the same way, if you hold a drinking glass or a prism, you can see the ridges of your fingerprints in a region that, because of total internal reflection, is otherwise mirrorlike. In more general terms, when the evanescent wave extends with appreciable amplitude across the rare medium into a nearby region occupied by a higher-index material, energy may flow through the gap in what is known as ***frustrated total internal reflection (FTIR)***. The evanescent wave, having traversed the gap, is still strong enough to drive electrons in the "frustrating" medium; they in turn will generate a wave that significantly alters the field configuration, thereby permitting energy to flow. Figure 4.65 is a schematic representation of FTIR: the width of the lines depicting the wavefronts decreases across the gap as a reminder that the amplitude of the field behaves in the same way.

![350](4-Optics/images/img-90.jpeg.png)
> Total internal reflection on one face of a glass prism. (E.H.)

![350](4-Optics/images/img-91.jpeg.png)
> Frustrated total internal reflection on one face of a prism. (E.H.)

![500](4-Optics/images/img-92.jpeg.png)
> Figure 4.65 Frustrated total internal reflection.

The process as a whole is remarkably similar to the quantummechanical phenomenon of barrier penetration or tunneling, which has numerous applications in contemporary physics.

One can demonstrate FTIR with the prism arrangement of Fig. 4.66 in a manner that is fairly self-evident. Moreover, if the hypotenuse faces of both prisms are made planar and parallel, they can be positioned so as to transmit and reflect any desired fraction of the incident flux density. Devices that perform this function are known as ***beamsplitters***. A ***beamsplitter cube*** can be made rather conveniently by using a thin, low-index transparent film as a precision spacer. Low-loss reflectors whose transmittance can be controlled by frustrating internal reflection are of considerable practical interest. FTIR can also be observed in other regions of the electromagnetic spectrum. Threecentimeter microwaves are particularly easy to work with, inasmuch as the evanescent wave will extend roughly $10^{5}$ times farther than it would at optical frequencies. One can duplicate the above optical experiments with solid prisms made of paraffin or hollow ones of acrylic plastic filled with kerosene or motor oil. Any one of these would have an index of about 1.5 for $3-\mathrm{cm}$ waves. It then becomes an easy matter to measure the dependence of the field amplitude on $y$.
![490](4-Optics/images/img-93.jpeg.png)
![250](4-Optics/images/img-94.jpeg.png)
> Figure 4.66 (a) A beamsplitter utilizing FTIR. (b) A typical modern application of FTIR: a conventional beamsplitter arrangement used to take photographs through a microscope. (c) Beamsplitter cubes. (Melles Grist)

## 4.7 全内反射 (Total Internal Reflection)
[!全内反射 (Total Internal Reflection)]-

想象一下，你站在一个清澈的游泳池边，看着水里的朋友。你看他很清楚。现在，如果你潜入水中，从水下向上看，你会看到什么？你会发现，当你从某些角度向上看时，水面就像一面完美的镜子，倒映出水底的景象，而你完全看不到水面以上的天空。这个奇特的现象，就是我们今天要学习的 #全内反射 ( #Total-Internal-Reflection )，简称TIR。

![600](4-Optics/images/img-77-1.jpeg.png)

### 4.7.1 现象与条件：何时水面会变成“镜子”？
要理解全内反射，我们必须先回到光在两种不同介质界面处的行为——折射和反射。这个行为由一个非常基本的定律主宰：**斯涅尔定律 (Snell's Law)**。

当一束光从介质1（入射介质，折射率为 $n_i$）以入射角 $\theta_i$ 射向介质2（透射介质，折射率为 $n_t$）时，会发生折射，折射角为 $\theta_t$。它们之间的关系是：
$$
n_i \sin\theta_i = n_t \sin\theta_t
$$

现在，让我们来分析一下全内反射发生的**两个前提条件**：

1.  **光必须从光密介质射向光疏介质。**
    “光密”和“光疏”是根据 #折射率 ( #Refractive-Index ) $n$ 的大小来定义的。折射率越大的介质，我们称之为光密介质；折射率越小的，则为光疏介质。所以，这个条件意味着 $n_i > n_t$。比如，光从水中（$n_i \approx 1.33$）射向空气（$n_t \approx 1.00$），或者从玻璃（$n_i \approx 1.5$）射向空气。

2.  **入射角必须大于或等于一个特定的角度——临界角。**
    让我们来看看为什么会有这个条件。将斯涅尔定律变形，我们可以得到：
    $$
    \sin\theta_t = \frac{n_i}{n_t} \sin\theta_i
    $$
    因为我们已经设定了 $n_i > n_t$，所以比值 $(n_i/n_t) > 1$。这意味着，对于同一个 $\sin\theta_i$，$\sin\theta_t$ 会被放大，所以折射角 $\theta_t$ 总是大于入射角 $\theta_i$。也就是说，光线会偏离法线。

    ![350](4-Optics/images/img-82.jpeg.png)
    > 图 4.59 内反射与临界角。(Educational Services, Inc.)

    如上图所示，随着我们逐渐增加入射角 $\theta_i$：
    - 折射角 $\theta_t$ 也会随之增大，并且增大的速度更快。
    - 透射出去的光线越来越贴近界面。
    - 同时，反射回来的光线会变得越来越强，而透射出去的光线则越来越弱。

    那么，会不会有一个特殊的入射角，使得透射光线恰好“平躺”在界面上呢？答案是肯定的。当折射角 $\theta_t = 90^\circ$ 时，$\sin\theta_t = 1$。此时对应的入射角，我们就定义为 #临界角 ( #Critical-Angle )，记作 $\theta_c$。

    将 $\theta_t = 90^\circ$ 和 $\theta_i = \theta_c$ 代入斯涅尔定律：
    $$
    n_i \sin\theta_c = n_t \sin(90^\circ) = n_t \times 1
    $$
    于是，我们得到了计算临界角的公式：
    $$
    \boxed{\sin \theta_{c}= \frac{n_t}{n_i}}\tag{4.69}
    $$

    **思考一下：** 如果入射角 $\theta_i$ 继续增大，超过了临界角 $\theta_c$ 呢？
    此时 $\sin\theta_i > \sin\theta_c = n_t/n_i$。根据斯涅尔定律，我们会得到 $\sin\theta_t = (n_i/n_t)\sin\theta_i > 1$。但在实数世界里，一个角度的正弦值是不可能大于1的！这在数学上意味着，**不存在一个实数的折射角 $\theta_t$ 与之对应**。
    
    物理上，这就意味着**没有光线能够透射到第二种介质中去了**。所有入射的能量都将被反射回第一种介质，就好像界面变成了一面完美的镜子。这个现象，就是**全内反射**。

> **生活中的例子：**
> ![300](4-Optics/images/img-83.jpeg.png)
> > 注意，你无法透过水面沿着那条明亮的水平带看到前面的两个火焰。这是由于全内反射造成的。试着从侧面看一个玻璃杯的底部，然后倒入几英寸的水，看看会发生什么？(E.H.)
>
> 水的折射率约为1.33，空气约为1.00。从水射向空气的临界角是 $\theta_c = \arcsin(1.00/1.33) \approx 48.75^\circ$。当你从水下以大于48.75°的角度看向水面时，水面就会像镜子一样，反射水下的景象。

下面的表格展示了光从不同折射率 $n_{it} = n_i/n_t$ 的介质组合入射时对应的临界角。可以看到，折射率比值越大，临界角越小。


| $n_{i t}$ | $\theta_{c}$ <br> (度) | $\theta_{c}$ <br> (弧度) | $n_{i t}$ | $\theta_{c}$ <br> (度) | $\theta_{c}$ <br> (弧度) |
| :-------: | :-------------------------: | :-------------------------: | :-------: | :-------------------------: | :-------------------------: |
|   1.30    |           50.2849           |           0.8776            |   1.50    |           41.8103           |           0.7297            |
|   1.31    |           49.7612           |           0.8685            |   1.51    |           41.4718           |           0.7238            |
|   1.32    |           49.2509           |           0.8596            |   1.52    |           41.1395           |           0.7180            |
|   1.33    |           48.7535           |           0.8509            |   1.53    |           40.8132           |           0.7123            |
|   1.34    |           48.2682           |           0.8424            |   1.54    |           40.4927           |           0.7067            |
|   1.35    |           47.7946           |           0.8342            |   1.55    |           40.1778           |           0.7012            |
|   1.36    |           47.3321           |           0.8261            |   1.56    |           39.8683           |           0.6958            |
|   1.37    |           46.8803           |           0.8182            |   1.57    |           39.5642           |           0.6905            |
|   1.38    |           46.4387           |           0.8105            |   1.58    |           39.2652           |           0.6853            |
|   1.39    |           46.0070           |           0.8030            |   1.59    |           38.9713           |           0.6802            |
|   1.40    |           45.5847           |           0.7956            |   1.60    |           38.6822           |           0.6751            |
|   1.41    |           45.1715           |           0.7884            |   1.61    |           38.3978           |           0.6702            |
|   1.42    |           44.7670           |           0.7813            |   1.62    |           38.1181           |           0.6653            |
|   1.43    |           44.3709           |           0.7744            |   1.63    |           37.8428           |           0.6605            |
|   1.44    |           43.9830           |           0.7676            |   1.64    |           37.5719           |           0.6558            |
|   1.45    |           43.6028           |           0.7610            |   1.65    |           37.3052           |           0.6511            |
|   1.46    |           43.2302           |           0.7545            |   1.66    |           37.0427           |           0.6465            |
|   1.47    |           42.8649           |           0.7481            |   1.67    |           36.7842           |           0.6420            |
|   1.48    |           42.5066           |           0.7419            |   1.68    |           36.5296           |           0.6376            |
|   1.49    |           42.1552           |           0.7357            |   1.69    |           36.2789           |           0.6332            |
> **表 4.3** 临界角

全内反射的应用非常广泛，比如光导纤维（光纤通信的基础）和双筒望远镜中的普罗棱镜，它们都利用了TIR近乎100%的反射效率，远高于普通金属镜面。

![600](4-Optics/images/img-84.jpeg.png)
> 图 4.60 全内反射。图中棱镜的玻璃-空气临界角约为42°。光线垂直入射第一个面，在斜面上以45°角入射，大于临界角，因此发生全内反射。

### 4.7.2 物理本质：从惠更斯原理看全内反射
斯涅尔定律完美地描述了现象，但物理的魅力在于探究“为什么”。为什么在临界角时，光就“消失”在界面上了呢？我们可以用惠更斯原理来获得一个更直观的物理图像。

惠更斯原理告诉我们，波阵面上的每一点都可以看作是一个新的点波源，发出次级球面波（子波），这些子波的包络面就构成了下一个时刻新的波阵面。

![500](4-Optics/images/img-85.jpeg.png)
> 图 4.61 从散射角度审视全内反射过程中的透射波。这里我们保持 $\theta_i$ 和 $n_i$ 不变，在连续的图示中减小 $n_t$，从而增大 $v_t$。反射波（$\theta_i = \theta_r$）未画出。

让我们跟随上图来理解这个过程：
- 入射波阵面 $CB$ 到达界面上的 $A$ 点。$A$ 点成为一个新的子波源，开始在介质2中以速度 $v_t = c/n_t$ 发射子波。
- 经过时间 $t$ 后，原来的波阵面传播到了 $B$ 点，传播距离为 $\overline{CB} = v_i t$，其中 $v_i = c/n_i$ 是在介质1中的速度。
- 在同样的时间 $t$ 内，$A$ 点发出的子波在介质2中传播的距离为 $\overline{AD} = v_t t$。
- 所有从 $A$ 到 $B$ 之间的点激发的子波，在 $t$ 时刻的包络面，就构成了新的透射波阵面 $DB$。

现在，我们来看图(a), (b), (c)的变化：
- **(a) 普通折射：** $v_t$ 比 $v_i$ 大（因为 $n_t < n_i$），所以 $\overline{AD} > \overline{CB}$。透射波阵面 $DB$ 与界面形成一个角度，光线正常透射。
- **(b) 增大入射角：** 随着 $\theta_i$ 增大，透射波阵面 $DB$ 变得越来越“陡峭”，即折射角 $\theta_t$ 越来越大。
- **(c) 达到临界角：** 当 $\theta_i = \theta_c$ 时，出现了一个特殊情况：$A$ 点发出的子波传播的距离 $\overline{AD}$ 恰好等于 $A, B$ 两点间的距离 $\overline{AB}$。从三角形 $ABC$ 中，我们知道 $\sin\theta_i = \overline{CB}/\overline{AB} = v_i t / \overline{AB}$。而在这种特殊情况下，$\overline{AB} = \overline{AD} = v_t t$。所以，$\sin\theta_c = v_i t / v_t t = v_i/v_t = (c/n_i)/(c/n_t) = n_t/n_i$。这正是我们之前推导的临界角公式！
  
  物理上，这意味着所有子波只能在界面上同相叠加，形成一个沿着界面传播的波。这个波被称为 #表面波 ( #Surface-Wave )。它不再向介质2的深处传播能量。这就是为什么在宏观上我们看不到透射光了。

---

### 4.7.3 倏逝波：边界另一侧的秘密 (The Evanescent Wave)
我们刚刚说，当发生全内反射时，没有能量透射到第二介质中。这是一个非常好的近似，但并不完全精确。如果光疏介质中真的**完全没有**电磁场，那么在界面上，电磁场的边条件（比如电场和磁场的切向分量必须连续）将无法满足。

这引出了一个极其深刻且有趣的概念：即使在全内反射条件下，光疏介质中依然存在一个特殊的、非传播的电磁场，我们称之为 #倏逝波 ( #Evanescent-Wave )。“倏逝”意为“转瞬即逝”，非常形象地描述了它的特性。

![350](4-Optics/images/img-86.jpeg.png)
> 棱镜就像一面镜子，反射了铅笔的一部分（上面的字母也反了）。其工作原理就是全内反射。(E.H.)

#### 4.7.3.1 倏逝波的数学描述
让我们从数学上看看这个波是如何产生的。透射波的电场可以写成：
$$
\overrightarrow{\mathbf{E}}_{t}=\overrightarrow{\mathbf{E}}_{0 t} \exp i\left(\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}-\omega t\right)
$$
其中，波矢量和位置矢量的点积为 $\overrightarrow{\mathbf{k}}_{t} \cdot \overrightarrow{\mathbf{r}}=k_{tx} x+k_{ty} y$（假设界面在xy平面，传播在xy平面内）。

根据边界条件，波在沿界面方向（x方向）的相位必须匹配，所以 $k_{tx} = k_{ix} = k_i \sin\theta_i$。

关键在于垂直于界面的分量 $k_{ty}$。我们知道 $k_t^2 = k_{tx}^2 + k_{ty}^2$，所以 $k_{ty} = \sqrt{k_t^2 - k_{tx}^2}$。
- $k_t = n_t k_0 = n_t (2\pi/\lambda_0)$
- $k_{tx} = k_i \sin\theta_i = n_i k_0 \sin\theta_i$

代入后得到：
$$
k_{ty} = \sqrt{(n_t k_0)^2 - (n_i k_0 \sin\theta_i)^2} = k_0 \sqrt{n_t^2 - n_i^2 \sin^2\theta_i}
$$
当发生全内反射时，$\theta_i > \theta_c$，所以 $\sin\theta_i > n_t/n_i$，即 $n_i \sin\theta_i > n_t$。
这意味着根号里面的值为负！
$$
n_t^2 - n_i^2 \sin^2\theta_i < 0
$$
我们可以把它写成 $k_{ty} = k_0 \sqrt{-1 \cdot (n_i^2 \sin^2\theta_i - n_t^2)} = \pm i \cdot k_0 \sqrt{n_i^2 \sin^2\theta_i - n_t^2}$。
这是一个纯虚数！我们定义一个实数 $\beta = k_0 \sqrt{n_i^2 \sin^2\theta_i - n_t^2}$，那么 $k_{ty} = \pm i\beta$。

现在，我们把这个虚数 $k_{ty}$ 代回到波函数中关于 $y$ 的部分 $e^{i k_{ty} y}$：
$$
e^{i (\pm i\beta) y} = e^{\mp \beta y}
$$
这个表达式不再是振荡的波函数，而是变成了指数衰减或指数增长的函数！从物理上考虑，能量密度不可能在远离界面的地方无限增大，所以我们必须舍弃增长的解（$e^{+\beta y}$），只保留衰减的解（$e^{-\beta y}$）。

因此，透射波的完整形式变为：
$$
\overrightarrow{\mathbf{E}}_{t} = \overrightarrow{\mathbf{E}}_{0t} e^{-\beta y} e^{i(k_{tx}x - \omega t)}\tag{4.73 (改写)}
$$
这个方程告诉我们：
1.  在光疏介质中确实存在电磁场。
2.  这个场沿着 $x$ 方向（平行于界面）传播，具有波的特性（相位项 $e^{i(k_{tx}x - \omega t)}$）。
3.  这个场的振幅会随着深入光疏介质的距离 $y$ 的增加而**指数衰减**（衰减项 $e^{-\beta y}$）。

![500](4-Optics/images/img-87.jpeg.png)
> 图 4.62 内反射的波矢量。当发生全内反射时，$k_{ty}$ 变为虚数。

#### 4.7.3.2 倏逝波的特性
- **指数衰减与穿透深度**：倏逝波的强度不是零，但它衰减得非常快。我们定义一个 #穿透深度 ( #Penetration-Depth ) $\delta = 1/\beta$，表示振幅衰减到界面处 $1/e$（约37%）时的距离。这个深度通常只有几个波长的量级。因此，在宏观尺度上，我们几乎无法察觉到它的存在。

- **非均匀波**：倏逝波是一种 #非均匀波 ( #Inhomogeneous-Wave )。普通的平面波，其等振幅面和等相位面是重合的（都是垂直于传播方向的平面）。但对于倏逝波，其等相位面（$x$=常数）和等振幅面（$y$=常数）是相互垂直的。

- **能量流动**：既然有场，就应该有能量。那能量守恒怎么办？更深入的分析表明，倏逝波的能量流非常奇特。它在每个周期内，能量会从光密介质“借”到光疏介质，然后再“还”回去，形成一种在界面附近来回交换的能量循环。因此，在**时间平均**上，没有**净**能量流穿过界面进入光疏介质。这与我们宏观上观察到的“全反射”($R=1$)是一致的。

- **驻波的形成**：在光密介质中，入射波和全反射回来的波会发生干涉。由于它们频率相同、振幅相近、传播方向相反（在y方向上），它们会叠加形成一个 #驻波 ( #Standing-Wave ) 图样。

![500](4-Optics/images/img-88.jpeg.png)
> 图 4.63 全内反射。(a) 描绘了入射波和出射波。(b) 两种介质中的驻波电场。

如图(b)所示，在光密介质（$y<0$）中，电场呈现驻波的振荡形态，有固定的波峰（antinodes）和波谷（nodes）。而在光疏介质（$y>0$）中，电场就是从界面处开始指数衰减的倏逝波。在界面 $y=0$ 处，两边的场必须平滑连接，满足电磁场的边界条件。

> **一个有趣的特例：X射线的“外”反射**
> 对于可见光，几乎所有材料的折射率都大于1。但对于频率极高的X射线，情况有所不同，材料的折射率 $n$ 会略小于1。这意味着，当X射线从空气（$n_{air} \approx 1$）射入玻璃（$n_{glass} < 1$）时，实际上是从“光密”介质射向“光疏”介质！因此，只要入射角足够大（接近掠射，即90°），X射线也会发生全内反射。这在X射线光学中被称为“全外反射”，但其物理原理仍然是TIR。

---

### 4.7.4 倏逝波的奇妙效应
倏逝波虽然“倏然而逝”，但它并非虚无缥缈的理论产物，它的存在会导致一些可以被精确测量的物理效应。

#### 4.7.4.1 古斯-汉欣位移 (The Goos-Hänchen Shift)
既然光在全内反射时会“渗入”光疏介质一小段距离，那么反射点究竟在哪里呢？是在界面上，还是在“渗入”的最深处？

1947年，Goos和Hänchen通过实验精确地证明，全内反射的光束并不会在入射点精确地反射，而是会沿着界面发生一个微小的侧向位移。这个位移被称为 #古斯-汉欣位移 ( #Goos-Hänchen-Shift )。
![400](4-Optics/images/img-89.jpeg.png)
> 图 4.64 在全内反射条件下，光束会经历一个看起来像是侧向位移 $\Delta x$ 的过程。

这个位移的直观解释是：光束的能量流可以被看作是进入了光疏介质，传播了一小段距离，然后再返回光密介质。这个过程就好像光束是在光疏介质内部一个深度为 $\delta$（穿透深度）的虚拟平面上反射的，从而导致了在界面上产生了一个 $\Delta x$ 的横向位移。这个位移非常小，通常和光的波长在同一个数量级，但它雄辩地证明了倏逝波的真实存在。

#### 4.7.4.2 受抑全内反射 (Frustrated Total Internal Reflection, FTIR)
这是倏逝波带来的最令人惊奇、也最富应用价值的现象。
想象一下，我们让一束光在第一块棱镜中发生全内反射。此时，在棱镜的另一侧（空气中）存在着一个迅速衰减的倏逝波。

![350](4-Optics/images/img-90.jpeg.png)
> 玻璃棱镜一个面上的全内反射。(E.H.)

现在，如果我们拿第二块同样的棱镜，逐渐靠近第一块棱镜的反射面，会发生什么？
当两块棱镜的间隙（空气层）足够大时，倏逝波在到达第二块棱镜之前就已经衰减到可以忽略不计了，所以什么都不会发生，仍然是全内反射。

但是，如果间隙变得非常小，小到与光的波长相当（也就是小于或等于穿透深度 $\delta$），那么倏逝波在还没来得及完全衰减时，就已经“触碰”到了第二块棱镜。第二块棱镜是光密介质，倏逝波的电磁场会驱动其中的电子振动，这些振动的电子会重新辐射出电磁波。结果，一个**新的传播波**在第二块棱镜中被“重新构建”出来，能量就这样“穿越”了原本无法通过的空气间隙！

![350](4-Optics/images/img-91.jpeg.png)
> 棱镜一个面上的受抑全内反射。(E.H.)

这个因为全内反射被“挫败”而导致光线透射的现象，就叫做 #受抑全内反射 ( #Frustrated-Total-Internal-Reflection )，简称FTIR。

![500](4-Optics/images/img-92.jpeg.png)
> 图 4.65 受抑全内反射。描绘波前的线条宽度在穿过间隙时减小，提醒我们场的振幅也以同样的方式变化。

**与量子隧穿的类比：**
这个现象与量子力学中的 #量子隧穿 ( #Quantum-Tunneling ) 效应惊人地相似。在量子力学中，一个粒子（比如电子）即使能量低于势垒的高度，也有一定的概率“隧穿”过去。在这里，光波（光子）的能量“隧穿”了折射率较低的空气“势垒”。倏逝波就扮演了量子力学中在势垒内部的那个指数衰减的波函数。这是一个宏观世界中可以观察到的、与微观量子现象极其相似的经典波动现象，非常奇妙！

**FTIR的应用：分束器**
通过精确控制两块棱镜之间的间隙大小，我们可以精确地控制有多少比例的能量被反射，多少比例的能量“隧穿”过去。这使得FTIR成为制造高精度 #分束器 ( #Beamsplitter ) 的一种绝佳方法。分束器是一种能将一束光分成两束或多束的光学元件，在干涉仪、显微镜和各种光学实验中都至关重要。

![490](4-Optics/images/img-93.jpeg.png)
![250](4-Optics/images/img-94.jpeg.png)
> 图 4.66 (a) 一个利用FTIR的分束器。(b) FTIR的一个典型现代应用：用于通过显微镜拍照的传统分束器装置。(c) 分束器立方体。(Melles Griot)

---

### 关键结论与知识点总结
1.  **全内反射 (TIR)**：光从光密介质射向光疏介质($n_i > n_t$)，且入射角大于临界角($\theta_i > \theta_c$)时，光线被100%反射回原介质的现象。
2.  **临界角 ($\theta_c$)**：使折射角恰好为90°的入射角，其计算公式为 $\sin\theta_c = n_t/n_i$。
3.  **倏逝波 (Evanescent Wave)**：即使在TIR条件下，光疏介质界面附近也存在一个特殊的电磁场。它沿着界面传播，但其振幅垂直于界面方向呈指数衰减。
4.  **倏逝波的特性**：它是一种非均匀波，不产生净的能量传输，其存在是满足电磁场边界条件的必然要求。它的穿透深度通常只有几个波长。
5.  **驻波 (Standing Wave)**：在光密介质一侧，入射波与反射波干涉形成驻波图样。
6.  **古斯-汉欣位移**：TIR中反射光束发生的微小侧向位移，是倏逝波存在的一个直接证据。
7.  **受抑全内反射 (FTIR)**：当另一个光密介质进入倏逝波的穿透深度内时，能量可以“隧穿”过去，形成新的透射波。这是量子隧穿效应的一个经典光学类比，并被用于制造分束器等光学元件。

---

### 专业术语/关键词汇编
- #全内反射 ( #Total-Internal-Reflection )
- #折射率 ( #Refractive-Index )
- #临界角 ( #Critical-Angle )
- #表面波 ( #Surface-Wave )
- #倏逝波 ( #Evanescent-Wave )
- #穿透深度 ( #Penetration-Depth )
- #非均匀波 ( #Inhomogeneous-Wave )
- #驻波 ( #Standing-Wave )
- #古斯-汉欣位移 ( #Goos-Hänchen-Shift )
- #受抑全内反射 ( #Frustrated-Total-Internal-Reflection )
- #量子隧穿 ( #Quantum-Tunneling )
- #分束器 ( #Beamsplitter )


## 4.8 Optical Properties of Metals

The characteristic feature of conducting media is the presence of a number of free electric charges (free in the sense of being unbound, i.e., able to circulate within the material). For metals these charges are of course electrons, and their motion constitutes a current. The current per unit area resulting from the application of a field $\overrightarrow{\mathbf{E}}$ is related by means of Eq. (A1.15) to the conductivity of the medium $\sigma$. For a dielectric there are no free or conduction electrons and $\sigma=0$, whereas for metals $\sigma$ is nonzero and finite. In contrast, an idealized "perfect" conductor would have an infinite conductivity. This is equivalent to saying that the electrons, driven into oscillation by a harmonic wave, would simply follow the field's alternations. There would be no restoring force, no natural frequencies, and no absorption, only reemission. In real metals the conduction electrons undergo collisions with the thermally agitated lattice or with imperfections and in so doing irreversibly convert electromagnetic energy into joule heat. The absorption of radiant energy by a material is a function of its conductivity.

#### Waves in a Metal

If we visualize the medium as continuous, Maxwell's Equations lead to
$$
\frac{\partial^{2} \overrightarrow{\mathbf{E}}}{\partial x^{2}}+\frac{\partial^{2} \overrightarrow{\mathbf{E}}}{\partial y^{2}}+\frac{\partial^{2} \overrightarrow{\mathbf{E}}}{\partial z^{2}}=\mu e \frac{\partial^{2} \overrightarrow{\mathbf{E}}}{\partial t^{2}}+\mu \sigma \frac{\partial \overrightarrow{\mathbf{E}}}{\partial t}\tag{4.74}
$$

which is Eq. (A1.21) in Cartesian coordinates. The last term, $\mu \sigma \partial \overrightarrow{\mathbf{E}} / \partial t$, is a first-order time derivative, like the damping force in the oscillator model (p. 81). The time rate-of-change of $\overrightarrow{\mathbf{E}}$ generates a voltage, currents circulate, and since the material is resistive, light is converted to thermal energy-ego absorption. This expression can be reduced to the unattenuated wave equation, if the permittivity is reformulated as a complex quantity. This in turn leads to a complex index of refraction, which, as we saw earlier (p. 81), is tantamount to absorption. We then need only substitute the complex index
$$
\tilde{n}=n_{R}-i n_{I}\tag{4.75}
$$

(where the real and imaginary indices $n_{R}$ and $n_{I}$ are both real numbers) into the corresponding solution for a nonconducting medium. Alternatively, we can utilize the wave equation and appropriate boundary conditions to yield a specific solution. In either event, it is possible to find a simple sinusoidal planewave solution applicable within the conductor. Such a wave propagating in the $y$-direction is ordinarily written as
$$
\overrightarrow{\mathbf{E}}=\overrightarrow{\mathbf{E}}_{0} \cos (\omega t-k y)
$$

or as a function of $n$,
$$
\overrightarrow{\mathbf{E}}=\overrightarrow{\mathbf{E}}_{0} \cos \omega(t-\tilde{n} y / c)
$$

but here the refractive index must be taken as complex. Writing the wave as an exponential and using Eq. (4.75) yields
$$
\overrightarrow{\mathbf{E}}=\overrightarrow{\mathbf{E}}_{0} e^{(-\omega n_{I} y / c)} e^{i \omega\left(t-n_{R} y / c\right)}\tag{4.76}
$$

or
$$
\overrightarrow{\mathbf{E}}=\overrightarrow{\mathbf{E}}_{0} e^{-\omega n_{I} y / c} \cos \omega\left(t-n_{R} y / c\right)\tag{4.77}
$$

The disturbance advances in the $y$-direction with a speed $c / n_{R}$, precisely as if $n_{R}$ were the more usual index of refraction. As the wave progresses into the conductor, its amplitude, $\overrightarrow{\mathbf{E}}_{0} \exp \left(-\omega n_{I} y / c\right)$, is exponentially attenuated. Inasmuch as irradiance is proportional to the square of the amplitude, we have
$$
I(y)=I_{0} e^{-\alpha y}\tag{4.78}
$$

where $I_{0}=I(0)$; that is, $I_{0}$ is the irradiance at $y=0$ (the interface), and $\alpha \equiv 2 \omega n_{I} / c$ is called the absorption coefficient or (even better) the ***attenuation coefficient***. The flux density will drop by a factor of $e^{-1}=1 / 2.7 \approx \frac{1}{3}$ after the wave has propagated a distance $y=1 / \alpha$, known as the ***skin*** or ***penetration depth***. For a material to be transparent, the penetration depth must be large in comparison to its thickness. The penetration depth for metals, however, is exceedingly small. For example, copper at ultraviolet wavelengths ( $\lambda_{0} \approx 100 \mathrm{~nm}$ ) has a miniscule penetration depth, about 0.6 nm , while it is still only about 6 nm in the infrared ( $\lambda_{0} \approx 10000 \mathrm{~nm}$ ). This accounts for the generally observed opacity of metals, which nonetheless can become partly transparent when formed into extremely thin films (e.g., in the case of partially silvered two-way mirrors). The familiar metallic sheen of conductors corresponds to a high reflectance, which exists because the incident wave cannot effectively penetrate the material. Relatively few electrons in the metal "see" the transmitted wave, and therefore, although each absorbs strongly, little total energy is dissipated by them. Instead, most of the incoming energy reappears as the reflected wave. The majority of metals, including the less common ones (e.g., sodium, potassium, cesium, vanadium, niobium, gadolinium, holmium, yttrium, scandium, and osmium) have a silvery gray appearance like that of aluminum, tin, or steel. They reflect almost all the incident light (roughly $85-95 \%$ ) regardless of wavelengths and are therefore essentially colorless.

Equation (4.77) is certainly reminiscent of Eq. (4.73) and FTIR. In both cases there is an exponential decay of the amplitude. Moreover, a complete analysis would show that the transmitted waves are not strictly transverse, there being a component of the field in the direction of propagation in both instances.

The representation of metal as a continuous medium works fairly well in the low-frequency, long-wavelength domain of the infrared. Yet we certainly might expect that as the wavelength of the incident beam decreased the actual granular nature of matter would have to be reckoned with. Indeed, the continuum model shows large discrepancies from experimental results at optical frequencies. And so we again turn to the classical atomistic picture initially formulated by Hendrik Lorentz, Paul Karl Ludwig Drude (1863-1906), and others. This simple approach will provide qualitative agreement with the experimental data, but the ultimate treatment requires quantum theory.

#### The Dispersion Equation

Envision the conductor as an assemblage of driven, damped oscillators. Some correspond to free electrons and will therefore have zero restoring force, whereas others are bound to the atom,

much like those in the dielectric media of Section 3.5.1. The conduction electrons are, however, the predominant contributors to the optical properties of metals. Recall that the displacement of a vibrating electron was given by
$$
x(t)=\frac{q_{e} / m_{e}}{\left(\omega_{0}^{2}-\omega^{2}\right)} E(t)\tag{3.66}
$$

With no restoring force, $\omega_{0}=0$, the displacement is opposite in sign to the driving force $q_{e} E(t)$ and therefore $180^{\circ}$ out-of-phase with it. This is unlike the situation for transparent dielectrics, where the resonance frequencies are above the visible and the electrons oscillate in-phase with the driving force (Fig. 4.67). Free electrons oscillating out-of-phase with the incident light will reradiate wavelets that tend to cancel the incoming disturbance. The effect, as we have already seen, is a rapidly decaying refracted wave.

Assuming that the average field experienced by an electron moving about within a conductor is just the applied field $\overrightarrow{\mathbf{E}}(t)$, we can extend the dispersion equation of a rare medium [Eq. (3.72)] to read
$$
\begin{aligned}
&n^{2}(\omega)= 1+\\
&\frac{N q_{e}^{2}}{\epsilon_{0} m_{e}}\left[\frac{f_{e}}{-\omega^{2}+i \gamma_{e} \omega}+\sum_{j} \frac{f_{j}}{\omega_{0 j}^{2}-\omega^{2}+i \gamma_{j} \omega}\right]
\end{aligned}\tag{4.79}
$$

The first bracketed term is the contribution from the free electrons, wherein $N$ is the number of atoms per unit volume. Each of these has $f_{e}$ conduction electrons, which have no natural frequencies. The second term arises from the bound electrons and is identical to Eq. (3.72). It should be noted that if a metal has a particular color, it indicates that the atoms are partaking of selective absorption by way of the bound electrons, in addition to the general absorption characteristic of the free electrons. 
![530](4-Optics/images/img-95.jpeg.png)
> Figure 4.67 Oscillations of bound and free electrons.

Recall that a medium that is very strongly absorbing at a given frequency doesn't actually absorb much of the incident light at that frequency but rather selectively reflects it. Gold and copper are reddish yellow because $n_{I}$ increases with wavelength, and the larger values of $\lambda$ are reflected more strongly. Thus, for example, gold should be fairly opaque to the longer visible wavelengths. Consequently, under white light, a gold foil less than roughly $10^{-6} \mathrm{~m}$ thick will indeed transmit predominantly greenish blue light.

We can get a rough idea of the response of metals to light by making a few simplifying assumptions. Accordingly, neglect the bound electron contribution and assume that $\gamma_{e}$ is also negligible for very large $\omega$, whereupon
$$
n^{2}(\omega)=1-\frac{N q_{e}^{2}}{\epsilon_{0} m_{e} \omega^{2}}\tag{4.80}
$$

The latter assumption is based on the fact that at high frequencies the electrons will undergo a great many oscillations between each collision. Free electrons and positive ions within a metal may be thought of as a plasma whose density oscillates at a natural frequency $\omega_{p}$, the ***plasma frequency***. This in turn can be shown to equal $\left(N q_{e}^{2} / \epsilon_{0} m_{e}\right)^{1 / 2}$, and so
$$
n^{2}(\omega)=1-\left(\omega_{p} / \omega\right)^{2}\tag{4.81}
$$

The plasma frequency serves as a critical value below which the index is complex and the penetrating wave drops off exponentially [Eq. (4.77)] from the boundary; at frequencies above $\omega_{p}, n$ is real, absorption is small, and the conductor is transparent. In the latter circumstance $n$ is less than 1 , as it was for dielectrics at very high frequencies ( $v$ can be greater than $c$-see p. 82). Hence we can expect metals in general to be fairly transparent to X-rays. Table 4.4 lists the plasma frequencies for some of the alkali metals that are transparent even to ultraviolet.

|               | $\lambda_{p}$ <br> (observed) | $\lambda_{p}$ <br> (calculated) | $\nu_{p}=c / \lambda_{p}$ <br> (observed) |
| :------------ | :---------------------------: | :-----------------------------: | :---------------------------------------: |
| Metal         |              nm               |               nm                |                    Hz                     |
| Lithium (Li)  |              155              |               155               |           $1.94 \times 10^{15}$           |
| Sodium (Na)   |              210              |               209               |           $1.43 \times 10^{15}$           |
| Potassium (K) |              315              |               287               |           $0.95 \times 10^{15}$           |
| Rubidium (Rb) |              340              |               322               |           $0.88 \times 10^{15}$           |
> **TABLE 4.4** Critical Wavelengths and Frequencies for Some Alkali Metals

The index of refraction for a metal will usually be complex, and the impinging wave will suffer absorption in an amount that is frequency dependent. For example, the outer visors on the Apollo space suits were overlaid with a very thin film of gold (see photo). 

![300](4-Optics/images/img-96.jpeg.png)
> Edwin Aldrin Jr. at Tranquility Base on the Moon. The photographer, Neil Armstrong, is reflected in the gold-coated visor. (NASA)

The coating reflected about $70 \%$ of the incident light and was used under bright conditions, such as low and forward Sun angles. It was designed to decrease the thermal load on the cooling system by strongly reflecting radiant energy in the infrared while still transmitting adequately in the visible. Inexpensive metal-coated sunglasses, which are quite similar in principle, are also available commercially, and they're well worth having just to experiment with.

The ionized upper atmosphere of the Earth contains a distribution of free electrons that behave very much like those confined within a metal. The index of refraction of such a medium will be real and less than 1 for frequencies above $\omega_{p}$. In July of 1965 the Mariner IV spacecraft made use of this effect to examine the ionosphere of the planet Mars, 216 million kilometers from Earth.

If we wish to communicate between two distant terrestrial points, we might bounce low-frequency waves off the Earth's ionosphere. To speak to someone on the Moon, however, we should use high-frequency signals, to which the ionosphere would be transparent.

#### Reflection from a Metal

Imagine that a plane wave initially in air impinges on a conducting surface. The transmitted wave advancing at some angle to the normal will be inhomogeneous. But if the conductivity of the medium is increased, the wavefronts will become aligned with the surfaces of constant amplitude, whereupon $\overrightarrow{\mathbf{k}}_{i}$ and $\overrightarrow{\mathbf{u}}_{n}$ will approach parallelism. In other words, in a good conductor the transmitted wave propagates in a direction normal to the interface regardless of $\theta_{i}$.

Let's now compute the reflectance, $R=I_{s} / I_{i}$, for the simplest case of normal incidence on a metal. Taking $n_{i}=1$ and $n_{i}=\tilde{n}$ (i.e., the complex index), we have from Eq. (4.47) that
$$
R=\left(\frac{\tilde{n}-1}{\tilde{n}+1}\right)\left(\frac{\tilde{n}-1}{\tilde{n}+1}\right)^{*}\tag{4.82}
$$

and therefore, since $\tilde{n}=n_{R}-i n_{I}$,
$$
R=\frac{\left(n_{R}-1\right)^{2}+n_{I}^{2}}{\left(n_{R}+1\right)^{2}+n_{I}^{2}}\tag{4.83}
$$

If the conductivity of the material goes to zero, we have the case of a dielectric, whereupon in principle the index is real $\left(n_{I}=0\right)$, and the attenuation coefficient, $\alpha$, is zero. Under those circumstances, the index of the transmitting medium $n_{t}$ is $n_{R}$, and the reflectance [Eq. (4.83)] becomes identical with that of Eq. (4.67). If instead $n_{I}$ is large while $n_{R}$ is comparatively small, $R$ in turn becomes large (Problem 4.95). In the unattainable limit where $\tilde{n}$ is purely imaginary, $100 \%$ of the incident flux density would be reflected $(R=1)$. Notice that it is possible for the reflectance of one metal to be greater than that of another even though its $n_{I}$ is smaller. For example, at $\lambda_{0}=589.3 \mathrm{~nm}$ the parameters associated with solid sodium are roughly $n_{R}=0.04$, $n_{I}=2.4$, and $R=0.9$; and those for bulk tin are $n_{R}=1.5$, $n_{I}=5.3$, and $R=0.8$; whereas for a gallium single crystal $n_{R}=3.7, n_{I}=5.4$, and $R=0.7$.

The curves of $R_{\|}$and $R_{\perp}$ for oblique incidence shown in Fig. 4.68 are somewhat typical of absorbing media. Thus, although $R$ at $\theta_{i}=0$ is about 0.5 for gold, as opposed to nearly 0.9 for silver in white light, the two metals have reflectances that are quite similar in shape, approaching 1.0 at $\theta_{i}=90^{\circ}$. Just as with dielectrics (Fig. 4.56), $R_{\|}$drops to a minimum at what is now called the principal angle-of-incidence, but here that minimum is nonzero. Figure 4.69 illustrates the spectral reflectance at normal incidence for a number of evaporated metal films under ideal conditions. Observe that although gold transmits fairly well in and below the green region of the spectrum, silver, which is highly reflective across the visible, becomes transparent in the ultraviolet at about 316 nm .

![350](4-Optics/images/img-97.jpeg.png)
> Figure 4.68 Typical reflectance for a linearly polarized beam of white light incident on an absorbing medium.

![580](4-Optics/images/img-98.jpeg.png)
> Figure 4.69 Reflectance versus wavelength for silver, gold, copper, and aluminum.

Phase shifts arising from reflection off a metal occur in both components of the field (i.e., parallel and perpendicular to the plane-of-incidence). These are generally neither 0 nor $\pi$, with a notable exception at $\theta_{l}=90^{\circ}$, where, just as with a dielectric, both components shift phase by $180^{\circ}$ on reflection.

## 4.8 金属的光学特性
[!金属的光学特性]-

### 4.8.1 宏观视角：从麦克斯韦方程看金属中的光传播
首先，我们要理解金属与我们之前讨论的电介质（比如玻璃）最根本的区别是什么。

**1. 自由电子：金属的灵魂**
金属最显著的特征，就是其内部存在大量的 **自由电荷 (free electric charges)**，也就是我们常说的 **传导电子 (conduction electrons)**。这些电子不被束缚在特定的原子上，可以在整个金属晶格内自由移动，就像一片“电子的海洋”。

当我们施加一个电场 $\overrightarrow{\mathbf{E}}$ 时，这些自由电子就会定向移动，形成电流。单位面积的电流（即电流密度）与电场的关系由一个重要的物理量来描述，那就是 #电导率 ( #Conductivity ) $\sigma$。

- 对于理想的 **电介质 (dielectric)**，内部没有自由电子，所以 $\sigma = 0$。
- 对于真实的 **金属 (metal)**，$\sigma$ 是一个不为零的有限值。
- 对于一个理想化的 **“完美导体” (perfect conductor)**，我们假设其电导率 $\sigma$ 为无穷大。

**2. 金属中的波动方程：引入“阻尼”**
当电磁波（也就是光）进入金属时，它的电场会驱动这些自由电子运动。这个过程如何用数学语言描述呢？我们需要回到电磁理论的基石——麦克斯韦方程组。对于导电介质，我们可以推导出一个描述电场 $\overrightarrow{\mathbf{E}}$ 传播的波动方程：

$$
\frac{\partial^{2} \overrightarrow{\mathbf{E}}}{\partial x^{2}}+\frac{\partial^{2} \overrightarrow{\mathbf{E}}}{\partial y^{2}}+\frac{\partial^{2} \overrightarrow{\mathbf{E}}}{\partial z^{2}}=\mu \epsilon \frac{\partial^{2} \overrightarrow{\mathbf{E}}}{\partial t^{2}}+\mu \sigma \frac{\partial \overrightarrow{\mathbf{E}}}{\partial t}\tag{4.74}
$$

**公式详解：**
- 这个方程的左边描述了电场在空间上的变化。
- 右边的第一项 $\mu \epsilon \frac{\partial^{2} \overrightarrow{\mathbf{E}}}{\partial t^{2}}$ 是我们在真空中或理想电介质中已经很熟悉的一项，它描述了电磁场的振荡和传播。
- **关键在于右边的第二项：$\mu \sigma \frac{\partial \overrightarrow{\mathbf{E}}}{\partial t}$**。
    - 这一项是金属区别于电介质的核心。它包含了电导率 $\sigma$，并且是电场对时间的一阶导数。
    - **物理本质：** 这一项代表了 **能量的耗散**。变化的电场 $\overrightarrow{\mathbf{E}}$ 驱动自由电子运动形成电流，但由于金属存在电阻（有限的电导率），电子在运动中会与晶格中的原子发生碰撞，将电磁能不可逆地转化为内能，这就是 **焦耳热 (Joule heat)**。这个过程就是 **吸收 (absorption)**。
    - **类比：** 我们可以把它想象成一个振动系统中的 **阻尼项**。就像一个在空气中摆动的秋千，空气阻力会使它的振幅越来越小，最终停下来。在金属中，这个 $\mu \sigma \frac{\partial \overrightarrow{\mathbf{E}}}{\partial t}$ 项就扮演了“空气阻力”的角色，使得电磁波的能量被不断消耗，振幅减小。

**3. 复折射率：一个巧妙的数学工具**
直接求解上面这个带有“阻尼项”的波动方程比较复杂。但物理学家们想出了一个非常聪明的办法：他们将介电常数 $\epsilon$ 改造为一个复数，这自然而然地就引出了一个 #复折射率 ( #Complex-Refractive-Index ) $\tilde{n}$ 的概念。

我们定义复折射率 $\tilde{n}$ 为：
$$
\tilde{n}=n_{R}-i n_{I}\tag{4.75}
$$

- 这里的 $n_{R}$ 和 $n_{I}$ 都是实数。$n_{R}$ 被称为折射率的 **实部**，而 $n_{I}$ 被称为 **虚部**，有时也叫 **消光系数 (extinction coefficient)**。
- 引入复折射率后，我们就可以像处理普通非导电介质一样，直接使用平面波的解，只不过把原来的实数折射率 $n$ 替换成复数 $\tilde{n}$。

**4. 衰减的波：深入理解复折射率的物理意义**
让我们来看一下，将复折射率代入平面波的表达式后会发生什么。假设一束平面波沿 y 轴正方向传播，其电场可以写为：
$$
\overrightarrow{\mathbf{E}}=\overrightarrow{\mathbf{E}}_{0} \cos \omega(t-\tilde{n} y / c)
$$

现在，我们将 $\tilde{n}=n_{R}-i n_{I}$ 代入，并利用欧拉公式 $e^{i\theta} = \cos\theta + i\sin\theta$ 将其写成指数形式：
$$
\overrightarrow{\mathbf{E}}=\overrightarrow{\mathbf{E}}_{0} \operatorname{Re}\left[e^{i \omega(t-\tilde{n} y / c)}\right] = \overrightarrow{\mathbf{E}}_{0} \operatorname{Re}\left[e^{i \omega(t-(n_R-in_I) y / c)}\right]
$$

展开指数项：
$$
\overrightarrow{\mathbf{E}}=\overrightarrow{\mathbf{E}}_{0} \operatorname{Re}\left[e^{i \omega(t-n_R y / c)} \cdot e^{i \omega(in_I y / c)}\right] = \overrightarrow{\mathbf{E}}_{0} \operatorname{Re}\left[e^{i \omega(t-n_R y / c)} \cdot e^{-\omega n_I y / c}\right]
$$

取其实部，我们就得到了波在金属中传播的最终形式：
$$
\overrightarrow{\mathbf{E}}=\overrightarrow{\mathbf{E}}_{0} e^{-\omega n_{I} y / c} \cos \omega\left(t-n_{R} y / c\right)\tag{4.77}
$$

**公式剖析：**
- **振荡与传播部分：** $\cos \omega\left(t-n_{R} y / c\right)$
    - 这部分和在普通介质中的波完全一样。波的传播速度由 $n_{R}$ 决定，为 $v = c / n_{R}$。所以，$n_{R}$ 扮演了我们通常理解的折射率的角色，决定了相速度。
- **振幅衰减部分：** $\overrightarrow{\mathbf{E}}_{0} e^{-\omega n_{I} y / c}$
    - 这是全新的部分！波的振幅不再是一个常数 $\overrightarrow{\mathbf{E}}_{0}$，而是随着传播距离 $y$ 的增加，按照 **指数形式快速衰减**。
    - **衰减的快慢由 $n_{I}$ 决定**。$n_{I}$ 越大，衰减得越快。这就是复折射率虚部的物理意义：**它描述了波在介质中被吸收的强度**。

**5. 趋肤深度：光在金属中能走多远？**
光的辐照度 $I$（也就是我们通常说的光强）与电场振幅的平方成正比。因此，
$$
I(y) \propto \left(E_0 e^{-\omega n_I y/c}\right)^2 = E_0^2 e^{-2\omega n_I y/c}
$$

我们可以将其写为：
$$
I(y)=I_{0} e^{-\alpha y}\tag{4.78}
$$

- $I_0$ 是光在进入金属表面（$y=0$）时的初始辐照度。
- $\alpha \equiv 2 \omega n_{I} / c$ 被称为 #衰减系数 ( #Attenuation-Coefficient )。它直接量化了光在金属中被吸收的剧烈程度。
- 当波传播了 $y = 1/\alpha$ 的距离后，辐照度会下降为初始值的 $I_0 e^{-1} \approx 0.37 I_0$（大约三分之一）。这个特殊的距离 $1/\alpha$ 被称为 #趋肤深度 ( #Skin-Depth ) 或 #穿透深度 ( #Penetration-Depth )。

**趋肤深度的物理意义：** 它衡量了电磁波能够有效穿透到导体内部的深度。
对于金属来说，这个深度非常非常小。例如：
- 对于铜，在紫外波段（$\lambda_0 \approx 100 \text{ nm}$），穿透深度只有约 0.6 nm。
- 即使在红外波段（$\lambda_0 \approx 10000 \text{ nm}$），穿透深度也只有约 6 nm。

这个数值比一张纸的厚度还要小成千上万倍！这完美地解释了 **为什么金属通常是不透明的**。光刚刚进入金属表面，就在极短的距离内被迅速吸收殆尽。

**6. 金属光泽的来源：高反射率**
既然光无法有效进入金属内部，那么入射到金属表面的能量去了哪里呢？根据能量守恒，大部分能量必然以反射光的形式重新辐射出去。这就是我们看到的明亮的 **金属光泽 (metallic sheen)** 的来源。

可以这样理解：因为只有极少数电子（在趋肤深度内的电子）能“看到”并吸收透射波的能量，所以总的吸收能量占入射能量的比例很小。大部分能量被表层的自由电子重新辐射，形成了强烈的反射波。

大多数金属，如铝、锡、钢、钠、钾等，对所有可见光波段的光都具有很高的反射率（大约 85-95%），因此它们看起来是银灰色或白色的。
![530](4-Optics/images/img-95.jpeg.png)
> 图 4.67 束缚电子与自由电子的振荡。束缚电子（如在电介质中）的振荡可能与驱动场同相，而金属中的自由电子振荡则与驱动场反相。

---

### 4.8.2 微观图像：从电子振荡看金属光学特性
宏观的连续介质模型在低频（如红外）区域效果不错，但在可见光及更高频率的波段，它就显得力不从心了。为了更深刻地理解金属的光学行为，我们需要深入到原子和电子的微观世界，采用由洛伦兹 (Hendrik Lorentz) 和德鲁德 (Paul Drude) 等人发展的经典原子模型。

**1. 自由电子的响应：180°反相振荡**
我们将金属看作是大量“受迫振动的阻尼振子”的集合。这些振子分为两类：
- **束缚电子：** 像在电介质中一样，被束缚在原子核周围，有特定的固有振动频率 $\omega_0$。
- **自由电子：** 不受原子核的束缚力，可以认为它们的 **恢复力为零**，因此 **固有频率 $\omega_0 = 0$**。

在金属中，自由电子的贡献是主导性的。回忆一下我们之前学过的受迫振动模型，电子的位移 $x(t)$ 与驱动电场 $E(t)$ 的关系是：
$$
x(t)=\frac{q_{e} / m_{e}}{\left(\omega_{0}^{2}-\omega^{2}\right)} E(t)\tag{3.66}
$$

对于自由电子，我们令 $\omega_0 = 0$，则上式变为：
$$
x(t)=\frac{q_{e} / m_{e}}{-\omega^{2}} E(t)
$$

**这里的物理图像至关重要：**
- 由于分母中有一个负号，电子的位移 $x(t)$ 的方向总是与驱动力 $q_e E(t)$ 的方向相反。这意味着 **自由电子的振荡与驱动它的光波电场之间，存在 180° 的相位差**。
- 这与透明电介质的情况完全不同。在透明电介质中，光的频率 $\omega$ 远小于电子的固有频率 $\omega_{0j}$（通常在紫外区），所以分母 $(\omega_{0j}^2 - \omega^2)$ 是正的，电子与光场 **同相振荡**。
- **反相振荡会产生什么后果？** 振荡的电子自身会向外辐射电磁波（次级波）。这些与入射波反相的次级波，会与入射波发生干涉相消。这种相消效应正是导致入射波在进入金属后迅速衰减的微观原因。

**2. 金属的色散方程**
综合考虑自由电子和束缚电子的贡献，我们可以得到金属的 #色散方程 ( #Dispersion-Equation )，它描述了折射率 $n$ 如何随频率 $\omega$ 变化：
$$
n^{2}(\omega)= 1+\frac{N q_{e}^{2}}{\epsilon_{0} m_{e}}\left[\frac{f_{e}}{-\omega^{2}+i \gamma_{e} \omega}+\sum_{j} \frac{f_{j}}{\omega_{0 j}^{2}-\omega^{2}+i \gamma_{j} \omega}\right]\tag{4.79}
$$

**公式详解：**
- $N$ 是单位体积内的原子数。
- $q_e, m_e$ 是电子的电荷和质量。
- **第一项（方括号内）：** 来自 **自由电子** 的贡献。
    - $f_e$ 是每个原子提供的自由电子数。
    - 分母中没有 $\omega_0^2$ 项，因为自由电子没有恢复力。
    - $i\gamma_e\omega$ 是阻尼项，代表电子碰撞带来的能量损失。
- **第二项（求和项）：** 来自 **束缚电子** 的贡献，这部分与我们之前在电介质中学习的形式完全相同。
    - $f_j$ 是对应于固有频率 $\omega_{0j}$ 的振子强度。
    - $\gamma_j$ 是束缚电子的阻尼系数。

**3. 金属的颜色：自由电子与束缚电子的合奏**
- **自由电子** 的贡献（公式中的第一项）导致了在很宽的频率范围内普遍的高反射率，这是金属呈现银白色光泽的主要原因。
- **束缚电子** 的贡献（公式中的第二项）则带来了 **选择性吸收**。如果某种金属的束缚电子在可见光区域有特定的吸收峰，那么这种金属就会呈现出颜色。
    - **示例：黄金 (Gold) 和铜 (Copper)** 它们呈现红黄色，是因为它们的束缚电子吸收了可见光谱中蓝色和绿色的部分，从而将黄色和红色的光更多地反射出来。
    - 一个有趣的现象是，如果我们将金箔做得非常非常薄（比如小于 $10^{-6}$ 米），在白光照射下，它透过的光会是蓝绿色的。这恰恰是因为它强烈反射（吸收）了黄红光，而让蓝绿光通过了。

#### 4.8.3 等离子体频率：金属透明与否的分界线
为了抓住主要矛盾，我们可以对色散方程做一个简化，来理解一个极其重要的概念。我们暂时忽略束缚电子的贡献，并假设在高频下，电子碰撞的阻尼效应 $\gamma_e$ 也可以忽略（因为在高频下，电子在两次碰撞之间已经振荡了成千上万次）。

这样，色散方程 (4.79) 就简化为：
$$
n^{2}(\omega)=1-\frac{N q_{e}^{2}}{\epsilon_{0} m_{e} \omega^{2}}\tag{4.80}
$$

物理学家们将上式中的常数组合定义为一个特殊的频率，称为 #等离子体频率 ( #Plasma-Frequency ) $\omega_p$：
$$
\omega_p^2 = \frac{N q_{e}^{2}}{\epsilon_{0} m_{e}}
$$

于是，简化的色散关系可以写成一个非常简洁优美的形式：
$$
n^{2}(\omega)=1-\left(\frac{\omega_{p}}{\omega}\right)^{2}\tag{4.81}
$$

**等离子体频率 $\omega_p$ 是一个临界频率，它决定了金属的核心光学行为：**
- **当入射光频率 $\omega < \omega_p$ 时 (低频区):**
    - $(\omega_p / \omega)^2 > 1$，所以 $n^2(\omega)$ 是一个 **负数**。
    - 这意味着折射率 $n$ 是一个 **纯虚数** ($n = i\sqrt{(\omega_p/\omega)^2 - 1}$)。
    - 根据我们之前的讨论，一个纯虚数的折射率（即 $n_R=0, n_I \neq 0$）意味着 **极强的衰减和反射**。此时，金属是不透明的，表现出高反射率。
    - **物理图像：** 在低频下，电场变化得足够慢，自由电子可以充分响应，其运动产生的反向电场几乎完全抵消了入射电场，阻止其进入金属内部。

- **当入射光频率 $\omega > \omega_p$ 时 (高频区):**
    - $(\omega_p / \omega)^2 < 1$，所以 $n^2(\omega)$ 是一个 **正数**，且小于 1。
    - 这意味着折射率 $n$ 是一个 **实数**，且 $n < 1$。
    - 一个实数折射率意味着 **吸收很小**，介质是 **透明的**！
    - **物理图像：** 在高频下，入射电场振荡得太快了，自由电子由于惯性根本来不及响应。它们几乎“原地不动”，无法形成有效的屏蔽电场。因此，电磁波可以畅通无阻地穿过金属，就像穿过真空一样。

**实际应用与例子：**
- **碱金属对紫外线透明：** 像锂、钠、钾等金属的等离子体频率恰好落在紫外区。因此，它们对可见光不透明，但对频率更高的紫外线是透明的。


| 金属 | 观测到的 $\lambda_{p}$ (nm) | 计算的 $\lambda_{p}$ (nm) | 观测到的 $\nu_{p}=c / \lambda_{p}$ (Hz) |
| :--- | :---: | :---: | :---: |
| 锂 (Li) | 155 | 155 | $1.94 \times 10^{15}$ |
| 钠 (Na) | 210 | 209 | $1.43 \times 10^{15}$ |
| 钾 (K) | 315 | 287 | $0.95 \times 10^{15}$ |
| 铷 (Rb) | 340 | 322 | $0.88 \times 10^{15}$ |
> **表 4.4** 一些碱金属的临界波长和频率

- **所有金属对X射线透明：** X射线的频率远远高于所有金属的等离子体频率，因此X射线可以轻易穿透金属，这也是X光安检和医学成像的原理。
- **地球电离层与无线电通信：** 地球高空的电离层充满了自由电子，就像一个巨大的“等离子体气团”。
    - 对于低频的无线电波（如AM广播），其频率 $\omega < \omega_p$，电离层会像金属一样将其反射回地面，使得远距离无线电通信成为可能。
    - 对于高频的无线电波（如FM广播、卫星通信的微波），其频率 $\omega > \omega_p$，电离层对它们是透明的。所以我们要和月球上的宇航员通话，就必须使用高频信号，让它穿透电离层。

![300](4-Optics/images/img-96.jpeg.png)
> 月球上的宇航员埃德温·奥尔德林。摄影师尼尔·阿姆斯特朗的身影反射在涂有金膜的头盔面罩上。(NASA)

阿波罗宇航员头盔面罩上镀了一层极薄的金膜。这层金膜可以强烈反射红外线（热辐射），同时允许足够的可见光通过，从而有效降低宇航服冷却系统的负担。

---

### 4.8.4 金属的反射：定量分析
现在我们已经理解了金属高反射率背后的物理原因，让我们来定量地计算一下反射率。

**1. 法向入射的反射率**
考虑最简单的情况：光从空气（折射率 $n_i \approx 1$）垂直入射到金属表面（复折射率 $n_t = \tilde{n}$）。我们借用菲涅尔方程中关于反射率 $R$ 的公式：
$$
R = \left| \frac{n_t - n_i}{n_t + n_i} \right|^2 = \left| \frac{\tilde{n} - 1}{\tilde{n} + 1} \right|^2
$$

为了计算这个模的平方，我们需要用表达式乘以它的 #复共轭 ( #Complex-Conjugate )：
$$
R=\left(\frac{\tilde{n}-1}{\tilde{n}+1}\right)\left(\frac{\tilde{n}-1}{\tilde{n}+1}\right)^{*}\tag{4.82}
$$

代入 $\tilde{n} = n_R - i n_I$：
$$
R = \left( \frac{(n_R - 1) - i n_I}{(n_R + 1) - i n_I} \right) \left( \frac{(n_R - 1) + i n_I}{(n_R + 1) + i n_I} \right)
$$

分子分母分别计算模的平方（$|a+ib|^2 = a^2+b^2$）：
$$
R=\frac{\left(n_{R}-1\right)^{2}+n_{I}^{2}}{\left(n_{R}+1\right)^{2}+n_{I}^{2}}\tag{4.83}
$$

**公式分析：**
- 如果 $n_I \to 0$（即介质为理想电介质），则公式退化为我们熟悉的 $R = (\frac{n_R-1}{n_R+1})^2$，与之前的结论一致。
- 如果 $n_I$ 很大（金属的典型特征），即使 $n_R$ 不大，分母和分子都会被 $n_I^2$ 项主导，使得 $R$ 的值趋近于 1。例如，在一个理想化的纯虚数折射率（$n_R=0$）的情况下，$R = \frac{1+n_I^2}{1+n_I^2} = 1$，即 100% 反射。
- 有趣的是，反射率不仅取决于 $n_I$，也和 $n_R$ 有关。例如，在钠黄光（589.3 nm）下：
    - 钠 (Na): $n_R \approx 0.04, n_I \approx 2.4$, 计算得 $R \approx 0.9$ (高反射率)
    - 锡 (Sn): $n_R \approx 1.5, n_I \approx 5.3$, 计算得 $R \approx 0.8$
    - 镓 (Ga): $n_R \approx 3.7, n_I \approx 5.4$, 计算得 $R \approx 0.7$
    这表明，即使锡和镓的 $n_I$ 比钠更大，但由于它们的 $n_R$ 也很大，导致整体反射率反而低于钠。

**2. 斜向入射的反射**
当光以一定角度 #斜向入射 ( #Oblique-Incidence ) 到金属表面时，情况会更复杂。
![350](4-Optics/images/img-97.jpeg.png)
> 图 4.68 一束线偏振白光入射到吸收介质上时的典型反射率曲线。

上图展示了金属反射率随入射角 $\theta_i$ 的变化情况，分为平行偏振光（$R_\|$）和垂直偏振光（$R_\perp$）。
- 与电介质类似，$R_\perp$ 随角度单调递增。
- $R_\|$ 会先下降到一个最小值，然后再迅速上升。这个出现最小值的入射角被称为 #主入射角 ( #Principal-Angle-of-Incidence )。
- **与电介质的关键区别：** 对于金属，这个最小值 **不为零**。也就是说，金属不存在布儒斯特角那样的完美透射点。

**3. 反射率的光谱**
![580](4-Optics/images/img-98.jpeg.png)
> 图 4.69 银、金、铜和铝在法向入射时的反射率与波长的关系。

这张图信息量很大：
- **银 (Silver):** 在整个可见光范围内都具有非常高的反射率，所以呈现明亮的银白色。但在紫外区约 316 nm 处，反射率急剧下降，这意味着银对该波段的紫外线是透明的。这正是银的等离子体频率所在的位置！
- **金 (Gold) 和 铜 (Copper):** 在光谱的蓝绿区域反射率较低，而在黄红区域反射率很高，这正是它们呈现红黄色的原因。
- **铝 (Aluminum):** 在可见光和近紫外区都有相当平坦且高的反射率，因此也是制作镜子的优良材料。

最后，关于 **相位移动 (phase shift)**，光从金属表面反射时，平行和垂直分量都会发生相位变化，但通常既不是0也不是$\pi$（除了在掠射 $\theta_i=90^\circ$ 时，两者都突变 $180^\circ$）。

---

### 关键结论与知识点总结
1.  **金属的核心特征**：存在大量自由电子，导致其具有高电导率和独特的与光相互作用的方式。
2.  **宏观模型**：金属中的波动方程比电介质中多了一个与电导率 $\sigma$ 相关的“阻尼项”，代表焦耳热耗散，即光的吸收。
3.  **复折射率 $\tilde{n} = n_R - i n_I$**：一个强大的数学工具。实部 $n_R$ 决定相速度，虚部 $n_I$ 决定波的指数衰减。
4.  **趋肤深度（穿透深度）**：光在金属中强度衰减到 $1/e$ 的距离，通常非常小，这解释了为何金属不透明。
5.  **高反射率的来源**：由于光无法深入金属内部，大部分能量在表面被反射，形成金属光泽。
6.  **微观模型（德鲁德模型）**：自由电子没有恢复力（$\omega_0=0$），其振荡与驱动光场有 180° 的相位差。这种反相振荡产生的次级波会抵消入射波，导致波的快速衰减。
7.  **金属的颜色**：普遍的高反射率（银白色）主要来自自由电子的贡献；而特定的颜色（如金、铜）则源于束缚电子在可见光区的选择性吸收。
8.  **等离子体频率 $\omega_p$**：一个临界频率。当光频 $\omega < \omega_p$ 时，金属反射光，不透明；当光频 $\omega > \omega_p$ 时，金属变得透明（如金属对X射线透明）。
9.  **金属的反射率**：可以用包含复折射率的菲涅尔方程计算。对于斜向入射，存在一个反射率不为零的极小值点，对应的角度称为主入射角。

---

### 专业术语/关键词中英对照表
-   #电导率 ( #Conductivity )
-   #复折射率 ( #Complex-Refractive-Index )
-   #衰减系数 ( #Attenuation-Coefficient )
-   #趋肤深度 ( #Skin-Depth )
-   #穿透深度 ( #Penetration-Depth )
-   #色散方程 ( #Dispersion-Equation )
-   #等离子体频率 ( #Plasma-Frequency )
-   #法向入射 ( #Normal-Incidence )
-   #复共轭 ( #Complex-Conjugate )
-   #斜向入射 ( #Oblique-Incidence )
-   #主入射角 ( #Principal-Angle-of-Incidence )



## 4.9 Familiar Aspects of the Interaction of Light and Matter

Let's now examine some of the phenomena that paint the everyday world in a marvel of myriad colors.

As we saw earlier (p. 87), light that contains a roughly equal amount of every frequency in the visible region of the spectrum is perceived as white. A broad source of white light (whether natural or artificial) is one for which every point on its surface can be imagined as sending out a stream of light of every visible frequency. Given that we evolved on this planet, it's not surprising that a source appears white when its emission spectrum resembles that of the Sun. Similarly, a reflecting surface that accomplishes essentially the same thing will also appear white: a highly reflecting, frequency-independent, diffusely scattering object will be perceived as white under white light illumination.

Although water is essentially transparent, water vapor appears white, as does ground glass. The reason is simple enoughif the grain size is small but larger than the wavelengths involved, light will enter each transparent particle, be reflected and refracted, and emerge. There will be no distinction among any of the frequency components, so the reflected light reaching the observer will be white (p. 87). This is the mechanism accountable for the whiteness of things like sugar, salt, paper, cloth, clouds, talcum powder, snow, and paint, each grain or fiber of which is actually transparent.

Similarly, a wadded-up piece of crumpled clear plastic wrap will appear whitish, as will an ordinarily transparent material filled with small air bubbles (e.g., shaving cream or beaten egg white). Even though we usually think of paper, talcum powder, and sugar as each consisting of some sort of opaque white substance, it's an easy matter to dispel that misconception. Cover a printed page with a few of these materials (a sheet of white paper, some grains of sugar, or talcum) and illuminate it from behind. You'll have little difficulty seeing through them. In the case of white paint, one simply suspends colorless transparent particles, such as the oxides of zinc, titanium, or lead, in an equally transparent vehicle, for example, linseed oil or acrylics. Obviously, if the particles and vehicle have the same index of refraction, there will not be any reflections at the grain boundaries. The particles will simply disappear into the conglomeration, which itself remains clear. In contrast, if the indices are markedly different, there will be a good deal of reflection at all wavelengths (Problem 4.72), and the paint will appear white and opaque [take another look at Eq. (4.67)]. To color paint one need only dye the particles so that they absorb all frequencies except the desired range.

Carrying the logic in the reverse direction, if we reduce the relative index, $n_{H}$, at the grain or fiber boundaries, the particles of material will reflect less, thereby decreasing the overall whiteness of the object. Consequently, a wet white tissue will have a grayish, more transparent look. Wet talcum powder loses its sparkling whiteness, becoming a dull gray, as does wet white cloth. In the same way, a piece of dyed fabric soaked in a clear liquid (e.g., water, gin, or benzene) will lose its whitish haze and become much darker, the colors then being deep and rich like those of a still-wet watercolor painting.

A diffusely reflecting surface that absorbs somewhatuniformly across the spectrum-will reflect a bit less than a white surface and so appear mat gray. The less it reflects, the darker the gray, until it absorbs almost all the light and appears black. A surface that reflects perhaps $70 \%$ or $80 \%$ or more, but does so specularly, will appear the familiar shiny gray of a typical metal. Metals possess tremendous numbers of free electrons (p. 139) that scatter light very effectively, independent of frequency: they are not bound to the atoms and have no associated resonances. Moreover, the amplitudes of the vibrations are an order of magnitude larger than they were for the bound electrons. The incident light cannot penetrate into the metal any more than a fraction of a wavelength or so before it's canceled completely. There is little or no refracted light; most of the energy is reflected out, and only the small remainder is absorbed. Note that the primary difference between a gray surface and a mirrored surface is one of diffuse versus specular reflection. An artist paints a picture of a polished "white" metal, such as silver or aluminum, by "reflecting" images of things in the room on top of a gray surface.

#### Additive Coloration

When the distribution of energy in a beam of light is not effectively uniform across the spectrum, the light appears colored.

![420](4-Optics/images/img-99.jpeg.png)
> Figure 4.70 Reflection curves for blue, green, and red pigments. These are typical, but there is a great deal of possible variation among the colors.

Figure 4.70 depicts typical frequency distributions for what would be perceived as red, green, and blue light. These curves show the predominant frequency regions, but there can be a great deal of variation in the distributions, and they will still provoke the responses of red, green, and blue. In the early 1800s Thomas Young showed that a broad range of colors could be generated by mixing three beams of light, provided their frequencies were widely separated. When three such beams combine to produce white light, they are called ***primary colors***. There is no single unique set of these primaries, nor do they have to be quasimonochromatic. Since a wide range of colors can be created by mixing red (R), green (G), and blue (B), these tend to be used most frequently. They are the three components (emitted by three phosphors) that generate the whole gamut of hues seen on a color television set.

Figure 4.71 summarizes the results when beams of these three primaries are overlapped in a number of different combinations:

| $\lambda(\mathrm{nm})$ | Spectral Line              |
| :--------------------- | :------------------------- |
| 334.1478               | ultraviolet mercury line   |
| 365.0146               | ultraviolet mercury line   |
| 404.6561               | violet mercury line        |
| 435.8343               | blue mercury line          |
| 479.9914               | blue cadmium line          |
| 486.1327               | blue hydrogen line         |
| 546.0740               | green mercury line         |
| 587.5618               | yellow helium line         |
| 589.2938               | yellow sodium line         |
|                        | (cener of the double line) |
| 632.8                  | helium neon laser          |
| 643.8469               | red cadmium line           |
| 656.2725               | red hydrogen line          |
| 676.4                  | krypton ion laser          |
| 694.3                  | ruby laser                 |
| 706.5188               | red helium line            |
| 768.2                  | red potassium line         |
| 852.11                 | infrared cesium line       |
| 1013.98                | infrared mercury line      |
| 1054                   | Nd: glass laser            |
| 1064                   | Nd: YAG laser              |
> **TABLE 4.5** Often-Used Wavelengths of Light, UV, and IR

Red light plus blue light is seen as magenta (M), a reddish purple; blue light plus green light is seen as cyan (C), a bluish green or turquoise; and perhaps most surprising, red light plus green light is seen as yellow $(\mathrm{Y})$. The sum of all three primaries is white:

$$
\begin{gathered}
\mathrm{R}+\mathrm{B}+\mathrm{G}=\mathrm{W} \\
\mathrm{M}+\mathrm{G}=\mathrm{W}, \text { since } \mathrm{R}+\mathrm{B}=\mathrm{M} \\
\mathrm{C}+\mathrm{R}=\mathrm{W}, \text { since } \mathrm{B}+\mathrm{G}=\mathrm{C} \\
\mathrm{Y}+\mathrm{B}=\mathrm{W}, \text { since } \mathrm{R}+\mathrm{G}=\mathrm{Y}
\end{gathered}
$$

![300](4-Optics/images/img-100.jpeg.png)
> Figure 4.71 Three overlapping beams of colored light. A color television set uses these same three primary light sourcesred, green, and blue.

![450](4-Optics/images/img-101.jpeg.png)
> Figure 4.72 A portion of the sodium spectrum. For obvious reasons it's called the sodium doublet.

Any two colored light beams that together produce white are said to be ***complementary***, and the last three symbolic statements exemplify that situation. Thus
$$
\begin{aligned}
\mathrm{R}+\mathrm{B}+\mathrm{G} & =\mathrm{W} \\
\mathrm{R}+\mathrm{B} & =\mathrm{W}-\mathrm{G}=\mathrm{M} \\
\mathrm{~B}+\mathrm{G} & =\mathrm{W}-\mathrm{R}=\mathrm{C} \\
\mathrm{R}+\quad \mathrm{G} & =\mathrm{W}-\mathrm{B}=\mathrm{Y}
\end{aligned}
$$

which means, for example, that a filter that absorbs blue out of white light passes yellow.

Because most people have little experience mixing light beams it usually comes as a surprise that red and green beams are seen as yellow, and that's true for lots of different reds and greens. The color-sensing cones on the retina essentially average the photon frequencies, and the brain "sees" yellow even though there might not be any yellow light present. For example, an amount of green at 540 nm plus about three times as much red at 640 nm is seen to be identical to yellow at 580 nm . And we can't tell the difference between the pure stuff and the blend; a bright yellow rose reflects strongly from above 700 nm down to about 540 nm . It gives us red, yellow, and green to ponder. Alas, without a spectrometer there is no way to know if that yellow shirt you are looking at is reflecting only wavelengths in the range from roughly 577 nm to 597 nm or not. Still, if you'd like to see some "yellow" photons, those bright yellow sodium vapor street lights that are so common nowadays are rich in light at 589 nm (see Fig. 4.72).

Suppose we overlap beams of magenta and yellow light:
$$
\mathrm{M}+\mathrm{Y}=(\mathrm{R}+\mathrm{B})+(\mathrm{R}+\mathrm{G})=\mathrm{W}+\mathrm{R}
$$
The result is a combination of red and white, or pink. That raises another point: we say a color is saturated, that it is deep and intense, when it does not contain any white light. As Fig. 4.73 shows, pink is unsaturated red—red superimposed on a background of white.
![450](4-Optics/images/img-102.jpeg.png)
> Figure 4.73 Spectral reflection of a pink pigment.

#### Subtractive Coloration

The mechanism responsible for the yellowish red hue of gold and copper is, in some respects, similar to the process that causes the sky to appear blue. Putting it rather succinctly, the molecules of air have resonances in the ultraviolet and will be driven into larger-amplitude oscillations as the frequency of the incident light increases toward the ultraviolet. They effectively take energy from and re-emit the blue component of sunlight in all directions, transmitting the complementary red end of the spectrum with little alteration. This is analogous to the selective reflection or scattering of yellow-red light that takes place at the surface of a gold film and the concomitant transmission of bluegreen light.

The characteristic colors of most substances have their origin in the phenomenon of ***selective*** or ***preferential absorption***. For example, water has a very faint green-blue tint because of its absorption of red light. That is, the $\mathrm{H}_{2} \mathrm{O}$ molecules have a broad resonance in the infrared, which extends somewhat into the visible. The absorption isn't very strong, so there is no accentuated reflection of red light at the surface. Instead it is transmitted and gradually absorbed out until at a depth of about 30 m of seawater, red is almost completely removed from the sunlight. This same process of selective absorption is responsible for the colors of brown eyes and butterflies, of birds and bees and cabbages and kings. Indeed, the great majority of objects in nature appear to have characteristic colors as the result of preferential absorption by pigment molecules. In contrast with most atoms and molecules, which have resonances in the ultraviolet and infrared, the pigment molecules must obviously have resonances in the visible. Yet visible photons have energies of roughly 1.6 eV to 3.2 eV , which, as you might expect, are on the low side for ordinary electron excitation and on the high side for excitation via molecular vibration. Despite this, there are atoms where the bound electrons form incomplete shells (gold, for example) and variations in the configuration of these shells provide a mode for low-energy excitation. In addition, there is the large group of organic dye molecules, which evidently also have resonances in the visible. All such substances, whether natural or synthetic, consist of long-chain molecules made up of regularly alternating single and double bonds in what is called a conjugated system. 

This structure is typified by the carotene molecule $\mathrm{C}_{40} \mathrm{H}_{56}$ (Fig. 4.74). The carotenoids range in color from yellow to red and are found in carrots, tomatoes, daffodils, dandelions, autumn leaves, and people. The chlorophylls are another group of familiar natural pigments, but here a portion of the long chain is turned around on itself to form a ring. In any event, conjugated systems of this sort contain a number of particularly mobile electrons known as pi electrons. They are not bound to specific atomic sites but instead can range over the relatively large dimensions of the molecular chain or ring. In the phraseology of Quantum Mechanics, we say that these are long-wavelength, low-frequency, and therefore low-energy, electron states. The energy required to raise a pi electron to an excited state is comparatively low, corresponding to that of visible photons. In effect, the molecule can be imagined as an oscillator having a resonance frequency in the visible.
![360](4-Optics/images/img-103.jpeg.png)
> Figure 4.74 The carotene molecule.

The energy levels of an individual atom are precisely defined; that is, the resonances are very sharp. With solids and liquids, however, the proximity of the atoms results in a broadening of the energy levels into wide bands. The resonances spread over a broad range of frequencies. Consequently, we can expect that a dye will not absorb just a narrow portion of the spectrum; indeed if it did, it would reflect most frequencies and appear nearly white.

Imagine a piece of stained glass with a resonance in the blue where it strongly absorbs. If you look through it at a white-light source composed of red, green, and blue, the glass will absorb blue, passing red and green, which is yellow (Fig. 4.75). The glass looks yellow: yellow cloth, paper, dye, paint, and ink all selectively absorb blue. If you peer at something that is a pure blue through a yellow filter, one that passes yellow and absorbs blue, the object will appear black. Here the filter colors the light yellow by removing blue, and we speak of the process as ***subtractive coloration***, as opposed to ***additive coloration***, which results from overlapping beams of light.
![430](4-Optics/images/img-104.jpeg.png)
> Figure 4.75 Yellow stained glass.

In the same way, fibers of a sample of white cloth or paper are essentially transparent, but when dyed each fiber behaves as if it were a chip of colored glass. The incident light penetrates the paper, emerging for the most part as a reflected beam only after undergoing numerous reflections and refractions within the dyed fibers. The exiting light will be colored to the extent that it lacks the frequency component absorbed by the dye. This is precisely why a leaf appears green, or a banana yellow.

A bottle of ordinary blue ink looks blue in either reflected or transmitted light. But if the ink is painted on a glass slide and the solvent evaporates, something rather interesting happens. The concentrated pigment absorbs so effectively that it preferentially reflects at the resonant frequency, and we are back to the idea that a strong absorber (larger $n_{I}$ ) is a strong reflector. Thus, concentrated blue-green ink reflects red, whereas redblue ink reflects green. Try it with a felt marker (overhead projector pens are best), but you must use reflected light, being careful not to inundate the sample with unwanted light from below. The most convenient way to accomplish that is to put colored ink onto a black surface that isn't very absorbant. For example, smear red ink over a black area on a glossy printed page (or better yet, on a black piece of plastic) and it will glow green in reflected light. Gentian violet, which you can buy in any drugstore, works beautifully. Put some on a glass slide and let it dry in a thick coat. Examine both the reflected and transmitted light-they will be complementary.

The whole range of colors (including red, green, and blue) can be produced by passing white light through various combinations of magenta, cyan, and yellow filters (Fig. 4.76). 

![430](4-Optics/images/img-105.jpeg.png)
> Figure 4.76 Transmission curves for colored filters.

These are the primary colors of subtractive mixing, the primaries of the paint box, although they are often mistakenly spoken of as red, blue, and yellow. They are the basic colors of the dyes used to make photographs and the inks used to print them. A picture in a magazine is not a source of colored light the way a T.V. screen is. White light from a lamp or the sky illuminates the page, different wavelengths are absorbed here and there, and what isn't removed is reflected to produce the "colored" optical field corresponding to the picture. Ideally, if you mix all the subtractive primaries together (either by combining paints or by stacking filters), you get no color, no light—black. Each removes a region of the spectrum, and together they absorb it all.

If the range of frequencies being absorbed spreads across the visible, the object will appear black. That is not to say that there is no reflection at all—you obviously can see a reflected image in a piece of black patent leather, and a rough black surface reflects also, only diffusely. If you still have those red and blue inks, mix them, add some green, and you'll get black.

![350](4-Optics/images/img-106.jpeg.png)
> Figure 4.77 Overlapping magenta, cyan, and yellow filters illuminated from the rear with white light.

Color filters work like inks and dyes; they absorb certain frequencies and pass what remains. All filters leak the frequencies they are supposed to remove and so the stronger the absorption (call it the "thicker" the filter), the purer the color it passes. Figure 4.77 illustrates overlapping magenta, cyan, and yellow filters and the resulting colors that would be transmitted under white light illumination. The colors are the same as those reflected from a photo printed with overlapping magenta, cyan, and yellow inks.

Suppose white light impinges on a cyan filter followed by a yellow filter, what would be passed? White light can be thought of as a combination of red, blue, and green. The cyan filter absorbs red and passes blue and green. The yellow filter absorbs the blue, and together they pass green. Varying the density of the filters (the thicknesses) changes the shade of green that results, just like adding more yellow to blue paint "lightens" the green. Again under white light, a thick yellow filter (that removes most of the blue) and a thin magenta filter (that passes lots of red and blue and some yellow) will together pass light that contains lots of red and a bit of yellow, and looks orange.

In addition to the above processes specifically related to reflection, refraction, and absorption, there are other color-generating mechanisms, which we shall explore later on. For example, scarabaeid beetles mantle themselves in the brilliant colors produced by diffraction gratings on their wing cases, and wavelengthdependent interference effects contribute to the color patterns seen on oil slicks, mother-of-pearl, soap bubbles, peacocks, and hummingbirds.

#### EXAMPLE 4.7

Each of five faces of a cube is painted with a single bright color: red, blue, magenta, cyan, and yellow; the last face is white. What color, if any, will each face appear when viewed through a magenta piece of stained glass? Explain your answers.

#### SOLUTION

A magenta filter passes red and blue and eats green. Red will stay red. Blue will stay blue. Magenta will stay magenta. Cyan will appear blue. Yellow will appear red. And white will appear magenta.

## 4.9 光与物质相互作用的常见现象
[!光与物质相互作用的常见现象]-

### 4.9.1 白、灰、黑与金属光泽的物理本质
在我们深入五彩斑斓的世界之前，我们首先需要理解最基础的色调：白色、灰色和黑色。

**1. 白色的本质：漫反射与散射**
首先，我们需要建立一个核心概念： #白光  ( #White-Light )。当一束光在可见光谱（约400纳米到700纳米）的每个频率（或波长）上都包含大致相等的能量时，我们的大脑就会将其感知为白色。我们赖以生存的太阳，其光谱就非常接近白光，因此我们演化出的视觉系统也将类似太阳光谱的光源视为白色。

那么，为什么一张白纸、一堆白糖或一朵云是白色的呢？它们本身并不是光源。这里的关键物理过程是 #漫反射  ( #Diffuse-Reflection )。
- **透明的微粒是关键**：你可能会惊讶地发现，构成白纸的纤维、白糖或食盐的晶体，甚至构成云的小水滴，它们本身几乎都是**透明**的！
- **光线的“迷宫之旅”**：当白光照射到这些由大量微小透明颗粒（其尺寸通常大于光的波长）组成的物质上时，光线会进入每一个颗粒。在每个颗粒的边界处（例如，纤维与空气的接触面），由于 #折射率  ( #Refractive-Index ) 的差异，光会发生复杂的**反射**和**折射**。
- **无差别的散射**：由于这些微粒的尺寸和朝向是随机的，光线会在其中经历无数次、朝向各个方向的反射和折射，就像在迷宫里弹跳一样。这个过程对所有频率（颜色）的光都是一视同仁的，没有任何一种颜色的光被特殊对待。最终，从物体表面“逃逸”出来、进入我们眼睛的光线，其光谱成分与入射的白光几乎完全相同。因此，我们感知到这个物体是白色的。

![420](4-Optics/images/img-99.jpeg.png)
> 图 4.70 蓝色、绿色和红色颜料的反射曲线。这些是典型曲线，但不同颜料之间可能存在很大差异。

这个原理可以解释很多现象：
- **白色物质**：糖、盐、纸、布、云、滑石粉、雪和白色涂料的白度都源于此。
- **人造白色**：白色涂料就是将折射率很高的透明颗粒（如氧化锌、二氧化钛）悬浮在同样透明的介质（如亚麻籽油或丙烯酸树脂）中。只要颗粒和介质的折射率差异足够大，光线在界面上就会发生强烈反射，使得涂料呈现不透明的白色。反之，如果颗粒和介质的折射率相同，光线将直接穿过，颗粒会“消失”，整个混合物将是透明的。
- **湿纸巾为何变暗？**：当你弄湿一张白纸或白布时，它会变得更灰暗、更透明。这是因为水填充了纤维之间的空气间隙。水与纤维的折射率差异远小于空气与纤维的折射率差异。根据我们之前学过的菲涅尔方程，折射率差异越小，界面处的反射就越弱。因此，更多的光会穿透纸张而不是被漫反射回来，导致它看起来更暗、更透明。

**2. 灰色与黑色的本质：均匀吸收**
- **灰色**：如果一个漫反射表面在整个可见光谱上都**均匀地吸收**一部分光，它就会呈现灰色。它反射的光谱成分和白光一样是均匀的，但强度更弱。吸收得越多，反射得越少，灰色就越深。
- **黑色**：当一个物体几乎吸收了所有照射到它上面的可见光时，它就呈现为黑色。当然，绝对的黑色是不存在的，任何黑色物体都会有少量反射，否则我们就根本看不见它了。

**3. 金属光泽的本质：自由电子与镜面反射**
金属（如银、铝）表面通常呈现一种闪亮的灰色或银白色。这与白纸的白色有本质区别。

- **镜面反射 vs. 漫反射**：白纸是漫反射，将光线散射到各个方向；而抛光的金属表面是 #镜面反射  ( #Specular-Reflection )，像镜子一样将光线以特定角度反射出去。艺术家在画一个抛光的银器时，会在灰色的基底上画出周围环境的倒影，正是为了表现这种镜面反射的特性。
- **自由电子的作用**：金属内部含有大量的 #自由电子  ( #Free-Electrons )，它们不束缚于任何特定的原子。当电磁波（光）入射时，这些自由电子可以非常高效地随电场振动，其振动幅度远大于束缚电子。这些振动的电子自身会产生新的电磁波，与入射波发生干涉。结果是，入射光在进入金属表面不到一个波长的极浅深度内就被完全抵消了。绝大部分能量以反射光的形式被“踢”了出去，只有极小部分被吸收。
- **无频率选择性**：由于自由电子的振动不受限于特定的原子能级跃迁（没有共振频率），它们对所有频率的可见光都能高效地反射。因此，金属在整个可见光谱范围内都具有很高的反射率，使其呈现出无色的、明亮的金属光泽。
>
> **表格 4.5** 常用的光、紫外和红外波长
>
> | $\lambda(\mathrm{nm})$ | 光谱线 |
> | :--------------------- | :------------------------- |
> | 334.1478 | 紫外汞线 |
> | 365.0146 | 紫外汞线 |
> | 404.6561 | 紫色汞线 |
> | 435.8343 | 蓝色汞线 |
> | 479.9914 | 蓝色镉线 |
> | 486.1327 | 蓝色氢线 |
> | 546.0740 | 绿色汞线 |
> | 587.5618 | 黄色氦线 |
> | 589.2938 | 黄色钠线（双线中心） |
> | 632.8 | 氦氖激光 |
> | 643.8469 | 红色镉线 |
> | 656.2725 | 红色氢线 |
> | 676.4 | 氪离子激光 |
> | 694.3 | 红宝石激光 |
> | 706.5188 | 红色氦线 |
> | 768.2 | 红色钾线 |
> | 852.11 | 红外铯线 |
> | 1013.98 | 红外汞线 |
> | 1054 | 钕玻璃激光 |
> | 1064 | 钕YAG激光 |

### 4.9.2 色彩的产生：加法混色与减法混色
当光束中的能量分布在光谱上不均匀时，光就会呈现出颜色。产生颜色的方式主要有两种。

### 4.9.3 加法混色：用光创造色彩 (Additive Coloration)
#加法混色  ( #Additive-Coloration ) 是指将不同颜色的光束叠加在一起，混合形成新的颜色。这就像在黑暗的舞台上，用不同颜色的聚光灯照射同一点。
**1. 三原色光**
19世纪初，托马斯·杨（Thomas Young）发现，通过混合三种频率（颜色）相距较远的光束，可以产生非常广泛的颜色范围。当这三种光束混合能产生白光时，它们就被称为 #三原色光  ( #Primary-Colors )。

最常用的三原色光是**红 (Red, R)**、**绿 (Green, G)** 和 **蓝 (Blue, B)**。这并非是唯一的组合，但它们能混合出非常宽的色域，并且与我们人眼视网膜上三种视锥细胞的感光特性相匹配。你家里的彩色电视机或手机屏幕，就是通过控制无数个微小的红、绿、蓝三色发光点（磷光体或LED）的亮度，来组合成你看到的万千色彩的。

![300](4-Optics/images/img-100.jpeg.png)
> 图 4.71 三束重叠的彩色光束。彩色电视机正是使用这三种光源：红、绿、蓝。

**2. 混色规则与互补色**
图 4.71 总结了三原色光混合的结果：
- **红光 + 绿光 = 黄光 (Yellow, Y)**：这是最令人意外的组合。我们稍后会深入解释。
- **绿光 + 蓝光 = 青光 (Cyan, C)**：一种蓝绿色，也叫天蓝色。
- **蓝光 + 红光 = 品红光 (Magenta, M)**：一种紫红色。
- **红光 + 绿光 + 蓝光 = 白光 (White, W)**

我们可以用简单的公式来表示：
$$
\mathrm{R}+\mathrm{G}+\mathrm{B}=\mathrm{W}
$$
任何两种颜色的光若能混合成白光，它们就互为 #互补色  ( #Complementary-Colors )。基于上面的公式，我们可以推导出：
$$
\begin{aligned}
\mathrm{M}+\mathrm{G} &= (\mathrm{R}+\mathrm{B})+\mathrm{G} = \mathrm{W} & \implies \text{品红与绿色互补} \\
\mathrm{C}+\mathrm{R} &= (\mathrm{B}+\mathrm{G})+\mathrm{R} = \mathrm{W} & \implies \text{青色与红色互补} \\
\mathrm{Y}+\mathrm{B} &= (\mathrm{R}+\mathrm{G})+\mathrm{B} = \mathrm{W} & \implies \text{黄色与蓝色互补}
\end{aligned}
$$
这个关系也可以反向理解，从白光中减去一种颜色，就会得到它的互补色：
$$
\begin{aligned}
\mathrm{W}-\mathrm{B} &= \mathrm{R}+\mathrm{G} = \mathrm{Y} & \implies \text{从白光中移除蓝色，剩下黄色} \\
\mathrm{W}-\mathrm{G} &= \mathrm{R}+\mathrm{B} = \mathrm{M} & \implies \text{从白光中移除绿色，剩下品红色} \\
\mathrm{W}-\mathrm{R} &= \mathrm{G}+\mathrm{B} = \mathrm{C} & \implies \text{从白光中移除红色，剩下青色}
\end{aligned}
$$
这个减法关系，为我们接下来要讲的“减法混色”埋下了伏笔。

**3. “红 + 绿 = 黄”的生理学解释**
为什么红光和绿光混合会看起来是黄色？这里必须强调，这并非一个纯粹的物理现象，而是一个**生理-心理**现象。我们视网膜上的视锥细胞主要有三种，分别对红、绿、蓝光最敏感。当红光和绿光同时进入眼睛时，红色和绿色视锥细胞都被激发。大脑接收到这两个信号后，将其“平均”或“解码”为一种我们称之为“黄色”的感觉。

这意味着，我们看到的黄色，可能是由波长约为580纳米的纯黄色光（比如钠灯发出的光，见图4.72）引起的，也可能是由特定比例的红光（如640纳米）和绿光（如540纳米）混合而成的。在没有光谱仪的情况下，我们的大脑无法区分这两种“黄色”。一朵鲜艳的黄玫瑰，它反射的光谱覆盖了从红到绿的宽广范围，我们的大脑便将其整合解读为黄色。

![450](4-Optics/images/img-101.jpeg.png)
> 图 4.72 钠光谱的一部分。它被称为钠双线，原因显而易见。

**4. 颜色的饱和度**
当我们说一种颜色是 #饱和的  ( #Saturated )，意思是它非常纯粹、浓烈，不含任何白光成分。反之，不饱和的颜色就是纯色与白光的混合。

例如，**粉红色**其实就是不饱和的红色。它是在白光背景上叠加了红色光，或者说，是红色光谱上叠加了一个平坦的、覆盖所有可见光的“白光”背景。
$$
\mathrm{M}+\mathrm{Y}=(\mathrm{R}+\mathrm{B})+(\mathrm{R}+\mathrm{G})=\mathrm{W}+\mathrm{R} = \text{粉红色}
$$
这里，品红(M)和黄色(Y)光束混合，得到的是白光(W)和额外一份红光(R)的组合，即粉红色。

![450](4-Optics/images/img-102.jpeg.png)
> 图 4.73 粉色颜料的光谱反射曲线。

### 4.9.4 减法混色：靠吸收创造色彩 (Subtractive Coloration)
现在我们来看第二种，也是自然界中更常见的颜色产生机制： #减法混色  ( #Subtractive-Coloration )。它不是将光束相加，而是从白光中“减去”或“移除”某些颜色。我们看到的大多数物体的颜色，如树叶的绿色、香蕉的黄色、衣服的颜色，都源于此。
**1. 核心机制：选择性吸收**
其核心物理过程是 #选择性吸收  ( #Selective-Absorption )。当白光照射到一个物体上时，物体表面的分子会吸收特定频率（颜色）的光，而将其余频率的光反射或透射出去。我们看到的颜色，正是这些“剩下”的光的组合。

- **示例：蓝色玻璃**：一块蓝色玻璃为什么是蓝色的？因为它内部的颜料分子强烈吸收了光谱中的黄色、橙色和红色部分，而让蓝色和部分绿色的光通过。所以透过它看白光，你会看到蓝色。
- **示例：绿叶**：叶绿素分子强烈吸收光谱中的蓝色和红色部分，而反射绿色部分。所以我们看到的叶子是绿色的。

**2. 吸收的微观原理：分子共振**
为什么特定分子只吸收特定颜色的光？这与分子的内部结构和量子力学有关。

- **能级与共振**：原子和分子内部的电子只能存在于特定的 #能级  ( #Energy-Levels ) 上。当一个光子的能量恰好等于某两个能级之间的能量差时（$E_{photon} = hf = E_{final} - E_{initial}$），这个光子就可能被电子吸收，使电子从低能级“跃迁”到高能级。这个过程就像一个秋千，只有在特定的频率下推它，它才会越荡越高，我们称之为 #共振  ( #Resonance )。
- **颜料分子的特殊性**：大多数简单分子（如氮气、氧气）的能级差很大，其共振频率在能量更高的紫外区。而可见光光子的能量（约1.6 eV至3.2 eV）相对较低。颜料分子之所以特殊，是因为它们拥有能够吸收可见光的结构。
- **共轭体系与π电子**：许多有机染料分子，如胡萝卜中的胡萝卜素（图 4.74），都具有一种叫做 #共轭体系  ( #Conjugated-System ) 的结构，即分子链中单键和双键交替出现。在这种长链或环状结构中，存在一类非常活跃的电子，称为 #π电子  ( #Pi-Electrons )。它们不局限于某个特定的原子，而可以在整个分子链上自由移动。根据量子力学，运动范围越大，粒子的能量就越低。因此，这些π电子的能级间隔较小，恰好落在可见光光子的能量范围内。当特定颜色的可见光照射时，π电子就会吸收光子能量发生跃迁，从而使分子呈现出颜色。
![360](4-Optics/images/img-103.jpeg.png)
> 图 4.74 胡萝卜素分子结构。

**3. 减法混色的三原色**
与加法混色的RGB不同，减法混色的三原色是**青色(Cyan, C)**、**品红色(Magenta, M)** 和 **黄色(Yellow, Y)**。这正是打印机墨盒里的三种颜色（通常还会加上黑色K，组成CMYK系统）。
![430](4-Optics/images/img-105.jpeg.png)
> 图 4.76 彩色滤光片的透射曲线。

让我们看看它们如何工作（假设用白光照射）：
- **黄色 (Y) 滤镜/颜料**：吸收蓝色光，透射/反射红色和绿色光（混合成黄色）。
- **青色 (C) 滤镜/颜料**：吸收红色光，透射/反射绿色和蓝色光（混合成青色）。
- **品红色 (M) 滤镜/颜料**：吸收绿色光，透射/反射红色和蓝色光（混合成品红色）。

**4. 混合减法原色**
当我们将这些颜料或滤镜混合时，会发生什么？

- **示例：黄色 + 青色 = 绿色**
    - 白光 (R+G+B) 首先通过黄色颜料。
    - 黄色颜料吸收蓝色(B)，剩下红色(R)和绿色(G)。
    - (R+G) 光接着通过青色颜料。
    - 青色颜料吸收红色(R)，最终只剩下**绿色(G)**。
    这就是为什么画画时，黄色和蓝色（这里的蓝色实际上是青色）颜料混合会得到绿色。

- **混合所有三种原色**：
    - 黄色吸收蓝色。
    - 青色吸收红色。
    - 品红色吸收绿色。
    - 如果将三者以足够浓度混合，它们会吸收掉所有可见光，结果就是**黑色**。

![350](4-Optics/images/img-106.jpeg.png)
> 图 4.77 用白光从后方照射重叠的品红、青、黄三色滤光片。

**5. 强吸收与反射**
这里有一个非常有趣的现象：一个强吸收体同时也是一个强反射体，但它反射的恰恰是它吸收的那个频率的光。这听起来有点矛盾，但可以这样理解：在共振频率处，分子与光的相互作用极其强烈，以至于入射光很快就被“重新辐射”出来，宏观上表现为强烈的反射。

- **实验验证**：你可以用毡头笔（投影仪用的那种最好）来验证。在光滑的黑色塑料片上涂一厚层红色墨水，在反射光下观察（注意不要让透射光干扰），你会发现它泛着绿光！同样，龙胆紫（一种紫药水）干了以后，在透射光下是紫色的，但在反射光下会呈现出黄绿色。透射光颜色和反射光颜色正好是互补色。

### 4.9.5 其他颜色产生机制
除了我们今天详细讨论的漫反射、镜面反射和选择性吸收，自然界还有其他产生颜色的奇妙方式，例如：
- **衍射 (Diffraction)**：某些甲虫壳上的微观光栅结构，通过衍射将白光分解成彩虹般的颜色。
- **干涉 (Interference)**：肥皂泡、水面上的油膜、珍珠母、孔雀羽毛上的斑斓色彩，是由于光在薄膜上下表面反射时发生干涉造成的。

---

#### 示例 4.7
一个立方体的五个面分别被涂上了明亮的单色：红、蓝、品红、青、黄；最后一个面是白色的。当通过一块品红色的彩色玻璃观察时，每个面会呈现什么颜色？请解释你的答案。

#### 解决方案
让我们一步步来分析：
- **分析滤镜**：首先，我们要明确品红色玻璃的作用。根据减法混色原理，品红色(M)是白光(W)减去绿色(G)得到的，即 $M = R+B$。所以，**品红色玻璃会吸收绿色光，并允许红色光和蓝色光通过**。

- **分析每个面**：
    1.  **红色面 (Red)**：红色面反射红光。红光可以通过品红色玻璃。所以，**红色面看起来仍然是红色**。
    2.  **蓝色面 (Blue)**：蓝色面反射蓝光。蓝光可以通过品红色玻璃。所以，**蓝色面看起来仍然是蓝色**。
    3.  **品红面 (Magenta)**：品红面反射红色和蓝色光。这两种光都可以通过品红色玻璃。所以，**品红面看起来仍然是品红色**。
    4.  **青色面 (Cyan)**：青色面反射绿色和蓝色光 ($C = G+B$)。当这些光射向品红色玻璃时，绿色光被吸收，只有蓝色光能通过。所以，**青色面看起来会是蓝色**。
    5.  **黄色面 (Yellow)**：黄色面反射红色和绿色光 ($Y = R+G$)。当这些光射向品红色玻璃时，绿色光被吸收，只有红色光能通过。所以，**黄色面看起来会是红色**。
    6.  **白色面 (White)**：白色面反射所有颜色的光（红、绿、蓝）。当这些光通过品红色玻璃时，绿色光被吸收，红色和蓝色光通过。红蓝光混合在一起，人眼感知为品红色。所以，**白色面看起来会是品红色**。

---

### 关键结论与知识点总结
1.  **白/灰/黑的物理**：
    - **白色**源于对所有可见光的无差别、高效率**漫反射**，通常由透明微粒的随机反射和折射造成。
    - **灰色**和**黑色**源于对所有可见光的**均匀吸收**，吸收率越高，颜色越深。
    - **金属光泽**源于**自由电子**对所有可见光的高效率**镜面反射**。

2.  **颜色产生的两种主要方式**：
    - **加法混色 (Additive)**：混合**光束**。三原色光为红(R)、绿(G)、蓝(B)。RGB混合为白色。适用于屏幕显示等发光物体。
    - **减法混色 (Subtractive)**：从白光中**吸收**部分颜色。三原色为青(C)、品红(M)、黄(Y)。CMY混合为黑色。适用于颜料、染料、印刷等。

3.  **混色规则**：
    - **加法**：$R+G=Y$, $G+B=C$, $B+R=M$, $R+G+B=W$。
    - **减法**：从白光中，Y吸收B，C吸收R，M吸收G。例如，Y+C颜料混合，Y吸收B，C吸收R，剩下G，故呈绿色。

4.  **颜色的物理与生理**：
    - 物体的颜色由其**选择性吸收**光谱决定，这源于分子内部电子的**共振吸收**，特别是颜料分子中的**π电子**。
    - 颜色的感知是人眼和大脑对光谱信号解码的结果，例如“红光+绿光=黄光”是生理现象。
    - **饱和度**描述了颜色的纯度，不饱和的颜色是纯色与白光的混合（如粉色是不饱和的红色）。

5.  **互补色**：两种能混合成白光的光色（加法），或一种颜料吸收的颜色与它呈现的颜色（减法）。例如，黄色颜料吸收蓝色光，所以黄色和蓝色互为互补色。

---

### 专业术语/关键词汇编 (Glossary)
-  #漫反射  ( #Diffuse-Reflection )
-  #折射率  ( #Refractive-Index )
-  #镜面反射  ( #Specular-Reflection )
-  #自由电子  ( #Free-Electrons )
-  #加法混色  ( #Additive-Coloration )
-  #三原色光  ( #Primary-Colors )
-  #互补色  ( #Complementary-Colors )
-  #减法混色  ( #Subtractive-Coloration )
-  #选择性吸收  ( #Selective-Absorption )
-  #能级  ( #Energy-Levels )
-  #共轭体系  ( #Conjugated-System )



## 4.10 The Stokes Treatment of Reflection and Refraction

A rather elegant and novel way of looking at reflection and transmission at a boundary was developed by the British physicist Sir George Gabriel Stokes (1819-1903). Suppose that we have an incident wave of amplitude $E_{0 i}$ impinging on the planar interface separating two dielectric media, as in Fig. 4.78a. As we saw earlier in this chapter, because $r$ and $t$ are the fractional amplitudes reflected and transmitted, respectively (where $n_{t}=n_{1}$ and $n_{t}=n_{2}$ ), then $E_{0 r}=r E_{0 t}$ and $E_{0 t}=t E_{0 t}$. Again we are reminded that Fermat's Principle led to the Principle of Reversibility, which implies that the situation depicted in Fig. 4.78b, where all the ray directions are reversed, must also be physically possible. With the one proviso that there be no energy dissipation (no absorption), a wave's meanderings must be reversible. Equivalently, in the idiom of modern physics one speaks of timereversal invariance, that is, if a process occurs, the reverse process can also occur. Thus if we take a hypothetical motion picture of the wave incident on, reflecting from, and transmitting through the interface, the behavior depicted when the film is run backward must also be physically realizable. Accordingly, examine Fig. 4.78c, where there are now two incident waves of amplitudes $E_{0 i} r$ and $E_{0 t} t$. A portion of the wave whose amplitude is $E_{0 t} t$ is both reflected and transmitted at the interface. Without making any assumptions, let $r^{\prime}$ and $t^{\prime}$ be the amplitude reflection and transmission coefficients, respectively, for a wave incident from below (i.e., $n_{i}=n_{2}, n_{t}=n_{1}$ ). Consequently, the reflected portion is $E_{0 t} t r^{\prime}$, and the transmitted portion is $E_{0 t} t t^{\prime}$. Similarly, the incoming wave whose amplitude is $E_{0 t} r$ splits into segments of amplitude $E_{0 i} r r$ and $E_{0 t} r t$. If the configuration in Fig. 4.78c is to be identical with that in Fig. 4.78b, then obviously
$$
E_{0 t} t t^{\prime}+E_{0 t} r r=E_{0 t}\tag{4.84}
$$

and
$$
E_{0 t} r t+E_{0 t} t r^{\prime}=0\tag{4.85}
$$

Hence
$$
t t^{\prime}=1-r^{2}\tag{4.86}
$$

and
$$
r^{\prime}=-r\tag{4.87}
$$

the latter two equations being known as the Stokes Relations. This discussion calls for a bit more caution than is usually granted it. It must be pointed out that the amplitude coefficients are functions of the incident angles, and therefore the Stokes Relations might better be written as
$$
t\left(\theta_{I}\right) t^{\prime}\left(\theta_{2}\right)=1-r^{2}\left(\theta_{I}\right)\tag{4.88}
$$
and
$$
r^{\prime}\left(\theta_{2}\right)=-r\left(\theta_{I}\right)\tag{4.89}
$$

where $n_{1} \sin \theta_{1}=n_{2} \sin \theta_{2}$. The second equation indicates, by virtue of the minus sign, that there is a $180^{\circ}$ phase difference between the waves internally and externally reflected. It is most important to keep in mind that here $\theta_{1}$ and $\theta_{2}$ are pairs of angles that are related by way of Snell's Law. Note as well that we never did say whether $n_{1}$ was greater or less than $n_{2}$, so Eqs. (4.88) and (4.89) apply in either case. Let's return for a moment to one of the Fresnel Equations:
$$
r_{\perp}=-\frac{\sin \left(\theta_{i}-\theta_{t}\right)}{\sin \left(\theta_{i}+\theta_{t}\right)}\tag{4.42}
$$

If a ray enters from above, as in Fig. 4.78a, and we assume $n_{2}>n_{1}, r_{\perp}$ is computed by setting $\theta_{i}=\theta_{1}$ and $\theta_{t}=\theta_{2}$ (external reflection), the latter being derived from Snell's Law. If, on the other hand, the wave is incident at that same angle from below (in this instance internal reflection), $\theta_{i}=\theta_{1}$ and we again substitute in Eq. (4.42), but here $\theta_{t}$ is not $\theta_{2}$, as before. The values of $r_{\perp}$ for internal and external reflection at the same incident angle are obviously different. Now suppose, in this case of internal reflection, that $\theta_{t}=\theta_{2}$. 
![img-107.jpeg](4-Optics/images/img-107.jpeg.png)
> Figure 4.78 Reflection and refraction via the Stokes treatment.

Then $\theta_{t}=\theta_{1}$, the ray directions are the reverse of those in the first situation, and Eq. (4.42) yields
$$
r_{\perp}^{\prime}\left(\theta_{2}\right)=\frac{\sin \left(\theta_{2}-\theta_{1}\right)}{\sin \left(\theta_{2}+\theta_{1}\right)}
$$

Although it may be unnecessary we once again point out that this is just the negative of what was determined for $\theta_{t}=\theta_{1}$ and external reflection, that is,
$$
r_{\perp}^{\prime}\left(\theta_{2}\right)=-r_{\perp}\left(\theta_{1}\right)\tag{4.90}
$$

The use of primed and unprimed symbols to denote the amplitude coefficients should serve as a reminder that we are once more dealing with angles related by Snell's Law. In the same way, interchanging $\theta_{t}$ and $\theta_{t}$ in Eq. (4.43) leads to
$$
r_{\parallel}^{\prime}\left(\theta_{2}\right)=-r_{\parallel}\left(\theta_{1}\right)\tag{4.91}
$$

The $180^{\circ}$ phase difference between each pair of components is evident in Fig. 4.52, but keep in mind that when $\theta_{t}=\theta_{p}$, $\theta_{t}=\theta_{p}^{\prime}$ and vice versa (Problem 4.100). Beyond $\theta_{t}=\theta_{c}$ there is no transmitted wave, Eq. (4.89) is not applicable, and as we have seen, the phase difference is no longer $180^{\circ}$.

It is common to conclude that both the parallel and perpendicular components of the externally reflected beam change phase by $\pi$ radians, while the internally reflected beam undergoes no phase shift at all. This is quite incorrect (compare Figs. $4.53 a$ and $4.54 a$ ).

## 4.10 斯托克斯方法对反射和折射的处理
[!斯托克斯方法对反射和折射的处理]-


### 4.10.1 核心思想： 原理可逆性 ( Principle-of-Reversibility )
在我们正式开始推导之前，必须先理解斯托克斯方法的基石。这个基石就是 **原理可逆性**，在现代物理学中，我们更常称之为 #时间反演不变性 ( #Time-Reversal-Invariance )。

这个原理是什么意思呢？简单来说，**如果一个物理过程是可能发生的，那么将这个过程在时间上倒放，所呈现的逆过程也必须是物理上可能发生的。**

我们可以用一个简单的比喻来理解：想象一下，你拍摄了一段一个完美弹性的球撞击墙壁并反弹回来的视频。现在，如果你将这段视频倒着播放，你会看到什么？你会看到球从反弹的路径上飞回，撞击墙壁，然后沿着它最初入射的路径返回。这个倒放的画面看起来完全符合物理定律，对吗？这就是时间反演不变性的一个直观体现。

斯托克斯将这个深刻的物理直觉应用到了光的传播上。他断言，光线的传播路径是可逆的。这个结论的前提是过程中没有能量的损耗，也就是说，介质是完全透明的，不存在 #吸收 ( #Absorption )。在满足这个条件下，光波的一次“旅行”，无论多么曲折，其路径都必须是可逆的。

### 4.10.2 斯托克斯的理想实验
为了运用可逆性原理，斯托克斯设计了一个巧妙的理想实验，我们通过下图来分步解析：

![[img-107.jpeg.png]]
> 图 4.78 斯托克斯方法处理反射和折射

**第一步：正向过程 (Forward Process)**
* 我们来看 **图 4.78(a)**。一束入射光的电场波振幅为 $E_{0i}$，从折射率为 $n_1$ 的介质1，射向折射率为 $n_2$ 的介质2的平整界面上。
* 在界面上，一部分光被反射，另一部分光被折射（透射）。
* 我们定义两个关键的系数：
    * #振幅反射系数 ( #Amplitude-Reflection-Coefficient ) $r$：它表示反射波振幅与入射波振幅之比。所以，反射波的振幅 $E_{0r}$ 就是 $r \cdot E_{0i}$。
    * #振幅透射系数 ( #Amplitude-Transmission-Coefficient ) $t$：它表示透射波振幅与入射波振幅之比。所以，透射波的振幅 $E_{0t}$ 就是 $t \cdot E_{0i}$。
* 这里的 $r$ 和 $t$ 是分数，代表了振幅变化的比例。例如，如果 $r=0.5$，意味着反射波的振幅是入射波的一半。

**第二步：时间反演过程 (Time-Reversed Process)**
* 现在，我们应用时间反演不变性原理。想象一下，我们将图(a)中的过程用摄像机录下来，然后倒着播放。我们会看到什么？
* 我们会看到 **图 4.78(b)** 的情景：原本的反射光和透射光现在变成了“入射光”，它们分别沿着原来的路径返回界面。
* 具体来说，一束振幅为 $E_{0r} = r E_{0i}$ 的光波从介质1射向界面，同时另一束振幅为 $E_{0t} = t E_{0i}$ 的光波从介质2射向界面。
* 根据可逆性原理，这两束光波在界面处相互作用后，应该完美地重新组合成最初的那束入射光。也就是说，它们会合并成一束振幅为 $E_{0i}$ 的光波，沿着图(a)中入射光相反的方向传播回介质1，并且在介质2中不应该有任何光波继续向下传播。

**第三步：分析反演过程 (Analysis of the Reversed Process)**
* **图 4.78(b)** 是我们根据原理推断出的“理想结果”。但要从中得到有用的关系，我们必须从物理上分析当这两束光真的入射到界面上时会发生什么。这就是 **图 4.78(c)** 所展示的。
* 在图(c)中，我们有两束入射光：一束来自介质1，振幅为 $r E_{0i}$；另一束来自介质2，振幅为 $t E_{0i}$。
* 为了区分光从介质2到介质1的反射和透射，我们引入新的系数：
    * $r'$：光从介质2入射到介质1时的振幅反射系数。
    * $t'$：光从介质2入射到介质1时的振幅透射系数。
* 现在我们来分析这两束光的“命运”：
    1.  **对于来自介质1的光 (振幅 $r E_{0i}$)**：
        * 它在界面上会发生反射，反射回介质1。反射波的振幅是入射振幅乘以反射系数 $r$，即 $(r E_{0i}) \cdot r = r^2 E_{0i}$。
        * 它也会发生透射，进入介质2。透射波的振幅是入射振幅乘以透射系数 $t$，即 $(r E_{0i}) \cdot t = rt E_{0i}$。
    2.  **对于来自介质2的光 (振幅 $t E_{0i}$)**：
        * 它在界面上会发生反射（这次是 #内部反射 #Internal-Reflection ），反射回介质2。反射波的振幅是入射振幅乘以反射系数 $r'$，即 $(t E_{0i}) \cdot r' = tr' E_{0i}$。
        * 它也会发生透射，进入介质1。透射波的振幅是入射振幅乘以透射系数 $t'$，即 $(t E_{0i}) \cdot t' = tt' E_{0i}$。

### 4.10.3 斯托克斯关系的推导
现在，最关键的一步来了。根据可逆性原理，图(c)的最终结果必须和图(b)完全一样。让我们来比较一下：
1.  **在介质1中向上的光波**：
    * 在图(b)中，最终只有一束向上的光，振幅为 $E_{0i}$。
    * 在图(c)中，最终向上的光由两部分叠加而成：一部分是 $r E_{0i}$ 的反射波（振幅 $r^2 E_{0i}$），另一部分是 $t E_{0i}$ 的透射波（振幅 $tt' E_{0i}$）。
    * 要使两者等同，必须满足：
$$
        E_{0i} r^2 + E_{0i} t t' = E_{0i}
        $$
    *   等式两边同时除以 $E_{0i}$，我们得到：
$$
        r^2 + tt' = 1 \quad \Rightarrow \quad tt' = 1 - r^2 \tag{4.86}
        $$

2.  **在介质2中向下的光波**：
    * 在图(b)中，时间反演后，介质2中不应该有任何向下的光波，其振幅为0。
    * 在图(c)中，向下的光也由两部分叠加而成：一部分是 $r E_{0i}$ 的透射波（振幅 $rt E_{0i}$），另一部分是 $t E_{0i}$ 的反射波（振幅 $tr' E_{0i}$）。
    * 要使两者等同，必须满足：
$$
        E_{0i} r t + E_{0i} t r' = 0
        $$
    *   假设透射系数 $t$ 不为零（否则就没有意义了），等式两边同时除以 $E_{0i} t$，我们得到：
$$
        r + r' = 0 \quad \Rightarrow \quad r' = -r \tag{4.87}
        $$

这两个方程，**$tt' = 1 - r^2$** 和 **$r' = -r$**，就是著名的 **斯托克斯关系 (Stokes Relations)**。

### 4.10.4 斯托克斯关系的物理内涵与深化
斯托克斯关系看起来很简单，但其物理内涵极其深刻。
**1. $r' = -r$ 的深刻含义：相位的反转**

这个关系告诉我们，光线从介质2以角度 $\theta_2$ 入射到界面，其振幅反射系数 $r'$，与光线从介质1以角度 $\theta_1$ 入射的振幅反射系数 $r$ 互为相反数。这里的 $\theta_1$ 和 $\theta_2$ 是通过 #斯涅尔定律 ( #Snells-Law ) ($n_1 \sin\theta_1 = n_2 \sin\theta_2$) 相关联的一对角度。

这个负号是关键！在波动光学中，一个负号意味着一个大小为 $\pi$ 弧度（即180°）的 #相移 ( #Phase-Shift )。

* **这意味着，在“外部反射”和“内部反射”这对可逆过程中，必然有一次反射伴随着180°的相位突变，而另一次则没有。**
* 具体是哪一次呢？
    * 当光从光疏介质（$n_1$ 较小）射向光密介质（$n_2$ 较大）时，我们称之为 #外部反射 ( #External-Reflection )。在这种情况下，反射光通常会有一个180°的相移。
    * 当光从光密介质（$n_2$ 较大）射向光疏介质（$n_1$ 较小）时，我们称之为内部反射。在这种情况下，反射光通常没有相移（除非发生全反射）。
* $r' = -r$ 这个关系完美地解释了这种相位上的不对称性，而这是仅从能量角度（强度反射率 $R=r^2$）无法看出的。

**2. 角度的依赖性**
我们必须非常严谨地认识到，$r, t, r', t'$ 这些系数都不是普适常数，它们是入射角的函数。因此，更精确的斯托克斯关系应该写成：
$$
r'(\theta_2) = -r(\theta_1) \tag{4.89}
$$
$$
t(\theta_1) t'(\theta_2) = 1 - r^2(\theta_1) \tag{4.88}
$$
其中 $n_1 \sin\theta_1 = n_2 \sin\theta_2$。这个写法提醒我们，这两个关系是建立在一对通过斯涅尔定律联系起来的特定角度上的。

**3. 与菲涅尔方程的联系**
斯托克斯关系是一个普适的结论，它必须与我们之前学过的 #菲涅尔方程 ( #Fresnel-Equations ) 相符。让我们来验证一下。

以垂直偏振分量（$s$-波）为例，其振幅反射系数为：
$$
r_{\perp}(\theta_i, \theta_t) = -\frac{\sin(\theta_i - \theta_t)}{\sin(\theta_i + \theta_t)} \tag{4.42}
$$

* **情况1：外部反射** (从介质1到介质2)
    入射角 $\theta_i = \theta_1$，折射角 $\theta_t = \theta_2$。
$$
    r_{\perp}(\theta_1) = -\frac{\sin(\theta_1 - \theta_2)}{\sin(\theta_1 + \theta_2)}
    $$

* **情况2：内部反射** (从介质2到介质1，但与情况1路径可逆)
    入射角 $\theta_i = \theta_2$，折射角 $\theta_t = \theta_1$。
$$
    r'_{\perp}(\theta_2) = -\frac{\sin(\theta_2 - \theta_1)}{\sin(\theta_2 + \theta_1)}
    $$

现在我们比较 $r_{\perp}(\theta_1)$ 和 $r'_{\perp}(\theta_2)$。利用三角函数性质 $\sin(x-y) = -\sin(y-x)$，我们有：
$$
r_{\perp}(\theta_1) = -\frac{-\sin(\theta_2 - \theta_1)}{\sin(\theta_1 + \theta_2)} = \frac{\sin(\theta_2 - \theta_1)}{\sin(\theta_2 + \theta_1)}
$$
于是，我们清晰地看到：
$$
r'_{\perp}(\theta_2) = -r_{\perp}(\theta_1) \tag{4.90}
$$
这完美地验证了斯托克斯关系！对于平行偏振分量（$p$-波），我们也可以进行完全相同的验证，得到 $r'_{\parallel}(\theta_2) = -r_{\parallel}(\theta_1)$。

**4. 一个常见的误解**
课文最后特别指出了一个常见的误解：“外部反射的两个偏振分量（平行和垂直）都发生 $\pi$ 的相移，而内部反射则完全没有相移。” **这种说法是错误的，或者说是不完整的。**

* 从菲涅尔方程的图像（例如原文提到的图4.53a和4.54a）我们可以看到，对于平行分量 $r_\|$，当入射角小于布儒斯特角时，其符号为正（0相移），大于布儒斯特角时才为负（$\pi$相移）。
* 因此，相移是否发生，不仅与内外反射有关，还与光的偏振态和入射角密切相关。
* 此外，当发生全内反射时，透射波消失（$t=0$），斯托kes关系 $r'=-r$ 不再适用，此时的相位变化会变得更加复杂，不再是简单的0或$\pi$。

---

### 关键结论和知识点总结
1.  **核心原理**：斯托克斯方法是基于物理学中的 **时间反演不变性原理**，即在无能量吸收的情况下，光路是可逆的。
2.  **斯托克斯关系**：通过一个巧妙的理想实验，我们推导出了两个核心关系式：
    *   $r' = -r$：在互逆路径下，振幅反射系数互为相反数。
    *   $tt' = 1 - r^2$：联系了双向的透射系数与反射系数。
3.  **相位关系**：$r' = -r$ 的关键物理意义在于揭示了反射过程中的 **180°（$\pi$ 弧度）相移**。它表明，在外部反射和内部反射这对互逆过程中，必然有一次伴随着相位反转。
4.  **与菲涅尔方程的自洽性**：斯托克斯关系并非独立的理论，它与基于电磁理论的菲涅尔方程是完全自洽的，可以相互验证。
5.  **适用性与局限**：
    * 这些关系式中的系数都是 **角度的函数**，并且角度之间通过斯涅尔定律关联。
    * 该方法的前提是 **无吸收**。
    * 在 **全内反射** 的条件下，由于没有透射波，简单的斯托克斯关系不再适用，相移的分析需要回归到复数形式的菲涅尔方程。
6.  **破除迷思**：关于反射相移的规则远比“外反射有、内反射无”要复杂，它依赖于偏振态、入射角以及是否超过布儒斯特角或临界角。

斯托克斯方法为我们提供了一个不依赖于复杂数学推导，而依赖于基本物理原理来洞察光学现象的绝佳范例。它充分展现了物理学思想的优雅与力量。

---

### 专业术语/关键词中英对照表
*    #原理可逆性  ( #Principle-of-Reversibility )
*    #时间反演不变性  ( #Time-Reversal-Invariance )
*    #振幅反射系数  ( #Amplitude-Reflection-Coefficient )
*    #振幅透射系数  ( #Amplitude-Transmission-Coefficient )
*    #内部反射  ( #Internal-Reflection )
*    #相移  ( #Phase-Shift )
*    #斯涅尔定律  ( #Snells-Law )
*    #外部反射  ( #External-Reflection )
*    #菲涅尔方程  ( #Fresnel-Equations )


## 4.11 Photons, Waves, and Probability

Much of the theoretical grounding of Optics is predicated on wave theory. We take for granted both that we understand the phenomenon and that it's "real." As one example out of the many that will be encountered, the process of scattering seems to be understandable only in terms of interference; classical particles simply do not interfere. When a beam propagates through a dense medium, interference in the forward direction is constructive, whereas in all other directions it's almost completely destructive. Thus nearly all the light energy advances in the forward direction. But this raises interesting questions about the basic nature of interference and the usual interpretation of what's happening. ***Interference is a nonlocalized phenomenon; it cannot happen at only one single point in space***, even though we often talk about the interference at a point $P$. The principle of Conservation of Energy makes it clear that if there is constructive interference at one point, the "extra" energy at that location must have come from elsewhere. There must therefore be destructive interference somewhere else. ***Interference takes place over an extended region of space in a coordinated fashion that leaves the total amount of radiant energy unchanged***.

Now imagine a light beam traversing a dense medium, as in Fig. 4.6. Do real energy-carrying electromagnetic wavelets
(which are never actually measured) propagate out laterally, only to interfere destructively everywhere beyond the beam? If so, these wavelets cancel and the energy they transport outward is inexplicably returned to the beam, since, in the end, there is no net lateral scattering. That's true no matter how far away $P$ is. Moreover, this applies to all interference effects (Chapter 9). If two or more electromagnetic waves arrive at point $P$ out-ofphase and cancel, "What does that mean as far as their energy is concerned?" Energy can be redistributed, but it doesn't cancel out. We've learned from Quantum Mechanics that at base interference is one of the most fundamental mysteries in physics.

Remembering Einstein's admonition that there are no spherical wavelets emitted by atoms, perhaps we're being too literal in our interpretation of the classical wave field. After all, strictly speaking, the classical electromagnetic wave with its continuous distribution of energy does not actually exist. Perhaps we should think of the wavelets and the overall pattern they produce (rather than being a real wave field) as a theoretical device that, wonderfully enough, tells us where the light will end up. In any event, Maxwell's Equations provide a means of calculating the macroscopic distribution of electromagnetic energy in space.

Moving ahead in a semiclassical way, imagine a distribution of light given by some function of the off-axis angle $\theta$. For example, consider the irradiance on a screen placed far beyond a slit-shaped aperture (p. 466) such that $I(\theta)=I(0) \operatorname{sinc}^{2} \beta(\theta)$. Suppose that instead of observing the pattern by eye a detector composed of a diaphragm followed by a photomultiplier tube is used. Such a device could be moved around from one point to another, and over a constant time interval, it could measure the number of photons arriving at each location, $N(\theta)$. Taking a great many such measurements, a spatial distribution of the number of photon counts would emerge that would be of the very same form as that for the irradiance, namely, $N(\theta)=$ $N(0) \operatorname{sinc}^{2} \beta(\theta)$ : the number of photons detected is proportional to the irradiance. A countable quantity like this lends itself to statistical analysis, and we can talk about the probability of detecting a photon at any point on the screen. That is, a probability distribution can be constructed, reminiscent of Fig. 3.23. Because the space variables $(\theta, x, y$, or $z$ ) are continuous, it's necessary to introduce a ***probability density***; let it be $\wp(\theta)$. Then $\wp(\theta) d \theta$ is the probability that a photon will be found in the infinitesimal range from $\theta$ to $\theta+d \theta$. In this case $\wp(\theta)=$ $\wp(0) \operatorname{sinc}^{2} \beta(\theta)$.

The square of the net electric field amplitude at every point in space corresponds to the irradiance (which can be measured directly), and that's equivalent to the likelihood of finding photons at any point. Accordingly, let's tentatively define the ***probability amplitude*** as that quantity whose absolute value squared equals the probability density. Thus the net $E_{0}$ at $P$ can be interpreted as being proportional to a ***semiclassical*** probability amplitude inasmuch as ***the probability of detecting a photon at some point in space depends on the irradiance at that location and*** $I \propto E_{0}^{2}$. This is in accord with Einstein's

conception of the light field, which Max Born (who initiated the statistical interpretation of Quantum Mechanics) described as a Gespensterfeld, or phantom field. In that view the waves of that field reveal how the photons distribute in space in the sense that the square of the absolute value of the wave amplitude somehow relates to the probability density of arriving photons. In the formal treatment of Quantum Mechanics, the probability amplitude is generally a complex quantity whose absolute value squared corresponds to the probability density (e.g., the Schrödinger wavefunction is a probability amplitude). Thus, however reasonable it was to consider $E_{0}$ as equivalent to a semiclassical probability amplitude, that usage cannot be carried over, as is, into quantum theory.

Still, all of this suggests that we might take the scattering process, considered in terms of probabilities, as the basis for a computational scheme. Each scattered wavelet is then a measure of the probability amplitude for light taking a particular route from one point to another, and the net electric field at $P$ is the sum of all the scattered fields arriving via all possible routes. A quantum-mechanical methodology analogous to this was devised by Feynman, Schwinger, Tomonaga, and Dyson in the course of their development of Quantum Electrodynamics. In brief, the final observable outcome of an event is determined by the superposition of all the various probability amplitudes associated with each and every possible way that the event can occur. In other words, each "route" along which an event can take place, each way it can happen, is given an abstract mathematical representation, a complex probability amplitude. All of these then combine-and interfere, as complex quantities are wont to do-to produce a net probability amplitude for the event to take place.

What follows is a greatly simplified version of that analysis.

### 4.11.1 QED

Feynman was rather unequivocal in his stance regarding the nature of light:

_Ɪ want to emphasize that light comes in this form-particles. It is very important to know that light behaves like particles, especially for those of you who have gone to school, where you were probably told something about light behaving like waves. I'm telling you the way it does behave-like particles. (SOURCE: R. P. Feynman, QED, Princeton University Press, Princeton, NJ, 1985)_

For him "light is made of particles (as Newton originally thought)"; it's a stream of photons whose behavior en masse can be determined statistically. For example, if 100 photons are incident perpendicularly on a piece of glass in air, on average 4 will be reflected backward from the first surface they encounter. Which 4 cannot be known, and in fact how those particular 4 photons are selected is a mystery. What can be deduced and confirmed experimentally is that $4 \%$ of the incident light will be reflected (p. 126).

Feynman's analysis proceeds from a few general computational rules, with the ultimate justification being that it works; the scheme makes accurate predictions. (1) ***The probability amplitude associated with the occurrence of an event is the "sum" of the constituent probability amplitudes corresponding to each and every possible way the event can occur***. (2) ***Each such constituent probability amplitude is generally expressible as a complex quantity***. Rather than analytically combining these constituent probability amplitudes, we can use the phasor representation (p. 31) to approximate the summation and thereby arrive at a resultant probability amplitude. (3) ***The probability of occurrence of the event as a whole is proportional to the absolute square of the resultant probability amplitude***.

We can appreciate how all of this comes together by treating the reflection pictured in Fig. 4.79; a point source $S$ illuminates a mirror, and light is subsequently scattered upward in every direction from every point on the mirror. We wish to determine the probability of a detector at $P$, recording the arrival of a photon. Here the classical perspective, with its familiar wavelet model, can be used as an analogue to provide guidance (and perhaps a little intellectual comfort, if you still believe in classical EM waves).
![550](4-Optics/images/img-108.jpeg.png)
> Figure 4.79 A schematic representation of reflection. A wave from $S$ sweeps down and spreads across the surface of the mirror. Every atom on the interface subsequently scatters light back in all upward directions. And some of it ultimately arrives at $P$, having come from every scatterer on the surface.

For simplicity, take the mirror to be a narrow strip (which is essentially one-dimensional); that doesn't change things conceptually. Divide it into a number of equal-sized lengths (Fig. 4.80a), each of which establishes a possible path to $P$. (Of course, every atom on the surface is a scatterer, and so there are a multitude of paths, but the several we have drawn will do.) 

![500](4-Optics/images/img-109.jpeg.png)
> Figure 4.80 (a) Feynman's analysis of the problem of reflection via QED. A number of paths from $S$ to the mirror to $P$. (b) The $O P L$ for light going from $S$ to $P$ along the paths depicted in (a). Each path has a probability amplitude associated with it. These add to produce a net amplitude.

Classically, we know that every route from $S$ to the mirror to $P$ corresponds to the path of a scattered wavelet, and that the amplitude $\left(E_{0 j}\right)$ and phase of each such wavelet at $P$ will determine the net resultant amplitude, $E_{0}$. As we saw with Fermat's Principle (p. 117), the optical path length from $S$ to the mirror to $P$ establishes the phase of each wavelet arriving at $P$. Moreover, the greater the path length is, the more the light spreads out (via the Inverse Square Law) and the smaller is the amplitude of the wavelet arriving at $P$.

Figure $4.80 b$ is a plot of the $O P L$ with its minimum at the observed path $(S-I-P)$, for which $\theta_{i}=\theta_{r}$. A large change in $O P L$, as between $(S-A-P)$ and $(S-B-P)$, is accompanied by a large phase difference and a correspondingly large rotation of the phasors drawn in Fig. 4.80c. Going from $A$ to $B$ to $C$ and so
on to $I$, the optical path lengths decrease less and less rapidly, and each phasor leads the previous one by a smaller angle (set by the slope of the curve). In effect, the phasors to the left of $I$ rotate counterclockwise from $A$ to $I$. Since the $O P L$ is a minimum at $I$, the phasors from that region are large and differ very little in phase angle. Going from $I$ to $J$ to $K$ and so on to $Q$, the optical path lengths increase more and more rapidly, and each phasor lags the previous one by a larger angle. In effect, the phasors to the right of $I$ rotate clockwise from $I$ to $Q$.

In Fig. 4.80c the resultant amplitude is drawn from the starting tail to the ending tip, and classically it corresponds to the net electric field amplitude at $P$. The irradiance, $I$, is proportional to the square of the net field amplitude, and that, in turn, should be a measure of the likelihood of finding a photon when a detector is placed at $P$.

Let's move beyond the classical ideas of scattered wavelets and electric fields (nonetheless being guided by them) and construct a quantum-mechanical treatment. Photons can go from $S$ to the mirror to $P$ along each of an innumerable number of distinct paths. It's reasonable to assume that each such path makes a specific contribution to the end result; an exceedingly long route out to the very edge of the mirror and back to $P$ should contribute differently than a more direct route. Following Feynman, we associate some (as yet unspecified) complex quantity, a constituent ***quantum-mechanical (QM) probability amplitude***, with each possible path. Each such constituent QM probability amplitude can be represented as a phasor whose angle is determined by the total time of flight from $S$ to the mirror to $P$, and whose size is determined by the path length traversed. (Of course, this is just what obtained with each phasor in Fig. 4.80c. Still there are convincing reasons why the classical $E$-field cannot be the QM probability amplitude.) The total QM probability amplitude is the sum of all such phasors corresponding to all possible paths, and that is analogous to the resultant phasor in Fig. 4.80c.

Now relabel Fig. 4.80c so that it represents the quantummechanical formulation. Clearly, ***most of the length of the resultant QM probability amplitude arises from contributions in the immediate vicinity of path $S-I-P$, where the constituent phasors are large and nearly in-phase***. Most of the accumulated probability for light to go from $S$ to $P$ via reflection arises along, and immediately adjacent to, path $S-I-P$. The regions at the ends of the mirror contribute very little because the phasors from those areas form tight spirals at both extremes (Fig. 4.80c). Covering the ends of the mirror will have little effect on the length of the resultant amplitude and therefore little effect on the amount of light reaching $P$. Keep in mind that this diagram is rather crude; instead of 17 routes from $S$ to $P$, there are billions of possible paths, and the phasors on both ends of the spiral wind around countless times.

QED predicts that light emitted by a point source $S$ reflects out to $P$ from all across the mirror, but that the most likely route is $S-I-P$, in which case $\theta_{i}=\theta_{r}$. With your eye at $P$ looking into the mirror, you see one sharp image of $S$.

### 4.11.2 Photons and the Laws of Reflection and Refraction

Suppose that light consists of a stream of photons and consider one such quantum that strikes the interface between two dielectric media (e.g., air and glass) at an angle $\theta_{I}$. That photon is absorbed by an atom (e.g., in the glass), and an identical photon is subsequently transmitted at an angle $\theta_{I}$. We know that if this were just one out of billions of such quanta in a narrow laserbeam, it would conform to Snell's Law. To explore this behavior, let's examine the dynamics associated with the odyssey of our single photon. Recall Eq. (3.54), namely, $p=h / \lambda$ and so its vector momentum would be
$$
\overrightarrow{\mathbf{p}}=\hbar \overrightarrow{\mathbf{k}}
$$
where $\overrightarrow{\mathbf{k}}$ is the propagation vector and $\hbar \equiv h / 2 \pi$. Consequently, the incident and transmitted momenta are $\overrightarrow{\mathbf{p}}_{i}=\hbar \overrightarrow{\mathbf{k}}_{i}$ and $\overrightarrow{\mathbf{p}}_{t}=\hbar \overrightarrow{\mathbf{k}}_{t}$ respectively. We assume (without much justification) that while the material in the vicinity of the interface affects the component of momentum perpendicular to the interface it leaves the parallel component unchanged. Indeed, we know experimentally that linear momentum perpendicular to the interface can be transferred to a medium from a light beam (Section 3.3.4). The statement of conservation of the component of momentum parallel to the interface for a single photon takes the form
$$
p_{i} \sin \theta_{i}=p_{i} \sin \theta_{i}
$$
We are at an important juncture here; classically the momentum of a material particle depends on its speed. When $n_{t}>n_{i}$ it follows (from Snell's Law and the above equation) that $p_{i}>p_{i}$, and the particles of light must presumably speed up. Indeed, the first derivation of the Law of Refraction, published by René Descartes (1637), wrongly treated light as a stream of particles that sped up as it entered the optically more dense medium (see Problem 4.12). By contrast, the first person to measure the shortening of the wavelength of light as it entered a more dense medium was probably Thomas Young ( $\approx 1802$ ).* He rightly inferred that the speed of a light beam was thereby actually reduced: $v<c$.

We now know from Quantum Mechanics that the speed of a photon is always $c$ and that its momentum depends on its wavelength and not its speed. Thus
$$
\frac{h}{\lambda_{l}} \sin \theta_{l}=\frac{h}{\lambda_{l}} \sin \theta_{l}
$$

Multiplying both sides by $c / \nu$, we get Snell's Law.
Do keep in mind that the above analysis is a bit simplistic, but it is appealing pedagogically.

## 4.11 光子、波和概率 (Photons, Waves, and Probability)
[!光子、波和概率 ]-


### 4.11.0 引言：经典波动理论的困境
我们光学理论的大厦，在很大程度上是建立在波动理论的基石之上的。我们理所当然地认为光是一种波，并且认为我们已经完全理解了这种现象。例如，光的 #散射 ( #Scattering ) 现象，似乎只有用波的 #干涉 ( #Interference ) 才能解释——经典的粒子是不会相互干涉的。

想象一束光穿过一种致密的介质（比如玻璃或水）。根据波动理论，光束中每个原子都像一个小小的波源，向四面八方发射子波。在光前进的方向上，这些子波会发生 #相长干涉 ( #Constructive-Interference )，使得光束能够继续向前传播；而在所有其他方向上，它们几乎完全发生 #相消干涉 ( #Destructive-Interference )，导致光能几乎不会向侧方传播。

但这立刻引发了一些深刻的问题：
1.  **干涉的非定域性**：干涉不是一个孤立发生在空间某一点的现象。我们常说“P点的干涉情况”，但这其实是一种简化。根据 #能量守恒原理 ( #Principle-of-Conservation-of-Energy )，如果某一点因为相长干涉而能量增强，那么多出来的能量必然来自其他地方。因此，必须有其他地方同时发生了相消干涉。***干涉是在一个广阔的空间区域内，以一种协调的方式发生的，它只是重新分配了能量，而总能量保持不变。***

2.  **能量的去向之谜**：那么，当光束在介质中传播时，那些向侧方传播并最终相消干涉的“子波”是真实存在的吗？如果它们真的携带能量向外传播，那么这些能量在相消之后去了哪里？它们是如何“莫名其妙”地返回到主光束中的？无论我们观察的点P离光束多远，这个问题都存在。如果两个或多个电磁波在P点异相到达并完全抵消，它们的能量发生了什么？能量可以被重新分布，但绝不会凭空消失。

这些问题，经典电磁理论无法给出令人满意的答案。量子力学告诉我们，干涉实际上是物理学中最基本的奥秘之一。爱因斯坦曾告诫我们，原子并不会发射出球形的电磁子波。这或许在暗示，我们不应该过于拘泥于经典波动理论的字面解释。严格来说，那种能量连续分布的经典电磁波在微观世界里并不真实存在。

也许，我们应该将这些子波和它们产生的干涉图样，看作是一种巧妙的**理论工具**，它能够精准地预测光最终会出现在哪里，而不是一个真实存在的物理场。无论如何，麦克斯韦方程组为我们计算电磁能量在宏观空间中的分布提供了无与伦比的强大工具。

### 4.11.1 从经典到量子：概率的引入
现在，让我们用一种“半经典”的思维方式向前迈进。想象一下，我们在一个屏幕上观察光的分布，比如单缝衍射图样。其光强分布可以用一个函数来描述，例如 $I(\theta) = I(0) \operatorname{sinc}^{2} \beta(\theta)$。

如果我们不用肉眼，而是用一个光电倍增管（一种可以探测单个光子的设备）在屏幕上逐点测量，我们会发现，在每个位置$\theta$处单位时间内接收到的 #光子 ( #Photon ) 数量 $N(\theta)$，其分布形式与光强分布完全一样：$N(\theta) = N(0) \operatorname{sinc}^{2} \beta(\theta)$。也就是说，***在某点探测到的光子数量正比于该点的光强***。

这个发现至关重要！光子是可数的粒子，这就自然而然地引出了统计和概率的概念。我们可以讨论在屏幕上任意一点“找到”一个光子的可能性有多大。

- **#概率密度 ( #Probability-Density )**：由于空间位置是连续的，我们引入一个概念叫做 #概率密度，记为 $\wp(\theta)$。那么，$\wp(\theta) d\theta$ 就表示在一个从 $\theta$ 到 $\theta+d\theta$ 的无穷小角度范围内找到一个光子的概率。在这个例子中，$\wp(\theta) = \wp(0) \operatorname{sinc}^{2} \beta(\theta)$。

- **#概率振幅 ( #Probability-Amplitude )**：我们知道，光强 $I$ 正比于电场振幅 $E_0$ 的平方，即 $I \propto E_0^2$。而我们又发现，找到光子的概率正比于光强 $I$。因此，我们可以得到一个关键的联系：**找到光子的概率 $\propto E_0^2$**。

这启发我们定义一个新的量—— #概率振幅，它的绝对值的平方等于概率密度。于是，在P点的净电场振幅 $E_0$ 就可以被诠释为一种“ #半经典 ( #Semiclassical )”的概率振幅。

这个观点与爱因斯坦对光场的构想不谋而合，马克斯·玻恩（量子力学统计诠释的创始人）将其描述为一个 ***Gespensterfeld***，即“ #魅影场 ( #Phantom-Field )”。在这个视图中，场的波动性并不代表能量的实际波动，而是揭示了光子在空间中如何分布——**波振幅的绝对值平方，以某种方式关联着光子到达的概率密度**。

*注意：* 在正式的量子力学中，概率振幅通常是一个 #复数 ( #Complex-Number )，它的模的平方才对应于概率密度（例如，薛定谔的波函数就是一个概率振幅）。因此，将经典电场振幅 $E_0$ 直接等同于量子概率振幅是不严谨的，但它为我们理解问题提供了一个绝佳的桥梁。

### 4.11.2 量子电动力学（QED）的视角：万径归一
有了概率的思想，我们就可以引入一种全新的计算方案，这就是由费曼、施温格、朝永振一郎和戴森等人发展的 #量子电动力学 ( #Quantum-Electrodynamics )，简称 #QED。

费曼对于光的本性持非常明确的立场：
> “我想强调，光是以这种形式——粒子的形式——出现的。认识到光的行为像粒子是非常重要的，特别是对于那些在学校里可能被告知光表现得像波的人。我正在告诉你们它实际的行为方式——像粒子。”

在他看来，“光是由粒子组成的（正如牛顿最初认为的那样）”；它是一束光子流，其集体行为可以通过统计来确定。例如，如果有100个光子垂直入射到一块玻璃上，平均会有4个从第一个表面反射回来。具体是哪4个我们无从知晓，这本身就是一个谜。但我们可以精确地计算和实验验证的是，有4%的光会被反射。

费曼的分析方法基于几条简单的计算规则，其最终的合理性在于——它行之有效，能做出精确的预测。
1.  ***一个事件发生的总概率振幅，是该事件所有可能发生方式所对应的分概率振幅的“总和”。***
2.  ***每一个分概率振幅通常用一个复数来表示。*** 我们可以用 #相量 ( #Phasor ) 图（一种表示复数的箭头）来近似地将这些分概率振幅相加，从而得到最终的合概率振幅。
3.  ***整个事件发生的概率，正比于这个合概率振幅的绝对值的平方。***

#### 用QED解释光的反射
让我们通过一个具体的例子——光的反射——来理解这套规则是如何运作的。
![550](4-Optics/images/img-108.jpeg.png)
> 图 4.79 反射的示意图。来自点光源 S 的波前扫过并扩散到镜子的整个表面。随后，界面上的每一个原子都向所有向上的方向散射光。最终，来自镜面每一个散射点的光都有一部分到达 P 点。

为了简化问题，我们假设镜子是一条很窄的长条（本质上是一维的），这并不会改变核心思想。我们将镜子分成许多大小相等的小段，每一段都代表了一条从光源S到探测器P的可能路径（如图 4.80a）。
![500](4-Optics/images/img-109.jpeg.png)
> 图 4.80 (a) 费曼用QED分析反射问题。展示了从S到镜子再到P的多条路径。(b) (a)中所示路径的 #光程 ( #Optical-Path-Length )。每条路径都有一个与之关联的概率振幅。它们相加产生一个净振幅。

现在，我们来一步步分析：
1.  **所有可能的路径**：一个光子从光源S出发，要到达探测器P，它可以经由镜面上的**任何一个点**发生反射。图 4.80a 中画出的 A, B, C...I...Q 等点，都代表了一条可能的路径。

2.  **每条路径的概率振幅（相量）**：根据QED的规则，我们需要为每一条可能的路径（例如 S-A-P, S-B-P, S-I-P 等）赋予一个分概率振幅。这个振幅是一个复数，我们可以用一个相量（带箭头的矢量）来表示它。
    - **相量的“角度”**：由光子走完这条路径所花费的**总时间**决定。时间越长，相量旋转的角度就越大。这与我们熟悉的光程概念是等价的，因为光程正比于光的传播时间。
    - **相量的“长度”**：由路径的长度决定。根据平方反比定律，路径越长，光传播得越开，到达P点的振幅就越小。

3.  **路径、光程与相量图**：
    - 图 4.80b 展示了不同路径对应的光程（OPL）。我们可以看到，在点 I 处，光程有一个最小值。根据费马原理，这正是经典光学预测的实际光路，满足入射角等于反射角（$\theta_i = \theta_r$）。
    - 图 4.80c 将所有路径的概率振幅（相量）加起来。让我们仔细分析这个图：
        - **远离中心I的路径 (A, B, C... 和 ...P, Q)**：在镜子的两端，相邻路径之间的光程变化非常剧烈（图b中曲线的斜率很大）。这意味着它们对应的相量之间有很大的相位差（角度差）。当我们将这些相量一个接一个地加起来时，它们会迅速地旋转，形成两个紧密的螺旋。这些螺旋的头尾几乎重合，所以它们加起来的总长度非常小，几乎对最终结果没有贡献。
        - **靠近中心I的路径**：在路径 S-I-P 附近，光程变化非常平缓（图b中曲线的斜率接近于零）。这意味着这些路径的相量长度最长，并且它们的相位（角度）非常接近。当我们将这些相量加起来时，它们几乎指向同一个方向，因此会产生一个很长的合矢量。

4.  **最终结果**：
    - 将所有相量从头到尾连接起来，从第一个相量的尾部指向最后一个相量的头部的那个总矢量（图 4.80c 中的“Resultant amplitude”），就是**总概率振幅**。
    - ***这个总概率振幅的绝大部分长度，都来自于中心路径 S-I-P 附近的那些贡献。***
    - 这意味着，光子从S到达P的**绝大部分概率**，都集中在经典路径（S-I-P）及其紧邻的区域。
    - 如果我们用黑布遮住镜子的两端，只会挡住那些形成螺旋、贡献很小的路径，对总概率振幅的长度影响微乎其微，因此到达P点的光子数量几乎不变。但如果我们遮住镜子中间的部分，就会挡住贡献最大的路径，到达P点的光子数量会急剧减少。

**结论**：QED告诉我们，光从S点经镜面反射到P点，确实考虑了所有可能的路径。但最终，所有路径的概率振幅经过干涉叠加后，使得**最可能**的路径恰好就是经典光学所预言的那条满足“入射角等于反射角”的路径。因此，当你的眼睛在P点看向镜子时，你会看到一个清晰的光源S的像。

### 4.11.3 光子与反射、折射定律的量子诠释
现在，让我们换一个角度，完全从光子的粒子性出发，来推导光的折射定律。

假设光是一束光子流，我们考虑其中一个光子，它以角度 $\theta_i$ 入射到两种介质（如空气和玻璃）的界面上。这个光子被界面附近的原子吸收，然后一个完全相同的光子以角度 $\theta_t$ 被发射（透射）出去。

为了探索这个过程，我们需要引入光子的动量。根据德布罗意的关系式 $p = h/\lambda$，我们可以写出光子的矢量动量：
$$
\vec{\mathbf{p}} = \hbar \vec{\mathbf{k}}
$$
其中，$\hbar = h/2\pi$ 是约化 #普朗克常数 ( #Reduced-Planck-Constant )，$\vec{\mathbf{k}}$ 是 #波矢量 ( #Wave-Vector )，其大小为 $k=2\pi/\lambda$，方向为光的传播方向。

因此，入射光子和透射光子的动量分别为 $\vec{\mathbf{p}}_i = \hbar \vec{\mathbf{k}}_i$ 和 $\vec{\mathbf{p}}_t = \hbar \vec{\mathbf{k}}_t$。

接下来，我们引入一个关键的物理假设：***当光子穿过介质界面时，其平行于界面的动量分量是守恒的。***

为什么这个假设是合理的？我们可以这样理解：介质界面在平行方向上是均匀、对称的，没有理由让光子在这个方向上受到力的作用而改变动量。但在垂直于界面的方向上，介质的性质发生了突变，界面可以给光子施加一个力，从而改变其垂直方向的动量分量（这正是光压的来源之一）。

根据这个假设，我们有：
$$
p_{i, \parallel} = p_{t, \parallel}
$$
写成标量形式就是：
$$
p_i \sin\theta_i = p_t \sin\theta_t
$$

这是一个非常重要的岔路口。如果我们按照经典物理来思考，认为光是像小球一样的粒子，动量 $p=mv$。那么根据斯涅尔定律 $n_i \sin\theta_i = n_t \sin\theta_t$，当光从光疏介质进入光密介质时（$n_t > n_i$），必然要求 $p_t > p_i$，这意味着粒子进入光密介质后**速度增大了**！这正是笛卡尔在1637年推导折射定律时犯下的错误。

然而，量子力学告诉我们一个颠覆性的事实：**任何光子的速度在真空中恒为 $c$，其动量只与其波长有关，而与速度无关！**

因此，我们必须使用光子的量子动量表达式 $p = h/\lambda$。代入动量守恒方程：
$$
\frac{h}{\lambda_i} \sin\theta_i = \frac{h}{\lambda_t} \sin\theta_t
$$
其中 $\lambda_i$ 和 $\lambda_t$ 分别是光在介质1和介质2中的波长。

现在，我们利用折射率的定义 $n = c/v$ 和波的基本关系 $v = f \lambda = \nu \lambda$（频率 $\nu$ 在穿越介质时保持不变）。
所以，$\lambda = v/\nu = (c/n)/\nu$。
代入上式：
$$
\frac{h}{(c/n_i\nu)} \sin\theta_i = \frac{h}{(c/n_t\nu)} \sin\theta_t
$$
两边同时消去公因子 $h\nu/c$，我们就得到了：
$$
n_i \sin\theta_i = n_t \sin\theta_t
$$
这正是我们熟知的 #斯涅尔定律 ( #Snell's-Law )！

这个推导虽然有些简化，但它在教学上极具启发性。它优美地展示了，光的粒子性（动量 $p=h/\lambda$）和波动性（波长 $\lambda$ 和折射率 $n$）是如何通过量子力学的框架和谐地统一起来，并最终导出了宏观世界的光学定律。

---

### 关键结论与知识点总结
1.  **经典波动理论的局限性**：经典波动理论在解释干涉中的能量守恒问题时遇到了困难，暗示了其并非物理实在的最终描述。波的图像更像一个能够预测光子宏观统计行为的“魅影场”。

2.  **光强与概率的联系**：光强 $I$ 在宏观上描述了能量的分布，在微观上则正比于在某处找到光子的**概率密度**。这是连接经典光学和量子光学的核心桥梁。

3.  **概率振幅**：概率振幅是一个复数，其模的平方等于找到粒子的概率密度。经典电场振幅 $E_0$ 可以被看作是概率振幅的一种“半经典”的模拟。

4.  **QED的核心思想（费曼路径积分）**：一个事件（如光子从A到B）的发生，是所有可能路径的**概率振幅**相干叠加（干涉）的结果。
    - 每条路径贡献一个复数振幅（相量）。
    - 振幅的**相位**由路径的光程/飞行时间决定。
    - 最终的概率由所有振幅叠加后的**总振幅**的模平方决定。

5.  **经典定律的量子起源**：经典光学定律（如反射定律、折射定律）在QED看来，并非是光子必须遵守的刚性规则，而是所有可能路径干涉叠加后**概率最大**的那个结果。

6.  **动量守恒推导斯涅尔定律**：通过假设光子在穿越介质界面时**平行于界面的动量分量守恒**，并使用光子的量子动量公式 $p=h/\lambda$，可以完美推导出斯涅尔定律，深刻体现了光的波粒二象性。

---

### 专业术语/关键词汇编 (Glossary of Key Terms)
- #散射 ( #Scattering )
- #干涉 ( #Interference )
- #相长干涉 ( #Constructive-Interference )
- #相消干涉 ( #Destructive-Interference )
- #能量守恒原理 ( #Principle-of-Conservation-of-Energy )
- #概率密度 ( #Probability-Density )
- #概率振幅 ( #Probability-Amplitude )
- #半经典 ( #Semiclassical )
- #魅影场 ( #Phantom-Field )
- #复数 ( #Complex-Number )
- #量子电动力学 ( #Quantum-Electrodynamics )
- #相量 ( #Phasor )
- #光程 ( #Optical-Path-Length )
- #普朗克常数 ( #Reduced-Planck-Constant )
- #波矢量 ( #Wave-Vector )
- #斯涅尔定律 ( #Snells-Law )