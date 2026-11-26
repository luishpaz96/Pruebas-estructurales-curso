#include "AcademiaAudio.h"

#include "Sound/SoundWaveProcedural.h"
#include "Components/AudioComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"

namespace
{
	// Generador de notas simple: onda senoidal con armónicos y envolvente ADSR corta
	struct FSynth
	{
		TArray<float> Buf;
		int32 Rate;
		explicit FSynth(int32 InRate, float Seconds) : Rate(InRate) { Buf.SetNumZeroed(FMath::CeilToInt(Seconds * InRate)); }

		static float MidiToHz(float Note) { return 440.f * FMath::Pow(2.f, (Note - 69.f) / 12.f); }

		void Note(float StartSec, float DurSec, float Hz, float Amp, float Attack = 0.01f, float Release = 0.08f, float Bright = 0.3f, float SlideHz = 0.f)
		{
			const int32 S0 = FMath::FloorToInt(StartSec * Rate);
			const int32 N = FMath::FloorToInt((DurSec + Release) * Rate);
			float Phase = 0.f;
			for (int32 i = 0; i < N && S0 + i < Buf.Num(); ++i)
			{
				const float T = float(i) / Rate;
				float Env = T < Attack ? T / Attack : 1.f;
				if (T > DurSec) Env *= FMath::Max(0.f, 1.f - (T - DurSec) / Release);
				const float F = Hz + SlideHz * (T / FMath::Max(DurSec, 0.001f));
				Phase += 2.f * PI * F / Rate;
				const float V = FMath::Sin(Phase) + Bright * FMath::Sin(2.f * Phase) * 0.5f + Bright * 0.25f * FMath::Sin(3.f * Phase);
				if (S0 + i >= 0) Buf[S0 + i] += V * Amp * Env;
			}
		}

		void Noise(float StartSec, float DurSec, float Amp)
		{
			const int32 S0 = FMath::FloorToInt(StartSec * Rate);
			const int32 N = FMath::FloorToInt(DurSec * Rate);
			float Lp = 0.f;
			for (int32 i = 0; i < N && S0 + i < Buf.Num(); ++i)
			{
				Lp = Lp * 0.85f + FMath::FRandRange(-1.f, 1.f) * 0.15f;
				Buf[S0 + i] += Lp * Amp * (1.f - float(i) / N);
			}
		}

		TArray<uint8> ToPCM16() const
		{
			TArray<uint8> Out;
			Out.SetNumUninitialized(Buf.Num() * 2);
			int16* P = reinterpret_cast<int16*>(Out.GetData());
			for (int32 i = 0; i < Buf.Num(); ++i)
				P[i] = (int16)FMath::Clamp(FMath::RoundToInt(FMath::Clamp(Buf[i], -1.f, 1.f) * 32000.f), -32768, 32767);
			return Out;
		}
	};
}

void UAcademiaAudio::Init(UWorld* InWorld)
{
	World = InWorld;
	BuildMusicLoop();
}

TArray<uint8> UAcademiaAudio::Render(EAcademiaSfx Sfx) const
{
	FSynth S(SampleRate, 1.6f);
	switch (Sfx)
	{
	case EAcademiaSfx::Click:   S.Note(0, 0.03f, 1200, 0.25f, 0.002f, 0.03f, 0.f); break;
	case EAcademiaSfx::Ok:      S.Note(0, 0.08f, 880, 0.35f); S.Note(0.09f, 0.14f, 1318.5f, 0.35f); break;
	case EAcademiaSfx::Bad:     S.Note(0, 0.18f, 220, 0.35f, 0.01f, 0.1f, 0.6f, -60.f); S.Note(0.2f, 0.25f, 165, 0.3f, 0.01f, 0.1f, 0.6f, -40.f); break;
	case EAcademiaSfx::Level:   { const float N[] = { 72, 76, 79, 84 }; for (int32 i = 0; i < 4; ++i) S.Note(i * 0.11f, 0.2f, FSynth::MidiToHz(N[i]), 0.3f); S.Note(0.45f, 0.6f, FSynth::MidiToHz(88), 0.25f, 0.01f, 0.4f); } break;
	case EAcademiaSfx::Badge:   S.Note(0, 0.12f, FSynth::MidiToHz(79), 0.3f); S.Note(0.12f, 0.12f, FSynth::MidiToHz(83), 0.3f); S.Note(0.24f, 0.5f, FSynth::MidiToHz(86), 0.3f, 0.01f, 0.4f); break;
	case EAcademiaSfx::Toast:   S.Note(0, 0.05f, 1567.98f, 0.15f, 0.003f, 0.12f, 0.f); break;
	case EAcademiaSfx::Beep:    S.Note(0, 0.12f, 2000, 0.2f, 0.002f, 0.02f, 0.f); break;
	case EAcademiaSfx::Alarm:   for (int32 i = 0; i < 4; ++i) { S.Note(i * 0.3f, 0.14f, 950, 0.3f, 0.005f, 0.02f, 0.2f); S.Note(i * 0.3f + 0.15f, 0.14f, 700, 0.3f, 0.005f, 0.02f, 0.2f); } break;
	case EAcademiaSfx::Conveyor: S.Noise(0, 1.2f, 0.25f); S.Note(0, 1.2f, 55, 0.15f, 0.2f, 0.2f, 0.8f); break;
	case EAcademiaSfx::Xray:    S.Note(0, 1.2f, 60, 0.2f, 0.3f, 0.3f, 0.9f); S.Note(0, 1.2f, 7800, 0.03f, 0.3f, 0.3f, 0.f); break;
	case EAcademiaSfx::MissionStart: S.Note(0, 0.15f, FSynth::MidiToHz(67), 0.3f); S.Note(0.16f, 0.15f, FSynth::MidiToHz(72), 0.3f); S.Note(0.32f, 0.4f, FSynth::MidiToHz(74), 0.3f, 0.01f, 0.3f); break;
	case EAcademiaSfx::MissionDone: { const float N[] = { 72, 76, 79, 76, 79, 84 }; for (int32 i = 0; i < 6; ++i) S.Note(i * 0.12f, 0.18f, FSynth::MidiToHz(N[i]), 0.28f); } break;
	}
	return S.ToPCM16();
}

void UAcademiaAudio::Play(EAcademiaSfx Sfx)
{
	UWorld* W = World.Get();
	if (!bSound || !W) return;
	const TArray<uint8> PCM = Render(Sfx);
	USoundWaveProcedural* Wave = NewObject<USoundWaveProcedural>(this);
	Wave->SetSampleRate(SampleRate);
	Wave->NumChannels = 1;
	Wave->Duration = float(PCM.Num() / 2) / SampleRate;
	Wave->SoundGroup = SOUNDGROUP_Default;
	Wave->bLooping = false;
	Wave->QueueAudio(PCM.GetData(), PCM.Num());
	UGameplayStatics::PlaySound2D(W, Wave, 0.8f);
}

void UAcademiaAudio::BuildMusicLoop()
{
	// Pista ambiental tranquila de fábrica: 8 compases a 96 BPM, progresión Am - F - C - G con arpegio y bajo.
	const float Beat = 60.f / 96.f;
	const int32 Bars = 8;
	FSynth S(SampleRate, Bars * 4 * Beat);
	const int32 Chords[4][3] = { { 57, 60, 64 }, { 53, 57, 60 }, { 48, 52, 55 }, { 55, 59, 62 } };
	for (int32 Bar = 0; Bar < Bars; ++Bar)
	{
		const int32* C = Chords[Bar % 4];
		const float T0 = Bar * 4 * Beat;
		// Colchón (pad)
		for (int32 k = 0; k < 3; ++k) S.Note(T0, 4 * Beat - 0.05f, FSynth::MidiToHz(C[k]), 0.045f, 0.6f, 0.5f, 0.1f);
		// Bajo
		S.Note(T0, 1.8f * Beat, FSynth::MidiToHz(C[0] - 12), 0.12f, 0.02f, 0.2f, 0.5f);
		S.Note(T0 + 2 * Beat, 1.8f * Beat, FSynth::MidiToHz(C[0] - 12), 0.1f, 0.02f, 0.2f, 0.5f);
		// Arpegio en corcheas
		for (int32 i = 0; i < 8; ++i)
		{
			const int32 Note = C[i % 3] + ((i / 3) % 2 ? 12 : 0) + 12;
			S.Note(T0 + i * Beat / 2, Beat / 2 * 0.6f, FSynth::MidiToHz(Note), Bar >= 4 ? 0.06f : 0.04f, 0.005f, 0.15f, 0.2f);
		}
		// Hi-hat suave en tiempos 2 y 4
		S.Noise(T0 + Beat, 0.05f, 0.05f);
		S.Noise(T0 + 3 * Beat, 0.05f, 0.05f);
	}
	MusicLoop = S.ToPCM16();
}

void UAcademiaAudio::OnMusicUnderflow(USoundWaveProcedural* Wave, int32 SamplesRequired)
{
	// Se llama en el hilo de audio: sólo encolamos el bloque ya generado.
	if (Wave && MusicLoop.Num() > 0) Wave->QueueAudio(MusicLoop.GetData(), MusicLoop.Num());
}

void UAcademiaAudio::SetMusic(bool bOn, float Volume)
{
	UWorld* W = World.Get();
	if (!bOn || !W)
	{
		if (MusicComp) { MusicComp->Stop(); MusicComp = nullptr; }
		return;
	}
	if (!MusicComp)
	{
		MusicWave = NewObject<USoundWaveProcedural>(this);
		MusicWave->SetSampleRate(SampleRate);
		MusicWave->NumChannels = 1;
		MusicWave->Duration = INDEFINITELY_LOOPING_DURATION;
		MusicWave->SoundGroup = SOUNDGROUP_Music;
		MusicWave->bLooping = false;
		MusicWave->OnSoundWaveProceduralUnderflow.BindUObject(this, &UAcademiaAudio::OnMusicUnderflow);
		MusicWave->QueueAudio(MusicLoop.GetData(), MusicLoop.Num());
		MusicComp = UGameplayStatics::CreateSound2D(W, MusicWave, Volume, 1.f, 0.f, nullptr, true, false);
		if (MusicComp) MusicComp->Play();
	}
	if (MusicComp) MusicComp->SetVolumeMultiplier(Volume);
}

void UAcademiaAudio::Shutdown()
{
	if (MusicComp) MusicComp->Stop();
	MusicComp = nullptr;
	if (MusicWave) MusicWave->OnSoundWaveProceduralUnderflow.Unbind();
}
